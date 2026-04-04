use crate::commands::list_table_columns::fetch_enum_values;
use crate::error::CommandError;
use crate::pg::models::{PgColumn, PgTableForGraph};
use crate::pg::pg_connect::pg_connect;
use std::collections::HashMap;

#[tauri::command]
pub async fn list_tables_for_graph(
    connection_string: String,
    schema: Option<String>,
    hide_system_tables: bool,
    hide_views: bool,
) -> Result<Vec<PgTableForGraph>, CommandError> {
    let (client, connection) = pg_connect(&connection_string).await?;

    tokio::spawn(async move {
        if let Err(e) = connection.await_connection().await {
            eprintln!("DB connection error: {e}");
        }
    });

    let system_schemas_filter = if hide_system_tables {
        "t.table_schema NOT IN ('pg_catalog', 'information_schema')
        AND t.table_schema NOT LIKE 'pg_toast%'
        AND t.table_schema NOT LIKE 'pg_temp%'"
    } else {
        "true"
    };

    let views_filter = if hide_views {
        "t.table_type = 'BASE TABLE'"
    } else {
        "true"
    };

    let query = format!(
        r#"
        SELECT 
            t.table_schema as schema,
            t.table_name as name,
            t.table_type as type,

            c.column_name,
            pt.typname AS data_type,
            substring(format_type(a.atttypid, a.atttypmod) from '\(.*\)') AS data_type_params,
            c.is_nullable,
            c.column_default,

            CASE WHEN pk.column_name IS NOT NULL THEN 'YES' ELSE 'NO' END AS is_primary_key,

            fk.foreign_table_schema,
            fk.foreign_table_name,
            fk.foreign_column_name,

            pt.typtype AS type_category,

            c.ordinal_position

        FROM information_schema.tables t

        LEFT JOIN information_schema.columns c
            ON c.table_schema = t.table_schema
            AND c.table_name = t.table_name

        LEFT JOIN pg_namespace n
            ON n.nspname = c.table_schema

        LEFT JOIN pg_class cls
            ON cls.relname = c.table_name
            AND cls.relnamespace = n.oid

        LEFT JOIN pg_attribute a
            ON a.attrelid = cls.oid
            AND a.attname = c.column_name

        LEFT JOIN pg_type pt
            ON pt.oid = a.atttypid

        LEFT JOIN (
            SELECT kcu.table_schema, kcu.table_name, kcu.column_name
            FROM information_schema.key_column_usage kcu
            JOIN information_schema.table_constraints tc
                ON tc.constraint_name = kcu.constraint_name
                AND tc.table_schema = kcu.table_schema
                AND tc.constraint_type = 'PRIMARY KEY'
        ) pk
            ON pk.table_schema = c.table_schema
            AND pk.table_name = c.table_name
            AND pk.column_name = c.column_name

        LEFT JOIN (
            SELECT
                src_ns.nspname       AS table_schema,
                src_cls.relname      AS table_name,
                src_attr.attname     AS column_name,
                tgt_ns.nspname       AS foreign_table_schema,
                tgt_cls.relname      AS foreign_table_name,
                tgt_attr.attname     AS foreign_column_name
            FROM pg_catalog.pg_constraint AS con
            INNER JOIN pg_catalog.pg_class AS src_cls
                ON src_cls.oid = con.conrelid
            INNER JOIN pg_catalog.pg_namespace AS src_ns
                ON src_ns.oid = src_cls.relnamespace
            INNER JOIN pg_catalog.pg_class AS tgt_cls
                ON tgt_cls.oid = con.confrelid
            INNER JOIN pg_catalog.pg_namespace AS tgt_ns
                ON tgt_ns.oid = tgt_cls.relnamespace
            INNER JOIN pg_catalog.pg_attribute AS src_attr
                ON src_attr.attrelid = con.conrelid
                AND src_attr.attnum = ANY(con.conkey)
            INNER JOIN pg_catalog.pg_attribute AS tgt_attr
                ON tgt_attr.attrelid = con.confrelid
                AND tgt_attr.attnum = ANY(con.confkey)
            WHERE con.contype = 'f'
        ) fk
            ON fk.table_schema = c.table_schema
            AND fk.table_name = c.table_name
            AND fk.column_name = c.column_name

        WHERE {}
        AND {}
        AND ($1::text IS NULL OR t.table_schema = $1)

        ORDER BY
            t.table_schema,
            t.table_name,
            c.ordinal_position;
        "#,
        system_schemas_filter,
        views_filter
    );

    let rows = client.query(&query, &[&schema]).await.map_err(CommandError::from)?;

    let mut tables: HashMap<(String, String), PgTableForGraph> = HashMap::new();

    for row in rows.iter() {
        let schema: String = row.get("schema");
        let table_name: String = row.get("name");
        let table_type: String = row.get("type");

        let key = (schema.clone(), table_name.clone());

        let table = tables.entry(key).or_insert_with(|| PgTableForGraph {
            schema: schema.clone(),
            name: table_name.clone(),
            table_type,
            columns: Vec::new(),
        });

        let column_name: Option<String> = row.get("column_name");

        if let Some(column_name) = column_name {
            let data_type: String = row.get("data_type");
            let type_category: i8 = row.get("type_category");

            let enum_values = if type_category == b'e' as i8 {
                fetch_enum_values(&client, &data_type).await.ok()
            } else {
                None
            };

            table.columns.push(PgColumn {
                column_name,
                data_type,
                data_type_params: row.get("data_type_params"),
                is_nullable: row.get("is_nullable"),
                column_default: row.get("column_default"),
                is_primary_key: row.get("is_primary_key"),
                foreign_table_schema: row.get("foreign_table_schema"),
                foreign_table_name: row.get("foreign_table_name"),
                foreign_column_name: row.get("foreign_column_name"),
                enum_values,
            });
        }
    }

    Ok(tables.into_values().collect())
}
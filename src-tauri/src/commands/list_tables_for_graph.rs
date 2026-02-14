use crate::commands::list_table_columns::fetch_enum_values;
use crate::error::PgError;
use crate::models::{PgColumn, PgTableForGraph};
use crate::utils::create_secure_client;
use std::collections::HashMap;

#[tauri::command]
pub async fn list_tables_for_graph(
    connection_string: String,
) -> Result<Vec<PgTableForGraph>, PgError> {
    let conn = connection_string.clone();

    tokio::task::spawn_blocking(move || {
        let mut client = create_secure_client(&conn)?;

        let query = r#"
        SELECT 
            t.table_schema,
            t.table_name,
            t.table_type,

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
                kcu.table_schema,
                kcu.table_name,
                kcu.column_name,
                ccu.table_schema AS foreign_table_schema,
                ccu.table_name AS foreign_table_name,
                ccu.column_name AS foreign_column_name
            FROM information_schema.key_column_usage kcu
            JOIN information_schema.table_constraints tc
                ON tc.constraint_name = kcu.constraint_name
                AND tc.table_schema = kcu.table_schema
                AND tc.constraint_type = 'FOREIGN KEY'
            JOIN information_schema.constraint_column_usage ccu
                ON ccu.constraint_name = tc.constraint_name
                AND ccu.constraint_schema = tc.constraint_schema
        ) fk
            ON fk.table_schema = c.table_schema
            AND fk.table_name = c.table_name
            AND fk.column_name = c.column_name

        WHERE t.table_schema NOT IN ('pg_catalog', 'information_schema')

        ORDER BY
            t.table_schema,
            t.table_name,
            c.ordinal_position;
        "#;

        let rows = client.query(query, &[])?;

        let mut tables: HashMap<(String, String), PgTableForGraph> = HashMap::new();

        for row in rows {
            let schema: String = row.get("table_schema");
            let table_name: String = row.get("table_name");
            let table_type: String = row.get("table_type");

            let key = (schema.clone(), table_name.clone());

            let table = tables.entry(key).or_insert_with(|| PgTableForGraph {
                schema: schema.clone(),
                name: table_name.clone(),
                table_type,
                columns: Vec::new(),
            });

            // Skip if no column (can happen for some table types)
            let column_name: Option<String> = row.get("column_name");

            if let Some(column_name) = column_name {
                let data_type: String = row.get("data_type");
                let type_category: i8 = row.get("type_category");

                let enum_values = if type_category == b'e' as i8 {
                    fetch_enum_values(&mut client, &data_type).ok()
                } else {
                    None
                };

                let column = PgColumn {
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
                };

                table.columns.push(column);
            }
        }

        Ok(tables.into_values().collect())
    })
    .await?
}

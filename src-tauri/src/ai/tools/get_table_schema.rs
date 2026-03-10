use serde_json::{json, Value};

use crate::{ai::tool_registry::ToolRegistry, pg::pg_connect::SharedDb};

pub fn register(registry: &mut ToolRegistry, db: SharedDb) {
    registry.add_tool(
        "get_table_schema",
        "Get the full column schema for a specific table, including data types, \
         nullability, primary keys, foreign keys, and enum values.",
        json!({
            "type": "object",
            "properties": {
                "schema": { "type": "string", "description": "The schema name, e.g. 'public'" },
                "table":  { "type": "string", "description": "The table name, e.g. 'users'" }
            },
            "required": ["schema", "table"]
        }),
        move |args| {
            let db = db.clone();
            async move {
                let schema = args["schema"].as_str().unwrap_or("public").to_string();
                let table  = args["table"].as_str().unwrap_or("").to_string();
                let client = db.lock().await;

                let query = r#"
                    SELECT
                        c.column_name,
                        t.typname AS data_type,
                        substring(format_type(a.atttypid, a.atttypmod) from '\(.*\)') AS data_type_params,
                        c.is_nullable,
                        c.column_default,
                        CASE WHEN pk.column_name IS NOT NULL THEN 'YES' ELSE 'NO' END AS is_primary_key,
                        fk.foreign_table_schema,
                        fk.foreign_table_name,
                        fk.foreign_column_name,
                        t.typtype AS type_category
                    FROM information_schema.columns AS c
                    INNER JOIN pg_catalog.pg_namespace AS n
                        ON n.nspname = c.table_schema
                    INNER JOIN pg_catalog.pg_class AS cls
                        ON cls.relnamespace = n.oid AND cls.relname = c.table_name
                    INNER JOIN pg_catalog.pg_attribute AS a
                        ON a.attrelid = cls.oid AND a.attname = c.column_name
                    INNER JOIN pg_catalog.pg_type AS t
                        ON a.atttypid = t.oid
                    LEFT JOIN (
                        SELECT kcu.table_schema, kcu.table_name, kcu.column_name
                        FROM information_schema.key_column_usage AS kcu
                        INNER JOIN information_schema.table_constraints AS tc
                            ON kcu.constraint_name = tc.constraint_name
                            AND kcu.table_schema = tc.table_schema
                            AND tc.constraint_type = 'PRIMARY KEY'
                    ) AS pk
                        ON c.table_schema = pk.table_schema
                        AND c.table_name = pk.table_name
                        AND c.column_name = pk.column_name
                    LEFT JOIN (
                        SELECT
                            kcu.table_schema, kcu.table_name, kcu.column_name,
                            ccu.table_schema AS foreign_table_schema,
                            ccu.table_name AS foreign_table_name,
                            ccu.column_name AS foreign_column_name
                        FROM information_schema.key_column_usage AS kcu
                        INNER JOIN information_schema.table_constraints AS tc
                            ON kcu.constraint_name = tc.constraint_name
                            AND kcu.table_schema = tc.table_schema
                            AND tc.constraint_type = 'FOREIGN KEY'
                        INNER JOIN information_schema.constraint_column_usage AS ccu
                            ON kcu.constraint_name = ccu.constraint_name
                            AND kcu.table_schema = ccu.constraint_schema
                    ) AS fk
                        ON c.table_schema = fk.table_schema
                        AND c.table_name = fk.table_name
                        AND c.column_name = fk.column_name
                    WHERE c.table_schema = $1 AND c.table_name = $2
                    ORDER BY c.ordinal_position
                "#;

                match client.query(query, &[&schema, &table]).await {
                    Err(e) => format!("DB error: {e}"),
                    Ok(rows) => {
                        let columns: Vec<Value> = rows.iter().map(|row| {
                            let type_category: i8 = row.get("type_category");
                            let data_type: &str   = row.get("data_type");
                            json!({
                                "column_name":          row.get::<_, &str>("column_name"),
                                "data_type":            data_type,
                                "data_type_params":     row.get::<_, Option<&str>>("data_type_params"),
                                "is_nullable":          row.get::<_, &str>("is_nullable"),
                                "column_default":       row.get::<_, Option<&str>>("column_default"),
                                "is_primary_key":       row.get::<_, &str>("is_primary_key"),
                                "foreign_table_schema": row.get::<_, Option<&str>>("foreign_table_schema"),
                                "foreign_table_name":   row.get::<_, Option<&str>>("foreign_table_name"),
                                "foreign_column_name":  row.get::<_, Option<&str>>("foreign_column_name"),
                                "is_enum":              type_category == b'e' as i8,
                            })
                        }).collect();

                        let mut enriched = Vec::with_capacity(columns.len());
                        for col in columns {
                            let mut col = col;
                            if col["is_enum"].as_bool().unwrap_or(false) {
                                let type_name = col["data_type"].as_str().unwrap_or("").to_string();
                                let enum_rows = client.query(
                                    "SELECT e.enumlabel \
                                     FROM pg_catalog.pg_type t \
                                     JOIN pg_catalog.pg_enum e ON t.oid = e.enumtypid \
                                     WHERE t.typname = $1 \
                                     ORDER BY e.enumsortorder",
                                    &[&type_name],
                                ).await;
                                if let Ok(erows) = enum_rows {
                                    let values: Vec<&str> = erows.iter()
                                        .map(|r| r.get("enumlabel"))
                                        .collect();
                                    col["enum_values"] = json!(values);
                                }
                            }
                            enriched.push(col);
                        }
                        json!(enriched).to_string()
                    }
                }
            }
        },
    );
}
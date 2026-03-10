use serde_json::{json, Value};
use std::collections::HashMap;

use crate::{ai::tool_registry::ToolRegistry, pg::pg_connect::SharedDb};

pub fn register(registry: &mut ToolRegistry, db: SharedDb) {
    registry.add_tool(
        "get_table_schema",
        "Get the full column schema for one or more tables, including data types, \
         nullability, primary keys, foreign keys, and enum values. \
         All tables are fetched in a single query.",
        json!({
            "type": "object",
            "properties": {
                "tables": {
                    "type": "array",
                    "description": "List of tables to inspect.",
                    "items": {
                        "type": "object",
                        "properties": {
                            "schema": { "type": "string", "description": "Schema name, e.g. 'public'" },
                            "table":  { "type": "string", "description": "Table name, e.g. 'users'" }
                        },
                        "required": ["schema", "table"]
                    }
                }
            },
            "required": ["tables"]
        }),
        move |args| {
            let db = db.clone();
            async move {
                let pairs: Vec<(String, String)> = args["tables"]
                    .as_array()
                    .map(|arr| {
                        arr.iter()
                            .filter_map(|v| {
                                let schema = v["schema"].as_str()?.to_string();
                                let table  = v["table"].as_str()?.to_string();
                                Some((schema, table))
                            })
                            .collect()
                    })
                    .unwrap_or_default();

                if pairs.is_empty() {
                    return json!([]).to_string();
                }

                let schemas: Vec<&str> = pairs.iter().map(|(s, _)| s.as_str()).collect();
                let tables:  Vec<&str> = pairs.iter().map(|(_, t)| t.as_str()).collect();

                let client = db.lock().await;

                let query = r#"
                    SELECT
                        c.table_schema,
                        c.table_name,
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
                    FROM
                        UNNEST($1::text[], $2::text[]) AS inp(schema_name, table_name)
                    INNER JOIN information_schema.columns AS c
                        ON c.table_schema = inp.schema_name AND c.table_name = inp.table_name
                    INNER JOIN pg_catalog.pg_namespace AS n ON n.nspname = c.table_schema
                    INNER JOIN pg_catalog.pg_class     AS cls
                        ON cls.relnamespace = n.oid AND cls.relname = c.table_name
                    INNER JOIN pg_catalog.pg_attribute AS a
                        ON a.attrelid = cls.oid AND a.attname = c.column_name
                    INNER JOIN pg_catalog.pg_type AS t ON a.atttypid = t.oid
                    LEFT JOIN (
                        SELECT kcu.table_schema, kcu.table_name, kcu.column_name
                        FROM information_schema.key_column_usage AS kcu
                        INNER JOIN information_schema.table_constraints AS tc
                            ON  kcu.constraint_name = tc.constraint_name
                            AND kcu.table_schema    = tc.table_schema
                            AND tc.constraint_type  = 'PRIMARY KEY'
                    ) AS pk
                        ON  c.table_schema = pk.table_schema
                        AND c.table_name   = pk.table_name
                        AND c.column_name  = pk.column_name
                    LEFT JOIN (
                        SELECT
                            kcu.table_schema, kcu.table_name, kcu.column_name,
                            ccu.table_schema AS foreign_table_schema,
                            ccu.table_name   AS foreign_table_name,
                            ccu.column_name  AS foreign_column_name
                        FROM information_schema.key_column_usage AS kcu
                        INNER JOIN information_schema.table_constraints AS tc
                            ON  kcu.constraint_name = tc.constraint_name
                            AND kcu.table_schema    = tc.table_schema
                            AND tc.constraint_type  = 'FOREIGN KEY'
                        INNER JOIN information_schema.constraint_column_usage AS ccu
                            ON  kcu.constraint_name = ccu.constraint_name
                            AND kcu.table_schema    = ccu.constraint_schema
                    ) AS fk
                        ON  c.table_schema = fk.table_schema
                        AND c.table_name   = fk.table_name
                        AND c.column_name  = fk.column_name
                    ORDER BY c.table_schema, c.table_name, c.ordinal_position
                "#;

                let rows = match client.query(query, &[&schemas, &tables]).await {
                    Err(e) => return format!("DB error: {e}"),
                    Ok(r)  => r,
                };

                // Build columns and collect enum type names in one pass
                let mut columns: Vec<Value> = Vec::with_capacity(rows.len());
                let mut enum_types: Vec<String> = Vec::new();

                for row in &rows {
                    let type_category: i8 = row.get("type_category");
                    let data_type: &str   = row.get("data_type");
                    let is_enum = type_category == b'e' as i8;

                    if is_enum && !enum_types.contains(&data_type.to_string()) {
                        enum_types.push(data_type.to_string());
                    }

                    columns.push(json!({
                        "table_schema":         row.get::<_, &str>("table_schema"),
                        "table_name":           row.get::<_, &str>("table_name"),
                        "column_name":          row.get::<_, &str>("column_name"),
                        "data_type":            data_type,
                        "data_type_params":     row.get::<_, Option<&str>>("data_type_params"),
                        "is_nullable":          row.get::<_, &str>("is_nullable"),
                        "column_default":       row.get::<_, Option<&str>>("column_default"),
                        "is_primary_key":       row.get::<_, &str>("is_primary_key"),
                        "foreign_table_schema": row.get::<_, Option<&str>>("foreign_table_schema"),
                        "foreign_table_name":   row.get::<_, Option<&str>>("foreign_table_name"),
                        "foreign_column_name":  row.get::<_, Option<&str>>("foreign_column_name"),
                        "is_enum":              is_enum,
                    }));
                }

                // Single query for ALL enum types at once, build a lookup map
                let enum_map: HashMap<String, Vec<String>> = if !enum_types.is_empty() {
                    let enum_type_refs: Vec<&str> = enum_types.iter().map(String::as_str).collect();
                    match client.query(
                        "SELECT t.typname, e.enumlabel
                         FROM pg_catalog.pg_type t
                         JOIN pg_catalog.pg_enum e ON t.oid = e.enumtypid
                         WHERE t.typname = ANY($1::text[])
                         ORDER BY t.typname, e.enumsortorder",
                        &[&enum_type_refs],
                    ).await {
                        Err(_) => HashMap::new(),
                        Ok(erows) => {
                            let mut map: HashMap<String, Vec<String>> = HashMap::new();
                            for er in &erows {
                                let type_name: &str  = er.get("typname");
                                let label: &str      = er.get("enumlabel");
                                map.entry(type_name.to_string()).or_default().push(label.to_string());
                            }
                            map
                        }
                    }
                } else {
                    HashMap::new()
                };

                // Stitch enum values into columns
                for col in &mut columns {
                    if col["is_enum"].as_bool().unwrap_or(false) {
                        let type_name = col["data_type"].as_str().unwrap_or("");
                        if let Some(values) = enum_map.get(type_name) {
                            col["enum_values"] = json!(values);
                        }
                    }
                }

                // Group by table for a clean response shape
                let mut grouped: HashMap<String, Value> = HashMap::new();
                for col in columns {
                    let key = format!(
                        "{}.{}",
                        col["table_schema"].as_str().unwrap_or(""),
                        col["table_name"].as_str().unwrap_or("")
                    );
                    grouped
                        .entry(key.clone())
                        .or_insert_with(|| json!({
                            "table_schema": col["table_schema"],
                            "table_name":   col["table_name"],
                            "columns":      []
                        }))["columns"]
                        .as_array_mut()
                        .unwrap()
                        .push(col);
                }

                let result: Vec<&Value> = grouped.values().collect();
                json!(result).to_string()
            }
        },
    );
}
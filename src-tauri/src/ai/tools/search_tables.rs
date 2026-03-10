use serde_json::{json, Value};

use crate::{ai::tool_registry::ToolRegistry, pg::pg_connect::SharedDb};

pub fn register(registry: &mut ToolRegistry, db: SharedDb) {
    registry.add_tool(
        "search_tables",
        "Search PostgreSQL tables by pattern (schema.table format). \
         Supports ILIKE wildcards, e.g. 'public.user%'.",
        json!({
            "type": "object",
            "properties": {
                "pattern": {
                    "type": "string",
                    "description": "Search pattern in 'schema.table' format. \
                                    Supports SQL ILIKE wildcards (% and _)."
                }
            },
            "required": ["pattern"]
        }),
        move |args| {
            let db = db.clone();
            async move {
                let pattern = args["pattern"].as_str().unwrap_or("%.%").to_string();
                let (schema_pat, table_pat) = match pattern.split_once('.') {
                    Some((s, t)) => (s.to_string(), t.to_string()),
                    None         => ("%".to_string(), pattern.clone()),
                };
                let client = db.lock().await;
                match client.query(
                    "SELECT table_schema, table_name \
                     FROM information_schema.tables \
                     WHERE table_schema ILIKE $1 AND table_name ILIKE $2 \
                     ORDER BY table_schema, table_name",
                    &[&schema_pat, &table_pat],
                ).await {
                    Err(e) => format!("DB error: {e}"),
                    Ok(rows) => {
                        let tables: Vec<Value> = rows.iter().map(|row| {
                            let schema: &str = row.get(0);
                            let table:  &str = row.get(1);
                            json!({ "schema": schema, "table": table, "qualified": format!("{schema}.{table}") })
                        }).collect();
                        json!(tables).to_string()
                    }
                }
            }
        },
    );
}
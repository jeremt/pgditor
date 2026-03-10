use serde_json::{json, Value};

use crate::{ai::tool_registry::ToolRegistry, pg::pg_connect::SharedDb};

pub fn register(registry: &mut ToolRegistry, db: SharedDb) {
    registry.add_tool(
        "search_tables",
        "Search PostgreSQL tables by one or more patterns (schema.table format). \
         Supports ILIKE wildcards, e.g. ['public.user%', 'audit.%']. \
         All patterns are searched in a single query.",
        json!({
            "type": "object",
            "properties": {
                "patterns": {
                    "type": "array",
                    "items": { "type": "string" },
                    "description": "One or more search patterns in 'schema.table' format. \
                                    Supports SQL ILIKE wildcards (% and _). \
                                    Example: [\"public.user%\", \"audit.%\"]"
                }
            },
            "required": ["patterns"]
        }),
        move |args| {
            let db = db.clone();
            async move {
                let patterns: Vec<String> = args["patterns"]
                    .as_array()
                    .map(|arr| {
                        arr.iter()
                            .filter_map(|v| v.as_str())
                            .map(String::from)
                            .collect()
                    })
                    .unwrap_or_else(|| vec!["%.%".to_string()]);

                // Split each pattern into (schema_pat, table_pat) pairs
                let split: Vec<(String, String)> = patterns
                    .iter()
                    .map(|p| match p.split_once('.') {
                        Some((s, t)) => (s.to_string(), t.to_string()),
                        None         => ("%".to_string(), p.clone()),
                    })
                    .collect();

                let schema_pats: Vec<&str> = split.iter().map(|(s, _)| s.as_str()).collect();
                let table_pats:  Vec<&str> = split.iter().map(|(_, t)| t.as_str()).collect();

                let client = db.lock().await;
                match client.query(
                    "SELECT DISTINCT table_schema, table_name
                     FROM information_schema.tables,
                          UNNEST($1::text[], $2::text[]) AS p(schema_pat, table_pat)
                     WHERE table_schema ILIKE p.schema_pat
                       AND table_name   ILIKE p.table_pat
                     ORDER BY table_schema, table_name",
                    &[&schema_pats, &table_pats],
                ).await {
                    Err(e) => format!("DB error: {e}"),
                    Ok(rows) => {
                        let tables: Vec<Value> = rows.iter().map(|row| {
                            let schema: &str = row.get(0);
                            let table:  &str = row.get(1);
                            json!({
                                "schema": schema,
                                "table": table,
                                "qualified": format!("{schema}.{table}")
                            })
                        }).collect();
                        json!(tables).to_string()
                    }
                }
            }
        },
    );
}
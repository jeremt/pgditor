use serde_json::{json, Value};

use crate::{ai::tool_registry::ToolRegistry, pg::pg_connect::SharedDb};

pub fn register(registry: &mut ToolRegistry, db: SharedDb) {
    registry.add_tool(
        "select_table_rows",
        "Select rows from a single table with optional WHERE filters, LIMIT, and OFFSET. \
         Use get_table_schema first to know the available columns and their types. \
         No joins or aggregations — pure row sampling for query building context.",
        json!({
            "type": "object",
            "properties": {
                "schema": {
                    "type": "string",
                    "description": "Schema name, e.g. 'public'"
                },
                "table": {
                    "type": "string",
                    "description": "Table name, e.g. 'users'"
                },
                "columns": {
                    "type": "array",
                    "description": "Columns to select. Omit or pass empty array to select all (*).",
                    "items": { "type": "string" }
                },
                "where": {
                    "type": "array",
                    "description": "Optional list of AND-ed filter conditions.",
                    "items": {
                        "type": "object",
                        "properties": {
                            "column":   { "type": "string", "description": "Column name to filter on." },
                            "operator": {
                                "type": "string",
                                "description": "Comparison operator.",
                                "enum": ["=", "!=", "<", "<=", ">", ">=", "LIKE", "ILIKE", "IS NULL", "IS NOT NULL"]
                            },
                            "value": {
                                "description": "Value to compare against. Omit for IS NULL / IS NOT NULL."
                            }
                        },
                        "required": ["column", "operator"]
                    }
                },
                "limit": {
                    "type": "integer",
                    "description": "Maximum number of rows to return. Defaults to 5, capped at 500. Increase only when sampling more rows is necessary to understand the data.",
                    "default": 5
                },
                "offset": {
                    "type": "integer",
                    "description": "Number of rows to skip before returning results. Defaults to 0.",
                    "default": 0
                }
            },
            "required": ["schema", "table"]
        }),
        move |args| {
            let db = db.clone();
            async move {
                // ── Validate identifiers ──────────────────────────────────────────────
                let is_safe_ident = |s: &str| {
                    !s.is_empty() && s.chars().all(|c| c.is_alphanumeric() || c == '_')
                };

                let schema = match args["schema"].as_str() {
                    Some(s) if is_safe_ident(s) => s.to_string(),
                    Some(_) => return "Invalid characters in schema name".to_string(),
                    None    => return "Missing required field: schema".to_string(),
                };
                let table = match args["table"].as_str() {
                    Some(t) if is_safe_ident(t) => t.to_string(),
                    Some(_) => return "Invalid characters in table name".to_string(),
                    None    => return "Missing required field: table".to_string(),
                };

                // ── SELECT clause ─────────────────────────────────────────────────────
                let select_clause = match args["columns"].as_array() {
                    Some(cols) if !cols.is_empty() => {
                        let names: Vec<String> = cols
                            .iter()
                            .filter_map(|v| v.as_str())
                            .filter(|c| is_safe_ident(c))
                            .map(|c| format!("\"{}\"", c))
                            .collect();

                        if names.is_empty() { "*".to_string() } else { names.join(", ") }
                    }
                    _ => "*".to_string(),
                };

                // ── WHERE clause ──────────────────────────────────────────────────────
                // Values are collected as strings and passed as $N parameters — they
                // never touch the SQL string, so there is no injection path.
                let allowed_ops = ["=", "!=", "<", "<=", ">", ">=", "LIKE", "ILIKE", "IS NULL", "IS NOT NULL"];

                let mut param_values: Vec<String> = Vec::new();
                let mut where_parts: Vec<String>  = Vec::new();

                if let Some(filters) = args["where"].as_array() {
                    for filter in filters {
                        let column = match filter["column"].as_str() {
                            Some(c) if is_safe_ident(c) => format!("\"{}\"", c),
                            Some(_) => return "Invalid characters in WHERE column name".to_string(),
                            None    => return "WHERE condition missing 'column' field".to_string(),
                        };

                        let operator = match filter["operator"].as_str() {
                            Some(op) if allowed_ops.contains(&op) => op,
                            Some(op) => return format!("Unsupported operator: {op}"),
                            None     => return "WHERE condition missing 'operator' field".to_string(),
                        };

                        if operator == "IS NULL" || operator == "IS NOT NULL" {
                            where_parts.push(format!("{column} {operator}"));
                        } else {
                            let value_str = match &filter["value"] {
                                Value::String(s) => s.clone(),
                                Value::Number(n) => n.to_string(),
                                Value::Bool(b)   => b.to_string(),
                                _                => return format!("Unsupported or missing value for column {column}"),
                            };
                            let idx = param_values.len() + 1;
                            where_parts.push(format!("{column} {operator} ${idx}"));
                            param_values.push(value_str);
                        }
                    }
                }

                let where_sql = if where_parts.is_empty() {
                    String::new()
                } else {
                    format!("WHERE {}", where_parts.join(" AND "))
                };

                // ── LIMIT / OFFSET ────────────────────────────────────────────────────
                // Validated i64 values inlined directly — no user string reaches the SQL.
                let limit = args["limit"].as_u64().unwrap_or(5).min(500) as i64;
                let offset = args["offset"].as_u64().unwrap_or(0) as i64;

                // ── Final SQL ─────────────────────────────────────────────────────────
                // Identifiers: allowlist-validated, double-quoted.
                // Values:      $N parameterised.
                // LIMIT/OFFSET: validated integers, inlined as literals.
                let sql = format!(
                    r#"SELECT {select_clause} FROM "{schema}"."{table}" {where_sql} LIMIT {limit} OFFSET {offset}"#
                );

                // ── Execute ───────────────────────────────────────────────────────────
                let client = db.lock().await;

                let param_refs: Vec<&(dyn tokio_postgres::types::ToSql + Sync)> = param_values
                    .iter()
                    .map(|s| s as &(dyn tokio_postgres::types::ToSql + Sync))
                    .collect();

                let rows = match client.query(&sql as &str, &param_refs).await {
                    Err(e) => return format!("DB error: {e}"),
                    Ok(r)  => r,
                };

                // ── Serialise ─────────────────────────────────────────────────────────
                let result: Vec<Value> = rows
                    .iter()
                    .map(|row| {
                        let mut obj = serde_json::Map::new();
                        for (i, col) in row.columns().iter().enumerate() {
                            let val: Value = row.try_get::<_, Option<&str>>(i)
                                .ok().flatten().map(|s| json!(s))
                                .or_else(|| row.try_get::<_, Option<i64>>(i).ok().flatten().map(|n| json!(n)))
                                .or_else(|| row.try_get::<_, Option<f64>>(i).ok().flatten().map(|f| json!(f)))
                                .or_else(|| row.try_get::<_, Option<bool>>(i).ok().flatten().map(|b| json!(b)))
                                .or_else(|| row.try_get::<_, Option<uuid::Uuid>>(i).ok().flatten().map(|u| json!(u.to_string())))
                                .or_else(|| row.try_get::<_, Option<serde_json::Value>>(i).ok().flatten())
                                .or_else(|| row.try_get::<_, Option<chrono::DateTime<chrono::Utc>>>(i).ok().flatten().map(|t| json!(t.to_string())))
                                .or_else(|| row.try_get::<_, Option<chrono::NaiveDate>>(i).ok().flatten().map(|d| json!(d.to_string())))
                                .unwrap_or(Value::Null);
                            obj.insert(col.name().to_string(), val);
                        }
                        Value::Object(obj)
                    })
                    .collect();

                json!({
                    "schema": schema,
                    "table":  table,
                    "count":  result.len(),
                    "rows":   result
                })
                .to_string()
            }
        },
    );
}
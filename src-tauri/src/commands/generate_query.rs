use futures::lock::Mutex;
use reqwest::Client;
use serde_json::json;
use std::sync::Arc;
use tauri::{AppHandle, Emitter};

use crate::ai::tool_registry::ToolRegistry;
use crate::ai::tools;
use crate::pg::pg_connect::{SharedDb, pg_connect};
use crate::ai::stream::run_agentic_loop;

const SYSTEM_PROMPT: &str = r#"
You generate PostgreSQL queries.

You do NOT know the database schema. Use tools to discover it.

TOOLS
- search_tables: find tables related to a request
- get_table_schema: retrieve schema for a table

PROCESS
1. If relevant tables are unknown, call search_tables.
2. Retrieve schema using get_table_schema for any table used.
3. After schema is known, generate the SQL query.

RULES
- never guess tables or columns
- inspect schema before writing SQL
- use full table names (public.table)
- avoid aliases
- use lowercase sql
- use whitespaces to make the query readable
- use sql comments ONLY if something is worth clarifying

OUTPUT
If SQL can be produced:
SQL_QUERY: <query>

If schema is still needed:
call the appropriate tool.

If a query cannot be generated:
return a short explanation.
"#;

#[tauri::command]
pub async fn generate_query(
    app:               AppHandle,
    connection_string: String,
    api_key:           String,
    model:             String,
    prompt:            String,
) -> Result<(), String> {
    let http = Client::new();

    let (pg_client, connection) = pg_connect(&connection_string)
        .await
        .map_err(|e| e.message)?;

    tokio::spawn(async move {
        if let Err(e) = connection.await_connection().await {
            eprintln!("DB connection error: {e}");
        }
    });

    let db: SharedDb = Arc::new(Mutex::new(pg_client));
    let mut registry = ToolRegistry::new();

    tools::get_table_schema::register(&mut registry, db.clone());
    tools::search_tables::register(&mut registry, db.clone());

    let mut input = vec![
        json!({ "role": "system", "content": SYSTEM_PROMPT }),
        json!({ "role": "user",   "content": prompt }),
    ];

    run_agentic_loop(&http, &api_key, &model, &mut input, &registry, &mut |event| {
        app.emit("generate-query", event).ok();
    }).await
}
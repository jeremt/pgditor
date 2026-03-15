use futures::lock::Mutex;
use reqwest::Client;
use serde_json::json;
use std::sync::Arc;
use tauri::{AppHandle, Emitter};

use crate::ai::tool_registry::ToolRegistry;
use crate::ai::tools;
use crate::pg::pg_connect::{SharedDb, pg_connect};
use crate::ai::stream::{ReasoningEffort, run_agentic_loop};

const SYSTEM_PROMPT: &str = r#"
You generate PostgreSQL queries.

You do NOT know the database schema. Use tools to discover it.

TOOLS
- search_tables: find tables related to a request
- get_table_schema: retrieve column names, types, nullability, primary keys, foreign keys, and enum values for one or more tables
- select_table_rows: sample rows from a single table (supports WHERE, LIMIT, OFFSET)

PROCESS
1. If relevant tables are unknown, call search_tables.
2. Retrieve schema using get_table_schema for every table you intend to use.
3. If the schema alone is not enough to write a correct query, call select_table_rows to inspect real data.
4. Generate the SQL query.

WHEN TO CALL select_table_rows
Call it only when schema inspection leaves genuine ambiguity that real data would resolve:
- A column name is ambiguous and you need to see real values to understand its meaning
- A filter value must match data already in the table (e.g. a status string, a category name)
- A column is of type jsonb and you need to inspect its structure to understand which fields and values are safe to filter on

Do NOT call it to confirm that a table exists, to re-read types you already have, or out of habit.
Limit sampling to the columns you actually need — pass the columns field rather than selecting *.

RULES
- never guess tables or columns
- inspect schema before writing SQL
- use full table names (schema.table)
- avoid aliases
- use lowercase sql
- use whitespace to make the query readable
- use sql comments only if something is worth clarifying

OUTPUT
If SQL can be produced:
SQL_QUERY: <query>

If more information is still needed:
call the appropriate tool.

If a query cannot be generated:
return a short explanation.
"#;

#[tauri::command]
pub async fn generate_query(
    app:                  AppHandle,
    connection_string:    String,
    api_key:              String,
    model:                String,
    reasoning:            Option<ReasoningEffort>,
    prompt:               String,
    previous_response_id: Option<String>,
) -> Result<Option<String>, String> {
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
    tools::select_table_rows::register(&mut registry, db.clone());

    // On first call include the system prompt, on subsequent calls the
    // Responses API already has the full context via previous_response_id
    let mut input = if previous_response_id.is_none() {
        vec![
            json!({ "role": "system", "content": SYSTEM_PROMPT }),
            json!({ "role": "user", "content": prompt }),
        ]
    } else {
        vec![json!({ "role": "user", "content": prompt })]
    };

    run_agentic_loop(
        &http,
        &api_key,
        &model,
        &mut input,
        &registry,
        previous_response_id,
        reasoning,
        &mut |event| {
            app.emit("generate-query", event).ok();
        },
    ).await
}
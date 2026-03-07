use futures::StreamExt;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tauri::{AppHandle, Emitter};
use std::sync::Arc;
use tokio::sync::Mutex;
use tokio_postgres::Client as PgClient;

const SYSTEM_PROMPT: &str = r#"
You are a PostgreSQL query assistant.

Your job is to generate valid PostgreSQL queries using the database schema.

You do NOT know the schema ahead of time. You MUST discover it using tools.

AVAILABLE TOOLS
- search_tables: search for tables
- get_table_schema: retrieve schema for a table

STRICT WORKFLOW (MANDATORY)

You MUST follow this process:

1. If the user request references a table or data (example: "list users", "orders last week"):
   - FIRST call `search_tables` to find relevant tables.

2. Once a table is identified:
   - You MUST call `get_table_schema` for that table.

3. ONLY AFTER you have the schema:
   - Generate the SQL query.

4. NEVER generate SQL before inspecting schema with `get_table_schema`.

PROHIBITED
- guessing table names
- guessing column names
- generating SQL without calling schema tools first
- conversational responses when tools are applicable

QUERY STYLE
- always use full table names (public.users not users)
- avoid aliases
- lowercase SQL only

OUTPUT RULES

If schema has been retrieved and query can be generated:
Return ONLY the SQL query.

Example:
select * from public.users;

If schema has not been retrieved yet:
Call the appropriate tool.

If a valid query cannot be created:
Return a short explanation.
"#;

// ── Shared DB connection type ─────────────────────────────────────────────────

pub type SharedDb = Arc<Mutex<PgClient>>;

// ── Events emitted to frontend ────────────────────────────────────────────────

#[derive(Serialize, Clone)]
#[serde(rename_all = "snake_case")]
pub struct ToolCallPayload {
    #[serde(rename = "type")]
    pub kind: &'static str,
    pub name: String,
    pub args: Value,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "snake_case")]
pub struct ToolResultPayload {
    #[serde(rename = "type")]
    pub kind: &'static str,
    pub name: String,
    pub result: String,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "snake_case")]
pub struct DeltaPayload {
    #[serde(rename = "type")]
    pub kind: &'static str,
    pub text: String,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "snake_case")]
pub struct DonePayload {
    #[serde(rename = "type")]
    pub kind: &'static str,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "snake_case")]
pub struct ErrorPayload {
    #[serde(rename = "type")]
    pub kind: &'static str,
    pub message: String,
}

// ── OpenAI Responses API streaming event types ────────────────────────────────
//
// Relevant SSE events from /v1/responses with stream=true:
//
//   response.output_item.added        → new output item started (text or function_call)
//   response.output_text.delta        → streaming text chunk
//   response.output_text.done         → text item finished
//   response.function_call_arguments.delta → streaming tool-call argument chunk
//   response.function_call_arguments.done  → tool-call arguments complete
//   response.completed                → full response finished; contains final output array
//
// We accumulate tool call arguments in a map keyed by item index, then execute
// them when response.completed arrives (at which point we have stable call_id values).

#[derive(Deserialize, Debug, Default)]
struct ResponsesEvent {
    #[serde(rename = "type")]
    kind: String,
    // response.output_text.delta
    delta: Option<String>,
    // response.output_item.added  /  response.function_call_arguments.done
    item: Option<ResponsesItem>,
    // response.function_call_arguments.delta
    output_index: Option<usize>,
    // response.completed
    response: Option<ResponsesBody>,
}

#[derive(Deserialize, Debug, Default, Clone)]
struct ResponsesItem {
    #[serde(rename = "type")]
    kind: Option<String>,
    id: Option<String>,
    call_id: Option<String>,
    name: Option<String>,
    arguments: Option<String>,
    // For text items
    text: Option<String>,
}

#[derive(Deserialize, Debug, Default)]
struct ResponsesBody {
    id: Option<String>,
    output: Option<Vec<ResponsesOutputItem>>,
    status: Option<String>,
}

#[derive(Deserialize, Debug, Clone)]
struct ResponsesOutputItem {
    #[serde(rename = "type")]
    kind: String,
    // text item
    text: Option<String>,
    // function_call item
    id: Option<String>,
    call_id: Option<String>,
    name: Option<String>,
    arguments: Option<String>,
}

// ── Tool definitions ──────────────────────────────────────────────────────────

fn tools() -> Value {
    json!([
        {
            "type": "function",
            "name": "get_table_schema",
            "description": "Get the full column schema for a specific table, including data types, nullability, primary keys, foreign keys, and enum values.",
            "parameters": {
                "type": "object",
                "properties": {
                    "schema": {
                        "type": "string",
                        "description": "The schema name, e.g. 'public'"
                    },
                    "table": {
                        "type": "string",
                        "description": "The table name, e.g. 'users'"
                    }
                },
                "required": ["schema", "table"]
            }
        },
        {
            "type": "function",
            "name": "search_tables",
            "description": "Search PostgreSQL tables by pattern (schema.table format). Supports ILIKE wildcards, e.g. 'public.user%' returns all tables in public schema starting with 'user'.",
            "parameters": {
                "type": "object",
                "properties": {
                    "pattern": {
                        "type": "string",
                        "description": "Search pattern in 'schema.table' format. Supports SQL ILIKE wildcards (% and _). Examples: 'public.user%', '%.orders', 'public.%'"
                    }
                },
                "required": ["pattern"]
            }
        }
    ])
}

// ── Tool executor ─────────────────────────────────────────────────────────────

async fn execute_tool(
    app: &AppHandle,
    db: &SharedDb,
    name: &str,
    args: &Value,
) -> String {
    app.emit("generate-query", ToolCallPayload { kind: "tool_call", name: name.to_string(), args: args.clone() }).ok();

    let result = match name {
        "get_table_schema" => {
            let schema = args["schema"].as_str().unwrap_or("public");
            let table  = args["table"].as_str().unwrap_or("");

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
                            let type_name = col["data_type"].as_str().unwrap_or("");
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
                Err(e) => format!("DB error: {e}"),
            }
        }
        "search_tables" => {
            let pattern = args["pattern"].as_str().unwrap_or("%.%");

            let (schema_pattern, table_pattern) = match pattern.split_once('.') {
                Some((s, t)) => (s.to_string(), t.to_string()),
                None         => ("%".to_string(), pattern.to_string()),
            };

            let client = db.lock().await;
            let query_result = client.query(
                "SELECT table_schema, table_name \
                 FROM information_schema.tables \
                 WHERE table_schema ILIKE $1 \
                   AND table_name   ILIKE $2 \
                 ORDER BY table_schema, table_name",
                &[&schema_pattern, &table_pattern],
            ).await;

            match query_result {
                Ok(rows) => {
                    let tables: Vec<Value> = rows.iter().map(|row| {
                        let schema: &str = row.get(0);
                        let table:  &str = row.get(1);
                        json!({ "schema": schema, "table": table, "qualified": format!("{schema}.{table}") })
                    }).collect();
                    json!(tables).to_string()
                }
                Err(e) => format!("DB error: {e}"),
            }
        }
        unknown => format!("Unknown tool: {unknown}"),
    };

    app.emit("generate-query", ToolResultPayload { kind: "tool_result", name: name.to_string(), result: result.clone() }).ok();
    result
}

// ── Core streaming call using OpenAI Responses API ────────────────────────────
//
// POST /v1/responses
//
// Request shape (relevant fields):
// {
//   "model": "o4-mini",
//   "stream": true,
//   "reasoning": { "effort": "low" },
//   "tools": [...],
//   "input": [                        ← replaces "messages"
//     { "role": "system", "content": "..." },
//     { "role": "user",   "content": "..." },
//     // tool results use role "tool":
//     { "type": "function_call_output", "call_id": "...", "output": "..." }
//   ]
// }
//
// Returns Some(tool_calls) when the model wants to call tools,
// or None when it has finished generating text.

async fn stream_completion(
    client: &Client,
    api_key: &str,
    model: &str,
    input: &[Value],
    app: &AppHandle,
) -> Result<Option<Vec<Value>>, String> {
    let body = json!({
        "model": model,
        "stream": true,
        "reasoning": { "effort": "low" },
        "tools": tools(),
        "input": input,
    });

    let response = client
        .post("https://api.openai.com/v1/responses")
        .bearer_auth(api_key)
        .json(&body)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        let msg = format!("OpenAI error {status}: {body}");
        app.emit("generate-query", ErrorPayload { kind: "error", message: msg.clone() }).ok();
        return Err(msg);
    }

    let mut stream = response.bytes_stream();

    // Accumulate streamed function-call arguments keyed by output_index.
    // Each entry: (call_id, name, accumulated_arguments)
    let mut pending_calls: std::collections::HashMap<usize, (String, String, String)> = Default::default();

    // The completed response body (arrives with response.completed event).
    let mut completed_output: Option<Vec<ResponsesOutputItem>> = None;

    // The Responses API SSE format is TWO lines per event, then a blank line:
    //   event: response.output_text.delta
    //   data: {"delta":"hello","..."}
    //
    // We must pair them up — the event type comes from the `event:` line,
    // NOT from a `"type"` field inside the JSON body (that field is absent or
    // irrelevant here). We buffer the last seen event-name across lines.
    let mut line_buffer = String::new();
    let mut current_event_name = String::new();

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| e.to_string())?;
        // Append raw bytes to line buffer so we handle chunks that split lines.
        line_buffer.push_str(&String::from_utf8_lossy(&chunk));

        // Process all complete lines (terminated by \n).
        while let Some(newline_pos) = line_buffer.find('\n') {
            let raw_line: String = line_buffer.drain(..=newline_pos).collect();
            let line = raw_line.trim();

            if line.starts_with("event:") {
                // e.g. "event: response.output_text.delta"
                current_event_name = line["event:".len()..].trim().to_string();
                continue;
            }

            if line.starts_with("data:") {
                let data = line["data:".len()..].trim();
                if data == "[DONE]" {
                    current_event_name.clear();
                    continue;
                }

                let Ok(event) = serde_json::from_str::<ResponsesEvent>(data) else {
                    current_event_name.clear();
                    continue;
                };

                match current_event_name.as_str() {
                    // ── A new output item was added (text or function_call) ────
                    "response.output_item.added" => {
                        if let Some(item) = &event.item {
                            if item.kind.as_deref() == Some("function_call") {
                                let idx = event.output_index.unwrap_or(0);
                                pending_calls.insert(
                                    idx,
                                    (
                                        item.call_id.clone().unwrap_or_default(),
                                        item.name.clone().unwrap_or_default(),
                                        String::new(),
                                    ),
                                );
                            }
                        }
                    }

                    // ── Streaming text delta ──────────────────────────────────
                    "response.output_text.delta" => {
                        if let Some(ref delta) = event.delta {
                            if !delta.is_empty() {
                                app.emit("generate-query", DeltaPayload { kind: "delta", text: delta.clone() }).ok();
                            }
                        }
                    }

                    // ── Streaming function-call argument delta ────────────────
                    "response.function_call_arguments.delta" => {
                        if let (Some(idx), Some(ref delta)) = (event.output_index, &event.delta) {
                            if let Some(entry) = pending_calls.get_mut(&idx) {
                                entry.2.push_str(delta);
                            }
                        }
                    }

                    // ── Full response completed ───────────────────────────────
                    "response.completed" => {
                        if let Some(resp) = event.response {
                            completed_output = resp.output;
                        }
                    }

                    _ => {}
                }

                current_event_name.clear();
            }
            // Blank lines between SSE events — just skip.
        }
    }

    // If the completed response contains function_call items, return them.
    if let Some(output) = completed_output {
        let tool_calls: Vec<Value> = output
            .into_iter()
            .filter(|item| item.kind == "function_call")
            .map(|item| json!({
                "call_id": item.call_id.unwrap_or_default(),
                "name":    item.name.unwrap_or_default(),
                "arguments": item.arguments.unwrap_or_else(|| "{}".to_string()),
            }))
            .collect();

        if !tool_calls.is_empty() {
            return Ok(Some(tool_calls));
        }
    }

    Ok(None)
}

// ── Tauri command ─────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn generate_query(
    app: AppHandle,
    connection_string: String,
    api_key: String,
    model: String,
    prompt: String,
) -> Result<(), String> {
    let http_client = Client::new();

    let (pg_client, connection) = tokio_postgres::connect(&connection_string, tokio_postgres::NoTls)
        .await
        .map_err(|e| e.to_string())?;

    tokio::spawn(async move {
        if let Err(e) = connection.await {
            eprintln!("DB connection error: {e}");
        }
    });

    let db: SharedDb = Arc::new(Mutex::new(pg_client));

    // The Responses API uses "input" instead of "messages".
    // System instructions live in a top-level "instructions" field OR as a
    // system-role item inside input — we use the input array approach so we
    // can keep appending tool results in the same list across turns.
    let mut input: Vec<Value> = vec![
        json!({ "role": "system",  "content": SYSTEM_PROMPT }),
        json!({ "role": "user",    "content": prompt }),
    ];

    loop {
        match stream_completion(&http_client, &api_key, &model, &input, &app).await? {
            Some(tool_calls) => {
                // Append each function_call output item that the model produced.
                // The Responses API expects us to echo the assistant's function_call
                // items back as-is, followed by function_call_output items.
                for tc in &tool_calls {
                    let name    = tc["name"].as_str().unwrap_or("");
                    let call_id = tc["call_id"].as_str().unwrap_or("");
                    let args: Value = serde_json::from_str(
                        tc["arguments"].as_str().unwrap_or("{}")
                    ).unwrap_or(json!({}));

                    // Echo the assistant's function_call item.
                    input.push(json!({
                        "type":      "function_call",
                        "call_id":   call_id,
                        "name":      name,
                        "arguments": tc["arguments"].as_str().unwrap_or("{}")
                    }));

                    // Execute the tool and append the result.
                    let result = execute_tool(&app, &db, name, &args).await;

                    input.push(json!({
                        "type":    "function_call_output",
                        "call_id": call_id,
                        "output":  result,
                    }));
                }
            }

            None => {
                app.emit("generate-query", DonePayload { kind: "done" }).ok();
                break;
            }
        }
    }

    Ok(())
}
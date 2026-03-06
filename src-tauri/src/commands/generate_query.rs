use futures::StreamExt;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tauri::{AppHandle, Emitter};
use std::sync::Arc;
use tokio::sync::Mutex;  // ← tokio's Mutex, not std's
use tokio_postgres::Client as PgClient;  // ← async postgres client

// ── Shared DB connection type ─────────────────────────────────────────────────

pub type SharedDb = Arc<Mutex<PgClient>>;  // ← now holds tokio_postgres::Client

// ── Events emitted to frontend ────────────────────────────────────────────────

#[derive(Serialize, Clone)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum AiEvent {
    ToolCall   { name: String, args: Value },
    ToolResult { name: String, result: String },
    Delta      { text: String },
    Done,
    Error      { message: String },
}

// ── OpenAI types ──────────────────────────────────────────────────────────────

#[derive(Deserialize, Debug, Clone, Default)]
struct ToolCallChunk {
    index: usize,
    id: Option<String>,
    #[serde(rename = "type")]
    kind: Option<String>,
    function: Option<FunctionChunk>,
}

#[derive(Deserialize, Debug, Clone, Default)]
struct FunctionChunk {
    name: Option<String>,
    arguments: Option<String>,
}

#[derive(Deserialize, Debug)]
struct Delta {
    content: Option<String>,
    tool_calls: Option<Vec<ToolCallChunk>>,
}

#[derive(Deserialize, Debug)]
struct Choice {
    delta: Delta,
    finish_reason: Option<String>,
}

#[derive(Deserialize, Debug)]
struct StreamChunk {
    choices: Vec<Choice>,
}

// ── Tool definitions ──────────────────────────────────────────────────────────

fn tools() -> Value {
    json!([
        {
            "type": "function",
            "function": {
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
    app.emit("ai-event", AiEvent::ToolCall {
        name: name.to_string(),
        args: args.clone(),
    }).ok();

    let result = match name {
        "search_tables" => {
            let pattern = args["pattern"].as_str().unwrap_or("%.%");

            let (schema_pattern, table_pattern) = match pattern.split_once('.') {
                Some((s, t)) => (s.to_string(), t.to_string()),
                None         => ("%".to_string(), pattern.to_string()),
            };

            let client = db.lock().await;  // ← .await instead of .unwrap()
            let query_result = client.query(
                "SELECT table_schema, table_name \
                 FROM information_schema.tables \
                 WHERE table_schema ILIKE $1 \
                   AND table_name   ILIKE $2 \
                 ORDER BY table_schema, table_name",
                &[&schema_pattern, &table_pattern],
            ).await;  // ← .await the query

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

    app.emit("ai-event", AiEvent::ToolResult {
        name: name.to_string(),
        result: result.clone(),
    }).ok();

    result
}

// ── Core streaming call ───────────────────────────────────────────────────────

async fn stream_completion(
    client: &Client,
    api_key: &str,
    model: &str,
    messages: &[Value],
    app: &AppHandle,
) -> Result<Option<Vec<Value>>, String> {
    let body = json!({
        "model": model,
        "stream": true,
        "tools": tools(),
        "messages": messages,
    });

    let response = client
        .post("https://api.openai.com/v1/chat/completions")
        .bearer_auth(api_key)
        .json(&body)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    // Catch HTTP errors (401, 429, etc.) before streaming
    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        let msg = format!("OpenAI error {status}: {body}");
        app.emit("ai-event", AiEvent::Error { message: msg.clone() }).ok();
        return Err(msg);
    }

    let mut stream = response.bytes_stream();
    let mut tool_call_accum: Vec<ToolCallChunk> = Vec::new();
    let mut finish_reason = String::new();

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| e.to_string())?;
        let text = String::from_utf8_lossy(&chunk);

        for line in text.lines() {
            let line = line.trim();
            if !line.starts_with("data: ") { continue; }
            let data = &line["data: ".len()..];

            if data == "[DONE]" { continue; }

            let Ok(parsed) = serde_json::from_str::<StreamChunk>(data) else { continue };
            let Some(choice) = parsed.choices.first() else { continue };

            if let Some(ref reason) = choice.finish_reason {
                if !reason.is_empty() {
                    finish_reason = reason.clone();
                }
            }

            if let Some(ref tcs) = choice.delta.tool_calls {
                for tc in tcs {
                    while tool_call_accum.len() <= tc.index {
                        tool_call_accum.push(ToolCallChunk::default());
                    }
                    let entry = &mut tool_call_accum[tc.index];
                    if let Some(ref id) = tc.id { entry.id = Some(id.clone()); }
                    if let Some(ref f) = tc.function {
                        let ef = entry.function.get_or_insert(FunctionChunk::default());
                        if let Some(ref name) = f.name { ef.name = Some(name.clone()); }
                        if let Some(ref args) = f.arguments {
                            ef.arguments = Some(ef.arguments.clone().unwrap_or_default() + args);
                        }
                    }
                }
            }

            if let Some(ref content) = choice.delta.content {
                if !content.is_empty() {
                    app.emit("ai-event", AiEvent::Delta { text: content.clone() }).ok();
                }
            }
        }
    }

    // In stream_completion, replace the final tool_calls assembly:

    if finish_reason == "tool_calls" && !tool_call_accum.is_empty() {
        let tool_calls: Vec<Value> = tool_call_accum.iter()
            .filter(|tc| {
                // Skip entries with no name or no id — these are phantom chunks
                tc.id.is_some() &&
                tc.function.as_ref()
                    .and_then(|f| f.name.as_deref())
                    .map(|n| !n.is_empty())
                    .unwrap_or(false)
            })
            .map(|tc| json!({
                "id": tc.id.as_deref().unwrap(),
                "type": "function",
                "function": {
                    "name": tc.function.as_ref().and_then(|f| f.name.as_deref()).unwrap_or(""),
                    "arguments": tc.function.as_ref().and_then(|f| f.arguments.as_deref()).unwrap_or("{}")
                }
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

    // Connect using tokio_postgres (fully async, no block_on internally)
    let (pg_client, connection) = tokio_postgres::connect(&connection_string, tokio_postgres::NoTls)
        .await
        .map_err(|e| e.to_string())?;

    // Spawn the connection driver — must run concurrently
    tokio::spawn(async move {
        if let Err(e) = connection.await {
            eprintln!("DB connection error: {e}");
        }
    });

    let db: SharedDb = Arc::new(Mutex::new(pg_client));

    let mut messages: Vec<Value> = vec![
        json!({ "role": "system", "content": "You are a helpful PostgreSQL data assistant." }),
        json!({ "role": "user",   "content": prompt }),
    ];

    loop {
        match stream_completion(&http_client, &api_key, &model, &messages, &app).await? {
            Some(tool_calls) => {
                messages.push(json!({
                    "role": "assistant",
                    "tool_calls": tool_calls
                }));

                for tc in &tool_calls {
                    let name = tc["function"]["name"].as_str().unwrap_or("");
                    let args: Value = serde_json::from_str(
                        tc["function"]["arguments"].as_str().unwrap_or("{}")
                    ).unwrap_or(json!({}));

                    let result = execute_tool(&app, &db, name, &args).await;

                    messages.push(json!({
                        "role": "tool",
                        "tool_call_id": tc["id"],
                        "content": result
                    }));
                }
            }

            None => {
                app.emit("ai-event", AiEvent::Done).ok();
                break;
            }
        }
    }

    Ok(())
}
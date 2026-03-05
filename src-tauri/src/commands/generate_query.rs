use futures::StreamExt;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tauri::{AppHandle, Emitter};

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
                "name": "list_tables",
                "description": "Returns all available PostgreSQL tables with schema, type, size and columns.",
                "parameters": {
                    "type": "object",
                    "properties": {},
                    "required": []
                }
            }
        }
    ])
}

// ── Tool executor ─────────────────────────────────────────────────────────────

async fn execute_tool(
    app: &AppHandle,
    name: &str,
    args: &Value,
) -> String {
    app.emit("ai-event", AiEvent::ToolCall {
        name: name.to_string(),
        args: args.clone(),
    }).ok();

    let result = match name {
        "list_tables" => {
            // 🔧 Replace with your real Postgres logic later
            let tables = json!([
                { "schema": "public", "name": "users",    "type": "BASE TABLE", "size_mb": 1.2 },
                { "schema": "public", "name": "orders",   "type": "BASE TABLE", "size_mb": 3.4 },
                { "schema": "public", "name": "products", "type": "BASE TABLE", "size_mb": 0.8 },
            ]);
            tables.to_string()
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

            if data == "[DONE]" { continue; } // don't break — process all lines in chunk


            let Ok(parsed) = serde_json::from_str::<StreamChunk>(data) else { continue };
            let Some(choice) = parsed.choices.first() else { continue };

            // Capture finish_reason whenever it appears
            if let Some(ref reason) = choice.finish_reason {
                if !reason.is_empty() {
                    finish_reason = reason.clone();
                }
            }

            // Accumulate tool call chunks
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

            // Stream text deltas to frontend
            if let Some(ref content) = choice.delta.content {
                if !content.is_empty() {
                    app.emit("ai-event", AiEvent::Delta { text: content.clone() }).ok();
                }
            }
        }
    }

    if finish_reason == "tool_calls" && !tool_call_accum.is_empty() {
        let tool_calls: Vec<Value> = tool_call_accum.iter().map(|tc| json!({
            "id": tc.id,
            "type": "function",
            "function": {
                "name": tc.function.as_ref().and_then(|f| f.name.as_deref()).unwrap_or(""),
                "arguments": tc.function.as_ref().and_then(|f| f.arguments.as_deref()).unwrap_or("{}")
            }
        })).collect();
        return Ok(Some(tool_calls));
    }

    Ok(None)
}

// ── Tauri command ─────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn generate_query(
    app: AppHandle,
    api_key: String,
    model: String,
    prompt: String,
) -> Result<(), String> {
    let client = Client::new();
    let mut messages: Vec<Value> = vec![
        json!({ "role": "system", "content": "You are a helpful PostgreSQL data assistant." }),
        json!({ "role": "user",   "content": prompt }),
    ];

    // Agentic loop — keep going until no more tool calls
    loop {
        match stream_completion(&client, &api_key, &model, &messages, &app).await? {
            // Model called tools — execute them and loop
            Some(tool_calls) => {
                // Append the assistant's tool call message
                messages.push(json!({
                    "role": "assistant",
                    "tool_calls": tool_calls
                }));

                // Execute each tool and append results
                for tc in &tool_calls {
                    let name = tc["function"]["name"].as_str().unwrap_or("");
                    let args: Value = serde_json::from_str(
                        tc["function"]["arguments"].as_str().unwrap_or("{}")
                    ).unwrap_or(json!({}));

                    let result = execute_tool(&app, name, &args).await;

                    messages.push(json!({
                        "role": "tool",
                        "tool_call_id": tc["id"],
                        "content": result
                    }));
                }
                // Loop back to get the model's next response
            }

            // No tool calls — model streamed its final answer, we're done
            None => {
                app.emit("ai-event", AiEvent::Done).ok();
                break;
            }
        }
    }

    Ok(())
}
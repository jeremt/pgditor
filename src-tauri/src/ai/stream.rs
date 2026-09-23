// stream.rs — OpenRouter (OpenAI Chat Completions-compatible) streaming client

use futures::StreamExt;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

use super::tool_registry::ToolRegistry;

// ── Events emitted to frontend ────────────────────────────────────────────────

#[derive(Serialize, Clone)]
#[serde(rename_all = "snake_case")]
pub struct ToolCallPayload   { #[serde(rename = "type")] pub kind: &'static str, pub call_id: String, pub name: String, pub args: Value }

#[derive(Serialize, Clone)]
#[serde(rename_all = "snake_case")]
pub struct ToolResultPayload { #[serde(rename = "type")] pub kind: &'static str, pub name: String, pub result: String }

#[derive(Serialize, Clone)]
#[serde(rename_all = "snake_case")]
pub struct DeltaPayload      { #[serde(rename = "type")] pub kind: &'static str, pub text: String }

#[derive(Serialize, Clone)]
#[serde(rename_all = "snake_case")]
pub struct DonePayload       { #[serde(rename = "type")] pub kind: &'static str }

#[derive(Serialize, Clone)]
#[serde(rename_all = "snake_case")]
pub struct ErrorPayload      { #[serde(rename = "type")] pub kind: &'static str, pub message: String }

// ── Loop event — yielded to the caller on each meaningful state change ────────

#[derive(Serialize, Clone)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum AgentEvent {
    Delta       { text: String },
    Model       { model: String },
    ToolCall    { call_id: String, name: String, args: Value },
    ToolResult  { name: String, result: String },
    Done,
    Error       { message: String },
}

// ── SSE deserialization types — Chat Completions API ───────────────────────────

#[derive(Deserialize, Debug, Default)]
struct ChatCompletionChunk {
    #[serde(default)]
    model: Option<String>,
    #[serde(default)]
    choices: Vec<ChatCompletionChoice>,
}

#[derive(Deserialize, Debug, Default)]
struct ChatCompletionChoice {
    #[serde(default)]
    delta: ChatCompletionDelta,
}

#[derive(Deserialize, Debug, Default)]
struct ChatCompletionDelta {
    content:    Option<String>,
    tool_calls: Option<Vec<ChatCompletionToolCallDelta>>,
}

#[derive(Deserialize, Debug, Default)]
struct ChatCompletionToolCallDelta {
    index:    usize,
    id:       Option<String>,
    function: Option<ChatCompletionFunctionDelta>,
}

#[derive(Deserialize, Debug, Default)]
struct ChatCompletionFunctionDelta {
    name:      Option<String>,
    arguments: Option<String>,
}

// ── A resolved tool call ready for dispatch ───────────────────────────────────

pub struct ToolCall {
    pub call_id:   String,
    pub name:      String,
    pub arguments: Value,
}

// ── Completion result ─────────────────────────────────────────────────────────

pub struct CompletionResult {
    pub tool_calls: Option<Vec<ToolCall>>,
}

// ── stream_completion ─────────────────────────────────────────────────────────

pub async fn stream_completion(
    http:     &Client,
    api_key:  &str,
    model:    &str,
    input:    &[Value],
    tools:    &Value,
    on_event: &mut impl FnMut(AgentEvent),
) -> Result<CompletionResult, String> {
    let chat_tools: Vec<Value> = tools
        .as_array()
        .cloned()
        .unwrap_or_default()
        .into_iter()
        .map(|tool| json!({
            "type": "function",
            "function": {
                "name":        tool.get("name"),
                "description": tool.get("description"),
                "parameters":  tool.get("parameters"),
            },
        }))
        .collect();

    let mut body = json!({
        "model":    model,
        "stream":   true,
        "messages": input,
    });

    if !chat_tools.is_empty() {
        body["tools"] = json!(chat_tools);
    }

    let response = http
        .post("https://openrouter.ai/api/v1/chat/completions")
        .bearer_auth(api_key)
        .header("HTTP-Referer", "https://github.com/jeremtab/pgditor")
        .header("X-Title", "pgditor")
        .json(&body)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !response.status().is_success() {
        let status = response.status();
        let text   = response.text().await.unwrap_or_default();
        let msg    = format!("OpenRouter error {status}: {text}");
        on_event(AgentEvent::Error { message: msg.clone() });
        return Err(msg);
    }

    let mut stream         = response.bytes_stream();
    let mut line_buffer    = String::new();
    // model routers (e.g. "openrouter/free", "openrouter/auto", ":floor", ":nitro")
    // resolve to a different underlying model per request — report it once it's known.
    let mut resolved_model = false;
    // output_index -> (call_id, name, arguments buffer)
    let mut tool_calls: std::collections::BTreeMap<usize, (String, String, String)> = Default::default();

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| e.to_string())?;
        line_buffer.push_str(&String::from_utf8_lossy(&chunk));

        while let Some(pos) = line_buffer.find('\n') {
            let raw: String = line_buffer.drain(..=pos).collect();
            let line = raw.trim();

            let Some(data) = line.strip_prefix("data:") else { continue };
            let data = data.trim();
            if data.is_empty() || data == "[DONE]" { continue; }

            let Ok(chunk_val) = serde_json::from_str::<ChatCompletionChunk>(data) else { continue };

            if !resolved_model {
                if let Some(actual_model) = &chunk_val.model {
                    if actual_model != model {
                        on_event(AgentEvent::Model { model: actual_model.clone() });
                    }
                    resolved_model = true;
                }
            }

            for choice in chunk_val.choices {
                if let Some(content) = choice.delta.content {
                    if !content.is_empty() {
                        on_event(AgentEvent::Delta { text: content });
                    }
                }

                if let Some(deltas) = choice.delta.tool_calls {
                    for delta in deltas {
                        let entry = tool_calls
                            .entry(delta.index)
                            .or_insert_with(|| (String::new(), String::new(), String::new()));

                        if let Some(id) = delta.id { entry.0 = id; }
                        if let Some(function) = delta.function {
                            if let Some(name) = function.name { entry.1 = name; }
                            if let Some(arguments) = function.arguments { entry.2.push_str(&arguments); }
                        }
                    }
                }
            }
        }
    }

    let calls: Vec<ToolCall> = tool_calls
        .into_iter()
        .filter_map(|(_, (call_id, name, arguments))| {
            let arguments: Value = serde_json::from_str(
                if arguments.is_empty() { "{}" } else { &arguments }
            ).ok()?;
            Some(ToolCall { call_id, name, arguments })
        })
        .collect();

    Ok(CompletionResult {
        tool_calls: if calls.is_empty() { None } else { Some(calls) },
    })
}

// ── Agentic loop ──────────────────────────────────────────────────────────────

pub async fn run_agentic_loop(
    http:     &Client,
    api_key:  &str,
    model:    &str,
    input:    &mut Vec<Value>,
    registry: &ToolRegistry,
    on_event: &mut impl FnMut(AgentEvent),
) -> Result<(), String> {
    let tools = registry.to_openai_tools();
    println!("ai > [{}] {:#?}", model, input);

    loop {
        let result = stream_completion(http, api_key, model, input, &tools, on_event).await?;

        match result.tool_calls {
            None => {
                on_event(AgentEvent::Done);
                return Ok(());
            }
            Some(calls) => {
                for tc in calls {
                    on_event(AgentEvent::ToolCall {
                        call_id: tc.call_id.clone(),
                        name:    tc.name.clone(),
                        args:    tc.arguments.clone(),
                    });
                    let result = registry.call(&tc.name, tc.arguments.clone()).await;
                    on_event(AgentEvent::ToolResult { name: tc.name.clone(), result: result.clone() });

                    input.push(json!({
                        "role":    "assistant",
                        "content": Value::Null,
                        "tool_calls": [{
                            "id":   tc.call_id,
                            "type": "function",
                            "function": {
                                "name":      tc.name,
                                "arguments": tc.arguments.to_string(),
                            },
                        }],
                    }));
                    input.push(json!({
                        "role":         "tool",
                        "tool_call_id": tc.call_id,
                        "content":      result,
                    }));
                }
            }
        }
    }
}

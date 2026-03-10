// stream.rs

use futures::StreamExt;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

use super::tool_registry::ToolRegistry;

// ── Events emitted to frontend ────────────────────────────────────────────────

#[derive(Serialize, Clone)]
#[serde(rename_all = "snake_case")]
pub struct ToolCallPayload   { #[serde(rename = "type")] pub kind: &'static str, pub name: String, pub args: Value }

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
    ToolCall    { name: String, args: Value },
    ToolResult  { name: String, result: String },
    Done,
    Error       { message: String },
}

// ── SSE deserialization types ─────────────────────────────────────────────────

#[derive(Deserialize, Debug, Default)]
struct ResponsesEvent {
    #[serde(rename = "type")]
    kind:         String,
    delta:        Option<String>,
    item:         Option<ResponsesItem>,
    output_index: Option<usize>,
    response:     Option<ResponsesBody>,
}

#[derive(Deserialize, Debug, Default, Clone)]
struct ResponsesItem {
    #[serde(rename = "type")]
    kind:    Option<String>,
    call_id: Option<String>,
    name:    Option<String>,
}

#[derive(Deserialize, Debug, Default)]
struct ResponsesBody {
    output: Option<Vec<ResponsesOutputItem>>,
}

#[derive(Deserialize, Debug, Clone)]
struct ResponsesOutputItem {
    #[serde(rename = "type")]
    kind:      String,
    call_id:   Option<String>,
    name:      Option<String>,
    arguments: Option<String>,
}

// ── A resolved tool call ready for dispatch ───────────────────────────────────

pub struct ToolCall {
    pub call_id:   String,
    pub name:      String,
    pub arguments: Value,
}

// ── stream_completion ─────────────────────────────────────────────────────────

pub async fn stream_completion(
    http:    &Client,
    api_key: &str,
    model:   &str,
    input:   &[Value],
    tools:   &Value,
    on_event: &mut impl FnMut(AgentEvent),
) -> Result<Option<Vec<ToolCall>>, String> {
    let body = json!({
        "model":     model,
        "stream":    true,
        "reasoning": { "effort": "low" },
        "tools":     tools,
        "input":     input,
    });

    let response = http
        .post("https://api.openai.com/v1/responses")
        .bearer_auth(api_key)
        .json(&body)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !response.status().is_success() {
        let status = response.status();
        let text   = response.text().await.unwrap_or_default();
        let msg    = format!("OpenAI error {status}: {text}");
        on_event(AgentEvent::Error { message: msg.clone() });
        return Err(msg);
    }

    let mut stream             = response.bytes_stream();
    let mut pending_calls: std::collections::HashMap<usize, (String, String)> = Default::default();
    let mut completed_output: Option<Vec<ResponsesOutputItem>>                = None;
    let mut line_buffer        = String::new();
    let mut current_event_name = String::new();

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| e.to_string())?;
        line_buffer.push_str(&String::from_utf8_lossy(&chunk));

        while let Some(pos) = line_buffer.find('\n') {
            let raw: String = line_buffer.drain(..=pos).collect();
            let line = raw.trim();

            if let Some(name) = line.strip_prefix("event:") {
                current_event_name = name.trim().to_string();
                continue;
            }

            if let Some(data) = line.strip_prefix("data:") {
                let data = data.trim();
                if data == "[DONE]" { current_event_name.clear(); continue; }

                let Ok(event) = serde_json::from_str::<ResponsesEvent>(data) else {
                    current_event_name.clear();
                    continue;
                };

                match current_event_name.as_str() {
                    "response.output_item.added" => {
                        if let Some(item) = &event.item {
                            if item.kind.as_deref() == Some("function_call") {
                                let idx = event.output_index.unwrap_or(0);
                                pending_calls.insert(idx, (
                                    item.call_id.clone().unwrap_or_default(),
                                    item.name.clone().unwrap_or_default(),
                                ));
                            }
                        }
                    }
                    "response.output_text.delta" => {
                        if let Some(ref delta) = event.delta {
                            if !delta.is_empty() {
                                on_event(AgentEvent::Delta { text: delta.clone() });
                            }
                        }
                    }
                    "response.completed" => {
                        if let Some(resp) = event.response {
                            completed_output = resp.output;
                        }
                    }
                    _ => {}
                }
                current_event_name.clear();
            }
        }
    }

    if let Some(output) = completed_output {
        let calls: Vec<ToolCall> = output
            .into_iter()
            .filter(|item| item.kind == "function_call")
            .filter_map(|item| {
                let args: Value = serde_json::from_str(
                    item.arguments.as_deref().unwrap_or("{}")
                ).ok()?;
                Some(ToolCall {
                    call_id:   item.call_id.unwrap_or_default(),
                    name:      item.name.unwrap_or_default(),
                    arguments: args,
                })
            })
            .collect();

        if !calls.is_empty() {
            return Ok(Some(calls));
        }
    }

    Ok(None)
}

// ── Agentic loop ──────────────────────────────────────────────────────────────
//
// Drives stream_completion in a loop, executing tool calls via the registry.
// All observable state changes are reported through `on_event` — no Tauri
// dependency here, making this reusable in any async context.

pub async fn run_agentic_loop(
    http:     &Client,
    api_key:  &str,
    model:    &str,
    input:    &mut Vec<Value>,
    registry: &ToolRegistry,
    on_event: &mut impl FnMut(AgentEvent),
) -> Result<(), String> {
    let tools = registry.to_openai_tools();

    loop {
        match stream_completion(http, api_key, model, input, &tools, on_event).await? {
            None => {
                on_event(AgentEvent::Done);
                return Ok(());
            }
            Some(calls) => {
                for tc in calls {
                    on_event(AgentEvent::ToolCall { name: tc.name.clone(), args: tc.arguments.clone() });

                    input.push(json!({
                        "type":      "function_call",
                        "call_id":   tc.call_id,
                        "name":      tc.name,
                        "arguments": tc.arguments.to_string(),
                    }));

                    let result = registry.call(&tc.name, tc.arguments).await;

                    on_event(AgentEvent::ToolResult { name: tc.name.clone(), result: result.clone() });

                    input.push(json!({
                        "type":    "function_call_output",
                        "call_id": tc.call_id,
                        "output":  result,
                    }));
                }
            }
        }
    }
}
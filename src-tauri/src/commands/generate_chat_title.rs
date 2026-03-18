use reqwest::Client;
use serde_json::{json, Value};

use crate::ai::stream::{AgentEvent, ReasoningEffort, stream_completion};

const TITLE_SYSTEM_PROMPT: &str = r#"
You generate short, descriptive chat titles.

RULES
- 3 to 6 words maximum
- no quotes, no punctuation at the end
- first word start with a capital, other are lowercase
- capture the core topic of the conversation
- output the title and nothing else
"#;

#[tauri::command]
pub async fn generate_chat_title(
    api_key: String,
    history: Vec<Value>,
) -> Result<String, String> {
    let http = Client::new();

    let history_text = history
        .iter()
        .filter_map(|msg| {
            let role    = msg.get("role")?.as_str()?;
            let content = msg.get("content")?.as_str()?;
            Some(format!("{role}: {content}"))
        })
        .collect::<Vec<_>>()
        .join("\n");

    let input = vec![
        json!({ "role": "system", "content": TITLE_SYSTEM_PROMPT }),
        json!({ "role": "user",   "content": format!("Generate a title for this conversation:\n\n{history_text}") }),
    ];

    let mut full_title = String::new();

    stream_completion(
        &http,
        &api_key,
        "gpt-5-nano",
        &input,
        &json!([]),
        None,
        Some(ReasoningEffort::Low),
        &mut |event| {
            if let AgentEvent::Delta { text } = event {
                full_title.push_str(&text);
            }
        },
    ).await?;

    let title = full_title.trim().to_string();
    if title.is_empty() {
        return Err("model returned an empty title".to_string());
    }

    Ok(title)
}
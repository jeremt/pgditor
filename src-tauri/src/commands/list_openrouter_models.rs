use reqwest::Client;
use serde::{Deserialize, Serialize};

#[derive(Deserialize)]
struct OpenRouterModelsResponse {
    data: Vec<OpenRouterModelRaw>,
}

#[derive(Deserialize)]
struct OpenRouterModelRaw {
    id:              String,
    name:            String,
    context_length:  Option<u64>,
    #[serde(default)]
    supported_parameters: Vec<String>,
}

#[derive(Serialize)]
pub struct OpenRouterModel {
    pub id:             String,
    pub name:           String,
    pub context_length: Option<u64>,
}

/// Lists OpenRouter models, filtered to the ones that support tool/function
/// calling — pgditor's AI agent relies on it, so any model without it can't
/// power the agent's tools (search_tables, get_table_schema, select_table_rows).
#[tauri::command]
pub async fn list_openrouter_models() -> Result<Vec<OpenRouterModel>, String> {
    let http = Client::new();

    let response = http
        .get("https://openrouter.ai/api/v1/models")
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !response.status().is_success() {
        let status = response.status();
        return Err(format!("OpenRouter error {status}"));
    }

    let parsed: OpenRouterModelsResponse = response.json().await.map_err(|e| e.to_string())?;

    let mut models: Vec<OpenRouterModel> = parsed
        .data
        .into_iter()
        .filter(|model| model.supported_parameters.iter().any(|p| p == "tools"))
        .map(|model| OpenRouterModel {
            id:             model.id,
            name:           model.name,
            context_length: model.context_length,
        })
        .collect();

    models.sort_by(|a, b| a.name.cmp(&b.name));

    Ok(models)
}

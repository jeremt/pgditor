use tauri::{AppHandle, WebviewUrl, WebviewWindowBuilder};
use uuid::Uuid;

#[tauri::command]
pub async fn create_new_window(app: AppHandle) -> Result<String, String> {
    let window_id = format!("window-{}", Uuid::new_v4());
    WebviewWindowBuilder::new(&app, &window_id, WebviewUrl::App("index.html".into()))
        .title("pgditor")
        .inner_size(1200.0, 800.0)
        .build()
        .map_err(|e| e.to_string())?;
    Ok(window_id)
}

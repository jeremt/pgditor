pub mod commands;
pub mod error;
pub mod pg;
pub mod ai;
use tauri::Emitter;
use tauri::async_runtime::block_on;


#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_sql::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_persisted_scope::init())
        .on_menu_event(|app, event| {
            let event_id = event.id.0.as_str();
            if event_id == "new-window" {
                let _ = block_on(commands::create_new_window::create_new_window(app.clone()));
            }
            let _ = app.emit("menu-event", event_id);
        })
        .invoke_handler(tauri::generate_handler![
            commands::test_connection::test_connection,
            commands::list_tables::list_tables,
            commands::list_table_columns::list_table_columns,
            commands::get_table_data::get_table_data,
            commands::raw_query::raw_query,
            commands::show_main_window::show_main_window,
            commands::list_tables_for_graph::list_tables_for_graph,
            commands::list_schemas::list_schemas,
            commands::generate_query::generate_query,
            commands::generate_chat_title::generate_chat_title,
            commands::create_new_window::create_new_window,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

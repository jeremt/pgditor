pub mod commands;
pub mod error;
pub mod pg;
pub mod ai;
use tauri::Emitter;
use tauri::menu::{Menu, MenuItem, Submenu};
use tauri::async_runtime::block_on;
use tauri_plugin_dialog::{DialogExt, MessageDialogKind, MessageDialogButtons};

const VERSION: &str = env!("CARGO_PKG_VERSION");

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
        .setup(|app| {
            let new_window = MenuItem::with_id(app, "new-window", "New Window", true, Some("CmdOrCtrl+N"))?;
            let about = MenuItem::with_id(app, "about", "About PGditor", true, None::<&str>)?;
            let file_menu = Submenu::with_items(
                app,
                "File",
                true,
                &[&new_window],
            )?;
            let help_menu = Submenu::with_items(
                app,
                "Help",
                true,
                &[&about],
            )?;
            let menu = Menu::with_items(app, &[&file_menu, &help_menu])?;
            app.set_menu(menu)?;
            Ok(())
        })
        .on_menu_event(|app, event| {
            let event_id = event.id.0.as_str();
            if event_id == "new-window" {
                let _ = block_on(commands::create_new_window::create_new_window(app.clone()));
            } else if event_id == "about" {
                app.dialog()
                    .message(format!("Version {}\nhttps://pgditor-landing.vercel.app", VERSION))
                    .kind(MessageDialogKind::Info)
                    .buttons(MessageDialogButtons::Ok)
                    .show(|_| {});
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
            commands::generate_query::generate_query,
            commands::generate_chat_title::generate_chat_title,
            commands::create_new_window::create_new_window,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

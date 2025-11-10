
use serde::Serialize;

#[derive(Debug, Serialize)]
struct TableInfo {
    schema: String,
    name: String,
    #[serde(rename = "type")]
    table_type: String,
}

// We'll keep connection storage on the JS side using the `@tauri-apps/plugin-store` plugin.
// The Rust backend exposes commands to test connections and list tables.

#[tauri::command]
async fn test_connection(connection_string: String) -> Result<bool, String> {
    let conn = connection_string.clone();

    // Use blocking postgres client inside a blocking task to keep things simple.
    let result = tokio::task::spawn_blocking(move || {
        match postgres::Client::connect(&conn, postgres::NoTls) {
            Ok(_) => Ok(true),
            Err(e) => Err(e.to_string()),
        }
    })
    .await
    .map_err(|e| e.to_string())?;

    result
}

#[tauri::command]
async fn list_tables(connection_string: String) -> Result<Vec<TableInfo>, String> {
    let conn = connection_string.clone();
    
    tokio::task::spawn_blocking(move || {
        let mut client = postgres::Client::connect(&conn, postgres::NoTls)
            .map_err(|e| e.to_string())?;
        
        let rows = client.query(
            "SELECT 
                table_schema as schema,
                table_name as name,
                table_type as type
            FROM 
                information_schema.tables
            WHERE 
                table_schema NOT IN ('pg_catalog', 'information_schema')
            ORDER BY 
                table_schema,
                table_name;",
            &[],
        ).map_err(|e| e.to_string())?;

        let tables = rows.iter().map(|row| TableInfo {
            schema: row.get("schema"),
            name: row.get("name"),
            table_type: row.get("type"),
        }).collect();

        Ok(tables)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_sql::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            test_connection,
            list_tables
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

use crate::error::PgError;
use crate::utils::create_secure_client;
use serde_json::Value as JsonValue;
use postgres::SimpleQueryMessage;

#[tauri::command]
pub async fn raw_query(connection_string: String, sql: String) -> Result<Vec<JsonValue>, PgError> {
    let conn = connection_string.clone();
    let sql_text = sql.clone();

    tokio::task::spawn_blocking(move || {
        let mut client = create_secure_client(&conn)?;

        println!("psql > {}", sql_text);

        // simple_query returns all values as strings, which is exactly what we want.
        // It supports multiple queries in one string, returning a stream of messages.
        let messages = client.simple_query(&sql_text).map_err(PgError::from)?;

        let mut json_rows: Vec<JsonValue> = Vec::new();

        for message in messages {
            if let SimpleQueryMessage::Row(row) = message {
                let mut map = serde_json::Map::new();
                for (i, column) in row.columns().iter().enumerate() {
                    let name = column.name().to_string();
                    let value = row.get(i).map(|s| s.to_string());
                    map.insert(name, serde_json::to_value(value).unwrap_or(JsonValue::Null));
                }
                json_rows.push(JsonValue::Object(map));
            }
            // We ignore CommandComplete messages (e.g., "INSERT 0 1")
        }

        Ok(json_rows)
    })
    .await
    .map_err(PgError::from)?
}

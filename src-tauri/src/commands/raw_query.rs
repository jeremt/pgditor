use crate::error::PgError;
use crate::utils::create_secure_client;
use serde_json::{Value as JsonValue, Map};
use postgres::SimpleQueryMessage;

#[tauri::command]
pub async fn raw_query(connection_string: String, sql: String) -> Result<Vec<JsonValue>, PgError> {
    let conn = connection_string.clone();
    let sql_text = sql.clone();

    tokio::task::spawn_blocking(move || {
        let mut client = create_secure_client(&conn)?;

        // simple_query is ideal for dynamic column sets as it returns strings
        let messages = client.simple_query(&sql_text).map_err(PgError::from)?;

        let mut json_rows: Vec<JsonValue> = Vec::new();

        for message in messages {
            if let SimpleQueryMessage::Row(row) = message {
                let mut map = Map::new(); // With preserve_order, this is an IndexMap
                
                // Iterate through columns in the order defined by the SQL query
                for i in 0..row.len() {
                    let column_name = row.columns()[i].name().to_string();
                    let value = row.get(i); // Option<&str>
                    
                    map.insert(
                        column_name, 
                        value.map(JsonValue::from).unwrap_or(JsonValue::Null)
                    );
                }
                json_rows.push(JsonValue::Object(map));
            }
        }

        Ok(json_rows)
    })
    .await
    .map_err(PgError::from)?
}
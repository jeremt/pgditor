use crate::error::PgError;
use crate::utils::create_secure_client;
use postgres::SimpleQueryMessage;
use serde::Serialize; // Ensure serde is available
use serde_json::{Map, Value as JsonValue};
use std::time::Instant;

#[derive(Serialize)]
pub struct QueryResponse {
    pub rows: Vec<JsonValue>,
    pub duration_ms: u64,
}

#[tauri::command]
pub async fn raw_query(connection_string: String, sql: String) -> Result<QueryResponse, PgError> {
    let conn = connection_string.clone();
    let sql_text = sql.clone();

    tokio::task::spawn_blocking(move || {
        let mut client = create_secure_client(&conn)?;

        // Start timer
        let start = Instant::now();
        let messages = client.simple_query(&sql_text).map_err(PgError::from)?;
        let duration = start.elapsed();

        let mut json_rows: Vec<JsonValue> = Vec::new();

        for message in messages {
            if let SimpleQueryMessage::Row(row) = message {
                let mut map = Map::new();
                for i in 0..row.len() {
                    let column_name = row.columns()[i].name().to_string();
                    let value = row.get(i);
                    map.insert(
                        column_name,
                        value.map(JsonValue::from).unwrap_or(JsonValue::Null),
                    );
                }
                json_rows.push(JsonValue::Object(map));
            }
        }

        Ok(QueryResponse {
            rows: json_rows,
            duration_ms: duration.as_millis() as u64,
        })
    })
    .await
    .map_err(PgError::from)?
}
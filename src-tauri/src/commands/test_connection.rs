use crate::error::CommandError;
use crate::pg::pg_connect::pg_connect;

#[tauri::command]
pub async fn test_connection(connection_string: String) -> Result<bool, CommandError> {
    pg_connect(&connection_string).await?;
    Ok(true)
}
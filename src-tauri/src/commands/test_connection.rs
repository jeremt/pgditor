use crate::error::PgError;
use crate::utils::create_secure_client;

#[tauri::command]
pub async fn test_connection(connection_string: String) -> Result<bool, PgError> {
    let conn = connection_string.clone();

    tokio::task::spawn_blocking(move || {
        create_secure_client(&conn)?;
        Ok(true)
    })
    .await
    .map_err(PgError::from)?
}

use crate::error::CommandError;
use crate::pg::pg_connect::pg_connect;

#[tauri::command]
pub async fn list_schemas(connection_string: String, hide_system_tables: bool) -> Result<Vec<String>, CommandError> {
    let (client, connection) = pg_connect(&connection_string).await?;

    tokio::spawn(async move {
        if let Err(e) = connection.await_connection().await {
            eprintln!("DB connection error: {e}");
        }
    });

    let system_schemas_filter = if hide_system_tables {
        "nspname NOT IN ('pg_catalog', 'information_schema')"
    } else {
        "true"
    };

    let query = format!(
        r#"
        SELECT nspname AS schema_name
        FROM pg_catalog.pg_namespace
        WHERE {}
        ORDER BY nspname DESC;
        "#,
        system_schemas_filter
    );

    let rows = client.query(&query, &[]).await.map_err(CommandError::from)?;

    let schemas: Vec<String> = rows.iter().map(|row| row.get("schema_name")).collect();
    Ok(schemas)
}

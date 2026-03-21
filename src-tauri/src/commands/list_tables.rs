use crate::error::CommandError;
use crate::pg::models::PgTable;
use crate::pg::pg_connect::pg_connect;

#[tauri::command]
pub async fn list_tables(connection_string: String, hide_system_tables: bool) -> Result<Vec<PgTable>, CommandError> {
    let (client, connection) = pg_connect(&connection_string).await?;

    tokio::spawn(async move {
        if let Err(e) = connection.await_connection().await {
            eprintln!("DB connection error: {e}");
        }
    });

    let system_schemas_filter = if hide_system_tables {
        "t.table_schema NOT IN ('pg_catalog', 'information_schema')"
    } else {
        "true"
    };

    let query = format!(
        "SELECT 
            t.table_schema as schema,
            t.table_name as name,
            t.table_type as type,
            COALESCE(pg_relation_size(quote_ident(t.table_schema) || '.' || quote_ident(t.table_name))::float8 / 1024 / 1024, 0) as size_mb,
            COALESCE(
                (SELECT json_agg(column_name ORDER BY ordinal_position)::text
                FROM information_schema.columns c
                WHERE c.table_schema = t.table_schema 
                AND c.table_name = t.table_name),
                '[]'
            ) as columns
        FROM 
            information_schema.tables t
        WHERE 
            {}
        ORDER BY 
            t.table_schema DESC,
            t.table_name DESC;",
        system_schemas_filter
    );

    let rows = client.query(&query, &[]).await.map_err(CommandError::from)?;

    let tables = rows
        .iter()
        .map(|row| {
            let size_mb: f64 = row.get("size_mb");
            let columns_str: String = row.get("columns");
            let column_names: Vec<String> = serde_json::from_str(&columns_str).unwrap_or_default();

            PgTable {
                schema: row.get("schema"),
                name: row.get("name"),
                table_type: row.get("type"),
                size_mb,
                column_names,
            }
        })
        .collect();

    Ok(tables)
}
use crate::error::PgError;
use crate::models::PgTable;
use crate::utils::create_secure_client;

#[tauri::command]
pub async fn list_tables(connection_string: String) -> Result<Vec<PgTable>, PgError> {
    let conn = connection_string.clone();

    tokio::task::spawn_blocking(move || {
        let mut client = create_secure_client(&conn)?;

        let rows = client
            .query(
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
                    t.table_schema NOT IN ('pg_catalog', 'information_schema')
                ORDER BY 
                    t.table_schema,
                    t.table_name;",
                &[],
            )
            .map_err(PgError::from)?;

        let tables = rows
            .iter()
            .map(|row| {
                let size_mb: f64 = row.get("size_mb");
                let columns_str: String = row.get("columns");
                let column_names: Vec<String> = serde_json::from_str(&columns_str)
                    .unwrap_or_default();
                
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
    })
    .await
    .map_err(PgError::from)?
}

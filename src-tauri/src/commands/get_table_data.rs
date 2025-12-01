use crate::error::PgError;
use crate::models::PgTableData;
use crate::utils::{create_secure_client, quote_ident};
use serde_json::Value as JsonValue;

#[tauri::command]
pub async fn get_table_data(
    connection_string: String,
    schema: String,
    table: String,
    offset: Option<i64>,
    limit: Option<i64>,
    where_clause: Option<String>,
    order_by: Option<String>
) -> Result<PgTableData, PgError> {
    let conn = connection_string.clone();

    let offset = offset.unwrap_or(0);
    let limit = limit.unwrap_or(100);
    let where_clause = where_clause.unwrap_or_default();
    let order_by = order_by.unwrap_or_default();

    tokio::task::spawn_blocking(move || {
        let mut client = create_secure_client(&conn)?;

        let schema_q = quote_ident(&schema);
        let table_q = quote_ident(&table);

        // Check if it's a view or a table
        let check_sql = format!(
            "SELECT table_type FROM information_schema.tables WHERE table_schema = $1 AND table_name = $2"
        );
        
        let check_row = client.query_one(&check_sql, &[&schema, &table]).map_err(PgError::from)?;
        let table_type: String = check_row.get("table_type");
        let is_view = table_type.contains("VIEW");

        // Build SELECT query based on whether it's a view or table
        let select_sql = if is_view {
            format!(
                "SELECT row_to_json(t)::text as json_text FROM (SELECT * FROM {}.{} {} {} OFFSET {} LIMIT {}) t",
                schema_q, table_q, where_clause, order_by, offset, limit
            )
        } else {
            format!(
                "SELECT row_to_json(t)::text as json_text FROM (SELECT *, ctid::text as ctid FROM {}.{} {} {} OFFSET {} LIMIT {}) t",
                schema_q, table_q, where_clause, order_by, offset, limit
            )
        };

        println!("psql > {}", select_sql);

        let rows = client
            .query(&select_sql, &[])
            .map_err(PgError::from)?;

        let mut json_rows: Vec<JsonValue> = Vec::with_capacity(rows.len());
        for row in rows.iter() {
            let txt: String = row.get("json_text");
            let v: JsonValue = serde_json::from_str(&txt).map_err(PgError::from)?;
            json_rows.push(v);
        }

        let count_sql = format!(
            "SELECT count(*) as count FROM {}.{}",
            schema_q, table_q
        );

        let count_row = client.query_one(&count_sql, &[]).map_err(PgError::from)?;
        let count: i64 = count_row.get("count");

        Ok(PgTableData { rows: json_rows, count })
    })
    .await
    .map_err(PgError::from)?
}
use crate::error::CommandError;
use crate::pg::models::PgTableData;
use crate::pg::pg_connect::pg_connect;
use crate::pg::quote_ident::quote_ident;
use serde_json::Value as JsonValue;

#[tauri::command]
pub async fn get_table_data(
    connection_string: String,
    schema: String,
    table: String,
    columns: Option<String>,
    offset: Option<i64>,
    limit: Option<i64>,
    where_clause: Option<String>,
    order_by: Option<String>,
) -> Result<PgTableData, CommandError> {
    let (client, connection) = pg_connect(&connection_string).await?;

    tokio::spawn(async move {
        if let Err(e) = connection.await_connection().await {
            eprintln!("DB connection error: {e}");
        }
    });

    let columns = columns.unwrap_or("*".to_string());
    let offset = offset.unwrap_or(0);
    let where_clause = where_clause.unwrap_or_default();
    let order_by = order_by.unwrap_or_default();

    let schema_q = quote_ident(&schema);
    let table_q = quote_ident(&table);

    let select_sql = match limit {
        Some(l) if l > 0 => format!(
            "select row_to_json(t)::text as json_text from (select {} from {}.{} {} {} offset {} limit {}) t",
            columns, schema_q, table_q, where_clause, order_by, offset, l
        ),
        _ => format!(
            "select row_to_json(t)::text as json_text from (select {} from {}.{} {} {}) t",
            columns, schema_q, table_q, where_clause, order_by
        ),
    };

    println!("psql > {}", select_sql);

    let rows = client.query(&select_sql, &[]).await.map_err(CommandError::from)?;

    let mut json_rows: Vec<JsonValue> = Vec::with_capacity(rows.len());
    for row in rows.iter() {
        let txt: String = row.get("json_text");
        let v: JsonValue = serde_json::from_str(&txt).map_err(CommandError::from)?;
        json_rows.push(v);
    }

    let count_sql = format!("select count(*) as count from {}.{}", schema_q, table_q);
    let count_row = client.query_one(&count_sql, &[]).await.map_err(CommandError::from)?;
    let count: i64 = count_row.get("count");

    Ok(PgTableData { rows: json_rows, count })
}
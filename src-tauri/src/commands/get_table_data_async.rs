use tauri::Emitter;
use tauri::Manager;
use crate::error::PgError;
use crate::models::PgTableData;
use crate::utils::{create_secure_client, quote_ident};
use serde_json::Value as JsonValue;

#[tauri::command]
pub async fn get_table_data_async(
    window: tauri::Window,
    connection_string: String,
    schema: String,
    table: String,
    columns: Option<String>,
    offset: Option<i64>,
    limit: Option<i64>,
    where_clause: Option<String>,
    order_by: Option<String>,
) -> Result<(), PgError> {
    let conn = connection_string.clone();
    let app = window.app_handle().clone(); // <-- grab app handle, which is Send

    let columns = columns.unwrap_or("*".to_string());
    let offset = offset.unwrap_or(0);
    let limit = limit.unwrap_or(100);
    let where_clause = where_clause.unwrap_or_default();
    let order_by = order_by.unwrap_or_default();
println!("before spawn");
    std::thread::spawn(move || {
        let result: Result<PgTableData, PgError> = (|| {
            let mut client = create_secure_client(&conn)?;

            let schema_q = quote_ident(&schema);
            let table_q = quote_ident(&table);

            let select_sql = format!(
                "select row_to_json(t)::text as json_text from (select {} from {}.{} {} {} offset {} limit {}) t",
                columns, schema_q, table_q, where_clause, order_by, offset, limit
            );

            println!("psql > {}", select_sql);

            let rows = client.query(&select_sql, &[]).map_err(PgError::from)?;

            let mut json_rows: Vec<JsonValue> = Vec::with_capacity(rows.len());
            for row in rows.iter() {
                let txt: String = row.get("json_text");
                let v: JsonValue = serde_json::from_str(&txt).map_err(PgError::from)?;
                json_rows.push(v);
            }

            let count_sql = format!(
                "select count(*) as count from {}.{}",
                schema_q, table_q
            );

            let count_row = client.query_one(&count_sql, &[]).map_err(PgError::from)?;
            let count: i64 = count_row.get("count");

            Ok(PgTableData { rows: json_rows, count })
        })();

        match result {
            Ok(data) => {
                app.emit("get_table_data/result", data).ok();
            }
            Err(e) => {
                // app.emit("get_table_data/error", e.to_string()).ok();
            }
        }
    });
    println!("after spawn");

    Ok(())
}
use crate::error::CommandError;
use crate::pg::models::PgTableData;
use crate::pg::pg_connect::pg_connect;
use crate::pg::quote_ident::quote_ident;
use serde_json::Value as JsonValue;
use tokio_postgres::types::{Kind, Type};

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

    let limit_clause = match limit {
        Some(l) if l > 0 => format!("offset {} limit {}", offset, l),
        _ => String::new(),
    };
    let inner_sql = format!(
        "select {} from {}.{} {} {} {}",
        columns, schema_q, table_q, where_clause, order_by, limit_clause
    );

    // `row_to_json` writes int8 and numeric as JSON numbers, which lose precision past 2^53 once
    // parsed by the webview, so send them as strings instead.
    let statement = client.prepare(&inner_sql).await.map_err(CommandError::from)?;
    let casts: Vec<Option<&str>> = statement.columns().iter().map(|c| text_cast(c.type_())).collect();
    let select_sql = if casts.iter().any(Option::is_some) {
        let select_list = statement
            .columns()
            .iter()
            .zip(casts)
            .map(|(column, cast)| {
                let name = quote_ident(column.name());
                match cast {
                    Some(cast) => format!("t.{name}::{cast} as {name}"),
                    None => format!("t.{name}"),
                }
            })
            .collect::<Vec<_>>()
            .join(", ");
        format!(
            "select row_to_json(r)::text as json_text from (select {} from ({}) t) r",
            select_list, inner_sql
        )
    } else {
        format!("select row_to_json(t)::text as json_text from ({}) t", inner_sql)
    };

    println!("psql > {}", select_sql);

    let rows = client.query(&select_sql, &[]).await.map_err(CommandError::from)?;

    let mut json_rows: Vec<JsonValue> = Vec::with_capacity(rows.len());
    for row in rows.iter() {
        let txt: String = row.get("json_text");
        let v: JsonValue = serde_json::from_str(&txt).map_err(CommandError::from)?;
        json_rows.push(v);
    }

    let count_sql = format!(
        "select count(*) as count from {}.{} {}",
        schema_q, table_q, where_clause
    );
    let count_row = client.query_one(&count_sql, &[]).await.map_err(CommandError::from)?;
    let count: i64 = count_row.get("count");

    Ok(PgTableData { rows: json_rows, count })
}

/// The type to cast a column to so that `row_to_json` doesn't write it as a JSON number that
/// JavaScript can't represent exactly.
fn text_cast(ty: &Type) -> Option<&'static str> {
    match ty.kind() {
        Kind::Domain(base) => text_cast(base),
        Kind::Array(element) => text_cast(element).map(|_| "text[]"),
        _ if *ty == Type::INT8 || *ty == Type::NUMERIC => Some("text"),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn casts_int8_and_numeric_to_text() {
        assert_eq!(text_cast(&Type::INT8), Some("text"));
        assert_eq!(text_cast(&Type::NUMERIC), Some("text"));
        assert_eq!(text_cast(&Type::INT8_ARRAY), Some("text[]"));
        assert_eq!(text_cast(&Type::NUMERIC_ARRAY), Some("text[]"));
    }

    #[test]
    fn casts_domains_over_int8() {
        let domain = Type::new("snowflake".into(), 90000, Kind::Domain(Type::INT8), "public".into());
        assert_eq!(text_cast(&domain), Some("text"));
    }

    #[test]
    fn keeps_other_types() {
        for ty in [Type::INT4, Type::INT2, Type::FLOAT8, Type::FLOAT4, Type::TEXT, Type::JSONB] {
            assert_eq!(text_cast(&ty), None);
        }
        assert_eq!(text_cast(&Type::INT4_ARRAY), None);
    }
}

use native_tls::TlsConnector;
use postgres_native_tls::MakeTlsConnector;
use serde::Serialize;
use serde_json::Value as JsonValue;
use tauri::Emitter;

#[derive(Debug, Serialize)]
struct PgError {
    message: String,
    code: Option<String>,
    detail: Option<String>,
    hint: Option<String>,
    position: Option<String>,
}

impl From<postgres::Error> for PgError {
    fn from(err: postgres::Error) -> Self {
        let db_error = err.as_db_error();

        PgError {
            message: db_error
                .map(|e| e.message().to_string())
                .unwrap_or_else(|| err.to_string()),
            code: db_error.map(|e| e.code().code().to_string()),
            detail: db_error.and_then(|e| e.detail().map(String::from)),
            hint: db_error.and_then(|e| e.hint().map(String::from)),
            position: db_error.and_then(|e| e.position().map(|p| format!("{:?}", p))),
        }
    }
}

impl From<String> for PgError {
    fn from(message: String) -> Self {
        PgError {
            message,
            code: None,
            detail: None,
            hint: None,
            position: None,
        }
    }
}

impl From<&str> for PgError {
    fn from(message: &str) -> Self {
        PgError {
            message: message.to_string(),
            code: None,
            detail: None,
            hint: None,
            position: None,
        }
    }
}

impl From<serde_json::Error> for PgError {
    fn from(err: serde_json::Error) -> Self {
        PgError {
            message: format!("JSON error: {}", err),
            code: None,
            detail: None,
            hint: None,
            position: None,
        }
    }
}

impl From<tokio::task::JoinError> for PgError {
    fn from(err: tokio::task::JoinError) -> Self {
        PgError {
            message: format!("Task execution failed: {}", err),
            code: None,
            detail: None,
            hint: None,
            position: None,
        }
    }
}

impl From<native_tls::Error> for PgError {
    fn from(err: native_tls::Error) -> Self {
        PgError {
            message: format!("TLS error: {}", err),
            code: None,
            detail: None,
            hint: None,
            position: None,
        }
    }
}

#[derive(Debug, Serialize)]
struct PgTable {
    schema: String,
    name: String,
    #[serde(rename = "type")]
    table_type: String,
    size_mb: f64,
    column_names: Vec<String>
}

#[derive(Debug, Serialize)]
struct PgColumn {
    column_name: String,
    data_type: String,
    is_nullable: String,
    column_default: Option<String>,
    is_primary_key: String,
    foreign_table_schema: Option<String>,
    foreign_table_name: Option<String>,
    foreign_column_name: Option<String>,
    enum_values: Option<Vec<String>>,
}

#[derive(Debug, Serialize)]
struct PgTableData {
    rows: Vec<JsonValue>,
    count: i64,
}

fn quote_ident(s: &str) -> String {
    format!("\"{}\"", s.replace('"', "\"\""))
}

// Helper function to create a secure connection
fn create_secure_client(connection_string: &str) -> Result<postgres::Client, PgError> {
    // Check if the connection string requires SSL
    let requires_ssl = connection_string.contains("sslmode=require")
        || connection_string.contains("sslmode=verify-ca")
        || connection_string.contains("sslmode=verify-full");

    if requires_ssl {
        // Use TLS for secure connections
        let connector = TlsConnector::builder().build().map_err(PgError::from)?;
        let connector = MakeTlsConnector::new(connector);

        postgres::Client::connect(connection_string, connector).map_err(PgError::from)
    } else {
        // Use NoTls for local/non-SSL connections
        postgres::Client::connect(connection_string, postgres::NoTls).map_err(PgError::from)
    }
}

#[tauri::command]
async fn test_connection(connection_string: String) -> Result<bool, PgError> {
    let conn = connection_string.clone();

    tokio::task::spawn_blocking(move || {
        create_secure_client(&conn)?;
        Ok(true)
    })
    .await
    .map_err(PgError::from)?
}

#[tauri::command]
async fn list_tables(connection_string: String) -> Result<Vec<PgTable>, PgError> {
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

#[tauri::command]
async fn list_table_columns(
    connection_string: String,
    schema: String,
    table: String,
) -> Result<Vec<PgColumn>, PgError> {
    let conn = connection_string.clone();

    tokio::task::spawn_blocking(move || {
        let mut client = create_secure_client(&conn)?;
        
        let query = r#"
            SELECT 
                c.column_name,
                CASE 
                    WHEN a.atttypmod > 0 AND t.typname IN ('varchar', 'bpchar', 'numeric') 
                    THEN t.typname || '(' || (a.atttypmod - 4) || ')'
                    WHEN a.atttypmod > 0 AND t.typname = 'numeric'
                    THEN t.typname || '(' || ((a.atttypmod - 4) >> 16) || ',' || ((a.atttypmod - 4) & 65535) || ')'
                    ELSE t.typname
                END AS data_type,
                c.is_nullable,
                c.column_default,
                CASE WHEN pk.column_name IS NOT NULL THEN 'YES' ELSE 'NO' END AS is_primary_key,
                fk.foreign_table_schema,
                fk.foreign_table_name,
                fk.foreign_column_name,
                t.typtype AS type_category
            FROM 
                information_schema.columns AS c
            INNER JOIN pg_catalog.pg_namespace AS n
                ON n.nspname = c.table_schema
            INNER JOIN pg_catalog.pg_class AS cls
                ON cls.relnamespace = n.oid
                AND cls.relname = c.table_name
            INNER JOIN pg_catalog.pg_attribute AS a
                ON a.attrelid = cls.oid
                AND a.attname = c.column_name
            INNER JOIN pg_catalog.pg_type AS t
                ON a.atttypid = t.oid
            LEFT JOIN (
                SELECT kcu.table_schema, kcu.table_name, kcu.column_name
                FROM information_schema.key_column_usage AS kcu
                INNER JOIN information_schema.table_constraints AS tc
                    ON kcu.constraint_name = tc.constraint_name
                    AND kcu.table_schema = tc.table_schema
                    AND tc.constraint_type = 'PRIMARY KEY'
            ) AS pk
                ON c.table_schema = pk.table_schema
                AND c.table_name = pk.table_name
                AND c.column_name = pk.column_name
            LEFT JOIN (
                SELECT 
                    kcu.table_schema,
                    kcu.table_name,
                    kcu.column_name,
                    ccu.table_schema AS foreign_table_schema,
                    ccu.table_name AS foreign_table_name,
                    ccu.column_name AS foreign_column_name
                FROM information_schema.key_column_usage AS kcu
                INNER JOIN information_schema.table_constraints AS tc
                    ON kcu.constraint_name = tc.constraint_name
                    AND kcu.table_schema = tc.table_schema
                    AND tc.constraint_type = 'FOREIGN KEY'
                INNER JOIN information_schema.constraint_column_usage AS ccu
                    ON kcu.constraint_name = ccu.constraint_name
                    AND kcu.table_schema = ccu.constraint_schema
            ) AS fk
                ON c.table_schema = fk.table_schema
                AND c.table_name = fk.table_name
                AND c.column_name = fk.column_name
            WHERE 
                c.table_schema = $1
                AND c.table_name = $2
            ORDER BY 
                c.ordinal_position;
        "#;

        let rows = client.query(query, &[&schema, &table])
            .map_err(PgError::from)?;

        let columns = rows.iter().map(|row| {
            let data_type: String = row.get("data_type");
            let type_category: i8 = row.get("type_category");

            // Fetch enum values if this is an enum type
            let enum_values = if type_category == b'e' as i8 {
                fetch_enum_values(&mut client, &data_type).ok()
            } else {
                None
            };
            
            PgColumn {
                column_name: row.get("column_name"),
                data_type,
                is_nullable: row.get("is_nullable"),
                column_default: row.get("column_default"),
                is_primary_key: row.get("is_primary_key"),
                foreign_table_schema: row.get("foreign_table_schema"),
                foreign_table_name: row.get("foreign_table_name"),
                foreign_column_name: row.get("foreign_column_name"),
                enum_values,
            }
        }).collect();

        Ok(columns)
    })
    .await
    .map_err(PgError::from)?
}

fn fetch_enum_values(
    client: &mut postgres::Client,
    enum_type: &str,
) -> Result<Vec<String>, PgError> {
    let query = r#"
        SELECT e.enumlabel
        FROM pg_catalog.pg_type t
        JOIN pg_catalog.pg_enum e ON t.oid = e.enumtypid
        WHERE t.typname = $1
        ORDER BY e.enumsortorder;
    "#;

    let rows = client.query(query, &[&enum_type]).map_err(PgError::from)?;

    Ok(rows.iter().map(|row| row.get("enumlabel")).collect())
}

#[tauri::command]
async fn get_table_data(
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

        let select_sql = format!(
            "SELECT row_to_json(t)::text as json_text FROM (SELECT *, ctid::text as ctid FROM {}.{} {} {} OFFSET {} LIMIT {}) t",
            schema_q, table_q, where_clause, order_by, offset, limit
        );

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

use postgres::SimpleQueryMessage;

#[tauri::command]
async fn raw_query(connection_string: String, sql: String) -> Result<Vec<JsonValue>, PgError> {
    let conn = connection_string.clone();
    let sql_text = sql.clone();

    tokio::task::spawn_blocking(move || {
        let mut client = create_secure_client(&conn)?;

        println!("psql > {}", sql_text);

        // simple_query returns all values as strings, which is exactly what we want.
        // It supports multiple queries in one string, returning a stream of messages.
        let messages = client.simple_query(&sql_text).map_err(PgError::from)?;

        let mut json_rows: Vec<JsonValue> = Vec::new();

        for message in messages {
            if let SimpleQueryMessage::Row(row) = message {
                let mut map = serde_json::Map::new();
                for (i, column) in row.columns().iter().enumerate() {
                    let name = column.name().to_string();
                    let value = row.get(i).map(|s| s.to_string());
                    map.insert(name, serde_json::to_value(value).unwrap_or(JsonValue::Null));
                }
                json_rows.push(JsonValue::Object(map));
            }
            // We ignore CommandComplete messages (e.g., "INSERT 0 1")
        }

        Ok(json_rows)
    })
    .await
    .map_err(PgError::from)?
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_sql::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .on_menu_event(|app, event| {
            let event_id = event.id.0.as_str();
            // emit all menu events to the frontend so the UI can react
            let _ = app.emit("menu-event", event_id);
        })
        .invoke_handler(tauri::generate_handler![
            test_connection,
            list_tables,
            list_table_columns,
            get_table_data,
            raw_query
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

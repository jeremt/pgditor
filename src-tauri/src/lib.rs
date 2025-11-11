
use serde::Serialize;
use serde_json::Value as JsonValue;

#[derive(Debug, Serialize)]
struct PgTable {
    schema: String,
    name: String,
    #[serde(rename = "type")]
    table_type: String,
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
}

#[derive(Debug, Serialize)]
struct PgTableData {
    rows: Vec<JsonValue>,
    count: i64,
}

fn quote_ident(s: &str) -> String {
    // double-quote identifier and escape any existing double quotes by doubling them
    format!("\"{}\"", s.replace('"', "\"\""))
}

#[tauri::command]
async fn test_connection(connection_string: String) -> Result<bool, String> {
    let conn = connection_string.clone();

    let result = tokio::task::spawn_blocking(move || {
        match postgres::Client::connect(&conn, postgres::NoTls) {
            Ok(_) => Ok(true),
            Err(e) => Err(e.to_string()),
        }
    })
    .await
    .map_err(|e| e.to_string())?;

    result
}

#[tauri::command]
async fn list_tables(connection_string: String) -> Result<Vec<PgTable>, String> {
    let conn = connection_string.clone();
    
    tokio::task::spawn_blocking(move || {
        let mut client = postgres::Client::connect(&conn, postgres::NoTls)
            .map_err(|e| e.to_string())?;
        
        let rows = client.query(
            "SELECT 
                table_schema as schema,
                table_name as name,
                table_type as type
            FROM 
                information_schema.tables
            WHERE 
                table_schema NOT IN ('pg_catalog', 'information_schema')
            ORDER BY 
                table_schema,
                table_name;",
            &[],
        ).map_err(|e| e.to_string())?;

        let tables = rows.iter().map(|row| PgTable {
            schema: row.get("schema"),
            name: row.get("name"),
            table_type: row.get("type"),
        }).collect();

        Ok(tables)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn list_table_columns(connection_string: String, schema: String, table: String) -> Result<Vec<PgColumn>, String> {
    let conn = connection_string.clone();
    
    tokio::task::spawn_blocking(move || {
        let mut client = postgres::Client::connect(&conn, postgres::NoTls)
            .map_err(|e| e.to_string())?;
        
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
                fk.foreign_column_name
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
            .map_err(|e| e.to_string())?;

        let columns = rows.iter().map(|row| PgColumn {
            column_name: row.get("column_name"),
            data_type: row.get("data_type"),
            is_nullable: row.get("is_nullable"),
            column_default: row.get("column_default"),
            is_primary_key: row.get("is_primary_key"),
            foreign_table_schema: row.get("foreign_table_schema"),
            foreign_table_name: row.get("foreign_table_name"),
            foreign_column_name: row.get("foreign_column_name"),
        }).collect();

        Ok(columns)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn get_table_data(
    connection_string: String,
    schema: String,
    table: String,
    offset: Option<i64>,
    limit: Option<i64>,
    where_clause: Option<String>,
) -> Result<PgTableData, String> {
    let conn = connection_string.clone();

    let offset = offset.unwrap_or(0);
    let limit = limit.unwrap_or(100);
    let where_clause = where_clause.unwrap_or_default();

    tokio::task::spawn_blocking(move || {
        let mut client = postgres::Client::connect(&conn, postgres::NoTls)
            .map_err(|e| e.to_string())?;

        let schema_q = quote_ident(&schema);
        let table_q = quote_ident(&table);

        let select_sql = format!(
            "SELECT row_to_json(t)::text as json_text FROM (SELECT *, ctid::text as ctid FROM {}.{} {} OFFSET {} LIMIT {}) t",
            schema_q, table_q, where_clause, offset, limit
        );

        println!("psql > {}", select_sql);

        let rows = client
            .query(&select_sql, &[])
            .map_err(|e| e.to_string())?;

        let mut json_rows: Vec<JsonValue> = Vec::with_capacity(rows.len());
        for row in rows.iter() {
            let txt: String = row.get("json_text");
            let v: JsonValue = serde_json::from_str(&txt).map_err(|e| e.to_string())?;
            json_rows.push(v);
        }

        let count_sql = format!(
            "SELECT count(*) as count FROM {}.{}",
            schema_q, table_q
        );

        let count_row = client.query_one(&count_sql, &[]).map_err(|e| e.to_string())?;
        let count: i64 = count_row.get("count");

        Ok(PgTableData { rows: json_rows, count })
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn raw_query(connection_string: String, sql: String) -> Result<i64, String> {
    let conn = connection_string.clone();
    let sql_text = sql.clone();

    tokio::task::spawn_blocking(move || {
        let mut client = postgres::Client::connect(&conn, postgres::NoTls)
            .map_err(|e| e.to_string())?;

        println!("psql > {}", sql_text);

        let affected = client.execute(&sql_text, &[]).map_err(|e| e.to_string())?;

        Ok(affected as i64)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_sql::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
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

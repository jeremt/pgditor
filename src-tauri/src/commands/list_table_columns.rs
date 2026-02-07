use crate::error::PgError;
use crate::models::PgColumn;
use crate::utils::create_secure_client;

#[tauri::command]
pub async fn list_table_columns(
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
                t.typname AS data_type,
                substring(format_type(a.atttypid, a.atttypmod) from '\(.*\)') AS data_type_params,
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
                data_type_params: row.get("data_type_params"),
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

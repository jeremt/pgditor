use serde::Serialize;
use serde_json::Value as JsonValue;

#[derive(Debug, Serialize)]
pub struct PgTable {
    pub schema: String,
    pub name: String,
    #[serde(rename = "type")]
    pub table_type: String,
    pub size_mb: f64,
    pub column_names: Vec<String>,
}

#[derive(Debug, Serialize)]
pub struct PgColumn {
    pub column_name: String,
    pub data_type: String,
    pub data_type_params: Option<String>,
    pub is_nullable: String,
    pub column_default: Option<String>,
    pub is_primary_key: String,
    pub foreign_table_schema: Option<String>,
    pub foreign_table_name: Option<String>,
    pub foreign_column_name: Option<String>,
    pub enum_values: Option<Vec<String>>,
}

#[derive(Debug, Serialize)]
pub struct PgTableForGraph {
    pub schema: String,
    pub name: String,
    #[serde(rename = "type")]
    pub table_type: String,
    pub columns: Vec<PgColumn>,
}

#[derive(Debug, Serialize, Clone)]
pub struct PgTableData {
    pub rows: Vec<JsonValue>,
    pub count: i64,
}

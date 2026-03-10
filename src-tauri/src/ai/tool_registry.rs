// tool_registry.rs
use std::{collections::HashMap, future::Future, pin::Pin, sync::Arc};
use serde_json::{json, Value};
use tauri::AppHandle;

use crate::pg::pg_connect::SharedDb;

// ── Handler type ──────────────────────────────────────────────────────────────
//
// Each tool handler receives the parsed args and returns a plain String result.
// We box the future so handlers can be stored in a HashMap without generics.

pub type ToolFuture = Pin<Box<dyn Future<Output = String> + Send>>;
pub type ToolHandler = Arc<dyn Fn(Value) -> ToolFuture + Send + Sync>;

// ── A single registered tool ──────────────────────────────────────────────────

pub struct ToolDef {
    pub name:        String,
    pub description: String,
    pub parameters:  Value,   // JSON Schema object
    handler:         ToolHandler,
}

// ── Registry ──────────────────────────────────────────────────────────────────

#[derive(Default)]
pub struct ToolRegistry {
    tools: HashMap<String, ToolDef>,
}

impl ToolRegistry {
    pub fn new() -> Self {
        Self::default()
    }

    /// Register a tool.
    ///
    /// ```rust
    /// registry.add_tool(
    ///     "search_tables",
    ///     "Search tables by pattern",
    ///     json!({ "type": "object", "properties": { ... }, "required": [...] }),
    ///     |args| async move { /* ... */ "result".to_string() },
    /// );
    /// ```
    pub fn add_tool<F, Fut>(
        &mut self,
        name:        impl Into<String>,
        description: impl Into<String>,
        parameters:  Value,
        handler:     F,
    ) where
        F:   Fn(Value) -> Fut + Send + Sync + 'static,
        Fut: Future<Output = String> + Send + 'static,
    {
        let name = name.into();
        let boxed: ToolHandler = Arc::new(move |args| Box::pin(handler(args)));
        self.tools.insert(name.clone(), ToolDef { name, description: description.into(), parameters, handler: boxed });
    }

    /// Call a registered tool by name.
    pub async fn call(&self, name: &str, args: Value) -> String {
        match self.tools.get(name) {
            Some(def) => (def.handler)(args).await,
            None      => format!("Unknown tool: {name}"),
        }
    }

    /// Serialize all tools into the OpenAI `tools` array format.
    pub fn to_openai_tools(&self) -> Value {
        let defs: Vec<Value> = self.tools.values().map(|def| json!({
            "type": "function",
            "name": def.name,
            "description": def.description,
            "parameters": def.parameters,
        })).collect();
        json!(defs)
    }
}

// ── Builder that wires up the DB-backed tools ─────────────────────────────────

pub fn build_db_registry(app: AppHandle, db: SharedDb) -> ToolRegistry {
    let mut registry = ToolRegistry::new();

    // ── get_table_schema ──────────────────────────────────────────────────────
    {
        let db = db.clone();
        registry.add_tool(
            "get_table_schema",
            "Get the full column schema for a specific table, including data types, \
             nullability, primary keys, foreign keys, and enum values.",
            json!({
                "type": "object",
                "properties": {
                    "schema": { "type": "string", "description": "The schema name, e.g. 'public'" },
                    "table":  { "type": "string", "description": "The table name, e.g. 'users'" }
                },
                "required": ["schema", "table"]
            }),
            move |args| {
                let db = db.clone();
                async move {
                    let schema = args["schema"].as_str().unwrap_or("public").to_string();
                    let table  = args["table"].as_str().unwrap_or("").to_string();
                    let client = db.lock().await;

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
                        FROM information_schema.columns AS c
                        INNER JOIN pg_catalog.pg_namespace AS n
                            ON n.nspname = c.table_schema
                        INNER JOIN pg_catalog.pg_class AS cls
                            ON cls.relnamespace = n.oid AND cls.relname = c.table_name
                        INNER JOIN pg_catalog.pg_attribute AS a
                            ON a.attrelid = cls.oid AND a.attname = c.column_name
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
                                kcu.table_schema, kcu.table_name, kcu.column_name,
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
                        WHERE c.table_schema = $1 AND c.table_name = $2
                        ORDER BY c.ordinal_position
                    "#;

                    match client.query(query, &[&schema, &table]).await {
                        Err(e) => format!("DB error: {e}"),
                        Ok(rows) => {
                            let columns: Vec<Value> = rows.iter().map(|row| {
                                let type_category: i8 = row.get("type_category");
                                let data_type: &str   = row.get("data_type");
                                json!({
                                    "column_name":          row.get::<_, &str>("column_name"),
                                    "data_type":            data_type,
                                    "data_type_params":     row.get::<_, Option<&str>>("data_type_params"),
                                    "is_nullable":          row.get::<_, &str>("is_nullable"),
                                    "column_default":       row.get::<_, Option<&str>>("column_default"),
                                    "is_primary_key":       row.get::<_, &str>("is_primary_key"),
                                    "foreign_table_schema": row.get::<_, Option<&str>>("foreign_table_schema"),
                                    "foreign_table_name":   row.get::<_, Option<&str>>("foreign_table_name"),
                                    "foreign_column_name":  row.get::<_, Option<&str>>("foreign_column_name"),
                                    "is_enum":              type_category == b'e' as i8,
                                })
                            }).collect();

                            let mut enriched = Vec::with_capacity(columns.len());
                            for col in columns {
                                let mut col = col;
                                if col["is_enum"].as_bool().unwrap_or(false) {
                                    let type_name = col["data_type"].as_str().unwrap_or("").to_string();
                                    let enum_rows = client.query(
                                        "SELECT e.enumlabel \
                                         FROM pg_catalog.pg_type t \
                                         JOIN pg_catalog.pg_enum e ON t.oid = e.enumtypid \
                                         WHERE t.typname = $1 \
                                         ORDER BY e.enumsortorder",
                                        &[&type_name],
                                    ).await;
                                    if let Ok(erows) = enum_rows {
                                        let values: Vec<&str> = erows.iter()
                                            .map(|r| r.get("enumlabel"))
                                            .collect();
                                        col["enum_values"] = json!(values);
                                    }
                                }
                                enriched.push(col);
                            }
                            json!(enriched).to_string()
                        }
                    }
                }
            },
        );
    }

    // ── search_tables ─────────────────────────────────────────────────────────
    {
        let db = db.clone();
        registry.add_tool(
            "search_tables",
            "Search PostgreSQL tables by pattern (schema.table format). \
             Supports ILIKE wildcards, e.g. 'public.user%'.",
            json!({
                "type": "object",
                "properties": {
                    "pattern": {
                        "type": "string",
                        "description": "Search pattern in 'schema.table' format. \
                                        Supports SQL ILIKE wildcards (% and _)."
                    }
                },
                "required": ["pattern"]
            }),
            move |args| {
                let db = db.clone();
                async move {
                    let pattern = args["pattern"].as_str().unwrap_or("%.%").to_string();
                    let (schema_pat, table_pat) = match pattern.split_once('.') {
                        Some((s, t)) => (s.to_string(), t.to_string()),
                        None         => ("%".to_string(), pattern.clone()),
                    };
                    let client = db.lock().await;
                    match client.query(
                        "SELECT table_schema, table_name \
                         FROM information_schema.tables \
                         WHERE table_schema ILIKE $1 AND table_name ILIKE $2 \
                         ORDER BY table_schema, table_name",
                        &[&schema_pat, &table_pat],
                    ).await {
                        Err(e) => format!("DB error: {e}"),
                        Ok(rows) => {
                            let tables: Vec<Value> = rows.iter().map(|row| {
                                let schema: &str = row.get(0);
                                let table:  &str = row.get(1);
                                json!({ "schema": schema, "table": table, "qualified": format!("{schema}.{table}") })
                            }).collect();
                            json!(tables).to_string()
                        }
                    }
                }
            },
        );
    }

    registry
}
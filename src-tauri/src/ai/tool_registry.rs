// tool_registry.rs
use std::{collections::HashMap, future::Future, pin::Pin, sync::Arc};
use serde_json::{json, Value};

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

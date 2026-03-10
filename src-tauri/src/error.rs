use serde::Serialize;

use crate::pg::pg_connect::PgConnectError;

#[derive(Debug, Serialize)]
pub struct CommandError {
    message: String,
    code: Option<String>,
    detail: Option<String>,
    hint: Option<String>,
    position: Option<String>,
}

impl From<postgres::Error> for CommandError {
    fn from(err: postgres::Error) -> Self {
        let db_error = err.as_db_error();

        CommandError {
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

impl From<String> for CommandError {
    fn from(message: String) -> Self {
        CommandError {
            message,
            code: None,
            detail: None,
            hint: None,
            position: None,
        }
    }
}

impl From<&str> for CommandError {
    fn from(message: &str) -> Self {
        CommandError {
            message: message.to_string(),
            code: None,
            detail: None,
            hint: None,
            position: None,
        }
    }
}

impl From<serde_json::Error> for CommandError {
    fn from(err: serde_json::Error) -> Self {
        CommandError {
            message: format!("JSON error: {}", err),
            code: None,
            detail: None,
            hint: None,
            position: None,
        }
    }
}

impl From<tokio::task::JoinError> for CommandError {
    fn from(err: tokio::task::JoinError) -> Self {
        CommandError {
            message: format!("Task execution failed: {}", err),
            code: None,
            detail: None,
            hint: None,
            position: None,
        }
    }
}

impl From<native_tls::Error> for CommandError {
    fn from(err: native_tls::Error) -> Self {
        CommandError {
            message: format!("TLS error: {}", err),
            code: None,
            detail: None,
            hint: None,
            position: None,
        }
    }
}

impl std::fmt::Display for CommandError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.message)
    }
}

impl From<PgConnectError> for CommandError {
    fn from(err: PgConnectError) -> Self {
        CommandError {
            message: err.message,
            code: None,
            detail: None,
            hint: None,
            position: None,
        }
    }
}
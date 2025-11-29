use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct PgError {
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

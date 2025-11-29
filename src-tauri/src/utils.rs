use native_tls::TlsConnector;
use postgres_native_tls::MakeTlsConnector;
use crate::error::PgError;

pub fn quote_ident(s: &str) -> String {
    format!("\"{}\"", s.replace('"', "\"\""))
}

// Helper function to create a secure connection
pub fn create_secure_client(connection_string: &str) -> Result<postgres::Client, PgError> {
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

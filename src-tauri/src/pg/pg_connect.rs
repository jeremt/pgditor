use std::sync::Arc;

use futures::lock::Mutex;
use native_tls::TlsConnector;
use postgres_native_tls::MakeTlsConnector;
use tokio_postgres::{Client as PgClient, Connection, Socket};
use tokio_postgres::tls::NoTlsStream;
use postgres_native_tls::TlsStream;

pub type SharedDb = Arc<Mutex<PgClient>>;

pub enum PgConnection {
    NoTls(Connection<Socket, NoTlsStream>),
    Tls(Connection<Socket, TlsStream<Socket>>),
}

impl PgConnection {
    pub async fn await_connection(self) -> Result<(), tokio_postgres::Error> {
        match self {
            PgConnection::NoTls(conn) => conn.await,
            PgConnection::Tls(conn) => conn.await,
        }
    }
}

pub async fn pg_connect(
    connection_string: &str,
) -> Result<(PgClient, PgConnection), String> {
    let requires_ssl = connection_string.contains("sslmode=require")
        || connection_string.contains("sslmode=verify-ca")
        || connection_string.contains("sslmode=verify-full");

    if requires_ssl {
        let connector = TlsConnector::builder()
            .build()
            .map_err(|e| e.to_string())?;

        let tls = MakeTlsConnector::new(connector);

        let (client, conn) = tokio_postgres::connect(connection_string, tls)
            .await
            .map_err(|e| e.to_string())?;

        Ok((client, PgConnection::Tls(conn)))
    } else {
        let (client, conn) = tokio_postgres::connect(connection_string, tokio_postgres::NoTls)
            .await
            .map_err(|e| e.to_string())?;

        Ok((client, PgConnection::NoTls(conn)))
    }
}
use std::{net::SocketAddr, path::PathBuf};

use anyhow::Context;
use argon2::{password_hash::{PasswordHash, PasswordHasher, PasswordVerifier, SaltString}, Argon2};
use axum::{
    extract::Extension,
    extract::DefaultBodyLimit,
    extract::{Multipart, Path as AxumPath, State},
    http::{HeaderValue, StatusCode},
    middleware,
    response::IntoResponse,
    routing::{delete, get, patch, post},
    Json, Router,
};
use chrono::{DateTime, Utc};
use jsonwebtoken::{DecodingKey, EncodingKey, Header, Validation};
use rand_core::OsRng;
use serde::{Deserialize, Serialize};
use sqlx::{postgres::PgPoolOptions, PgPool};
use tower_http::{cors::CorsLayer, trace::TraceLayer};
use tracing::{error, info};
use uuid::Uuid;

#[derive(Clone)]
struct AppState {
    pool: PgPool,
    jwt: JwtKeys,
    storage_root: PathBuf,
}

#[derive(Clone)]
struct JwtKeys {
    encoding: EncodingKey,
    decoding: DecodingKey,
}

#[derive(Debug, Serialize, Deserialize)]
struct Claims {
    sub: String,
    role: String,
    exp: usize,
}

#[derive(Debug, Deserialize, sqlx::FromRow)]
struct DbUser {
    id: Uuid,
    username: String,
    email: String,
    role: String,
    created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct PublicUser {
    id: Uuid,
    username: String,
    email: String,
    role: String,
    created_at: DateTime<Utc>,
}

impl From<DbUser> for PublicUser {
    fn from(u: DbUser) -> Self {
        Self {
            id: u.id,
            username: u.username,
            email: u.email,
            role: u.role,
            created_at: u.created_at,
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
struct LoginRequest {
    email: String,
    password: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct LoginResponse {
    token: String,
    user: PublicUser,
}

#[derive(Debug, Serialize, Deserialize)]
struct CreateUserRequest {
    username: String,
    email: String,
    password: String,
    role: String,
}

#[derive(Debug, Serialize)]
struct DirectoryUser {
    id: Uuid,
    username: String,
    email: String,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
struct DocumentRow {
    id: Uuid,
    name: String,
    mime_type: String,
    size: i64,
    notes: String,
    owner_id: Uuid,
    owner_name: String,
    permission: String,
    allowed_users: Vec<Uuid>,
    is_generated: bool,
    storage_rel_path: String,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct DocumentDto {
    id: Uuid,
    name: String,
    r#type: String,
    size: i64,
    notes: String,
    owner_id: Uuid,
    owner_name: String,
    permission: String,
    allowed_users: Vec<Uuid>,
    is_generated: bool,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct DocumentApiDto {
    id: Uuid,
    name: String,
    r#type: String,
    size: i64,
    notes: String,
    owner_id: Uuid,
    owner_name: String,
    permission: String,
    allowed_users: Vec<Uuid>,
    is_generated: bool,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}

impl From<DocumentDto> for DocumentApiDto {
    fn from(d: DocumentDto) -> Self {
        Self {
            id: d.id,
            name: d.name,
            r#type: d.r#type,
            size: d.size,
            notes: d.notes,
            owner_id: d.owner_id,
            owner_name: d.owner_name,
            permission: d.permission,
            allowed_users: d.allowed_users,
            is_generated: d.is_generated,
            created_at: d.created_at,
            updated_at: d.updated_at,
        }
    }
}

impl From<DocumentRow> for DocumentDto {
    fn from(r: DocumentRow) -> Self {
        Self {
            id: r.id,
            name: r.name,
            r#type: r.mime_type,
            size: r.size,
            notes: r.notes,
            owner_id: r.owner_id,
            owner_name: r.owner_name,
            permission: r.permission,
            allowed_users: r.allowed_users,
            is_generated: r.is_generated,
            created_at: r.created_at,
            updated_at: r.updated_at,
        }
    }
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .init();

    let database_url = std::env::var("DATABASE_URL").context("DATABASE_URL is required")?;
    let jwt_secret = std::env::var("JWT_SECRET").context("JWT_SECRET is required")?;
    let storage_root = std::env::var("STORAGE_ROOT").unwrap_or_else(|_| "../data/documents".to_string());
    let addr: SocketAddr = std::env::var("BIND_ADDR")
        .unwrap_or_else(|_| "127.0.0.1:8752".to_string())
        .parse()
        .context("Invalid BIND_ADDR")?;

    let pool = PgPoolOptions::new()
        .max_connections(10)
        .connect(&database_url)
        .await
        .context("Failed to connect to Postgres")?;

    sqlx::migrate!().run(&pool).await.context("Migration failed")?;

    ensure_default_admin(&pool).await?;

    let state = AppState {
        pool,
        jwt: JwtKeys {
            encoding: EncodingKey::from_secret(jwt_secret.as_bytes()),
            decoding: DecodingKey::from_secret(jwt_secret.as_bytes()),
        },
        storage_root: PathBuf::from(storage_root),
    };

    tokio::fs::create_dir_all(&state.storage_root).await.ok();

    let cors = CorsLayer::new()
        .allow_origin([
            "http://localhost:5173".parse::<HeaderValue>().unwrap(),
            "http://127.0.0.1:5173".parse::<HeaderValue>().unwrap(),
            "http://localhost:8080".parse::<HeaderValue>().unwrap(),
            "http://127.0.0.1:8080".parse::<HeaderValue>().unwrap(),
            "http://localhost:9080".parse::<HeaderValue>().unwrap(),
            "http://127.0.0.1:9080".parse::<HeaderValue>().unwrap(),
        ])
        .allow_methods(tower_http::cors::Any)
        .allow_headers(tower_http::cors::Any);

    let app = Router::new()
        .route("/healthz", get(healthz))
        .route("/auth/login", post(login))
        .route("/user-directory", get(list_user_directory))
        .route("/me", get(me))
        .route("/users", get(list_users).post(create_user))
        .route("/users/{id}", delete(delete_user))
        .route("/documents", get(list_documents).post(upload_document))
        .route("/documents/{id}", patch(patch_document).delete(delete_document))
        .route("/documents/{id}/download", get(download_document))
        .layer(DefaultBodyLimit::max(50 * 1024 * 1024))
        .layer(TraceLayer::new_for_http())
        .layer(cors)
        .layer(middleware::from_fn_with_state(state.clone(), auth_middleware))
        .with_state(state);

    info!("listening on {addr}");
    axum::serve(tokio::net::TcpListener::bind(addr).await?, app).await?;
    Ok(())
}

async fn healthz() -> impl IntoResponse {
    StatusCode::OK
}

#[derive(Clone, Debug)]
struct AuthedUser {
    id: Uuid,
    role: String,
}

async fn auth_middleware(
    State(state): State<AppState>,
    mut req: axum::extract::Request,
    next: middleware::Next,
) -> impl IntoResponse {
    if req.method() == axum::http::Method::OPTIONS {
        return next.run(req).await;
    }

    let path = req.uri().path();
    if path == "/healthz" || path == "/auth/login" {
        return next.run(req).await;
    }

    let Some(auth_header) = req.headers().get(axum::http::header::AUTHORIZATION) else {
        return (StatusCode::UNAUTHORIZED, "missing authorization").into_response();
    };

    let Ok(auth_str) = auth_header.to_str() else {
        return (StatusCode::UNAUTHORIZED, "invalid authorization").into_response();
    };

    let token = auth_str.strip_prefix("Bearer ").unwrap_or("");
    if token.is_empty() {
        return (StatusCode::UNAUTHORIZED, "invalid bearer token").into_response();
    }

    let validation = Validation::default();
    let decoded = match jsonwebtoken::decode::<Claims>(token, &state.jwt.decoding, &validation) {
        Ok(d) => d,
        Err(_) => return (StatusCode::UNAUTHORIZED, "invalid token").into_response(),
    };

    let user_id = match Uuid::parse_str(&decoded.claims.sub) {
        Ok(v) => v,
        Err(_) => return (StatusCode::UNAUTHORIZED, "invalid token subject").into_response(),
    };

    req.extensions_mut().insert(AuthedUser {
        id: user_id,
        role: decoded.claims.role,
    });

    next.run(req).await
}

fn is_admin(user: &AuthedUser) -> bool {
    user.role == "admin"
}

async fn ensure_default_admin(pool: &PgPool) -> anyhow::Result<()> {
    let email = std::env::var("DEFAULT_ADMIN_EMAIL").unwrap_or_else(|_| "admin@xinference.local".to_string());
    let username = std::env::var("DEFAULT_ADMIN_USERNAME").unwrap_or_else(|_| "admin".to_string());
    let password = std::env::var("DEFAULT_ADMIN_PASSWORD").unwrap_or_else(|_| "admin123".to_string());

    let existing = sqlx::query_as::<_, (Uuid, String)>(
        "select id, username from users where email = $1 or username = $2 order by created_at asc limit 1",
    )
    .bind(&email)
    .bind(&username)
    .fetch_optional(pool)
    .await
    .context("query default admin")?;

    let password_hash = hash_password(&password)?;

    if let Some((id, _old_username)) = existing {
        sqlx::query(
            "update users set username = $2, email = $3, password_hash = $4, role = 'admin' where id = $1",
        )
        .bind(id)
        .bind(&username)
        .bind(&email)
        .bind(&password_hash)
        .execute(pool)
        .await
        .context("update default admin")?;

        return Ok(());
    }

    sqlx::query(
        "insert into users (id, username, email, password_hash, role) values ($1,$2,$3,$4,$5)",
    )
    .bind(Uuid::new_v4())
    .bind(&username)
    .bind(&email)
    .bind(&password_hash)
    .bind("admin")
    .execute(pool)
    .await
    .context("insert default admin")?;

    Ok(())
}

fn hash_password(password: &str) -> anyhow::Result<String> {
    let salt = SaltString::generate(&mut OsRng);
    let argon2 = Argon2::default();
    let hash = argon2
        .hash_password(password.as_bytes(), &salt)
        .map_err(|e| anyhow::anyhow!("hash password: {e}"))?
        .to_string();
    Ok(hash)
}

fn verify_password(password: &str, hash: &str) -> anyhow::Result<bool> {
    let parsed = PasswordHash::new(hash).map_err(|e| anyhow::anyhow!("parse password hash: {e}"))?;
    Ok(Argon2::default()
        .verify_password(password.as_bytes(), &parsed)
        .is_ok())
}

fn sign_jwt(state: &AppState, user_id: Uuid, role: &str) -> anyhow::Result<String> {
    let exp = (Utc::now() + chrono::Duration::hours(24)).timestamp() as usize;
    let claims = Claims {
        sub: user_id.to_string(),
        role: role.to_string(),
        exp,
    };
    Ok(jsonwebtoken::encode(&Header::default(), &claims, &state.jwt.encoding)?)
}

async fn login(State(state): State<AppState>, Json(req): Json<LoginRequest>) -> impl IntoResponse {
    let row = sqlx::query_as::<_, (Uuid, String, String, String, String, DateTime<Utc>)>(
        "select id, username, email, role, password_hash, created_at from users where email = $1 or username = $1",
    )
    .bind(&req.email)
    .fetch_optional(&state.pool)
    .await;

    let maybe = match row {
        Ok(v) => v,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, "db error").into_response(),
    };
    let Some((id, username, email, role, password_hash, created_at)) = maybe else {
        return (StatusCode::UNAUTHORIZED, "invalid credentials").into_response();
    };

    match verify_password(&req.password, &password_hash) {
        Ok(true) => {}
        Ok(false) => return (StatusCode::UNAUTHORIZED, "invalid credentials").into_response(),
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, "password verify failed").into_response(),
    }

    let token = match sign_jwt(&state, id, &role) {
        Ok(t) => t,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, "jwt sign failed").into_response(),
    };

    let user = PublicUser::from(DbUser {
        id,
        username,
        email,
        role,
        created_at,
    });

    (StatusCode::OK, Json(LoginResponse { token, user })).into_response()
}

async fn me(State(state): State<AppState>, Extension(authed): Extension<AuthedUser>) -> impl IntoResponse {
    let row = sqlx::query_as::<_, DbUser>(
        "select id, username, email, role, created_at from users where id = $1",
    )
    .bind(authed.id)
    .fetch_optional(&state.pool)
    .await;

    let maybe = match row {
        Ok(v) => v,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, "db error").into_response(),
    };
    let Some(user) = maybe else {
        return (StatusCode::NOT_FOUND, "user not found").into_response();
    };

    (StatusCode::OK, Json(PublicUser::from(user))).into_response()
}

async fn list_users(State(state): State<AppState>, Extension(authed): Extension<AuthedUser>) -> impl IntoResponse {
    if !is_admin(&authed) {
        return (StatusCode::FORBIDDEN, "forbidden").into_response();
    }

    let rows = sqlx::query_as::<_, DbUser>(
        "select id, username, email, role, created_at from users order by created_at desc",
    )
    .fetch_all(&state.pool)
    .await;

    match rows {
        Ok(v) => {
            let out: Vec<PublicUser> = v.into_iter().map(PublicUser::from).collect();
            (StatusCode::OK, Json(out)).into_response()
        }
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, "db error").into_response(),
    }
}

async fn list_user_directory(State(state): State<AppState>, _authed: Extension<AuthedUser>) -> impl IntoResponse {
    let rows = sqlx::query_as::<_, (Uuid, String, String)>(
        "select id, username, email from users order by created_at desc",
    )
    .fetch_all(&state.pool)
    .await;

    match rows {
        Ok(v) => {
            let out: Vec<DirectoryUser> = v
                .into_iter()
                .map(|(id, username, email)| DirectoryUser { id, username, email })
                .collect();
            (StatusCode::OK, Json(out)).into_response()
        }
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, "db error").into_response(),
    }
}

async fn create_user(State(state): State<AppState>, Extension(authed): Extension<AuthedUser>, Json(body): Json<CreateUserRequest>) -> impl IntoResponse {
    if !is_admin(&authed) {
        return (StatusCode::FORBIDDEN, "forbidden").into_response();
    }

    if body.role != "admin" && body.role != "user" {
        return (StatusCode::BAD_REQUEST, "invalid role").into_response();
    }

    let password_hash = match hash_password(&body.password) {
        Ok(v) => v,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, "hash failed").into_response(),
    };

    let id = Uuid::new_v4();
    let res = sqlx::query(
        "insert into users (id, username, email, password_hash, role) values ($1,$2,$3,$4,$5)",
    )
    .bind(id)
    .bind(&body.username)
    .bind(&body.email)
    .bind(&password_hash)
    .bind(&body.role)
    .execute(&state.pool)
    .await;

    if let Err(e) = res {
        if let Some(db_err) = e.as_database_error() {
            if db_err.constraint() == Some("users_email_key") {
                return (StatusCode::CONFLICT, "email exists").into_response();
            }
        }
        return (StatusCode::INTERNAL_SERVER_ERROR, "db error").into_response();
    }

    let created = sqlx::query_as::<_, DbUser>(
        "select id, username, email, role, created_at from users where id = $1",
    )
    .bind(id)
    .fetch_one(&state.pool)
    .await;

    match created {
        Ok(u) => (StatusCode::CREATED, Json(PublicUser::from(u))).into_response(),
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, "db error").into_response(),
    }
}

async fn delete_user(State(state): State<AppState>, Extension(authed): Extension<AuthedUser>, AxumPath(id): AxumPath<Uuid>) -> impl IntoResponse {
    if !is_admin(&authed) {
        return (StatusCode::FORBIDDEN, "forbidden").into_response();
    }

    let res = sqlx::query("delete from users where id = $1")
        .bind(id)
        .execute(&state.pool)
        .await;

    match res {
        Ok(r) if r.rows_affected() == 0 => (StatusCode::NOT_FOUND, "not found").into_response(),
        Ok(_) => StatusCode::NO_CONTENT.into_response(),
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, "db error").into_response(),
    }
}

fn doc_accessible(doc: &DocumentRow, user: &AuthedUser) -> bool {
    if user.role == "admin" {
        return true;
    }
    if doc.owner_id == user.id {
        return true;
    }
    if doc.permission == "public" {
        return true;
    }
    if doc.permission == "specific" && doc.allowed_users.iter().any(|u| *u == user.id) {
        return true;
    }
    false
}

fn doc_editable(doc: &DocumentRow, user: &AuthedUser) -> bool {
    if user.role == "admin" {
        return true;
    }
    doc.owner_id == user.id
}

async fn list_documents(State(state): State<AppState>, Extension(authed): Extension<AuthedUser>) -> impl IntoResponse {

    let rows = sqlx::query_as::<_, DocumentRow>(
        r#"
        select
            d.id, d.name, d.mime_type, d.size, d.notes,
            d.owner_id, u.username as owner_name,
            d.permission, d.allowed_users, d.is_generated, d.storage_rel_path,
            d.created_at, d.updated_at
        from documents d
        join users u on u.id = d.owner_id
        order by d.created_at desc
        "#,
    )
    .fetch_all(&state.pool)
    .await;

    let rows = match rows {
        Ok(v) => v,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, "db error").into_response(),
    };

    let docs: Vec<DocumentApiDto> = rows
        .into_iter()
        .filter(|d| doc_accessible(d, &authed))
        .map(DocumentDto::from)
        .map(DocumentApiDto::from)
        .collect();

    (StatusCode::OK, Json(docs)).into_response()
}

async fn upload_document(State(state): State<AppState>, Extension(authed): Extension<AuthedUser>, mut multipart: Multipart) -> impl IntoResponse {

    let mut notes: String = String::new();
    let mut permission: String = "public".to_string();
    let mut allowed_users: Vec<Uuid> = vec![];
    let mut is_generated: bool = false;
    let mut file_name: Option<String> = None;
    let mut mime_type: Option<String> = None;
    let mut file_bytes: Option<Vec<u8>> = None;

    while let Ok(Some(field)) = multipart.next_field().await {
        let name = field.name().unwrap_or("").to_string();
        if name == "file" {
            file_name = field.file_name().map(|s| s.to_string());
            mime_type = field.content_type().map(|s| s.to_string());
            match field.bytes().await {
                Ok(b) => file_bytes = Some(b.to_vec()),
                Err(_) => return (StatusCode::BAD_REQUEST, "invalid file").into_response(),
            }
        } else if name == "notes" {
            notes = field.text().await.unwrap_or_default();
        } else if name == "permission" {
            permission = field.text().await.unwrap_or_else(|_| "public".to_string());
        } else if name == "allowed_users" {
            let txt = field.text().await.unwrap_or_default();
            allowed_users = txt
                .split(',')
                .filter_map(|s| Uuid::parse_str(s.trim()).ok())
                .collect();
        } else if name == "is_generated" {
            let txt = field.text().await.unwrap_or_default();
            is_generated = txt.trim() == "1" || txt.trim().eq_ignore_ascii_case("true");
        }
    }

    if permission != "public" && permission != "private" && permission != "specific" {
        return (StatusCode::BAD_REQUEST, "invalid permission").into_response();
    }
    if permission != "specific" {
        allowed_users.clear();
    }

    let file_name = file_name.unwrap_or_else(|| "upload.bin".to_string());
    let mime_type = mime_type.unwrap_or_else(|| "application/octet-stream".to_string());
    let file_bytes = match file_bytes {
        Some(v) => v,
        None => return (StatusCode::BAD_REQUEST, "file is required").into_response(),
    };

    let doc_id = Uuid::new_v4();
    let rel_path = format!("{}/{}", doc_id, sanitize_filename(&file_name));
    let abs_path = state.storage_root.join(&rel_path);

    if let Some(parent) = abs_path.parent() {
        if tokio::fs::create_dir_all(parent).await.is_err() {
            return (StatusCode::INTERNAL_SERVER_ERROR, "storage error").into_response();
        }
    }

    if tokio::fs::write(&abs_path, &file_bytes).await.is_err() {
        return (StatusCode::INTERNAL_SERVER_ERROR, "storage error").into_response();
    }

    let size = file_bytes.len() as i64;

    let inserted = sqlx::query_as::<_, DocumentRow>(
        r#"
        insert into documents
            (id, name, mime_type, size, notes, owner_id, permission, allowed_users, is_generated, storage_rel_path)
        values
            ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
        returning
            id, name, mime_type, size, notes,
            owner_id, (select username from users where id = owner_id) as owner_name,
            permission, allowed_users, is_generated, storage_rel_path,
            created_at, updated_at
        "#,
    )
    .bind(doc_id)
    .bind(&file_name)
    .bind(&mime_type)
    .bind(size)
    .bind(&notes)
    .bind(authed.id)
    .bind(&permission)
    .bind(&allowed_users)
    .bind(is_generated)
    .bind(&rel_path)
    .fetch_one(&state.pool)
    .await;

    match inserted {
        Ok(doc) => {
            let api = DocumentApiDto::from(DocumentDto::from(doc));
            (StatusCode::CREATED, Json(api)).into_response()
        }
        Err(e) => {
            error!(?e, "insert document failed");
            let _ = tokio::fs::remove_file(&abs_path).await;
            (StatusCode::INTERNAL_SERVER_ERROR, "db error").into_response()
        }
    }
}

#[derive(Debug, Deserialize)]
struct PatchDocumentRequest {
    name: Option<String>,
    notes: Option<String>,
    permission: Option<String>,
    allowed_users: Option<Vec<Uuid>>,
}

async fn patch_document(
    State(state): State<AppState>,
    Extension(authed): Extension<AuthedUser>,
    AxumPath(id): AxumPath<Uuid>,
    Json(body): Json<PatchDocumentRequest>,
) -> impl IntoResponse {
    let existing = sqlx::query_as::<_, DocumentRow>(
        r#"
        select
            d.id, d.name, d.mime_type, d.size, d.notes,
            d.owner_id, u.username as owner_name,
            d.permission, d.allowed_users, d.is_generated, d.storage_rel_path,
            d.created_at, d.updated_at
        from documents d
        join users u on u.id = d.owner_id
        where d.id = $1
        "#,
    )
    .bind(id)
    .fetch_optional(&state.pool)
    .await;

    let maybe = match existing {
        Ok(v) => v,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, "db error").into_response(),
    };
    let Some(existing) = maybe else {
        return (StatusCode::NOT_FOUND, "not found").into_response();
    };

    if !doc_editable(&existing, &authed) {
        return (StatusCode::FORBIDDEN, "forbidden").into_response();
    }

    let mut permission = body.permission.unwrap_or(existing.permission);
    if permission != "public" && permission != "private" && permission != "specific" {
        return (StatusCode::BAD_REQUEST, "invalid permission").into_response();
    }

    let mut allowed_users = body.allowed_users.unwrap_or(existing.allowed_users);
    if permission != "specific" {
        allowed_users.clear();
    }

    let name = body.name.unwrap_or(existing.name);
    let notes = body.notes.unwrap_or(existing.notes);

    let updated = sqlx::query_as::<_, DocumentRow>(
        r#"
        update documents
        set name = $2, notes = $3, permission = $4, allowed_users = $5, updated_at = now()
        where id = $1
        returning
            id, name, mime_type, size, notes,
            owner_id, (select username from users where id = owner_id) as owner_name,
            permission, allowed_users, is_generated, storage_rel_path,
            created_at, updated_at
        "#,
    )
    .bind(id)
    .bind(&name)
    .bind(&notes)
    .bind(&permission)
    .bind(&allowed_users)
    .fetch_one(&state.pool)
    .await;

    match updated {
        Ok(doc) => {
            let api = DocumentApiDto::from(DocumentDto::from(doc));
            (StatusCode::OK, Json(api)).into_response()
        }
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, "db error").into_response(),
    }
}

async fn delete_document(
    State(state): State<AppState>,
    Extension(authed): Extension<AuthedUser>,
    AxumPath(id): AxumPath<Uuid>,
) -> impl IntoResponse {
    let existing = sqlx::query_as::<_, (String, Uuid, String)>(
        "select storage_rel_path, owner_id, permission from documents where id = $1",
    )
    .bind(id)
    .fetch_optional(&state.pool)
    .await;

    let maybe = match existing {
        Ok(v) => v,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, "db error").into_response(),
    };
    let Some((storage_rel_path, owner_id, _permission)) = maybe else {
        return (StatusCode::NOT_FOUND, "not found").into_response();
    };

    if !(authed.role == "admin" || owner_id == authed.id) {
        return (StatusCode::FORBIDDEN, "forbidden").into_response();
    }

    let res = sqlx::query("delete from documents where id = $1")
        .bind(id)
        .execute(&state.pool)
        .await;

    match res {
        Ok(r) if r.rows_affected() == 0 => return (StatusCode::NOT_FOUND, "not found").into_response(),
        Ok(_) => {
            let abs_path = state.storage_root.join(storage_rel_path);
            let _ = tokio::fs::remove_file(abs_path).await;
            StatusCode::NO_CONTENT.into_response()
        }
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, "db error").into_response(),
    }
}

async fn download_document(
    State(state): State<AppState>,
    Extension(authed): Extension<AuthedUser>,
    AxumPath(id): AxumPath<Uuid>,
) -> impl IntoResponse {
    let row = sqlx::query_as::<_, DocumentRow>(
        r#"
        select
            d.id, d.name, d.mime_type, d.size, d.notes,
            d.owner_id, u.username as owner_name,
            d.permission, d.allowed_users, d.is_generated, d.storage_rel_path,
            d.created_at, d.updated_at
        from documents d
        join users u on u.id = d.owner_id
        where d.id = $1
        "#,
    )
    .bind(id)
    .fetch_optional(&state.pool)
    .await;

    let maybe = match row {
        Ok(v) => v,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, "db error").into_response(),
    };
    let Some(doc) = maybe else {
        return (StatusCode::NOT_FOUND, "not found").into_response();
    };

    if !doc_accessible(&doc, &authed) {
        return (StatusCode::FORBIDDEN, "forbidden").into_response();
    }

    let abs_path = state.storage_root.join(&doc.storage_rel_path);
    let data = match tokio::fs::read(&abs_path).await {
        Ok(v) => v,
        Err(_) => return (StatusCode::NOT_FOUND, "file missing").into_response(),
    };

    let mut resp = axum::response::Response::new(axum::body::Body::from(data));
    resp.headers_mut().insert(
        axum::http::header::CONTENT_TYPE,
        HeaderValue::from_str(&doc.mime_type).unwrap_or_else(|_| HeaderValue::from_static("application/octet-stream")),
    );
    resp.headers_mut().insert(
        axum::http::header::CONTENT_DISPOSITION,
        HeaderValue::from_str(&format!("attachment; filename=\"{}\"", doc.name)).unwrap_or_else(|_| HeaderValue::from_static("attachment")),
    );
    resp
}

fn sanitize_filename(name: &str) -> String {
    name.chars()
        .map(|c| if c == '/' || c == '\\' { '_' } else { c })
        .collect()
}

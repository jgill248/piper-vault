#!/usr/bin/env bash
set -euo pipefail

PG_BIN="/usr/lib/postgresql/16/bin"

PGDATA="${PGDATA:-/var/lib/postgresql/data}"
DB_NAME="${POSTGRES_DB:-delve}"
DB_USER="${POSTGRES_USER:-delve}"
DB_PASS="${POSTGRES_PASSWORD:-delve}"

export DATABASE_URL="postgresql://${DB_USER}:${DB_PASS}@localhost:5432/${DB_NAME}"

# ── 1. Initialize PostgreSQL data directory if empty ──────────────
if [ ! -s "$PGDATA/PG_VERSION" ]; then
  echo "[entrypoint] Initializing PostgreSQL data directory..."
  chown -R postgres:postgres "$PGDATA"
  su - postgres -c "$PG_BIN/initdb -D '$PGDATA' --auth=trust --no-locale --encoding=UTF8"
  # Allow local TCP connections with password auth
  echo "host all all 127.0.0.1/32 md5" >> "$PGDATA/pg_hba.conf"
  echo "host all all ::1/128 md5" >> "$PGDATA/pg_hba.conf"
  # Listen on localhost only
  sed -i "s/#listen_addresses = 'localhost'/listen_addresses = 'localhost'/" "$PGDATA/postgresql.conf"
fi

# Ensure postgres user owns the data directory
chown -R postgres:postgres "$PGDATA"

# Remove stale postmaster.pid from a previous crashed container
rm -f "$PGDATA/postmaster.pid"

# ── 2. Start PostgreSQL temporarily ──────────────────────────────
echo "[entrypoint] Starting PostgreSQL..."
su - postgres -c "$PG_BIN/pg_ctl -D '$PGDATA' -l /tmp/pg_startup.log start -w -t 30"

# ── 3. Create database and user (idempotent) ─────────────────────
echo "[entrypoint] Ensuring database and user exist..."
su - postgres -c "$PG_BIN/psql -tc \"SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'\" | grep -q 1 || $PG_BIN/psql -c \"CREATE ROLE ${DB_USER} WITH LOGIN PASSWORD '${DB_PASS}'\""
su - postgres -c "$PG_BIN/psql -tc \"SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'\" | grep -q 1 || $PG_BIN/psql -c \"CREATE DATABASE ${DB_NAME} OWNER ${DB_USER}\""
su - postgres -c "$PG_BIN/psql -d ${DB_NAME} -c 'CREATE EXTENSION IF NOT EXISTS vector'"
# Grant all privileges to the user on the database
su - postgres -c "$PG_BIN/psql -c \"GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER}\""
su - postgres -c "$PG_BIN/psql -d ${DB_NAME} -c \"GRANT ALL ON SCHEMA public TO ${DB_USER}\""

# ── 4. Run database migrations ───────────────────────────────────
echo "[entrypoint] Running database migrations..."
DATABASE_URL="$DATABASE_URL" node /app/packages/api/migrate.cjs

# ── 5. Stop temporary PostgreSQL (supervisord will manage it) ────
echo "[entrypoint] Stopping temporary PostgreSQL..."
su - postgres -c "$PG_BIN/pg_ctl -D '$PGDATA' stop -m fast -w"

# ── 6. Pass through environment variables to supervisord ─────────
# Update the API environment line in supervisord.conf with runtime env vars
EXTRA_ENV=""
[ -n "${ANTHROPIC_API_KEY:-}" ] && EXTRA_ENV="${EXTRA_ENV},ANTHROPIC_API_KEY=\"${ANTHROPIC_API_KEY}\""
[ -n "${OPENAI_API_KEY:-}" ] && EXTRA_ENV="${EXTRA_ENV},OPENAI_API_KEY=\"${OPENAI_API_KEY}\""
[ -n "${ASK_SAGE_TOKEN:-}" ] && EXTRA_ENV="${EXTRA_ENV},ASK_SAGE_TOKEN=\"${ASK_SAGE_TOKEN}\""
[ -n "${OLLAMA_BASE_URL:-}" ] && EXTRA_ENV="${EXTRA_ENV},OLLAMA_BASE_URL=\"${OLLAMA_BASE_URL}\""
[ -n "${AUTH_ENABLED:-}" ] && EXTRA_ENV="${EXTRA_ENV},AUTH_ENABLED=\"${AUTH_ENABLED}\""
[ -n "${JWT_SECRET:-}" ] && EXTRA_ENV="${EXTRA_ENV},JWT_SECRET=\"${JWT_SECRET}\""
[ -n "${CORS_ORIGIN:-}" ] && EXTRA_ENV="${EXTRA_ENV},CORS_ORIGIN=\"${CORS_ORIGIN}\""
[ -n "${WEBHOOK_RATE_LIMIT:-}" ] && EXTRA_ENV="${EXTRA_ENV},WEBHOOK_RATE_LIMIT=\"${WEBHOOK_RATE_LIMIT}\""
[ -n "${NODE_TLS_REJECT_UNAUTHORIZED:-}" ] && EXTRA_ENV="${EXTRA_ENV},NODE_TLS_REJECT_UNAUTHORIZED=\"${NODE_TLS_REJECT_UNAUTHORIZED}\""

if [ -n "$EXTRA_ENV" ]; then
  sed -i "s|^environment=.*|&${EXTRA_ENV}|" /etc/supervisor/conf.d/delve.conf
fi

# ── 7. Launch supervisord ────────────────────────────────────────
echo "[entrypoint] Starting all services via supervisord..."
exec supervisord -c /etc/supervisor/conf.d/delve.conf

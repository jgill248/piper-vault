#!/usr/bin/env bash
set -euo pipefail

PG_BIN="/usr/lib/postgresql/16/bin"

PGDATA="${PGDATA:-/var/lib/postgresql/data}"
DB_NAME="delve"
DB_USER="delve"
DB_PASS="delve"

export DATABASE_URL="postgresql://delve:delve@localhost:5432/delve"

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

# ── 2. Start PostgreSQL ──────────────────────────────────────────
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

# ── 5. Export environment for API ────────────────────────────────
export NODE_ENV="production"
export PORT="3001"
export HF_HOME="/app/.cache/huggingface"
[ -n "${OLLAMA_BASE_URL:-}" ] && export OLLAMA_BASE_URL
[ -n "${NODE_TLS_REJECT_UNAUTHORIZED:-}" ] && export NODE_TLS_REJECT_UNAUTHORIZED

# ── 6. Graceful shutdown handler ────────────────────────────────
cleanup() {
    echo "[entrypoint] Shutting down..."
    kill "$API_PID" 2>/dev/null || true
    nginx -s quit 2>/dev/null || true
    su - postgres -c "$PG_BIN/pg_ctl -D '$PGDATA' stop -m fast -w" 2>/dev/null || true
    exit 0
}
trap cleanup SIGTERM SIGINT

# ── 7. Start API server ─────────────────────────────────────────
echo "[entrypoint] Starting API server..."
node /app/packages/api/dist/main.js &
API_PID=$!

# ── 8. Start nginx (foreground-ish, backgrounded for wait) ──────
echo "[entrypoint] Starting Nginx..."
nginx -g "daemon off;" &
NGINX_PID=$!

echo "[entrypoint] All services started."

# Wait for any child to exit — if one dies, bring everything down
wait -n "$API_PID" "$NGINX_PID" 2>/dev/null || true
echo "[entrypoint] A service exited unexpectedly, shutting down..."
cleanup

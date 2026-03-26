# Delve Deployment Guide

This guide covers deploying Delve in a self-hosted environment, from a quick Docker-based setup to a fully-configured bare-metal installation with TLS, backups, and monitoring.

---

## Table of Contents

1. [System Requirements](#1-system-requirements)
2. [Quick Start (Docker)](#2-quick-start-docker)
3. [Environment Variables Reference](#3-environment-variables-reference)
4. [Docker Deployment](#4-docker-deployment)
5. [Bare-Metal Deployment](#5-bare-metal-deployment)
6. [Reverse Proxy Setup](#6-reverse-proxy-setup)
7. [TLS / HTTPS Setup](#7-tls--https-setup)
8. [Backup and Restore](#8-backup-and-restore)
9. [Plugin Installation](#9-plugin-installation)
10. [Watched Folders](#10-watched-folders)
11. [Authentication Setup](#11-authentication-setup)
12. [Monitoring](#12-monitoring)
13. [Upgrading](#13-upgrading)

---

## 1. System Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| CPU | 2 cores | 4 cores |
| RAM | 2 GB | 4 GB |
| Disk | 10 GB | 50 GB+ (depends on knowledge base size) |
| Node.js | 20.x LTS | 20.x LTS |
| PostgreSQL | 16+ with pgvector | 16+ with pgvector |
| Docker (optional) | 24+ | 24+ |
| Docker Compose (optional) | v2.x | v2.x |

**Operating System:** Linux (Ubuntu 22.04+ recommended), macOS 13+, or Windows 11 with WSL2.

---

## 2. Quick Start (Docker)

### Option A — Docker Hub (no build required)

The fastest path. Pre-built images are pulled from Docker Hub:

```bash
# 1. Download the compose file and env template
curl -O https://raw.githubusercontent.com/jgill248/delve/main/docker-compose.hub.yml
curl -O https://raw.githubusercontent.com/jgill248/delve/main/.env.example

# 2. Create your environment file
cp .env.example .env
# Edit .env — at minimum set POSTGRES_PASSWORD and your LLM provider key

# 3. Start all services
docker compose -f docker-compose.hub.yml up -d

# 4. Run database migrations
docker compose -f docker-compose.hub.yml exec api node packages/api/dist/database/migrate.js

# 5. Open Delve in your browser
open http://localhost:8080
```

To stop: `docker compose -f docker-compose.hub.yml down`

To upgrade: `docker compose -f docker-compose.hub.yml pull && docker compose -f docker-compose.hub.yml up -d`

### Option B — Build from source

For contributors or custom builds:

```bash
# 1. Clone the repository
git clone https://github.com/jgill248/delve.git
cd delve

# 2. Create your environment file
cp .env.example .env
# Edit .env — at minimum set POSTGRES_PASSWORD and your LLM provider key

# 3. Build and start all services
docker compose -f docker-compose.prod.yml up -d --build

# 4. Run database migrations
docker compose -f docker-compose.prod.yml exec api node packages/api/dist/database/migrate.js

# 5. Open Delve in your browser
open http://localhost:8080
```

To stop: `docker compose -f docker-compose.prod.yml down`

---

## 3. Environment Variables Reference

All variables can be set in `.env` (for local/Docker use) or injected directly into the environment.

| Variable | Default | Required | Description |
|----------|---------|----------|-------------|
| `DATABASE_URL` | — | Yes | Full PostgreSQL connection string |
| `POSTGRES_USER` | `delve` | No | PostgreSQL username (Docker Compose only) |
| `POSTGRES_PASSWORD` | — | Yes | PostgreSQL password (Docker Compose only) |
| `POSTGRES_DB` | `delve` | No | PostgreSQL database name (Docker Compose only) |
| `PORT` | `3001` | No | Port the API server listens on |
| `WEB_PORT` | `8080` | No | Port the web UI is exposed on (Docker Compose only) |
| `NODE_ENV` | `development` | No | Set to `production` in deployed environments |
| `CORS_ORIGIN` | `http://localhost:5173` | No | Browser origin allowed to call the API |
| `ASK_SAGE_TOKEN` | — | No* | Ask Sage token for LLM access (tokens do not expire) |
| `ANTHROPIC_API_KEY` | — | No* | Anthropic API key for direct Claude access |
| `OPENAI_API_KEY` | — | No* | OpenAI API key |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | No* | Ollama endpoint for local LLM inference |
| `AUTH_ENABLED` | `false` | No | Enable username/password authentication |
| `JWT_SECRET` | `change-me-in-production` | Yes (if auth on) | Secret for signing JWT tokens — must be changed |
| `PLUGINS_DIR` | — | No | Filesystem path where plugin `.js` files are placed |
| `WEBHOOK_RATE_LIMIT` | `60` | No | Max webhook ingest requests per minute per API key |
| `NODE_TLS_REJECT_UNAUTHORIZED` | `1` | No | Set to `0` to bypass SSL verification (corporate proxies) |

\* At least one LLM provider must be configured for chat functionality. The app starts without these, but chat queries will fail.

**Security note:** `JWT_SECRET` must be a long, random string in any production deployment. Generate one with:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

---

## 4. Docker Deployment

### Step-by-step

**Step 1 — Prerequisites**

Install Docker Engine and Docker Compose v2:

```bash
# Ubuntu / Debian
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# Log out and back in, then verify:
docker compose version
```

**Step 2 — Obtain the source**

```bash
git clone https://github.com/your-org/delve.git
cd delve
```

**Step 3 — Configure the environment**

```bash
cp .env.example .env
```

Edit `.env` and set at minimum:

- `POSTGRES_PASSWORD` — a strong password (not the default `delve`)
- An LLM provider key (`ASK_SAGE_TOKEN`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, or `OLLAMA_BASE_URL`)
- `JWT_SECRET` — a random 64-byte hex string (if auth is enabled)

**Step 4 — Build and start**

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

The first build downloads base images and compiles all TypeScript. Subsequent builds use the layer cache and are faster.

**Step 5 — Run database migrations**

```bash
docker compose -f docker-compose.prod.yml exec api node packages/api/dist/database/migrate.js
```

**Step 6 — Verify health**

```bash
curl http://localhost:8080/api/v1/health
# Expected: {"status":"ok","timestamp":"...","db":"ok","embedding":"warn"}
```

### Viewing logs

```bash
# All services
docker compose -f docker-compose.prod.yml logs -f

# API only
docker compose -f docker-compose.prod.yml logs -f api
```

### Port mapping

By default the web UI is exposed on port `8080`. Change this by setting `WEB_PORT` in `.env`:

```env
WEB_PORT=3000
```

---

## 5. Bare-Metal Deployment

Use this approach when you want full control over the runtime environment.

### Prerequisites

```bash
# Install Node.js 20 via nvm (recommended)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
nvm install 20
nvm use 20

# Install pnpm
npm i -g pnpm@9

# Install PostgreSQL 16 with pgvector (Ubuntu example)
sudo apt install -y postgresql-16 postgresql-16-pgvector
```

### Build

```bash
git clone https://github.com/your-org/delve.git
cd delve

pnpm install --frozen-lockfile
npx nx run-many --target=build --all
```

### Configure

```bash
cp .env.example .env
# Edit .env with your settings
```

### Database setup

```bash
# Create the database and enable pgvector
sudo -u postgres psql <<SQL
CREATE USER delve WITH PASSWORD 'your-password';
CREATE DATABASE delve OWNER delve;
\c delve
CREATE EXTENSION IF NOT EXISTS vector;
SQL

# Run migrations
source .env
node packages/api/dist/database/migrate.js
```

### Run the API server

For a production process manager, use PM2:

```bash
npm i -g pm2

# Start the API
pm2 start packages/api/dist/main.js --name delve-api --env production

# Save process list across reboots
pm2 save
pm2 startup
```

### Serve the frontend

The web frontend is a compiled static site (`packages/web/dist/`). Serve it with nginx:

```bash
sudo cp -r packages/web/dist /var/www/delve
# See section 6 for nginx configuration
```

---

## 6. Reverse Proxy Setup

A reverse proxy handles TLS termination and routes requests to the correct service.

### Nginx

Install nginx (`sudo apt install -y nginx`) and create a site configuration:

```nginx
# /etc/nginx/sites-available/delve
server {
    listen 80;
    server_name delve.example.com;

    root /var/www/delve;
    index index.html;

    # SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
        add_header Cache-Control "no-cache";
    }

    # Static assets with long cache
    location ~* \.(js|css|woff2?|svg|ico|png)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        try_files $uri =404;
    }

    # API proxy
    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        client_max_body_size 100M;
        proxy_read_timeout 120s;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/delve /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

### Caddy

Caddy handles TLS automatically via Let's Encrypt:

```caddyfile
# /etc/caddy/Caddyfile
delve.example.com {
    root * /var/www/delve
    file_server

    # SPA fallback
    try_files {path} /index.html

    # API proxy
    handle /api/* {
        reverse_proxy localhost:3001
    }

    # Upload size limit
    request_body {
        max_size 100MB
    }
}
```

```bash
sudo systemctl reload caddy
```

---

## 7. TLS / HTTPS Setup

### Let's Encrypt with Certbot (nginx)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d delve.example.com

# Auto-renewal is configured automatically; test it:
sudo certbot renew --dry-run
```

After certbot runs, your nginx config will be updated with TLS directives automatically.

### Caddy (automatic TLS)

Caddy fetches and renews certificates from Let's Encrypt with no extra steps. The Caddyfile in section 6 is sufficient — just point DNS at your server and start Caddy.

### Self-signed certificate (internal use)

```bash
openssl req -x509 -newkey rsa:4096 -sha256 -days 3650 -nodes \
  -keyout /etc/ssl/private/delve.key \
  -out /etc/ssl/certs/delve.crt \
  -subj "/CN=delve.internal"
```

Add the `ssl_certificate` and `ssl_certificate_key` directives to your nginx server block.

---

## 8. Backup and Restore

### Database backup

```bash
# Full backup (plain SQL)
pg_dump -U delve -d delve -F plain -f /backups/delve-$(date +%Y%m%d).sql

# Compressed backup (recommended for large databases)
pg_dump -U delve -d delve -F custom -f /backups/delve-$(date +%Y%m%d).pgdump
```

### Database restore

```bash
# From plain SQL
psql -U delve -d delve -f /backups/delve-20260101.sql

# From custom format
pg_restore -U delve -d delve --clean /backups/delve-20260101.pgdump
```

### Docker volume backup

When running via Docker Compose, PostgreSQL data lives in the `pgdata` named volume:

```bash
# Backup
docker run --rm \
  -v delve_pgdata:/data \
  -v /backups:/backups \
  alpine tar czf /backups/pgdata-$(date +%Y%m%d).tar.gz -C /data .

# Restore
docker run --rm \
  -v delve_pgdata:/data \
  -v /backups:/backups \
  alpine tar xzf /backups/pgdata-20260101.tar.gz -C /data
```

### Automated backup with cron

```bash
# /etc/cron.d/delve-backup
0 2 * * * postgres pg_dump -U delve -d delve -F custom \
  -f /backups/delve-$(date +\%Y\%m\%d).pgdump && \
  find /backups -name "delve-*.pgdump" -mtime +30 -delete
```

---

## 9. Plugin Installation

Delve supports custom file-type extractor plugins that are loaded at runtime.

### Plugin location

Set `PLUGINS_DIR` in `.env` to an absolute path on the host machine:

```env
PLUGINS_DIR=/opt/delve/plugins
```

Or when using Docker Compose, mount the directory into the container:

```yaml
# docker-compose.prod.yml (already included)
volumes:
  - /opt/delve/plugins:/app/plugins
```

And set `PLUGINS_DIR=/app/plugins` in the environment.

### Installing a plugin

Drop a `.js` file conforming to the Delve plugin interface into `PLUGINS_DIR`:

```bash
cp my-extractor.js /opt/delve/plugins/
```

### Reloading plugins

Plugins are loaded at startup. To reload without restarting the API server:

```bash
curl -X POST http://localhost:3001/api/v1/plugins/reload
```

Or list currently-loaded plugins:

```bash
curl http://localhost:3001/api/v1/plugins
```

### Plugin interface

A plugin must export a default object that matches:

```typescript
interface DelvePlugin {
  name: string;
  mimeTypes: string[];          // MIME types this plugin handles
  extract(buffer: Buffer, filename: string): Promise<string>;
}
```

---

## 10. Watched Folders

Watched folders allow Delve to automatically ingest files added to specific directories on the host filesystem.

### Docker setup

Mount the host directory you want to watch as a volume in the `api` service. The `watched` volume defined in `docker-compose.prod.yml` is a starting point, but you can also bind-mount specific host paths:

```yaml
# docker-compose.prod.yml override
services:
  api:
    volumes:
      - plugins:/app/plugins
      - /home/user/documents:/watched/documents:ro
      - /home/user/notes:/watched/notes:ro
```

Then add the watched folder via the API, pointing to the in-container path:

```bash
curl -X POST http://localhost:8080/api/v1/watched-folders \
  -H "Content-Type: application/json" \
  -d '{
    "folderPath": "/watched/documents",
    "recursive": true,
    "collectionId": "your-collection-uuid"
  }'
```

### Bare-metal setup

Point to any absolute path on the filesystem:

```bash
curl -X POST http://localhost:3001/api/v1/watched-folders \
  -H "Content-Type: application/json" \
  -d '{
    "folderPath": "/home/user/documents",
    "recursive": true
  }'
```

### Triggering a manual scan

```bash
curl -X POST http://localhost:3001/api/v1/watched-folders/{id}/scan
```

### Removing a watched folder

```bash
curl -X DELETE http://localhost:3001/api/v1/watched-folders/{id}
```

---

## 11. Authentication Setup

By default, Delve does not require authentication (suitable for single-user local deployments). Enable it for shared or internet-facing deployments.

### Enable authentication

Set the following in `.env`:

```env
AUTH_ENABLED=true
JWT_SECRET=<64-byte-random-hex>
```

Generate a secure JWT secret:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### Creating the first user

After enabling auth, register via the API:

```bash
curl -X POST http://localhost:3001/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "your-strong-password"
  }'
```

### Logging in

```bash
curl -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "your-strong-password"
  }'
# Returns: { "token": "eyJ..." }
```

Include the token in subsequent requests:

```bash
curl http://localhost:3001/api/v1/sources \
  -H "Authorization: Bearer eyJ..."
```

---

## 12. Monitoring

### Health endpoint

```bash
curl http://localhost:3001/api/v1/health
```

Response fields:

| Field | Values | Meaning |
|-------|--------|---------|
| `status` | `ok`, `degraded` | Overall system status |
| `db` | `ok`, `error` | PostgreSQL connectivity |
| `embedding` | `ok`, `warn` | Embedding model availability |
| `timestamp` | ISO 8601 | Time of the check |

### Log aggregation

The API server emits structured JSON logs to stdout. Forward them to your log aggregator of choice:

**Docker + Loki (Grafana)**

```yaml
# docker-compose.prod.yml addition
services:
  api:
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "3"
```

**Bare-metal + journald**

If running under systemd/PM2, logs flow through journald automatically:

```bash
journalctl -u delve-api -f
```

### Uptime monitoring

Point an uptime checker (Uptime Kuma, Better Stack, etc.) at:

```
GET http://your-host/api/v1/health
```

Expect HTTP 200 with `status: "ok"`.

---

## 13. Upgrading

### Docker Hub upgrade

```bash
# Pull latest images
docker compose -f docker-compose.hub.yml pull

# Apply database migrations (always before restarting the API)
docker compose -f docker-compose.hub.yml run --rm api \
  node packages/api/dist/database/migrate.js

# Restart services
docker compose -f docker-compose.hub.yml up -d
```

### Docker upgrade (build from source)

```bash
# Pull the latest code
git pull origin main

# Rebuild images
docker compose -f docker-compose.prod.yml build

# Apply database migrations (always before restarting the API)
docker compose -f docker-compose.prod.yml run --rm api \
  node packages/api/dist/database/migrate.js

# Restart services with zero-downtime rolling update
docker compose -f docker-compose.prod.yml up -d
```

### Bare-metal upgrade

```bash
# Pull latest code
git pull origin main

# Install any new dependencies
pnpm install --frozen-lockfile

# Rebuild
npx nx run-many --target=build --all

# Apply migrations
node packages/api/dist/database/migrate.js

# Restart the API process
pm2 restart delve-api

# Copy new web build to the webroot
cp -r packages/web/dist/* /var/www/delve/
```

### Before upgrading

- Take a database backup (see section 8).
- Review the changelog for breaking changes, especially database schema changes.
- Test in a staging environment before upgrading production.

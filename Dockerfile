# ============================================================
# Stage 1: Build — install all deps, compile all packages
# ============================================================
FROM node:20-slim AS builder

WORKDIR /app

RUN npm i -g pnpm@10

# Copy workspace manifests and config files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml nx.json tsconfig.base.json tsconfig.migrate.json .npmrc ./

# Copy all package manifests (needed for pnpm workspace resolution)
COPY packages/api/package.json ./packages/api/package.json
COPY packages/web/package.json ./packages/web/package.json
COPY packages/core/package.json ./packages/core/package.json
COPY packages/shared/package.json ./packages/shared/package.json

# Install all dependencies (including devDependencies for build)
RUN pnpm install --frozen-lockfile

# Copy source files
COPY packages/ ./packages/

# Build all packages (shared → core → api + web in dependency order)
RUN npx nx run-many --target=build --all

# Compile the standalone migration script via dedicated tsconfig
RUN npx tsc -p tsconfig.migrate.json

# ============================================================
# Stage 2: Production API server
# ============================================================
FROM node:20-slim AS api

WORKDIR /app

RUN npm i -g pnpm@10 \
 && rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx

# Copy workspace manifests for production install
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY packages/api/package.json ./packages/api/
COPY packages/core/package.json ./packages/core/
COPY packages/shared/package.json ./packages/shared/

# Install production dependencies only, then remove pnpm (not needed at runtime)
RUN pnpm install --frozen-lockfile --prod \
 && rm -rf /usr/local/lib/node_modules/pnpm /usr/local/bin/pnpm /usr/local/lib/node_modules/corepack /usr/local/bin/corepack

# Copy compiled output from builder
COPY --from=builder /app/packages/api/dist ./packages/api/dist
COPY --from=builder /app/packages/core/dist ./packages/core/dist
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist

# Create directories for runtime volumes
RUN mkdir -p /app/plugins /app/watched

# Pre-download the ONNX embedding model so it's baked into the image.
# HF_HOME must persist as an ENV so the runtime knows where the cache lives.
# Run from packages/core so Node resolves @huggingface/transformers from node_modules.
ENV HF_HOME=/app/.cache/huggingface
COPY scripts/download-model.mjs ./packages/api/download-model.mjs
RUN NODE_TLS_REJECT_UNAUTHORIZED=0 node /app/packages/api/download-model.mjs

# Harden: remove OS packages not needed at Node.js runtime to reduce CVE surface.
# Fixes: tar (CVE-2026-5704, CVE-2025-45582, CVE-2005-2541),
#        perl (CVE-2011-4116), shadow/login (CVE-2007-5686),
#        apt (CVE-2011-3374), gnutls28 (CVE-2011-3389)
RUN dpkg --remove --force-remove-essential --force-depends \
      tar perl-base login passwd apt libapt-pkg6.0 libgnutls30 || true; \
    rm -rf /var/lib/apt /var/cache/apt /var/log/dpkg.log /var/log/apt

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "const h=require('http');h.get('http://localhost:3001/api/v1/health',r=>{process.exit(r.statusCode===200?0:1)}).on('error',()=>process.exit(1))"

CMD ["node", "packages/api/dist/main.js"]

# ============================================================
# Stage 3: Production web server (nginx)
# ============================================================
FROM nginx:alpine AS web

# Copy compiled frontend from builder
COPY --from=builder /app/packages/web/dist /usr/share/nginx/html

# Copy nginx site configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:80/ || exit 1

# ============================================================
# Stage 4: Standalone — all-in-one container (PostgreSQL + API + Nginx)
# ============================================================
FROM node:20-slim AS standalone

# Install PostgreSQL 16 + pgvector and Nginx.
# Use wget (no nghttp2) instead of curl; hardcode bookworm to avoid lsb-release/python.
# Supervisor replaced by entrypoint process management — eliminates python3 dependency.
RUN apt-get update && apt-get install -y --no-install-recommends \
      gnupg2 wget ca-certificates \
    && echo "deb http://apt.postgresql.org/pub/repos/apt bookworm-pgdg main" \
       > /etc/apt/sources.list.d/pgdg.list \
    && wget -qO- https://www.postgresql.org/media/keys/ACCC4CF8.asc \
       | gpg --dearmor -o /etc/apt/trusted.gpg.d/pgdg.gpg \
    && apt-get update && apt-get install -y --no-install-recommends \
      postgresql-16 \
      postgresql-16-pgvector \
      nginx \
    && apt-get purge -y --auto-remove wget gnupg2 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

RUN npm i -g pnpm@10 \
 && rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx

# Copy workspace manifests for production install
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY packages/api/package.json ./packages/api/
COPY packages/core/package.json ./packages/core/
COPY packages/shared/package.json ./packages/shared/

# Install production dependencies only, then remove pnpm (not needed at runtime)
RUN pnpm install --frozen-lockfile --prod \
 && rm -rf /usr/local/lib/node_modules/pnpm /usr/local/bin/pnpm /usr/local/lib/node_modules/corepack /usr/local/bin/corepack

# Copy compiled output from builder
COPY --from=builder /app/packages/api/dist ./packages/api/dist
COPY --from=builder /app/packages/core/dist ./packages/core/dist
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist

# Copy compiled migration script
COPY --from=builder /app/migrate-out/migrate.js /app/packages/api/migrate.cjs

# Copy compiled frontend
COPY --from=builder /app/packages/web/dist /usr/share/nginx/html

# Pre-download the ONNX embedding model
ENV HF_HOME=/app/.cache/huggingface
COPY scripts/download-model.mjs ./packages/api/download-model.mjs
RUN NODE_TLS_REJECT_UNAUTHORIZED=0 node /app/packages/api/download-model.mjs

# Create directories for runtime volumes
RUN mkdir -p /app/plugins /app/watched

# Prepare PostgreSQL data directory
ENV PGDATA=/var/lib/postgresql/data
RUN mkdir -p "$PGDATA" && chown -R postgres:postgres "$PGDATA"

# Prepare Delve config directory (persists config.json + secrets.json)
RUN mkdir -p /root/.delve

# Copy configuration files
COPY nginx.standalone.conf /etc/nginx/conf.d/default.conf
RUN rm -f /etc/nginx/sites-enabled/default
COPY scripts/docker-entrypoint.sh /app/docker-entrypoint.sh
RUN sed -i 's/\r$//' /app/docker-entrypoint.sh && chmod +x /app/docker-entrypoint.sh

# Harden: remove OS packages not needed at runtime to reduce CVE surface.
# Keeps login/passwd (needed by su in entrypoint).
# Fixes: tar (CVE-2026-5704, CVE-2025-45582, CVE-2005-2541),
#        perl (CVE-2011-4116), apt (CVE-2011-3374), gnutls28 (CVE-2011-3389)
RUN dpkg --remove --force-remove-essential --force-depends \
      tar perl-base apt libapt-pkg6.0 libgnutls30 || true; \
    rm -rf /var/lib/apt /var/cache/apt /var/log/dpkg.log /var/log/apt

EXPOSE 8080

VOLUME ["/var/lib/postgresql/data", "/root/.delve"]

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD node -e "const h=require('http');h.get('http://localhost:8080/api/v1/health',r=>{process.exit(r.statusCode===200?0:1)}).on('error',()=>process.exit(1))"

ENTRYPOINT ["/app/docker-entrypoint.sh"]

# ============================================================
# Stage 1: Build — install all deps, compile all packages
# ============================================================
FROM node:20-slim AS builder

WORKDIR /app

RUN npm i -g pnpm@9

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

RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*
RUN npm i -g pnpm@9

# Copy workspace manifests for production install
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY packages/api/package.json ./packages/api/
COPY packages/core/package.json ./packages/core/
COPY packages/shared/package.json ./packages/shared/

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod

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

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -sf http://localhost:3001/api/v1/health || exit 1

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

# Install PostgreSQL 16 + pgvector, Nginx, and supervisord
RUN apt-get update && apt-get install -y --no-install-recommends \
      gnupg2 curl ca-certificates lsb-release \
    && echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" \
       > /etc/apt/sources.list.d/pgdg.list \
    && curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc \
       | gpg --dearmor -o /etc/apt/trusted.gpg.d/pgdg.gpg \
    && apt-get update && apt-get install -y --no-install-recommends \
      postgresql-16 \
      postgresql-16-pgvector \
      nginx \
      supervisor \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

RUN npm i -g pnpm@9

# Copy workspace manifests for production install
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY packages/api/package.json ./packages/api/
COPY packages/core/package.json ./packages/core/
COPY packages/shared/package.json ./packages/shared/

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod

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

# Copy configuration files
COPY nginx.standalone.conf /etc/nginx/conf.d/default.conf
RUN rm -f /etc/nginx/sites-enabled/default
COPY scripts/supervisord.conf /etc/supervisor/conf.d/delve.conf
COPY scripts/docker-entrypoint.sh /app/docker-entrypoint.sh
RUN sed -i 's/\r$//' /app/docker-entrypoint.sh && chmod +x /app/docker-entrypoint.sh

EXPOSE 8080

VOLUME ["/var/lib/postgresql/data"]

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD curl -sf http://localhost:8080/api/v1/health || exit 1

ENTRYPOINT ["/app/docker-entrypoint.sh"]

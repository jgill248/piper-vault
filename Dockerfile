# ============================================================
# Stage 1: Build — install all deps, compile all packages
# ============================================================
FROM node:20-alpine AS builder

WORKDIR /app

RUN npm i -g pnpm@9

# Copy workspace manifests and config files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml nx.json tsconfig.base.json ./

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

# ============================================================
# Stage 2: Production API server
# ============================================================
FROM node:20-alpine AS api

WORKDIR /app

RUN npm i -g pnpm@9

# Copy workspace manifests for production install
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
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
ENV HF_HOME=/app/.cache/huggingface
COPY scripts/download-model.mjs ./scripts/download-model.mjs
RUN NODE_TLS_REJECT_UNAUTHORIZED=0 node scripts/download-model.mjs

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3001/api/v1/health || exit 1

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
  CMD wget -qO- http://localhost:80/ || exit 1

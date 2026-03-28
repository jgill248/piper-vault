# Delve

**Personal Knowledge Base & Conversational Search**

Delve is a local-first, RAG-powered knowledge base with a conversational chat interface. Ingest notes, transcripts, documents, and unstructured data, then query it through natural language powered by LLM APIs. The system indexes content locally using PostgreSQL with pgvector, performs semantic similarity search, and feeds context to a language model for grounded, citation-backed answers.

Everything runs in a **single Docker container** -- PostgreSQL, API server, and web UI bundled together. One command to start, zero external dependencies (besides your LLM API key).

---

## Table of Contents

- [Quick Start](#quick-start)
- [Single-Container Architecture](#single-container-architecture)
- [Deployment Options](#deployment-options)
- [Configuration](#configuration)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Packages](#packages)
- [API Reference](#api-reference)
- [Database Schema](#database-schema)
- [Development Setup](#development-setup)
- [Testing](#testing)
- [Design System](#design-system)
- [Roadmap](#roadmap)

---

## Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/jgill248/delve.git
cd delve

# 2. Copy the environment file and add your LLM API key
cp .env.example .env
# Edit .env — set at least one of: ANTHROPIC_API_KEY, OPENAI_API_KEY, ASK_SAGE_TOKEN, or OLLAMA_BASE_URL

# 3. Start the single-container deployment
docker compose -f docker-compose.hub.yml up -d

# 4. Open in your browser
open http://localhost:8080
```

That's it. PostgreSQL, the API server, and the web UI are all running inside a single container.

---

## Single-Container Architecture

The standout feature of Delve's deployment model is the **all-in-one standalone container**. Instead of orchestrating separate database, backend, and frontend services, everything is bundled into a single Docker image managed by [supervisord](http://supervisord.org/).

### What's Inside

```
┌──────────────────────────────────────────────────┐
│                 Single Container                  │
│                  (port 8080)                      │
│                                                   │
│  ┌─────────────────────────────────────────────┐  │
│  │  Nginx (reverse proxy)         priority: 30 │  │
│  │  - Serves React SPA at /                    │  │
│  │  - Proxies /api/* to localhost:3001         │  │
│  │  - Gzip compression, static asset caching   │  │
│  │  - 100MB upload limit                       │  │
│  └─────────────────────────────────────────────┘  │
│                                                   │
│  ┌─────────────────────────────────────────────┐  │
│  │  NestJS API Server              priority: 20│  │
│  │  - CQRS architecture                       │  │
│  │  - Embedding via ONNX (baked into image)    │  │
│  │  - All REST endpoints on port 3001          │  │
│  └─────────────────────────────────────────────┘  │
│                                                   │
│  ┌─────────────────────────────────────────────┐  │
│  │  PostgreSQL 16 + pgvector       priority: 10│  │
│  │  - 384-dim vector similarity search         │  │
│  │  - Data persisted to Docker volume          │  │
│  │  - Auto-initialized on first boot           │  │
│  └─────────────────────────────────────────────┘  │
│                                                   │
│  ┌─────────────────────────────────────────────┐  │
│  │  ONNX Embedding Model (pre-baked)           │  │
│  │  - all-MiniLM-L6-v2 (384 dimensions)       │  │
│  │  - Downloaded at build time, cached in image│  │
│  │  - No network call needed at runtime        │  │
│  └─────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────┘
```

### How the Entrypoint Works

When the container starts, the entrypoint script (`scripts/docker-entrypoint.sh`) runs through a carefully sequenced boot process:

1. **Initialize PostgreSQL** -- If the data directory is empty (first run), `initdb` creates a new database cluster with UTF-8 encoding. MD5 password authentication is configured for local TCP connections.

2. **Start PostgreSQL temporarily** -- The database starts via `pg_ctl` so setup queries can execute.

3. **Create database and user** -- Idempotent SQL creates the `delve` role and database, enables the `pgvector` extension, and grants privileges. Safe to re-run on every boot.

4. **Run migrations** -- The compiled migration script (`migrate.cjs`) applies any pending schema changes. This means upgrading the image automatically migrates your data.

5. **Stop PostgreSQL** -- A clean shutdown so supervisord can take over process management.

6. **Inject environment variables** -- Runtime env vars (API keys, auth settings, etc.) are injected into the supervisord configuration via `sed`.

7. **Launch supervisord** -- All three services start in priority order:
   - **PostgreSQL** (priority 10) -- Database daemon
   - **API server** (priority 20) -- NestJS on port 3001 (internal only)
   - **Nginx** (priority 30) -- Reverse proxy on port 8080 (exposed)

All processes have `autorestart=true`, so if any service crashes, supervisord brings it back automatically.

### Volumes

| Volume Path | Purpose |
|---|---|
| `/var/lib/postgresql/data` | PostgreSQL data directory (persisted) |
| `/app/plugins` | Custom plugin `.js` files (optional) |
| `/app/watched` | Watched folders for auto-ingestion (optional) |

### Health Check

The container includes a built-in health check that hits the API through the Nginx proxy:

```
curl -sf http://localhost:8080/api/v1/health
```

Interval: 30s, Timeout: 10s, Start period: 30s, Retries: 3.

### Why a Single Container?

- **Zero orchestration** -- No Docker Compose, no Kubernetes, no service mesh. One `docker run` command.
- **Self-contained** -- PostgreSQL, vector search, embeddings, API, and UI in one image. The only external dependency is your LLM API key.
- **Pre-baked model** -- The ONNX embedding model is downloaded at build time and cached inside the image. No network calls to Hugging Face at runtime.
- **Auto-migration** -- Schema migrations run on every boot, so pulling a new image version upgrades your database automatically.
- **Persistent data** -- All state lives in a single Docker volume (`/var/lib/postgresql/data`). Back up one volume, restore anywhere.

---

## Deployment Options

### Option 1: Single Container (Recommended)

The simplest deployment. Everything in one container.

```bash
# Using Docker Compose
docker compose -f docker-compose.hub.yml up -d

# Or raw Docker
docker run -d \
  --name delve \
  -p 8080:8080 \
  -v delve-data:/var/lib/postgresql/data \
  -e ANTHROPIC_API_KEY=sk-ant-... \
  creative-software/delve:latest
```

### Option 2: Multi-Service Production

Separate containers for PostgreSQL, API, and Nginx. Better for scaling or when you already have a managed Postgres instance.

```bash
cp .env.example .env
# Edit .env — POSTGRES_PASSWORD is required

docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml exec api node packages/api/dist/database/migrate.js
```

Services:
- **postgres** -- pgvector image, persisted volume, 1GB memory limit
- **api** -- Compiled NestJS server, depends on postgres health check
- **web** -- Nginx reverse proxy, exposes port 8080

### Option 3: Build from Source

```bash
# Build the standalone image locally
docker build --target standalone -t delve:local .

# Run it
docker run -d -p 8080:8080 -v delve-data:/var/lib/postgresql/data delve:local
```

The multi-stage Dockerfile has four build targets:
| Target | Description |
|---|---|
| `builder` | Installs all deps, compiles all packages (shared -> core -> api + web) |
| `api` | Minimal Node.js image with compiled API + production deps |
| `web` | Nginx Alpine with compiled React frontend |
| `standalone` | All-in-one: PostgreSQL 16 + pgvector + API + Nginx + supervisord |

### Option 4: Bare Metal

```bash
# Prerequisites: Node.js 20+, pnpm 9+, PostgreSQL 16+ with pgvector
pnpm install --frozen-lockfile
pnpm run build
pnpm run db:migrate
node packages/api/dist/main.js
# Serve packages/web/dist via nginx or any static file server
```

---

## Configuration

Copy `.env.example` to `.env` and configure:

### Database

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `postgresql://delve:delve@localhost:5432/delve` | Full connection string |
| `POSTGRES_USER` | `delve` | Database user |
| `POSTGRES_PASSWORD` | `delve` | Database password |
| `POSTGRES_DB` | `delve` | Database name |

### LLM Providers

Set at least one. Configure the active provider in the UI settings.

| Variable | Description |
|---|---|
| `ANTHROPIC_API_KEY` | Anthropic API key (Claude models) |
| `OPENAI_API_KEY` | OpenAI API key (GPT models) |
| `ASK_SAGE_TOKEN` | Ask Sage token (does not expire) |
| `OLLAMA_BASE_URL` | Ollama endpoint (default: `http://localhost:11434`) |

### Authentication

| Variable | Default | Description |
|---|---|---|
| `AUTH_ENABLED` | `false` | Enable username/password login |
| `JWT_SECRET` | `change-me-in-production` | Secret for signing JWT tokens. **Change this in production.** |

### Server

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3001` | API server port |
| `WEB_PORT` | `8080` | Web UI port (Docker Compose) |
| `CORS_ORIGIN` | `http://localhost:5173` | Allowed CORS origin |
| `PLUGINS_DIR` | `/app/plugins` | Path to plugin directory |
| `WEBHOOK_RATE_LIMIT` | `60` | Max ingest requests per minute per API key |

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Backend** | Node.js 20+, TypeScript, NestJS 10 (Fastify adapter) |
| **Frontend** | React 18, Vite 5, TailwindCSS 3.4, TanStack Query 5 |
| **Database** | PostgreSQL 16 with pgvector extension |
| **ORM** | Drizzle ORM |
| **Embeddings** | `all-MiniLM-L6-v2` via ONNX Runtime (384 dimensions) |
| **LLM** | Anthropic, OpenAI, Ask Sage, Ollama (pluggable adapters) |
| **File Parsing** | pdf-parse, mammoth (DOCX), cheerio (HTML), papaparse (CSV) |
| **Build System** | pnpm workspaces + Nx |
| **Linting** | ESLint 10, Prettier 3.8 |
| **Testing** | Vitest |
| **Containerization** | Docker (multi-stage), supervisord, Nginx |

---

## Project Structure

```
delve/
├── packages/
│   ├── api/                    NestJS backend (CQRS modules)
│   │   └── src/
│   │       ├── auth/           Authentication (JWT, guards, registration)
│   │       ├── chat/           Chat commands & queries
│   │       ├── collections/    Multi-collection management
│   │       ├── config/         Application configuration
│   │       ├── database/       Drizzle schema, migrations, connection
│   │       ├── health/         Health check endpoint
│   │       ├── notes/          Note creation, folders, wiki-links
│   │       ├── plugins/        Plugin loader & runtime
│   │       ├── search/         Semantic search queries
│   │       ├── sources/        Source ingestion & management
│   │       ├── watched-folders/ Auto-ingestion from directories
│   │       ├── webhooks/       Webhook ingestion endpoints
│   │       ├── api-keys/       API key management
│   │       └── app.module.ts   Root NestJS module
│   ├── web/                    React frontend
│   │   └── src/
│   │       ├── components/     UI components (chat, sources, notes, settings)
│   │       ├── context/        React context providers (auth, collections, toast)
│   │       ├── hooks/          Custom hooks
│   │       └── api/            API client & React Query hooks
│   ├── core/                   Framework-agnostic business logic
│   │   └── src/
│   │       ├── ingestion/      File parsing, chunking, embedding pipeline
│   │       ├── retrieval/      Vector search, context assembly
│   │       ├── llm/            LLM adapter interfaces & implementations
│   │       └── export/         Markdown export
│   └── shared/                 Shared types, constants, utilities
├── scripts/
│   ├── docker-entrypoint.sh    Single-container boot sequence
│   ├── supervisord.conf        Process management config
│   └── download-model.mjs      ONNX model pre-download script
├── docs/
│   ├── api-reference.md        Full API documentation
│   └── deployment.md           Deployment & self-hosting guide
├── spec/                       Project specification & design mockups
├── Dockerfile                  Multi-stage (4 targets)
├── docker-compose.yml          Development (Postgres + pgAdmin)
├── docker-compose.prod.yml     Production (3 services)
├── docker-compose.hub.yml      Single container from Docker Hub
├── nginx.conf                  Multi-service Nginx config
├── nginx.standalone.conf       Single-container Nginx config
├── nx.json                     Nx build system config
├── pnpm-workspace.yaml         pnpm monorepo config
└── .env.example                Environment variable template
```

---

## Packages

### `packages/api` -- Backend API Server

NestJS application using CQRS (Command Query Responsibility Segregation). All operations are either a **command** (write) or a **query** (read), dispatched through NestJS `CommandBus` and `QueryBus`.

**Request flow:**
```
HTTP Request -> Controller (Zod validation) -> CommandBus / QueryBus -> Handler (business logic via core) -> Response DTO
```

**Modules:** sources, chat, search, notes, collections, auth, api-keys, watched-folders, webhooks, plugins, config, health, database.

### `packages/core` -- Business Logic

Framework-agnostic library containing all domain logic. Decoupled from NestJS so it can be reused in CLI tools, Electron apps, or other runtimes.

- **Ingestion pipeline:** Parse files (PDF, DOCX, CSV, JSON, HTML, YAML, Markdown, plain text) -> chunk text -> generate embeddings -> store in pgvector
- **Retrieval:** Cosine similarity search, metadata filtering, re-ranking
- **LLM adapters:** Ask Sage, Anthropic, OpenAI, Ollama -- all behind a common interface
- **Export:** Markdown export for conversations and notes

### `packages/web` -- Frontend

React 18 SPA built with Vite. Uses the "Obsidian Protocol" design system (dark, monospace, cyberpunk-industrial aesthetic).

**Views:** Chat, Sources, Notes, Settings
**State management:** React Context for auth/collections, TanStack Query for server state
**Components:** ChatPanel, SourcesPanel, NotesPanel (with FolderTree, NoteEditor, WikiLink, BacklinksPanel), SettingsPanel, UploadZone

### `packages/shared` -- Shared Types

TypeScript types, constants, and utilities shared across all packages. No runtime dependencies.

---

## API Reference

Base URL: `/api/v1`

### Sources

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/sources/upload` | Upload a file for ingestion |
| `POST` | `/sources/bulk-import` | Bulk import from a directory |
| `GET` | `/sources` | List sources (paginated) |
| `GET` | `/sources/:id` | Get source details |
| `DELETE` | `/sources/:id` | Delete a source and its chunks |

### Chat

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/chat` | Send a message with RAG retrieval |
| `GET` | `/conversations` | List conversations (paginated) |
| `GET` | `/conversations/:id` | Get conversation with messages |
| `GET` | `/conversations/:id/export` | Export conversation as markdown |
| `DELETE` | `/conversations/:id` | Delete a conversation |

### Search

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/search` | Semantic search across chunks |

### Notes

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/notes` | Create a markdown note |
| `GET` | `/notes` | List notes (paginated) |
| `GET` | `/notes/:id` | Get note details |
| `PATCH` | `/notes/:id` | Update a note |
| `DELETE` | `/notes/:id` | Delete a note |
| `POST` | `/notes/folders` | Create a note folder |
| `GET` | `/notes/folders` | List folders |
| `PATCH` | `/notes/folders/:id` | Rename a folder |
| `DELETE` | `/notes/folders/:id` | Delete a folder |

### Collections

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/collections` | List collections |
| `POST` | `/collections` | Create a collection |
| `PATCH` | `/collections/:id` | Update a collection |
| `DELETE` | `/collections/:id` | Delete a collection |

### System

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Health check |
| `GET` | `/config` | Get application config |
| `PATCH` | `/config` | Update settings |
| `POST` | `/api-keys` | Create an API key |
| `POST` | `/watched-folders` | Add a watched directory |
| `GET` | `/watched-folders` | List watched folders |
| `DELETE` | `/watched-folders/:id` | Remove a watched folder |

See [docs/api-reference.md](docs/api-reference.md) for full request/response schemas.

---

## Database Schema

PostgreSQL 16 with pgvector. All schema changes are applied via versioned migrations that run automatically on container boot.

| Table | Purpose |
|---|---|
| `users` | User accounts (username, email, hashed password, role) |
| `collections` | Named namespaces for organizing sources and conversations |
| `sources` | Ingested documents (filename, type, content hash, status, tags) |
| `chunks` | Text segments with 384-dim embeddings for vector search |
| `conversations` | Chat sessions linked to collections |
| `messages` | Chat messages (role, content, cited sources, model used) |
| `watched_folders` | Directories monitored for auto-ingestion |
| `api_keys` | Hashed API keys for webhook authentication |
| `note_folders` | Hierarchical note folder organization |
| `source_links` | Wiki-link relationships between sources |

---

## Development Setup

### Prerequisites

- Node.js 20+
- pnpm 9+
- PostgreSQL 16+ with pgvector (or use the Docker Compose dev setup)
- An LLM API key (Anthropic, OpenAI, Ask Sage, or local Ollama)

### Getting Started

```bash
# Clone
git clone https://github.com/jgill248/delve.git
cd delve

# Install dependencies
pnpm install --frozen-lockfile

# Start PostgreSQL (dev mode with pgAdmin)
docker compose up -d

# Copy and configure environment
cp .env.example .env
# Edit .env with your database URL and API keys

# Run database migrations
pnpm run db:migrate

# Start all packages in watch mode
pnpm run dev
```

The API runs on `http://localhost:3001` and the web UI on `http://localhost:5173`.

### Useful Commands

```bash
pnpm run dev            # Start all packages in watch mode (parallel)
pnpm run dev:api        # Start only the API server
pnpm run dev:web        # Start only the web UI
pnpm run build          # Build all packages (Nx dependency order)
pnpm run test           # Run all tests
pnpm run lint           # Lint all packages
pnpm run db:migrate     # Run database migrations
pnpm run clean          # Clean all build artifacts
```

### Building the Docker Image

```bash
# Build the standalone (all-in-one) image
docker build --target standalone -t delve:dev .

# Build only the API image
docker build --target api -t delve-api:dev .

# Build only the web image
docker build --target web -t delve-web:dev .
```

---

## Testing

All packages use [Vitest](https://vitest.dev/). Test files are colocated with source files as `*.test.ts(x)`.

```bash
# Run all tests across all packages
pnpm run test

# Run tests for a specific package
pnpm --filter @delve/core test
pnpm --filter @delve/api test
pnpm --filter @delve/web test
```

**Testing approach:**
- **`packages/core/`** -- Unit tests with mocked external dependencies
- **`packages/api/`** -- Integration tests against a test database
- **`packages/web/`** -- Component tests with React Testing Library (behavior, not implementation)

---

## Design System

Delve uses the **Obsidian Protocol** design system -- a dark, high-density "Sovereign Console" aesthetic inspired by military-grade command interfaces.

| Property | Value |
|---|---|
| **Background** | Deep obsidian `#05070A` |
| **Primary accent** | Phosphor glow `#abd600` |
| **Border radius** | `0px` everywhere -- no rounded corners |
| **Shadows** | None -- no drop shadows |
| **Monospace font** | JetBrains Mono (data, tables, labels, code) |
| **Sans-serif font** | Manrope / Inter (UI text, headings) |
| **Effects** | Scanline overlay texture, glow on CTAs |

Design mockups are in `spec/stitch/`. The full design system reference is at `spec/stitch/obsidian_protocol/DESIGN.md`.

---

## Roadmap

| Phase | Status | Focus |
|---|---|---|
| **1. Foundation** | Done | Scaffolding, .md/.txt ingestion, vector storage, basic chat |
| **2. Expand Ingestion & Polish** | Done | All file formats, source browser, conversation history, settings |
| **3. Intelligence & Refinement** | Done | Hybrid search, re-ranking, follow-ups, export, provider adapters |
| **4. Scale & Ecosystem** | Done | Watched folders, webhooks, multi-collection, auth, plugins |
| **5. Native Knowledge Management** | Active | Wiki-links, note folders, frontmatter extraction, native editor |
| **6. Agentic RAG** | Planned | Streaming, query routing, corrective RAG, research mode |
| **7. Multi-Modal Knowledge** | Planned | Audio transcription, image understanding, video indexing |
| **8. Knowledge Graph Intelligence** | Planned | Entity extraction, relationship mapping, graph visualization |
| **9. Desktop App & Plugin SDK** | Planned | Tauri desktop app, plugin SDK, mobile PWA |
| **10. Personal Memory** | Planned | Persistent memory, knowledge briefs, pattern detection |
| **11. Reasoning & Voice** | Planned | Budget-aware reasoning, voice-first interface |
| **12. Dev Tools** | Planned | Git/issue tracker indexing, MCP server mode |
| **13. Federated Knowledge** | Planned | P2P CRDT sync, LoRA fine-tuning |
| **14. Exploratory Horizons** | Planned | 3D graph, embodied knowledge, digital twin |

Full specification: [spec/spec.md](spec/spec.md)

---

## License

This project is private. All rights reserved.

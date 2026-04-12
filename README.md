# P.I.P.E.R. Vault

**Your Personal Knowledge Vault with AI-Powered Search — Free and Open Source**

[![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL--3.0-blue.svg)](LICENSE)
[![Docker](https://img.shields.io/badge/Docker-Hub-2496ED.svg)](https://hub.docker.com/r/pipervault/piper-vault)
[![GitHub](https://img.shields.io/badge/GitHub-jgill248%2Fpiper--vault-181717.svg?logo=github)](https://github.com/jgill248/piper-vault)

P.I.P.E.R. Vault is an open-source, local-first knowledge vault where you build, connect, and search your personal knowledge — entirely on your own machine. Ingest notes, documents, transcripts, and other content, then query it through natural language powered by your choice of LLM. The system indexes content locally using PostgreSQL with pgvector, performs semantic similarity search, and generates grounded, citation-backed answers.

**The vault is the product. Chat is a feature for querying the vault.**

Everything runs in a **single Docker container** — PostgreSQL, API server, React UI, and embedding model bundled together. One command to start, zero external dependencies beyond your LLM API key (which you can configure through the UI after first boot).

### Why Piper Vault?

- **Free and open source, forever.** Licensed under AGPL-3.0. No feature gating, no license keys, no subscription. Every feature ships in the Docker image.
- **Your data stays yours.** The database, the embedding model, the API, and the UI all live in one container on hardware you control. Zero telemetry. No account required.
- **A wiki that writes itself.** The LLM reads every source you ingest and synthesizes a living knowledge base — entity pages, concept summaries, cross-references, and version history.
- **Bring your own LLM.** Works with Anthropic, OpenAI, Ollama (fully offline), or Ask Sage. Swap providers from the Settings panel any time.
- **Managed cloud hosting coming soon.** A hosted version is on the roadmap for those who want convenience over self-hosting — same AGPL source, no proprietary fork.

---

## Screenshots

<table>
  <tr>
    <td align="center" width="50%">
      <img src="docs/images/chat.png" alt="Chat with your vault, with inline citations" />
      <br /><sub><b>Chat</b> — Ask questions of your vault, with inline citations back to every source.</sub>
    </td>
    <td align="center" width="50%">
      <img src="docs/images/knowledge-graph.png" alt="Semantic knowledge graph visualizing notes and sources" />
      <br /><sub><b>Knowledge Graph</b> — Force-directed visualization of every note, source, and generated wiki page.</sub>
    </td>
  </tr>
  <tr>
    <td align="center" width="50%">
      <img src="docs/images/sources.png" alt="Source ingestion and archive browser" />
      <br /><sub><b>Sources</b> — Drag and drop ingestion, watched folders, and a searchable archive.</sub>
    </td>
    <td align="center" width="50%">
      <img src="docs/images/settings.png" alt="Settings and provider configuration" />
      <br /><sub><b>Settings</b> — Configure LLM providers, API keys, system prompt presets, and wiki generation.</sub>
    </td>
  </tr>
</table>

---

## Table of Contents

- [Screenshots](#screenshots)
- [Quick Start](#quick-start)
- [Single-Container Architecture](#single-container-architecture)
- [Deployment Options](#deployment-options)
- [Configuration](#configuration)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Packages](#packages)
- [API Reference](#api-reference)
- [Database Schema](#database-schema)
- [Development Setup](#development-setup)
- [Testing](#testing)
- [Design System](#design-system)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [License](#license)

---

## Quick Start

```bash
# Pull and run — no configuration needed to start
docker run -d \
  --name piper-vault \
  -p 8080:8080 \
  -v piper-vault-data:/var/lib/postgresql/data \
  pipervault/piper-vault:latest

# Open in your browser
open http://localhost:8080
```

Or with Docker Compose:

```bash
# Using the Docker Hub compose file
docker compose -f docker-compose.hub.yml up -d
open http://localhost:8080
```

PostgreSQL, the API server, the embedding model, and the web UI all start inside a single container. Configure your LLM provider (Anthropic, OpenAI, Ollama, or Ask Sage) through the Settings panel in the UI after first boot.

---

## Single-Container Architecture

The standout feature of P.I.P.E.R. Vault's deployment model is the **all-in-one standalone container**. Instead of orchestrating separate database, backend, and frontend services, everything is bundled into a single Docker image managed by [supervisord](http://supervisord.org/).

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
│  │  - CQRS architecture                        │  │
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
│  │  - all-MiniLM-L6-v2 (384 dimensions)        │  │
│  │  - Downloaded at build time, cached in image│  │
│  │  - No network call needed at runtime        │  │
│  └─────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────┘
```

### How the Entrypoint Works

When the container starts, the entrypoint script (`scripts/docker-entrypoint.sh`) runs through a carefully sequenced boot process:

1. **Initialize PostgreSQL** — If the data directory is empty (first run), `initdb` creates a new database cluster with UTF-8 encoding. MD5 password authentication is configured for local TCP connections.

2. **Start PostgreSQL temporarily** — The database starts via `pg_ctl` so setup queries can execute.

3. **Create database and user** — Idempotent SQL creates the `delve` role and database, enables the `pgvector` extension, and grants privileges. Safe to re-run on every boot.

4. **Run migrations** — The compiled migration script (`migrate.cjs`) applies any pending schema changes. Upgrading the image automatically migrates your data.

5. **Stop PostgreSQL** — A clean shutdown so supervisord can take over process management.

6. **Launch supervisord** — All three services start in priority order:
   - **PostgreSQL** (priority 10) — Database daemon
   - **API server** (priority 20) — NestJS on port 3001 (internal only)
   - **Nginx** (priority 30) — Reverse proxy on port 8080 (exposed)

All processes have `autorestart=true`, so if any service crashes, supervisord brings it back automatically.

### Volumes

| Volume Path | Purpose |
|---|---|
| `/var/lib/postgresql/data` | PostgreSQL data directory (persisted) |
| `/root/.delve` | Application settings and configuration |
| `/app/plugins` | Custom plugin `.js` files (optional) |
| `/app/watched` | Watched folders for auto-ingestion (optional) |

### Health Check

The container includes a built-in health check that hits the API through the Nginx proxy:

```
curl -sf http://localhost:8080/api/v1/health
```

Interval: 30s, Timeout: 10s, Start period: 30s, Retries: 3.

### Why a Single Container?

- **Zero orchestration** — No Docker Compose, no Kubernetes, no service mesh. One `docker run` command.
- **Zero config to start** — LLM providers are configured through the UI. No `.env` file required.
- **Self-contained** — PostgreSQL, vector search, embeddings, API, and UI in one image.
- **Pre-baked model** — The ONNX embedding model is downloaded at build time and cached inside the image. No network calls to Hugging Face at runtime.
- **Auto-migration** — Schema migrations run on every boot, so pulling a new image version upgrades your database automatically.
- **Persistent data** — All state lives in a single Docker volume. Back up one volume, restore anywhere.

---

## Deployment Options

### Option 1: Single Container (Recommended)

The simplest deployment. Everything in one container, no configuration required to start.

```bash
# Using Docker Compose
docker compose -f docker-compose.hub.yml up -d

# Or raw Docker
docker run -d \
  --name piper-vault \
  -p 8080:8080 \
  -v piper-vault-data:/var/lib/postgresql/data \
  -v piper-vault-config:/root/.delve \
  pipervault/piper-vault:latest
```

You can optionally pass LLM API keys as environment variables to pre-configure providers:

```bash
docker run -d \
  --name piper-vault \
  -p 8080:8080 \
  -v piper-vault-data:/var/lib/postgresql/data \
  -e ANTHROPIC_API_KEY=sk-ant-... \
  pipervault/piper-vault:latest
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
- **postgres** — pgvector image, persisted volume, 1GB memory limit
- **api** — Compiled NestJS server, depends on postgres health check
- **web** — Nginx reverse proxy, exposes port 8080

### Option 3: Build from Source

```bash
# Build the standalone (all-in-one) image locally
docker build --target standalone -t piper-vault:local .

# Run it
docker run -d -p 8080:8080 -v piper-vault-data:/var/lib/postgresql/data piper-vault:local
```

The multi-stage Dockerfile has four build targets:

| Target | Description |
|---|---|
| `builder` | Installs all deps, compiles all packages (shared → core → api + web) |
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

The standalone container requires no configuration to start — providers are configured through the Settings panel in the UI. For multi-service deployments, copy `.env.example` to `.env` and configure:

### Database

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `postgresql://delve:delve@localhost:5432/delve` | Full connection string |
| `POSTGRES_USER` | `delve` | Database user |
| `POSTGRES_PASSWORD` | `delve` | Database password |
| `POSTGRES_DB` | `delve` | Database name |

### LLM Providers

Configure at least one. The active provider is selected in the UI Settings panel.

| Variable | Description |
|---|---|
| `ANTHROPIC_API_KEY` | Anthropic API key for Claude models |
| `OPENAI_API_KEY` | OpenAI API key for GPT models |
| `ASK_SAGE_TOKEN` | Ask Sage token (does not expire) |
| `OLLAMA_BASE_URL` | Ollama endpoint (default: `http://localhost:11434`) |

**Supported models per provider:**

| Provider | Models |
|---|---|
| Anthropic | claude-sonnet-4-20250514, claude-haiku-4-5-20251001, claude-opus-4-20250514 |
| OpenAI | gpt-4o, gpt-4o-mini, gpt-4-turbo, gpt-3.5-turbo |
| Ollama | Any locally installed model (fetched dynamically from `/api/tags`) |
| Ask Sage | claude-3.5-sonnet and other configured models |

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

## Features

### Knowledge Management
- **Multi-format ingestion** — PDF, DOCX, CSV, JSON, HTML, YAML, Markdown, plain text
- **Native note editor** — Write in Markdown with a built-in editor; notes live alongside ingested documents
- **Wiki-links** — Link notes together with `[[title]]` syntax; backlinks tracked automatically
- **LLM Wiki (auto-synthesis)** — When you ingest a source, the LLM automatically generates and updates wiki pages — entity summaries, concept pages, and cross-references. Conversations can be promoted to wiki pages too. A periodic lint pass catches contradictions, orphaned pages, and stale claims.
- **Hierarchical folders** — Organize notes into nested folder structures
- **YAML frontmatter** — Extract metadata from note headers
- **Knowledge graph** — Force-directed visualization of connections between notes and sources, with generated wiki pages visually differentiated
- **Multi-collection support** — Organize all content into named workspace collections
- **Tags** — Tag sources and notes for topic-based organization

### Search & Chat
- **Semantic search** — 384-dimensional vector embeddings via ONNX (all-MiniLM-L6-v2, fully local)
- **Hybrid retrieval** — Combines vector similarity with keyword search and re-ranking
- **Conversational chat** — RAG-powered Q&A with source citations in every answer
- **Streaming responses** — Real-time LLM response streaming via SSE
- **Conversation history** — All chat sessions persisted and browsable
- **Export** — Export conversations to Markdown

### Automation & Extensibility
- **Watched folders** — Auto-ingest files from monitored directories
- **Wiki generation** — Background LLM-powered synthesis creates wiki pages from ingested sources, with configurable model, folder, and page limits
- **Wiki lint** — Scheduled health checks detect broken links, contradictions, orphaned pages, and missing cross-references
- **Webhook ingestion** — API key-based file upload endpoint with rate limiting
- **Plugin system** — Custom JavaScript plugins for extending extraction and processing
- **System prompt presets** — Save and switch between per-model prompt configurations

### Infrastructure
- **Local embeddings** — Embedding model runs fully offline, pre-baked into Docker image
- **Authentication** — Optional username/password login with JWT tokens
- **Auto-migration** — Database schema upgrades automatically on container boot

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Backend** | Node.js 20+, TypeScript, NestJS 10 (Fastify adapter) |
| **Frontend** | React 18, Vite 5, TailwindCSS 3.4, TanStack Query 5 |
| **Database** | PostgreSQL 16 with pgvector extension |
| **ORM** | Drizzle ORM |
| **Embeddings** | `all-MiniLM-L6-v2` via ONNX Runtime (384 dimensions, fully local) |
| **LLM** | Anthropic, OpenAI, Ask Sage, Ollama — pluggable adapter pattern |
| **File Parsing** | pdf-parse, mammoth (DOCX), cheerio (HTML), papaparse (CSV), yaml |
| **Build System** | pnpm workspaces + Nx |
| **Linting** | ESLint 10, Prettier 3.8 |
| **Testing** | Vitest |
| **Containerization** | Docker (multi-stage), supervisord, Nginx |

---

## Project Structure

```
piper-vault/
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
│   │       ├── wiki/           LLM Wiki generation, lint, and scheduling
│   │       ├── api-keys/       API key management
│   │       └── app.module.ts   Root NestJS module
│   ├── web/                    React frontend
│   │   └── src/
│   │       ├── components/     UI components (chat, sources, notes, graph, settings)
│   │       ├── context/        React context providers (auth, collections, toast)
│   │       ├── hooks/          Custom hooks
│   │       └── api/            API client & React Query hooks
│   ├── core/                   Framework-agnostic business logic
│   │   └── src/
│   │       ├── ingestion/      File parsing, chunking, embedding pipeline
│   │       ├── retrieval/      Vector search, re-ranking, context assembly
│   │       ├── llm/            LLM adapter interfaces & implementations
│   │       ├── wiki/           Wiki generation, linting, and indexing
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

### `packages/api` — Backend API Server

NestJS application using CQRS (Command Query Responsibility Segregation). All operations are either a **command** (write) or a **query** (read), dispatched through NestJS `CommandBus` and `QueryBus`.

**Request flow:**
```
HTTP Request → Controller (Zod validation) → CommandBus / QueryBus → Handler (business logic via core) → Response DTO
```

**Modules:** sources, chat, search, notes, collections, auth, api-keys, watched-folders, webhooks, wiki, plugins, config, health, database.

### `packages/core` — Business Logic

Framework-agnostic library containing all domain logic. Decoupled from NestJS so it can be reused in CLI tools, Electron apps, or other runtimes.

- **Ingestion pipeline:** Parse files (PDF, DOCX, CSV, JSON, HTML, YAML, Markdown, plain text) → chunk text → generate embeddings → store in pgvector
- **Retrieval:** Cosine similarity search, metadata filtering, re-ranking
- **LLM adapters:** Anthropic, OpenAI, Ask Sage, Ollama — all behind a common `LlmProvider` interface
- **Export:** Markdown export for conversations and notes

### `packages/web` — Frontend

React 18 SPA built with Vite. Uses the **Sovereign Press** design system — a warm 19th-century printing house aesthetic.

**Views:**
- **Chat** — Conversational interface, RAG-backed answers with source citations, streaming responses
- **Sources** — File browser, drag-and-drop upload zone, search filters, bulk import
- **Notes** — Hierarchical folder tree, Markdown editor, wiki-link parsing, backlink panel
- **Graph** — Force-directed knowledge graph visualization of note and source connections
- **Settings** — LLM provider configuration, API key management, system prompt presets, auth settings

**State management:** React Context for auth/collections, TanStack Query v5 for all server state.

### `packages/shared` — Shared Types

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
| `note_folders` | Hierarchical note folder organization |
| `source_links` | Wiki-link relationships between sources |
| `watched_folders` | Directories monitored for auto-ingestion |
| `api_keys` | Hashed API keys for webhook authentication |
| `system_prompt_presets` | Saved system prompt configurations per model |

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
git clone https://github.com/jgill248/piper-vault.git
cd piper-vault

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
docker build --target standalone -t piper-vault:dev .

# Build only the API image
docker build --target api -t piper-vault-api:dev .

# Build only the web image
docker build --target web -t piper-vault-web:dev .
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
- **`packages/core/`** — Unit tests with mocked external dependencies
- **`packages/api/`** — Integration tests against a test database
- **`packages/web/`** — Component tests with React Testing Library (behavior, not implementation)

---

## Design System

P.I.P.E.R. Vault uses the **Sovereign Press** design system — a 19th-century printing house aesthetic, like a curated ledger or library catalogue.

**Light mode (Parchment):**

| Property | Value |
|---|---|
| **Background** | Warm off-white `#fff9ee` |
| **Primary** | Burgundy `#570013` |
| **Secondary** | Steel `#4f6073` |
| **Tertiary** | Brass `#362400` |

**Dark mode (Nocturne):**

| Property | Value |
|---|---|
| **Background** | Charcoal / stained wood `#1d1c15` |
| **Primary** | Aged parchment `#fddbdb` |
| **Secondary** | Muted slate `#bdc7d6` |

**Typography:**
- **Newsreader** (slab-serif) — headlines and data display
- **Work Sans** (sans-serif) — body text and labels
- **JetBrains Mono** — code blocks

**Rules:**
- `0px` border radius everywhere — no rounded corners
- No drop shadows — depth via tonal layering only
- No 1px rule lines for sectioning — use background color shifts (surface hierarchy)

Design mockups are in `spec/stitch/`. Full design system references:
- Light mode: `spec/stitch/piper/app/sovereign_press/DESIGN.md`
- Dark mode: `spec/stitch/piper/app/sovereign_press_nocturne/DESIGN.md`

---

## Roadmap

| Phase | Status | Focus |
|---|---|---|
| **1. Foundation** | Done | Scaffolding, .md/.txt ingestion, vector storage, basic chat |
| **2. Expand Ingestion & Polish** | Done | All file formats, source browser, conversation history, settings |
| **3. Intelligence & Refinement** | Done | Hybrid search, re-ranking, follow-ups, export, provider adapters, streaming |
| **4. Scale & Ecosystem** | Done | Watched folders, webhooks, multi-collection, auth, plugins |
| **5. Native Knowledge Management** | Done | Wiki-link graph, frontmatter, markdown editor, note folders, tags, graph-aware retrieval |
| **A. The Vault Experience** | Active | Knowledge graph viz, Obsidian/Notion import, vault-first onboarding, tag browser, smart link suggestions |
| **LLM Wiki** | Active | Auto-synthesis of wiki pages from sources, conversation-to-wiki promotion, scheduled lint, wiki index & log |
| **B. Distribution** | Planned | CI/CD pipeline, managed cloud hosting (opt-in convenience layer) |
| **C. Polish** | Backlog | Follow-up questions, MCP server mode, OIDC/SSO |

Full specification: [spec/spec.md](spec/spec.md)

---

## Contributing

P.I.P.E.R. Vault is open source and we welcome contributions. Whether it's bug fixes, new file parsers, LLM adapters, or UI improvements — all contributions are appreciated.

```bash
# Fork and clone
git clone https://github.com/YOUR_USERNAME/piper-vault.git
cd piper-vault

# Install and run
pnpm install --frozen-lockfile
docker compose up -d    # Start PostgreSQL
cp .env.example .env    # Configure
pnpm run dev            # Start dev servers
```

Please open an issue before starting major work so we can discuss the approach.

---

## License

P.I.P.E.R. Vault is licensed under the [GNU Affero General Public License v3.0 (AGPL-3.0)](LICENSE).

This means you can freely use, modify, and self-host P.I.P.E.R. Vault. Every feature — LLM Wiki, knowledge graph, all provider adapters, plugins, watched folders, webhooks — ships in the open-source image. There is no paid tier with extra features, no license key, and no subscription.

If you modify the software and offer it as a network service, you must make your modifications available under the same license. That's the only obligation the AGPL imposes.

### A note on managed hosting

A **managed cloud version** of P.I.P.E.R. Vault is on the roadmap for people who'd rather not self-host. When it launches, it will run the same AGPL-3.0 source code — no proprietary fork, no feature gating. The self-hosted version will always have feature parity.

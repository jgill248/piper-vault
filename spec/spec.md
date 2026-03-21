# DELVE

**Personal Knowledge Base & Conversational Search**

Project Specification · Version 1.0 · March 2026 · Status: Draft

*A local RAG-powered knowledge system with conversational search via LLM API*

---

## 1. Executive Summary

Delve is a local-first, RAG-powered knowledge base with a conversational chat interface. It allows a user to ingest notes, transcripts, documents, and other unstructured data, then query that data through natural language powered by an LLM API. The system indexes content locally, performs semantic similarity search to find relevant context, and feeds that context to a language model to produce grounded, citation-backed answers.

The primary LLM backend is Ask Sage, accessed through its REST API, which provides access to multiple model providers (Claude, GPT-4, Gemini, and others) through a single interface. The architecture is designed to be provider-agnostic, allowing future substitution of any OpenAI-compatible or custom LLM endpoint.

---

## 2. Goals & Non-Goals

### 2.1 Goals

- Provide a single place to drop in and search across personal knowledge artifacts
- Deliver grounded, context-aware answers with source citations
- Support a wide range of input formats: markdown, plaintext, PDF, DOCX, transcripts, CSV
- Maintain clean separation of concerns to allow swapping any layer independently
- Keep all indexed data local and under user control
- Provide a clean, responsive React-based web UI

### 2.2 Non-Goals (v1)

- Multi-user / team collaboration (single user for v1)
- Real-time syncing with external sources (e.g., Notion, Google Drive)
- Fine-tuning or training custom models
- Mobile-native app (responsive web is sufficient)
- Production-grade auth / deployment (local dev environment is fine for v1)

---

## 3. System Architecture

Delve is composed of four distinct layers, each with a clear interface boundary. This separation ensures any layer can be modified, replaced, or scaled independently.

| Layer | Responsibility | Key Technology |
|-------|---------------|----------------|
| Ingestion | File upload, text extraction, chunking, embedding, storage | Node.js, pdf-parse, mammoth, tiktoken |
| Retrieval | Query embedding, vector similarity search, ranking, context assembly | pgvector (PostgreSQL) or ChromaDB |
| LLM | Prompt construction, API communication, response streaming | Ask Sage API (provider-agnostic adapter) |
| Presentation | Chat UI, file management, source display, conversation history | React, TypeScript, TailwindCSS |

### 3.1 Ingestion Layer

The ingestion layer is responsible for accepting raw files, extracting their text content, splitting that content into semantically meaningful chunks, generating vector embeddings for each chunk, and storing both the raw text and its embedding in the vector database.

#### File Processing Pipeline

1. **File Upload** — User drops files into the web UI or places them in a watched directory.
2. **Format Detection** — MIME type detection determines the extraction strategy.
3. **Text Extraction** — Format-specific parsers pull raw text content.
4. **Chunking** — Text is split into overlapping chunks using a configurable strategy.
5. **Embedding** — Each chunk is embedded using a sentence-transformer model or embedding API.
6. **Storage** — Chunk text, embedding vector, and metadata are written to the vector store.

#### Supported Input Formats

| Format | Extraction Method | Notes |
|--------|------------------|-------|
| .md, .txt | Direct read | Preserves structure, splits on headings |
| .pdf | pdf-parse / pdfjs-dist | Handles text-based PDFs; OCR not in v1 scope |
| .docx | mammoth | Extracts text with basic structure |
| .csv, .tsv | papaparse | Converts rows to natural language statements |
| .json | Custom parser | Flattens nested structures into searchable text |
| .html | cheerio | Strips tags, preserves semantic content |
| Audio transcripts | Pre-transcribed text | Accepts .txt/.md output from Whisper, Otter, etc. |

#### Chunking Strategy

The default chunking approach uses a recursive text splitter with the following configurable parameters:

- **Chunk size:** 512 tokens (default), configurable per source type
- **Chunk overlap:** 64 tokens (12.5%) to preserve context across boundaries
- **Split hierarchy:** headings → paragraphs → sentences → token count
- **Metadata attachment:** each chunk carries source file name, page/section number, ingestion timestamp, and chunk index

### 3.2 Retrieval Layer

The retrieval layer converts user queries into vector embeddings, performs approximate nearest neighbor (ANN) search against the stored chunk embeddings, applies optional metadata filters, and returns ranked context to the LLM layer.

#### Retrieval Pipeline

1. **Query Embedding** — The user's natural language question is embedded using the same model as ingestion.
2. **Vector Search** — Cosine similarity search returns the top-k most relevant chunks.
3. **Metadata Filtering** — Optional filters by source, date range, file type, or tags.
4. **Re-ranking (optional, v2)** — A cross-encoder or LLM-based re-ranker can refine results.
5. **Context Assembly** — Selected chunks are formatted with source attribution into a context block.

#### Vector Store Options

| Option | Pros | Cons | Recommendation |
|--------|------|------|----------------|
| **pgvector (PostgreSQL)** | Familiar tooling, SQL queries, joins with metadata, mature ecosystem | Heavier setup, requires running Postgres | **Selected for v1.** Single database for relational + vector data. |
| ChromaDB | Lightweight, Python-native, zero-config, built for RAG | Less control over indexing, newer project | Not selected — pgvector preferred for extensibility |
| Qdrant | Purpose-built vector DB, excellent filtering, gRPC support | Another service to run, more complex | Not selected — consider only if pgvector hits scale limits |

#### Search Configuration Defaults

- **Top-k results:** 8 chunks
- **Similarity threshold:** 0.72 minimum cosine similarity
- **Max context window:** 4,000 tokens of retrieved content
- **Deduplication:** merge overlapping chunks from the same source

### 3.3 LLM Layer

The LLM layer is responsible for constructing prompts that combine the user's question with retrieved context, sending requests to the Ask Sage API, streaming responses back to the UI, and managing conversation history for follow-up questions.

#### Ask Sage API Integration

Ask Sage provides a REST API at api.asksage.ai with the following key endpoints:

- **/server/query** — Primary query endpoint with model, persona, dataset, and temperature parameters
- **/server/get-models** — Lists available LLM models
- **/server/follow-up-questions** — Generates suggested follow-up queries
- **/user/get-token-with-api-key** — Authentication via email + API key

Authentication uses the `x-access-tokens` header. Tokens are obtained by exchanging an API key via the user endpoint.

#### Provider Abstraction

To maintain extensibility, the LLM layer implements a provider adapter interface. This allows swapping Ask Sage for any other backend (direct Anthropic API, OpenAI, local Ollama, etc.) without modifying the retrieval or presentation layers.

| Interface Method | Description |
|-----------------|-------------|
| `query(prompt, options)` | Send a prompt and receive a completion response |
| `streamQuery(prompt, options)` | Send a prompt and receive a streaming response |
| `getModels()` | List available models from the provider |
| `getTokenCount(text)` | Estimate token count for context window management |

#### Prompt Construction

The system prompt template follows a structured format that grounds the LLM in the retrieved context:

- **System role:** Defines Delve's behavior as a knowledge assistant that answers only from provided context
- **Context block:** Inserted retrieved chunks with source labels (`[Source: filename.md, chunk 3]`)
- **User query:** The original question
- **Instruction suffix:** Directs the model to cite sources, indicate confidence, and flag when context is insufficient

Conversation history is maintained client-side and passed with each request to support multi-turn follow-up questions. A sliding window limits history to the most recent 10 turns or 3,000 tokens, whichever is smaller.

### 3.4 Presentation Layer

The presentation layer is a React + TypeScript single-page application styled with TailwindCSS. It provides the primary user interface for all interactions with Delve.

#### Core UI Components

| Component | Description |
|-----------|-------------|
| ChatPanel | Conversation view with message bubbles, streaming response display, and source citation links |
| FileDropZone | Drag-and-drop file upload area with format validation and ingestion progress |
| SourceBrowser | Sidebar listing all ingested sources with metadata, status, and ability to delete or re-ingest |
| SourcePreview | Expandable panel showing the original chunk text when a citation is clicked |
| SearchFilters | Controls for narrowing retrieval by source, date range, file type, or custom tags |
| ConversationHistory | List of past conversations with ability to resume or export |
| SettingsPanel | Configuration for API keys, model selection, chunking parameters, and theme |

#### UX Principles

- **Response streaming:** tokens appear as they arrive for immediate feedback
- **Source transparency:** every answer shows which documents informed it
- **Progressive disclosure:** advanced settings are accessible but not in the way
- **Keyboard-first:** Cmd+K for quick search, Enter to send, Escape to clear
- **Dark/light theme** support from day one

---

## 4. Data Model

The following core entities define Delve's data layer. All are stored locally in PostgreSQL (with pgvector extension) or in the chosen vector store.

### 4.1 Source

Represents an ingested file or document.

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| filename | VARCHAR(500) | Original filename |
| file_type | VARCHAR(50) | MIME type or extension |
| file_size | INTEGER | Size in bytes |
| content_hash | VARCHAR(64) | SHA-256 hash for deduplication |
| status | ENUM | pending \| processing \| ready \| error |
| chunk_count | INTEGER | Number of chunks generated |
| metadata | JSONB | Custom tags, notes, extracted title/author |
| created_at | TIMESTAMP | Ingestion timestamp |
| updated_at | TIMESTAMP | Last modification |

### 4.2 Chunk

Represents a single indexed segment of content from a source.

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| source_id | UUID | Foreign key to Source |
| chunk_index | INTEGER | Position within the source (0-indexed) |
| content | TEXT | Raw text content of the chunk |
| embedding | VECTOR(dims) | Vector embedding (dimension depends on model) |
| token_count | INTEGER | Number of tokens in this chunk |
| page_number | INTEGER | Page or section number in original (nullable) |
| metadata | JSONB | Additional chunk-level metadata |
| created_at | TIMESTAMP | Chunk creation timestamp |

### 4.3 Conversation

Represents a chat session.

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| title | VARCHAR(200) | Auto-generated or user-edited title |
| created_at | TIMESTAMP | Session start time |
| updated_at | TIMESTAMP | Last message time |

### 4.4 Message

Represents a single message in a conversation.

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| conversation_id | UUID | Foreign key to Conversation |
| role | ENUM | user \| assistant \| system |
| content | TEXT | Message text content |
| sources | JSONB | Array of chunk IDs used as context for this response |
| model | VARCHAR(100) | LLM model used for this response (nullable for user messages) |
| created_at | TIMESTAMP | Message timestamp |

---

## 5. Technology Stack

### 5.1 Backend

| Component | Technology | Rationale |
|-----------|-----------|-----------|
| Runtime | Node.js (v20+) | Consistent JS/TS across stack, strong async I/O |
| Framework | **NestJS** | Built-in CQRS (`@nestjs/cqrs`), DI, modules, guards, pipes. Structured architecture aligned with CQRS pattern. Uses Fastify under the hood as HTTP adapter. |
| Language | TypeScript | Type safety across the full stack |
| Database | **PostgreSQL 16+ with pgvector** | Mature, handles both relational and vector data. Confirmed as vector store. |
| ORM / Query | Drizzle ORM or Kysely | Type-safe queries without heavy abstraction |
| Embedding | **Local: `all-MiniLM-L6-v2` via ONNX (384-dim)** | Zero-cost, zero-dependency local embeddings. Ollama available as upgrade path for higher-quality models. |
| File parsing | pdf-parse, mammoth, papaparse, cheerio | Proven libraries for each format |

### 5.2 Frontend

| Component | Technology | Rationale |
|-----------|-----------|-----------|
| Framework | React 18+ with Vite | Fast dev experience, wide ecosystem |
| Language | TypeScript | Shared types with backend |
| Styling | TailwindCSS | Utility-first, rapid prototyping, consistent design |
| State | **React Query (TanStack Query)** | Server state management with caching, deduplication, background refetch |
| Markdown | react-markdown + rehype | Render LLM responses with formatting |
| Icons | Lucide React | Clean, consistent icon set |

### 5.3 Infrastructure

| Component | Technology | Rationale |
|-----------|-----------|-----------|
| Containerization | Docker + Docker Compose | Reproducible local environment |
| Dev tooling | ESLint, Prettier, Vitest | Code quality and testing from day one |
| Monorepo | **pnpm workspaces + Nx** | pnpm for dependency management, Nx for task orchestration, caching, and dependency graph |

---

## 6. API Design

The backend exposes a RESTful API consumed by the React frontend. All endpoints are prefixed with `/api/v1`.

### 6.1 Ingestion Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /sources/upload | Upload one or more files for ingestion |
| GET | /sources | List all ingested sources with status and metadata |
| GET | /sources/:id | Get details for a single source including chunk count |
| DELETE | /sources/:id | Remove a source and all associated chunks |
| POST | /sources/:id/reindex | Re-process an existing source with updated settings |

### 6.2 Search & Chat Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /chat | Send a message and receive a streamed LLM response with context |
| POST | /search | Perform a vector similarity search without LLM (raw retrieval) |
| GET | /conversations | List past conversations |
| GET | /conversations/:id | Retrieve full message history for a conversation |
| DELETE | /conversations/:id | Delete a conversation and its messages |

### 6.3 Configuration Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /config | Get current configuration (model, chunk size, etc.) |
| PATCH | /config | Update configuration settings |
| GET | /models | List available LLM models from the configured provider |
| GET | /health | System health check including DB and API connectivity |

---

## 7. Phased Roadmap

### Phase 1: Foundation

**Goal:** End-to-end working prototype with a single file type and basic chat.

- Project scaffolding: monorepo, TypeScript config, Docker Compose with Postgres + pgvector
- Basic ingestion pipeline for .md and .txt files
- Embedding generation using a selected model
- Vector storage and cosine similarity search
- Ask Sage API adapter with query endpoint integration
- Minimal chat UI: input box, message display, streaming responses
- Source citation display in chat responses

### Phase 2: Expand Ingestion & Polish

**Goal:** Support all target file formats and refine the user experience.

- Add PDF, DOCX, CSV, JSON, and HTML parsers
- File drag-and-drop with progress indicators
- Source browser sidebar with status and metadata
- Conversation history: persistence, listing, resumption
- Search filters (source, date, file type)
- Settings panel for model selection and chunk configuration
- Dark/light theme

### Phase 3: Intelligence & Refinement

**Goal:** Improve retrieval quality and add power-user features.

- Hybrid search: combine vector similarity with keyword (BM25) scoring
- Re-ranking pass using cross-encoder or LLM-based scoring
- Suggested follow-up questions
- Bulk import from directories
- Source tagging and organization
- Export conversations as markdown
- Provider adapter for direct Anthropic, OpenAI, or Ollama APIs

### Phase 4: Scale & Ecosystem (Future)

**Goal:** Production-readiness and integration capabilities.

- Watched folder auto-ingestion
- Webhook / API for programmatic ingestion from external tools
- Multi-collection support (separate knowledge bases per project)
- Auth layer if multi-user is needed
- Deployment guide for self-hosted server
- Plugin architecture for custom extractors

---

## 8. Embedding Strategy

The choice of embedding model directly affects retrieval quality. The system should support multiple embedding backends through an adapter pattern, similar to the LLM provider abstraction.

### 8.1 Options Under Consideration

| Model | Dimensions | Approach | Trade-offs |
|-------|-----------|----------|------------|
| all-MiniLM-L6-v2 | 384 | Local via ONNX runtime | Fast, free, no API calls; lower quality on domain-specific content |
| text-embedding-3-small (OpenAI) | 1536 | API call | High quality, cost per token; requires OpenAI key |
| Ask Sage built-in | Varies | Via Ask Sage dataset API | Integrated, but couples embedding to Ask Sage platform |
| Cohere embed-v3 | 1024 | API call | Strong multilingual support; another API dependency |

**Decision for v1:** Use `all-MiniLM-L6-v2` via ONNX runtime for zero-cost, fully local embedding (384 dimensions). This keeps the system self-contained with no external API dependency. Ollama is available as a local upgrade path for higher-quality models (e.g., `nomic-embed-text` at 768-dim) without requiring cloud API calls. The embedding adapter interface supports swapping models — a dimension change requires re-indexing all chunks.

---

## 9. Configuration

All configuration is managed through environment variables (for secrets) and a config file (for application settings). The settings panel in the UI writes to the config file.

| Setting | Default | Description |
|---------|---------|-------------|
| ASK_SAGE_API_KEY | (env var) | API key for Ask Sage authentication |
| ASK_SAGE_EMAIL | (env var) | Email for Ask Sage token exchange |
| LLM_MODEL | claude-3.5-sonnet | Default LLM model to use for queries |
| EMBEDDING_MODEL | all-MiniLM-L6-v2 | Embedding model for chunk vectorization |
| CHUNK_SIZE | 512 | Target chunk size in tokens |
| CHUNK_OVERLAP | 64 | Overlap between consecutive chunks in tokens |
| TOP_K_RESULTS | 8 | Number of chunks to retrieve per query |
| SIMILARITY_THRESHOLD | 0.72 | Minimum cosine similarity for retrieval |
| MAX_CONTEXT_TOKENS | 4000 | Maximum tokens of retrieved context per query |
| MAX_CONVERSATION_TURNS | 10 | Sliding window size for conversation history |
| DATABASE_URL | postgresql://... | PostgreSQL connection string |
| PORT | 3001 | Backend API server port |

---

## 10. Project Structure

Delve uses a monorepo with clear separation between packages. Shared TypeScript types ensure consistency across the stack.

```
delve/
├── packages/
│   ├── api/          — NestJS backend server (CQRS modules)
│   ├── web/          — React frontend application
│   ├── shared/       — Shared TypeScript types, constants, and utilities
│   └── core/         — Ingestion, retrieval, and LLM adapter logic (framework-agnostic)
├── spec/             — Specification and design mockups
├── docker-compose.yml
├── .env.example
├── nx.json
└── pnpm-workspace.yaml
```

The `core` package is intentionally decoupled from the NestJS API framework. This means the ingestion pipeline, retrieval logic, and LLM adapters can be tested independently and reused if the delivery mechanism ever changes (e.g., CLI, desktop app, or different web framework). NestJS command/query handlers in `packages/api/` delegate to `packages/core/` for all business logic.

---

## 11. Resolved Decisions

The following open questions have been resolved (March 2026):

| # | Question | Decision | Notes |
|---|----------|----------|-------|
| 1 | **Embedding model** | **Local: `all-MiniLM-L6-v2` via ONNX (384-dim)** | Zero-cost, fully local. Ollama available as upgrade path for higher-quality local models (e.g., `nomic-embed-text`). Schema uses `vector(384)`. |
| 2 | **Vector store** | **pgvector (PostgreSQL 16+)** | Leverages existing Postgres, SQL joins with metadata, mature ecosystem. Docker image: `pgvector/pgvector:pg16`. |
| 3 | **Streaming** | **Request/response for v1** | Ask Sage API used in synchronous request/response mode. LLM adapter interface includes `streamQuery()` method signature for future use but is not wired in v1. |
| 4 | **Ask Sage token refresh** | **Not needed** | Ask Sage access tokens do not expire. Obtain once, reuse indefinitely. No refresh middleware required. |
| 5 | **Chunk size tuning** | **512 tokens default, configurable per-source in v2** | Keep a single global default for v1. Per-source configuration deferred to Phase 2+. |
| 6 | **Monorepo tooling** | **pnpm workspaces + Nx** | pnpm for dependency management, Nx for task orchestration, caching, and dependency graph. |
| 7 | **Backend framework** | **NestJS** | Built-in CQRS (`@nestjs/cqrs`), dependency injection, modules, guards, pipes. Uses Fastify as HTTP adapter. Replaces raw Express/Fastify from original spec. |
| 8 | **Frontend state** | **React Query (TanStack Query)** | All server state managed via React Query. No Zustand needed for v1. |

---

## 12. Success Criteria

Delve v1 is considered successful when:

- A user can drop in a markdown file and ask a question about its contents within 60 seconds
- Responses cite specific source documents and chunk locations
- The system handles at least 100 ingested documents without degraded search performance
- Swapping the LLM provider requires changing only the adapter configuration, not application code
- The codebase is clean enough that a new developer can understand the architecture from the folder structure alone

---

*— End of Specification —*
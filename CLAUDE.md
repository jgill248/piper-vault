# Delve — Personal Knowledge Base & Conversational Search

## Project Overview

Delve is a local-first, RAG-powered knowledge base with a conversational chat interface. Users ingest notes, transcripts, documents, and unstructured data, then query it through natural language powered by an LLM API (Ask Sage). The system indexes content locally, performs semantic similarity search, and feeds context to a language model for grounded, citation-backed answers.

**Status:** Phase 1 complete, Phase 2 complete — entering Phase 3

## Resolved Decisions

The following open questions from the spec (Section 11) have been resolved:

| # | Question | Decision | Rationale |
|---|----------|----------|-----------|
| 1 | Embedding model | **Local (ONNX + Ollama)** | Start with `all-MiniLM-L6-v2` via ONNX (384-dim). Ollama available as upgrade path for higher-quality local models. Zero external API dependency. |
| 2 | Vector store | **pgvector (PostgreSQL)** | Leverages existing Postgres, SQL joins with metadata, mature ecosystem. Long-term extensibility over ChromaDB. |
| 3 | Streaming | **Request/response first** | Ask Sage API used in request/response mode for v1. LLM adapter interface designed to support streaming later (method signature exists, not wired). |
| 4 | Ask Sage token refresh | **Not needed** | Ask Sage tokens do not expire. Store token once, reuse indefinitely. No refresh middleware required. |
| 5 | Monorepo tooling | **pnpm + Nx** | pnpm workspaces for dependency management, Nx for task orchestration, caching, and dependency graph. |
| 6 | Backend framework | **NestJS** | Provides built-in CQRS (`@nestjs/cqrs`), dependency injection, modules, guards, pipes, and interceptors. Better structure than raw Express/Fastify for this architecture. |

## Tech Stack

- **Backend:** Node.js v20+, TypeScript, NestJS, PostgreSQL 16+ with pgvector, Drizzle ORM or Kysely
- **Frontend:** React 18+ with Vite, TypeScript, TailwindCSS, React Query (TanStack Query)
- **Embeddings:** `all-MiniLM-L6-v2` via ONNX (384-dim), Ollama as upgrade path
- **Infrastructure:** Docker + Docker Compose, pnpm workspaces + Nx
- **Testing:** Vitest
- **Linting/Formatting:** ESLint, Prettier

## Project Structure

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

## Key References

- **Specification:** `spec/spec.md` — Full project specification (v1.0)
- **Design System:** `spec/stitch/obsidian_protocol/DESIGN.md` — "Obsidian Protocol" / "Sovereign Console" aesthetic
- **UI Mockups:** `spec/stitch/` — HTML mockups for chat, sources, knowledge graph, and settings views

## Design System: Obsidian Protocol

- Deep obsidian backgrounds (#05070A), no rounded corners (0px radius), no drop shadows
- Monospace (JetBrains Mono) for data/tables/labels, sans-serif (Manrope/Inter) for UI text
- Phosphor glow effects on CTAs (#abd600 primary), scanline overlay texture
- High-density "Sovereign Console" aesthetic — precision instrument, not consumer app

## Architecture Principles

- **CQRS (Command Query Responsibility Segregation):** Separate command (write) and query (read) paths on the API side. Commands mutate state and return minimal confirmation. Queries are optimized read models. Never mix mutation logic into query handlers or vice versa.
- **Provider-agnostic:** LLM and embedding layers use adapter interfaces for easy swapping
- **Layer separation:** Ingestion, Retrieval, LLM, and Presentation layers have clear interface boundaries
- **Local-first:** All indexed data stays under user control
- **Core decoupled:** `packages/core/` is framework-agnostic for independent testing and reuse

## CQRS Pattern (NestJS)

The API layer follows CQRS using NestJS's built-in `@nestjs/cqrs` module. All operations are either a **command** (writes/mutations) or a **query** (reads). NestJS provides `CommandBus`, `QueryBus`, and `EventBus` for dispatching.

### Structure

```
packages/api/src/
├── sources/
│   ├── commands/
│   │   ├── ingest-source.command.ts      — Command class (data)
│   │   ├── ingest-source.handler.ts      — CommandHandler (logic)
│   │   ├── delete-source.command.ts
│   │   └── delete-source.handler.ts
│   ├── queries/
│   │   ├── list-sources.query.ts
│   │   ├── list-sources.handler.ts
│   │   ├── get-source.query.ts
│   │   └── get-source.handler.ts
│   ├── events/
│   │   ├── source-ingested.event.ts
│   │   └── source-ingested.handler.ts
│   ├── dto/
│   │   ├── create-source.dto.ts          — Request DTO (Zod validated)
│   │   └── source-response.dto.ts        — Response DTO
│   ├── sources.controller.ts             — Thin HTTP layer
│   └── sources.module.ts                 — NestJS module wiring
├── chat/
│   ├── commands/
│   │   ├── send-message.command.ts
│   │   └── send-message.handler.ts
│   ├── queries/
│   │   ├── list-conversations.query.ts
│   │   ├── list-conversations.handler.ts
│   │   ├── get-conversation.query.ts
│   │   └── get-conversation.handler.ts
│   ├── dto/
│   ├── chat.controller.ts
│   └── chat.module.ts
├── search/
│   ├── queries/
│   │   ├── search-chunks.query.ts
│   │   └── search-chunks.handler.ts
│   ├── search.controller.ts
│   └── search.module.ts
├── config/
│   ├── config.controller.ts
│   └── config.module.ts
├── health/
│   ├── health.controller.ts
│   └── health.module.ts
└── app.module.ts                         — Root module
```

### Rules

1. **Commands** are plain classes carrying data. **CommandHandlers** (decorated with `@CommandHandler`) execute business logic via `packages/core/` and return a result type (success/failure + minimal data like the created ID).
2. **Queries** are plain classes carrying filter/pagination params. **QueryHandlers** (decorated with `@QueryHandler`) read from optimized query paths and return typed response DTOs. Queries never trigger side effects.
3. **Controllers** are thin — they parse the request, dispatch to `CommandBus` or `QueryBus`, and format the response. No business logic in controllers.
4. **DTOs are separate from domain models.** Request DTOs, response DTOs, and internal domain types are distinct. Map between them explicitly. Use NestJS pipes or Zod for validation.
5. **Events** are emitted by command handlers via `EventBus` (e.g., `SourceIngestedEvent`, `ChunkCreatedEvent`). Event handlers react asynchronously and must not be called directly.
6. **Modules** encapsulate feature boundaries. Each domain area (sources, chat, search, config) is a self-contained NestJS module that declares its controllers, providers, commands, queries, and events.

## Best Practices

### TypeScript

- Strict mode (`strict: true`) across all packages
- Prefer `unknown` over `any` — narrow with type guards
- Use discriminated unions for state modeling (e.g., `SourceStatus`)
- Use `readonly` for data that should not be mutated after creation
- Prefer `interface` for object shapes, `type` for unions and computed types
- No `enum` — use `as const` objects or string literal unions instead
- Use `Result<T, E>` pattern (or similar) for operations that can fail — avoid throwing for expected failures
- Explicit return types on exported functions

### React (packages/web/)

- Functional components only — no class components
- Colocate component files: `ComponentName/index.tsx`, `ComponentName.test.tsx`
- Custom hooks for reusable logic — prefix with `use`
- Derive state instead of syncing — avoid `useEffect` for state derivation
- Use React Query (TanStack Query) for all server state — no manual fetch + useState
- Keep components small and single-responsibility — extract early
- Lift state only as high as necessary, not higher
- Memoize expensive computations with `useMemo`, not all computations
- Use `useCallback` only when passing callbacks to memoized children
- Event handlers as `handleXxx` (e.g., `handleSubmit`, `handleFilesDrop`)
- No inline styles — TailwindCSS classes only
- Accessible by default: semantic HTML, ARIA labels, keyboard navigation
- Suspense boundaries for async UI — show loading states, not blank screens
- Error boundaries around independent UI sections

### SQL / Database (PostgreSQL + pgvector)

- All schema changes via versioned migrations — never modify the database manually
- Use parameterized queries exclusively — never interpolate user input into SQL
- Indexes on all foreign keys and frequently filtered columns
- Use `EXPLAIN ANALYZE` to validate query plans for complex queries
- Prefer `RETURNING` clauses on INSERT/UPDATE to avoid extra round-trips
- Use transactions for multi-step write operations
- Vector indexes: use IVFFlat or HNSW index on embedding columns for ANN search performance
- Keep vector dimension consistent — same embedding model for ingestion and query
- Use `pg_trgm` or `ts_vector` for any full-text / keyword search (hybrid retrieval)
- Connection pooling in production — don't open a connection per request
- JSONB fields: use GIN indexes when querying inside metadata
- Naming: snake_case for tables and columns, plural table names (`sources`, `chunks`)

### API Design

- Consistent error response shape: `{ error: { code: string, message: string, details?: unknown } }`
- HTTP status codes: 201 for created, 204 for deleted, 400 for validation, 404 for not found, 422 for business rule violations, 500 for unexpected errors
- Pagination on all list endpoints: cursor-based preferred, offset-based acceptable
- Input validation at the boundary — use Zod schemas (via NestJS pipes) for request parsing
- Log structured JSON (not console.log) — include request ID for tracing. Use NestJS's built-in `Logger` or a structured logger like `pino`.
- Idempotency: POST endpoints that create resources should handle duplicate submissions gracefully (content_hash dedup for sources)

### Testing

- Vitest for all packages
- Unit tests for pure logic in `packages/core/` — mock external dependencies
- Integration tests for API routes — use a test database, not mocks
- Component tests with Testing Library — test behavior, not implementation
- Name test files `*.test.ts(x)` colocated with source files
- Arrange-Act-Assert structure
- Test the public interface, not internal details
- Factory functions for test data — avoid fixtures that rot

## Linear Project Management

Project management is tracked in Linear. Agents and skills have access to Linear MCP tools.

### Workspace

- **Team:** Creative-software (key: `CRE`)
- **Project:** Delve
- **Issue labels:** `design`, `frontend`, `backend`, `infra`, `Feature`, `Bug`, `Improvement`
- **Statuses:** Backlog → Todo → In Progress → Done (also: Canceled, Duplicate)

### Milestone ↔ Spec Phase Mapping

| Linear Milestone | Spec Section | Focus |
|-----------------|--------------|-------|
| Phase 1: Foundation | Section 7, Phase 1 | Scaffolding, .md/.txt ingestion, vector storage, basic chat UI |
| Phase 2: Expand Ingestion & Polish | Section 7, Phase 2 | All file formats, source browser, conversation history, settings |
| Phase 3: Intelligence & Refinement | Section 7, Phase 3 | Hybrid search, re-ranking, follow-ups, export, provider adapters |
| Phase 4: Scale & Ecosystem | Section 7, Phase 4 | Watched folders, webhooks, multi-collection, auth, plugins |
| Phase 5: Obsidian Integration | Section 7, Phase 5 | Vault watcher, wiki-link graph, frontmatter extraction, Obsidian plugin, bidirectional sync |

### Linear Sync Workflow

When working on Delve, keep Linear in sync with the codebase:

1. **Starting work:** Move the relevant Linear issue to `In Progress` before beginning implementation.
2. **Completing work:** Move the issue to `Done` after the implementation is committed and tests pass.
3. **Discovering bugs:** Create a new `Bug` issue in Linear with the appropriate labels and milestone.
4. **New work not in Linear:** If you implement something that doesn't have a Linear issue, create one and immediately mark it `Done` so the record exists.
5. **Blocked work:** Add `blockedBy` relations to the blocking issue and leave a comment explaining the blocker.

Use the Linear MCP tools (`save_issue`, `list_issues`, `get_issue`, etc.) to read and update issues directly. Never let Linear drift out of sync with the repo.

### Issue Conventions

- One deliverable per issue — single, testable unit of work
- Include acceptance criteria in every issue description
- Apply labels (`backend`, `frontend`, `design`, `infra`) on every issue
- Use parent issues as epics to group related work
- Mark `blocks`/`blockedBy` dependencies between issues
- Reference the spec section in issue descriptions
- Backend issues should note whether the work is a CQRS command or query
- Frontend issues should reference relevant Obsidian Protocol design rules

### Milestone Completion Policy

A milestone **cannot be marked complete** until the following process is satisfied:

1. **Run the `qa-gate` agent** against the milestone. This runs the full QA checklist (tests, build, spec compliance, smoke tests, security, performance).
2. **Linear issues are created for every failure.** The qa-gate agent creates a `Bug` issue with the `qa-blocker` label for each distinct failure found. Issues are filed in the Delve project under the milestone being validated.
3. **All `qa-blocker` issues must reach Done status.** No milestone can close while any `qa-blocker` issue remains open. Fix the issues, then proceed to step 4.
4. **Re-run the `qa-gate` agent** to confirm all fixes pass. If new failures are found, repeat from step 2.
5. **Only after the qa-gate issues APPROVE** can the milestone be moved to Done in Linear.

This is a hard gate — no exceptions. Skipping the QA gate or closing a milestone with open `qa-blocker` issues is not allowed.

## Conventions

- TypeScript strict mode across all packages
- Shared types live in `packages/shared/`
- API routes prefixed with `/api/v1`
- Environment variables for secrets, config file for application settings
- All chunks carry source metadata for citation transparency
- Commands and queries are the unit of work on the API side — no "service" grab-bags. Use NestJS `CommandBus`/`QueryBus` for dispatch.
- Each domain area is a NestJS module — controllers, commands, queries, events, and DTOs are colocated within the module
- No barrel re-exports deeper than one level — keep import paths explicit

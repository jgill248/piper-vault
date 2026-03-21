# Delve — Personal Knowledge Base & Conversational Search

## Project Overview

Delve is a local-first, RAG-powered knowledge base with a conversational chat interface. Users ingest notes, transcripts, documents, and unstructured data, then query it through natural language powered by an LLM API (Ask Sage). The system indexes content locally, performs semantic similarity search, and feeds context to a language model for grounded, citation-backed answers.

**Status:** Pre-implementation (specification and design phase)

## Tech Stack (Planned)

- **Backend:** Node.js v20+, TypeScript, Express or Fastify, PostgreSQL 16+ with pgvector, Drizzle ORM or Kysely
- **Frontend:** React 18+ with Vite, TypeScript, TailwindCSS, Zustand or React Query
- **Infrastructure:** Docker + Docker Compose, pnpm workspaces or Turborepo
- **Testing:** Vitest
- **Linting/Formatting:** ESLint, Prettier

## Project Structure (Planned)

```
delve/
├── packages/
│   ├── api/          — Backend Express/Fastify server
│   ├── web/          — React frontend application
│   ├── shared/       — Shared TypeScript types, constants, and utilities
│   └── core/         — Ingestion, retrieval, and LLM adapter logic (framework-agnostic)
├── spec/             — Specification and design mockups
├── docker-compose.yml
├── .env.example
└── turbo.json / pnpm-workspace.yaml
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

## CQRS Pattern

The API layer follows CQRS. All operations are either a **command** (writes/mutations) or a **query** (reads).

### Structure

```
packages/api/src/
├── commands/           — Write operations (create, update, delete)
│   ├── ingest-source.command.ts
│   ├── delete-source.command.ts
│   ├── send-message.command.ts
│   └── update-config.command.ts
├── queries/            — Read operations (list, get, search)
│   ├── list-sources.query.ts
│   ├── get-source.query.ts
│   ├── search-chunks.query.ts
│   ├── list-conversations.query.ts
│   └── get-conversation.query.ts
├── handlers/           — Route handlers that dispatch to commands/queries
├── middleware/         — Validation, error handling, request parsing
└── routes/            — Route definitions (thin, delegate to handlers)
```

### Rules

1. **Commands** accept a typed input DTO, perform validation, execute business logic via `packages/core/`, and return a result type (success/failure + minimal data like the created ID)
2. **Queries** accept filter/pagination params, read from optimized query paths, and return typed response DTOs. Queries never trigger side effects.
3. **Route handlers** are thin — they parse the request, call the appropriate command or query, and format the response. No business logic in handlers.
4. **DTOs are separate from domain models.** Request DTOs, response DTOs, and internal domain types are distinct. Map between them explicitly.
5. **Commands can emit domain events** (e.g., `SourceIngested`, `ChunkCreated`) that other parts of the system can react to asynchronously.

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
- Input validation at the boundary — use Zod schemas for request parsing
- Log structured JSON (not console.log) — include request ID for tracing
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
- Commands and queries are the unit of work on the API side — no "service" grab-bags
- No barrel re-exports deeper than one level — keep import paths explicit

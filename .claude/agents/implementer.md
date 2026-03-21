---
name: implementer
description: Implements features from the Delve specification following CQRS patterns, monorepo conventions, and the phased roadmap. Use for backend API commands/queries, core logic, and full-stack feature work.
model: sonnet
tools: Read, Edit, Write, Bash, Glob, Grep, Agent
---

# Implementer Agent

Implements features from the Delve specification, following the phased roadmap.

## Instructions

You implement features for the Delve project based on the specification. Before writing any code:

1. Read `spec/spec.md` to understand the full architecture and requirements
2. Identify which roadmap phase (section 7) the requested feature belongs to
3. Check existing code in `packages/` for patterns to follow
4. Read `spec/stitch/obsidian_protocol/DESIGN.md` if the feature involves UI

### Implementation Guidelines

**Monorepo structure:**
- `packages/api/` — Backend server (Express or Fastify)
- `packages/web/` — React frontend
- `packages/shared/` — Shared TypeScript types and constants
- `packages/core/` — Framework-agnostic business logic (ingestion, retrieval, LLM adapters)

**Backend patterns (CQRS):**
- Follow CQRS: every API operation is either a command (write) or a query (read)
- Commands go in `packages/api/src/commands/` — they mutate state, return minimal confirmation
- Queries go in `packages/api/src/queries/` — they read data, never trigger side effects
- Route handlers are thin — parse request, dispatch to command/query, format response
- Use separate DTOs for requests, responses, and internal domain models — map between them
- Commands can emit domain events (e.g., `SourceIngested`) for async reactions
- Use Zod for request validation at the boundary
- Consistent error shape: `{ error: { code, message, details? } }`
- Implement provider adapter interfaces for LLM and embedding layers in `packages/core/`
- Use Drizzle ORM or Kysely for type-safe database queries
- PostgreSQL with pgvector for vector storage and similarity search
- API routes under `/api/v1` prefix
- Use `Result<T, E>` pattern for operations that can fail — don't throw for expected failures
- Structured JSON logging with request IDs

**Database patterns:**
- All schema changes via versioned migrations
- Parameterized queries only — never interpolate user input
- Use `RETURNING` clauses to avoid extra round-trips
- Transactions for multi-step writes
- IVFFlat or HNSW index on embedding columns
- GIN indexes on JSONB metadata fields when queried
- snake_case for tables/columns, plural table names

**Frontend patterns:**
- React functional components with TypeScript — no class components
- React Query (TanStack Query) for all server state — no manual fetch + useState
- Colocate component files: `ComponentName/index.tsx`, `ComponentName.test.tsx`
- Custom hooks prefixed with `use` for reusable logic
- Derive state instead of syncing — avoid `useEffect` for state derivation
- TailwindCSS with Obsidian Protocol design tokens — no inline styles
- Stream LLM responses token-by-token for immediate feedback
- Every answer must show source citations
- Suspense boundaries for async UI, error boundaries for fault isolation
- Accessible by default: semantic HTML, ARIA labels, keyboard navigation

**Testing:**
- Vitest for all packages
- Unit tests for pure logic in `packages/core/` with mocked dependencies
- Integration tests for API commands/queries with a test database
- Component tests with Testing Library — test behavior, not implementation
- Arrange-Act-Assert structure, factory functions for test data
- Test files colocated as `*.test.ts(x)`

**Key configuration defaults (from spec section 9):**
- Chunk size: 512 tokens, overlap: 64 tokens
- Top-k results: 8, similarity threshold: 0.72
- Max context tokens: 4000, max conversation turns: 10
- Default LLM model: claude-3.5-sonnet
- Backend port: 3001

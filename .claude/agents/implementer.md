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

**Backend patterns:**
- Use TypeScript strict mode
- Implement provider adapter interfaces for LLM and embedding layers
- Use Drizzle ORM or Kysely for type-safe database queries
- PostgreSQL with pgvector for vector storage and similarity search
- API routes under `/api/v1` prefix

**Frontend patterns:**
- React functional components with TypeScript
- TailwindCSS with Obsidian Protocol design tokens
- Zustand or React Query for state management
- Stream LLM responses token-by-token for immediate feedback
- Every answer must show source citations

**Testing:**
- Write Vitest tests alongside implementation
- Test core adapters with mock implementations
- Test API routes with supertest or similar

**Key configuration defaults (from spec section 9):**
- Chunk size: 512 tokens, overlap: 64 tokens
- Top-k results: 8, similarity threshold: 0.72
- Max context tokens: 4000, max conversation turns: 10
- Default LLM model: claude-3.5-sonnet
- Backend port: 3001

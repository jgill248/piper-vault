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

- **Provider-agnostic:** LLM and embedding layers use adapter interfaces for easy swapping
- **Layer separation:** Ingestion, Retrieval, LLM, and Presentation layers have clear interface boundaries
- **Local-first:** All indexed data stays under user control
- **Core decoupled:** `packages/core/` is framework-agnostic for independent testing and reuse

## Conventions

- TypeScript strict mode across all packages
- Shared types live in `packages/shared/`
- API routes prefixed with `/api/v1`
- Environment variables for secrets, config file for application settings
- All chunks carry source metadata for citation transparency

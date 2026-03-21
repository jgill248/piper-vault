# Scaffold Agent

Scaffolds new packages, modules, or components following the Delve monorepo conventions.

## Instructions

You scaffold code for the Delve project. Before generating any code:

1. Read `spec/spec.md` to understand the full system architecture
2. Read `spec/stitch/obsidian_protocol/DESIGN.md` for UI components
3. Check existing code in `packages/` to follow established patterns

### Package Scaffolding

When creating a new package under `packages/`:
- Use TypeScript with strict mode
- Include a `tsconfig.json` extending the root config
- Include a `package.json` with correct workspace dependencies
- Add an `index.ts` barrel export
- Add a basic Vitest test file

### Component Scaffolding

When creating React components in `packages/web/`:
- Use functional components with TypeScript
- Apply TailwindCSS classes following the Obsidian Protocol design system
- Zero border-radius, no drop shadows, use tonal recess for depth
- Monospace (JetBrains Mono) for data/labels, sans-serif for UI text
- Primary color: #abd600 with phosphor glow effects
- Surface hierarchy: base (#111417), inset (#0c0e12), raised (#282a2e)

### API Command Scaffolding

When creating a new command in `packages/api/src/commands/`:
- Create `<name>.command.ts` with a typed input DTO and result type
- Validate input with a Zod schema
- Execute business logic via `packages/core/` — no ORM/DB calls directly in the command
- Return a `Result<T, E>` — don't throw for expected failures
- Emit domain events if other parts of the system need to react
- Create a corresponding route handler in `packages/api/src/handlers/`
- Include a `<name>.command.test.ts` integration test

### API Query Scaffolding

When creating a new query in `packages/api/src/queries/`:
- Create `<name>.query.ts` with typed filter/pagination params and a response DTO
- Queries must never trigger side effects or mutations
- Use optimized read paths — join/project only needed columns
- Support cursor-based or offset pagination on list queries
- Create a corresponding route handler in `packages/api/src/handlers/`
- Include a `<name>.query.test.ts` test

### API Route Scaffolding

When creating routes in `packages/api/src/routes/`:
- Prefix all routes with `/api/v1`
- Routes are thin — define method + path + middleware, delegate to handlers
- Use Zod schemas for request validation middleware
- Consistent error shape: `{ error: { code: string, message: string, details?: unknown } }`

### React Component Scaffolding

When creating components in `packages/web/`:
- Colocate files: `ComponentName/index.tsx`, `ComponentName.test.tsx`
- Use React Query for server state — no manual fetch + useState
- Custom hooks (prefixed `use`) for reusable logic
- Event handlers named `handleXxx`
- Accessible by default: semantic HTML, ARIA labels, keyboard nav
- Suspense boundary for async content, error boundary for fault isolation

### Adapter Scaffolding

When creating adapters in `packages/core/`:
- Implement the provider interface pattern from the spec
- Keep framework-agnostic (no Express/Fastify imports)
- Use `Result<T, E>` for operations that can fail
- Include unit tests with mock implementations

### Database Migration Scaffolding

When creating migrations:
- Versioned migration files with timestamp prefix
- snake_case for tables and columns, plural table names
- Parameterized queries only
- Include `up` and `down` functions
- Add indexes on foreign keys and frequently filtered columns
- IVFFlat or HNSW index on vector embedding columns
- GIN index on JSONB columns that are queried

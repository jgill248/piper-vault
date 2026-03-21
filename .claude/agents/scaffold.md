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

### API Route Scaffolding

When creating API routes in `packages/api/`:
- Prefix all routes with `/api/v1`
- Include request/response type definitions from `packages/shared/`
- Add input validation
- Return consistent error response shapes

### Adapter Scaffolding

When creating adapters in `packages/core/`:
- Implement the provider interface pattern from the spec
- Keep framework-agnostic (no Express/Fastify imports)
- Include unit tests with mock implementations

# Linear Breakdown

Breaks a spec section or feature request into Linear issues with proper structure.

## Instructions

When the user asks to break down a feature, spec section, or milestone into Linear tickets:

1. Read `spec/spec.md` to understand the full context of the feature
2. Read `CLAUDE.md` for CQRS patterns and best practices to reference in tickets
3. Check existing issues in the Delve project to avoid duplicates

### Process

1. **Identify the scope** — which spec section(s) does this cover?
2. **Create a parent issue** (epic) if the work spans multiple deliverables
3. **Break into child issues** — each one a single, testable unit of work
4. **Apply labels** — `backend`, `frontend`, `design`, `infra`, `Feature`
5. **Set milestone** — map to the correct phase (Foundation, Expand, Intelligence, Scale)
6. **Add blocking relationships** — mark dependencies between issues
7. **Set priority** — 2=High for critical path, 3=Normal for everything else, 4=Low for nice-to-haves

### Linear Workspace

- **Team:** Creative-software
- **Project:** Delve
- **Labels:** `design`, `frontend`, `backend`, `infra`, `Feature`, `Bug`, `Improvement`

### Issue Description Format

```markdown
## Summary
[What this issue delivers]

## Spec Reference
[Section from spec.md]

## Acceptance Criteria
- [ ] [Testable criterion]

## Technical Notes
[CQRS pattern, design system rules, or other guidance]
```

### Example Breakdown

For "Ingestion Layer" (spec 3.1), you might create:
- **Parent:** "Ingestion Pipeline" (epic)
  - "Create Source entity schema and migration" — `backend`, `infra`
  - "Create Chunk entity schema and migration" — `backend`, `infra`
  - "Implement file upload command" — `backend` (CQRS command)
  - "Implement text extraction for .md/.txt" — `backend`
  - "Implement chunking strategy" — `backend`
  - "Implement embedding generation adapter" — `backend`
  - "Create list-sources query" — `backend` (CQRS query)
  - "Create get-source query" — `backend` (CQRS query)
  - "Build file upload dropzone component" — `frontend`, `design`

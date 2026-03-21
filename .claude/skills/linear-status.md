# Linear Status

Shows current project status from Linear — milestones, sprint progress, and blockers.

## Instructions

When the user asks for project status, sprint progress, or what's left to do:

1. Fetch the Delve project milestones to see overall phase progress
2. List issues grouped by status (In Progress, Todo, Backlog, Done)
3. Identify blockers — issues that are blocking other work
4. Summarize progress per milestone

### Linear Workspace

- **Team:** Creative-software
- **Project:** Delve

### Output Format

```
## Project: Delve

### Current Milestone: [name]
Progress: X of Y issues done

### In Progress
- [CRE-XX] Issue title (assignee)

### Blocked
- [CRE-XX] Issue title — blocked by [CRE-YY]

### Up Next (Todo)
- [CRE-XX] Issue title

### Recently Completed
- [CRE-XX] Issue title

### Milestone Overview
| Milestone | Done | In Progress | Todo | Backlog |
|-----------|------|-------------|------|---------|
| Phase 1   | X    | X           | X    | X       |
```

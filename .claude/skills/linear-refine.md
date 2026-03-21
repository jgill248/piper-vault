# Linear Refine

Refines existing Linear issues — adds acceptance criteria, breaks down oversized tickets, and adds technical context.

## Instructions

When the user asks to refine issues, either specify issue IDs or refine all issues in a milestone/status:

### Refinement Checklist

For each issue, check and fix:

1. **Has acceptance criteria?** — If missing, add specific, testable criteria based on `spec/spec.md`
2. **Is it too large?** — If an issue covers multiple deliverables, break it into child issues
3. **Has labels?** — Apply `backend`, `frontend`, `design`, `infra` as appropriate
4. **Has priority?** — Set if missing (2=High for critical path, 3=Normal default)
5. **Has milestone?** — Link to the correct phase milestone
6. **Has technical notes?** — Add guidance on:
   - Whether this is a CQRS command or query (for backend)
   - Which design system rules apply (for frontend)
   - What adapter interface to implement (for core)
   - Which spec section to reference
7. **Has dependencies?** — Add `blocks`/`blockedBy` relationships where applicable
8. **Is the title clear?** — Should describe the deliverable, not the activity (e.g., "Source entity migration" not "Work on database")

### Linear Workspace

- **Team:** Creative-software
- **Project:** Delve
- **Labels:** `design`, `frontend`, `backend`, `infra`, `Feature`, `Bug`, `Improvement`

### Output

After refining, summarize what was changed:
- Issues updated (with what was added/changed)
- Issues split into sub-issues
- Dependencies added

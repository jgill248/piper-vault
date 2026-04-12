# D1 — Tenancy Foundation

> **Status:** Scaffolding. Fill in before D1 implementation begins.

## Goal

Make the data model multi-tenant-capable without breaking single-user installs.

## Data Model (draft)

```
organizations (id, name, slug, created_at, ...)
teams (id, organization_id, name, ...)
organization_members (organization_id, user_id, role, joined_at)
team_members (team_id, user_id, role, joined_at)
```

Add `organization_id` (and optionally `team_id`) FKs to: `collections`, `conversations`, `sources`, `api_keys`, `notes`, `audit_log` (D3).

## Migration Path

Existing single-user installs backfill to a synthetic "default org" on first boot after upgrade. `AUTH_ENABLED=false` continues to work — a single implicit user belongs to the default org.

## Tenancy Middleware

NestJS middleware derives `orgId` from:
1. JWT claim (`org_id`) when `AUTH_ENABLED=true`.
2. `X-Organization-Id` header when called via API key.
3. Default org when neither is present.

Every query/command handler scopes reads/writes to the resolved `orgId`. Cross-org access is forbidden except for `role=superadmin` (global support role).

## Open Questions

- Single-org-per-user or multi-org-per-user in v1? (Multi recommended for parity with Notion/Linear.)
- Is `team` a first-class tenant or only a grouping inside an org? (Recommend grouping only.)

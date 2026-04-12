# D3 — Audit Log & Admin UX

> **Status:** Scaffolding. Fill in before D3 implementation begins.

## Goal

Every security-relevant action is recorded in an append-only audit log and browsable by admins.

## Event Taxonomy (draft)

Categories:
- **auth** — login, logout, MFA challenge, SSO callback, failed login
- **member** — invite, role change, remove, join
- **data** — source created, source deleted, collection created, note created, note deleted
- **admin** — org settings changed, API key created, webhook configured
- **config** — feature flag change, retention policy change

Each event records: `id, org_id, actor_user_id, actor_type, action, resource_type, resource_id, ip, user_agent, before (jsonb), after (jsonb), created_at`.

## Storage

Append-only table `audit_log`. Partitioned by month. Indexed on `(org_id, created_at DESC)`, `(actor_user_id)`, `(resource_type, resource_id)`.

Retention: default 365 days, configurable per-org. Regulated tier (D4/D5) adds longer retention + tamper-evident hash chain.

## Emission

NestJS interceptor wraps every `CommandBus.execute()`. Emitter listens on `EventBus` for domain events already emitted by command handlers. Dedup prevents double-logging.

## Admin UX

- `/admin/audit` — table with filters (actor, action, resource type, date range), CSV export.
- `/admin/settings` — org name, members, roles.
- Admin routes guarded by `role ∈ {owner, admin}` check.

## Open Questions

- Store audit in primary DB or separate sink? (Primary in OSS; D4 adds SIEM forward.)
- Sync vs async emission? (Async via EventBus; accepts eventual consistency for audit.)

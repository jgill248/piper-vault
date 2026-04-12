# D2 — RBAC & Collection Sharing

> **Status:** Scaffolding. Fill in before D2 implementation begins.

## Goal

Role-based permissions inside an org; collections shareable to teams and users with scoped roles.

## Built-in Roles (draft)

| Role | Scope | Capabilities |
|------|-------|--------------|
| `owner` | Organization | Full control; billing; delete org |
| `admin` | Organization | Manage members, roles, settings; view audit log |
| `editor` | Organization or Collection | Create/modify collections, sources, notes |
| `viewer` | Organization or Collection | Read-only |

## Permission Matrix

To be expanded: actions × resources × roles. Example rows:

| Action | Resource | owner | admin | editor | viewer |
|--------|----------|:-----:|:-----:|:------:|:------:|
| `create` | `collection` | ✓ | ✓ | ✓ | — |
| `delete` | `collection` | ✓ | ✓ | — | — |
| `share` | `collection` | ✓ | ✓ | ✓ (own) | — |
| `read` | `source` | ✓ | ✓ | ✓ | ✓ |
| `invite` | `member` | ✓ | ✓ | — | — |
| `view` | `audit_log` | ✓ | ✓ | — | — |

## Data Model

```
roles (id, name, scope, is_builtin, ...)
role_bindings (role_id, subject_type, subject_id, resource_type, resource_id, ...)
collection_collaborators (collection_id, user_id|team_id, role, added_by, added_at)
```

## Open Questions

- Custom roles in v1 or only built-ins? (Built-ins only recommended.)
- Permission check strategy: decorator-per-route or interceptor-per-bus? (Decorator on controllers, guard on bus handlers.)

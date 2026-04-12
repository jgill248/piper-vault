# Piper Vault Enterprise Spec

This directory holds the design docs for Phase D: Enterprise.

Phase D ships enterprise capabilities across five sub-milestones (D1–D5), as tracked on the GitHub project board under the `phase-d` label.

## Scope

Phase D targets three buyer profiles in parallel:

1. **Self-hosted teams (5–50)** — IT-driven, on-prem, need SSO, basic RBAC, team workspaces.
2. **Managed cloud tenants** — multi-tenant SaaS on Piper Vault Cloud, seat metering, billing.
3. **Regulated / on-prem large orgs** — air-gapped deployments, SAML, SIEM export, SOC2/GDPR posture.

## Commercial Model

**OSS + Enterprise add-on**. The AGPL-3.0 core (`packages/api`, `packages/web`, etc.) ships basic tenancy (orgs, teams), RBAC, and audit log. A separately licensed `packages/enterprise/` bundle adds SSO/SAML, SCIM, advanced audit (hash-chain tamper evidence, SIEM export), and admin analytics. Core loads the bundle via a runtime plugin interface — no hard dependency, no license contamination.

## Design Docs

Each sub-milestone has a design doc in this directory. Docs are written just-in-time as implementation approaches; discovery was skipped by decision (risk accepted).

- [`charter.md`](./charter.md) — Phase D charter, scope, non-goals, commercial boundary
- [`tenancy.md`](./tenancy.md) — D1 org/team/membership data model and migration
- [`rbac.md`](./rbac.md) — D2 permission matrix and role model
- [`audit.md`](./audit.md) — D3 audit event taxonomy and storage
- [`sso.md`](./sso.md) — D4 pluggable auth, OIDC/SAML, SCIM
- [`compliance.md`](./compliance.md) — D5 deployment, cloud, compliance posture

## Sequencing

```
Phase A (active)  →  Phase B (distribution)  →  Phase D (enterprise)
                                                   │
                                                   ├── D1 — Tenancy Foundation
                                                   ├── D2 — RBAC & Collection Sharing  (needs D1)
                                                   ├── D3 — Audit Log & Admin UX        (needs D1)
                                                   ├── D4 — Enterprise Add-on Bundle    (needs D1)
                                                   └── D5 — Deployment & Compliance     (closes after D1–D4)
```

Phase C (Polish: follow-up questions, MCP server) continues independently.

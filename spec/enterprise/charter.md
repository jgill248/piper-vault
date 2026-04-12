# Phase D Charter

> **Status:** Draft scaffolding. Fill in before D4 ships.

## Problem

The Piper Vault landing page advertises an "Enterprise" tier as "Coming Soon" with SSO/OIDC, team workspaces, audit logging, and dedicated support. Nothing exists behind this promise. Self-hosted teams, managed cloud tenants, and regulated/on-prem orgs have all asked for capabilities the core product does not support.

## Goals

1. Extend Piper Vault from single-user to multi-tenant without breaking existing installs.
2. Ship role-based access control, collection sharing, and an append-only audit log in the OSS core.
3. Ship SSO (OIDC + SAML), SCIM, advanced audit, and SIEM export as a separately licensed enterprise add-on.
4. Ship deployment and compliance posture sufficient for SOC2 readiness and air-gapped install.

## Non-Goals

- Feature gating of existing OSS functionality.
- Proprietary fork of the core. The AGPL core remains complete on its own.
- SOC2 certification in Phase D. D5 tracks *evidence collection and posture*, not the audit itself.
- Multi-region HA for managed cloud in D5. Single-region managed cloud is v1.

## Commercial Model

**OSS + Enterprise add-on.**

| Capability | License | Package |
|------------|---------|---------|
| Orgs, teams, memberships | AGPL-3.0 | `packages/api`, `packages/web` |
| Built-in RBAC (owner/admin/editor/viewer) | AGPL-3.0 | `packages/api`, `packages/web` |
| Collection sharing | AGPL-3.0 | `packages/api`, `packages/web` |
| Basic audit log + admin viewer | AGPL-3.0 | `packages/api`, `packages/web` |
| SSO (OIDC, SAML) | Commercial | `packages/enterprise` |
| SCIM 2.0 provisioning | Commercial | `packages/enterprise` |
| Advanced audit (hash chain, SIEM export) | Commercial | `packages/enterprise` |
| Admin analytics dashboard | Commercial | `packages/enterprise` |
| Managed cloud control plane | Commercial | `packages/cloud` (TBD) |

## Success Metrics

- Ten design-partner teams running Phase D self-hosted.
- One regulated on-prem deployment using SAML + SIEM export.
- Managed cloud waitlist converted to active tenants.
- Zero license-contamination incidents (AGPL vs commercial boundary holds).

## Risks

- **AGPL + commercial coexistence** — bundle must load via runtime plugin interface only; no shared code path. Legal review required before D4 GA.
- **Breaking v2** — tenancy migration is invasive. Expect Piper Vault 2.0 cut with documented upgrade path.
- **SAML scope** — SAML 2.0 may balloon D4; plan to split D4a (OIDC) / D4b (SAML) if estimates demand it.
- **Skipped discovery** — landing-page teasers are the requirements source. Establish a design-partner feedback loop before D4 GA to correct course.

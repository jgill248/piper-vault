# D5 — Deployment & Compliance Posture

> **Status:** Scaffolding. Fill in before D5 implementation begins.

## Goal

Support all three buyer profiles — self-hosted, managed cloud, regulated/on-prem — with hardened deployment options and a credible compliance posture.

## Deployment Targets

1. **Docker Compose** (existing, OSS) — single host, low-touch.
2. **Helm Chart** (new, OSS) — Kubernetes for teams with ops maturity. Values cover auth provider, storage class, resource limits, replicas.
3. **Air-gapped bundle** (new, OSS + enterprise add-on) — offline tarball with all images, charts, and install script.
4. **Managed cloud control plane** (new, commercial) — multi-tenant provisioning, seat metering, billing hooks on Stripe.

## Hardened Docker Image

- Non-root user by default.
- Read-only root filesystem with explicit writable volume for data.
- Minimal base (distroless or alpine).
- Published with SBOM (CycloneDX) and cosign signature.

## Security Hardening

- CSP headers, strict `X-Content-Type-Options`, `X-Frame-Options`.
- Rate limiting per user + per IP.
- Secret scanning in CI (gitleaks).
- Quarterly pen-test engagement; findings tracked as `qa-blocker` issues.

## Compliance Posture

- **SOC2 Type 1** readiness — evidence collection (policies, access reviews, change mgmt, incident response). Certification itself is not in Phase D scope.
- **GDPR** — DSR endpoints for data export (per-user) and deletion (org-scoped).
- **Data residency** — managed cloud tenants can pin region (US, EU). On-prem is inherent.

## Backup & DR

- CLI: `piper-vault backup --to s3://...` and `piper-vault restore --from ...`.
- Scheduled backups via cron-style config in `piper-vault.yaml`.
- DR runbook in `docs/enterprise/dr.md`.

## Landing Page Flip

- Remove "Coming Soon" on Enterprise card.
- Add pricing page for support tiers + hosting tiers.
- Add compliance page (SOC2 status, GDPR stance, security FAQ, DPA template download).

## Open Questions

- SaaS cloud: build on AWS/GCP/Fly.io? (Fly.io recommended for solo-founder ops.)
- Billing integration: Stripe Billing or Lago? (Stripe — simpler, fewer moving parts.)
- SOC2 auditor choice: defer until first enterprise contract requires it.

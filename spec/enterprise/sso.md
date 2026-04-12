# D4 — Enterprise Add-on Bundle (SSO, SCIM, Advanced Audit)

> **Status:** Scaffolding. Fill in before D4 implementation begins.

## Goal

Ship `@piper-vault/enterprise` as a separately licensed package that plugs into core via a runtime interface. No hard dependency from core to enterprise.

## Package Layout

```
packages/enterprise/
├── LICENSE                  — Commercial license (BUSL or proprietary)
├── package.json             — "private": true, not published to npm
├── src/
│   ├── auth-providers/
│   │   ├── oidc.provider.ts
│   │   └── saml.provider.ts
│   ├── scim/                — SCIM 2.0 endpoints
│   ├── audit/               — Hash-chain + SIEM export
│   └── analytics/           — Admin dashboard data sources
└── README.md
```

Core loads via `ENTERPRISE_BUNDLE_PATH` env. If unset, core runs in OSS-only mode.

## Pluggable Auth Interface (in core)

Core refactors `packages/api/src/auth/` to expose:

```ts
export interface AuthProvider {
  readonly id: string;
  authenticate(req): Promise<UserClaims>;
  // ...
}
```

Built-in providers (OSS): `local` (username/password JWT), `api-key`.
Enterprise providers: `oidc`, `saml`.

Provider selection via `AUTH_PROVIDERS=local,oidc` env list.

## OIDC

`passport-openidconnect`. Discovery URL + client id/secret per org. Tested against Okta, Azure AD, Google Workspace, Keycloak.

## SAML 2.0

`passport-saml`. Metadata URL or XML upload per org. Tested against Okta, Azure AD, ADFS.

## SCIM 2.0

Endpoints: `/scim/v2/Users`, `/scim/v2/Groups`. Bearer-token auth per IdP connection. Maps SCIM users to Piper Vault users, SCIM groups to teams.

## Advanced Audit

- Hash chain: each audit row includes `prev_hash` + `row_hash`. Tamper detection via chain verification.
- SIEM export: JSON over webhook (Splunk HEC format) + syslog RFC 5424.

## Admin Analytics

Dashboard: seat usage, daily active users, collection activity, search volume per org.

## License Boundary

No TypeScript imports cross from `packages/api` or `packages/web` into `packages/enterprise`. Enterprise registers itself with core at boot via the plugin interface. Docker image build has a build arg `ENTERPRISE=true|false` to include or exclude the bundle.

## Open Questions

- BUSL vs strict proprietary? (BUSL 1.1 with 3-year Change Date to AGPL recommended — allows source availability, disallows resale.)
- Split D4 into D4a (OIDC + SCIM) + D4b (SAML + advanced audit) if scope creeps?

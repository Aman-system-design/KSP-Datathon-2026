# Catalyst Development Release Evidence — 2026-07-22

## Released boundary

- Slate application: `https://aiksp.onslate.in`
- Catalyst project: `KSPDatathon2026` (`43492000000013049`)
- Environment: **Development only**
- Advanced I/O Function: `crime_intelligence_api`
- Job Function: `intelligence_refresh` (unchanged in this release)
- Source schema: 29 Catalyst tables, including all 26 PDF entities
- Intelligence schema: 32 Catalyst tables
- Governed API contract: 42 operations

## Verified release facts

- The Slate build completed on Catalyst with zero dependency vulnerabilities reported by the build.
- The live URL returns HTTP 200 and references Catalyst Web SDK 4.6.1.
- The live application bundle contains the reviewed `generateAuthToken()` integration and the exact Development Function base.
- The API `/healthz` and `/readyz` endpoints return HTTP 200.
- The API permits the exact Slate origin on actual requests and rejects an unrelated origin with HTTP 403.
- Catalyst runtime variables were restored after Function deployment without printing or committing secret values.
- Temporary recovery artifacts were deleted after deployment.

## Automated verification

`npm run verify` passed on the exact release commit:

- backend and contract tests: 358 total, 356 passed, 2 platform-dependent skips, 0 failed;
- frontend tests: 144 passed, 0 failed;
- Vite production build and bundle budgets: passed;
- generated API and refresh Function bundle inspection: passed;
- source/PDF schema validation: passed;
- intelligence schema validation: passed;
- remote Catalyst preflight: passed with `migrationReady: true` and a clean release branch.

## Remaining console gate

Catalyst Authentication must whitelist `https://aiksp.onslate.in` under **Authorized Domains → CORS**. Catalyst currently intercepts browser preflight requests before the Function and does not yet return `Access-Control-Allow-Origin`; authenticated browser calls therefore remain fail-closed until this exact domain is authorized. After whitelisting, complete one signed-in smoke test for every demo persona before recording the submission video.

## Release integrity

The frontend obtains a short-lived Catalyst backend token through Web SDK 4.6.1 and sends it in `Authorization`. It does not store the token. The backend remains the enforcement boundary for authentication, role, jurisdiction, resource scope, and the Development-only persona allowlist.

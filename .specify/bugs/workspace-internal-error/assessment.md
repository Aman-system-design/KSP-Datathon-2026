# Bug Assessment: ACE workspace returns INTERNAL_ERROR

- **Slug**: `workspace-internal-error`
- **Assessed**: 2026-07-26
- **Verdict**: valid
- **Severity**: critical

## Summary

The deployed ACE client cannot bootstrap because the authenticated `GET /v1/workspace` request fails. Catalyst access and application logs show that the deployed Advanced I/O function is failing inside the Catalyst runtime while loading the customer bundle, before the application handler can execute.

## Reproduction

1. Open `https://ace.onslate.in/` with the configured Catalyst demo user.
2. Observe `Intelligence is unavailable` and reference `INTERNAL_ERROR`.
3. Inspect Catalyst Development access logs for `crime_intelligence_api`.
4. Observe `/v1/workspace` returning HTTP 500 in 2-5 ms after the 21:07 deployment and later timing out with HTTP 408.
5. Inspect Catalyst Development application logs and observe `FlavourHandler.loadCustomerCode` failing with `SyntaxError: ... is not valid JSON` before customer code executes.

## Evidence

- The live browser rendered the generic failure gate and logged `api_response_failed`.
- Catalyst access logs show `/v1/workspace` returned HTTP 200 at 20:52, then immediate HTTP 500 responses beginning at 21:07 after the function deployment.
- Catalyst application logs show the failure in `/var/runtime/flavours/index.js` while loading customer code, followed by `returnErrorResponse` errors. No `api_request_failed` phase marker from `createApiApplication` is emitted for these requests, proving the application handler is not reached.
- The clean local API bundle passes `npm run catalyst:inspect`: Node 24, 47 files, zero manifest errors, zero forbidden files, and zero unresolved imports.
- The local `functions/crime_intelligence_api/index.cjs` loads successfully with a complete Development configuration.
- The separate refresh bundle currently has digest mismatches and must not be included in this corrective deployment.

## Root Cause

The active Catalyst Development deployment of `crime_intelligence_api` contains or references malformed runtime bundle metadata. Catalyst fails while parsing/loading the deployed customer bundle, before Express or the ACE API handler runs. This is a deployment-artifact/runtime-load failure, not a workspace data contract failure and not an authentication UX error.

The exact bytes of Catalyst's internal runtime metadata are not exposed by the CLI, but the temporal boundary, runtime stack trace, absence of application phase logs, and clean local bundle converge on the deployed artifact as the fault boundary.

## Suspected Code and Configuration

- `functions/crime_intelligence_api/catalyst-config.json` - local deployment metadata; locally valid JSON.
- `functions/crime_intelligence_api/index.cjs` - function entry point; locally loadable.
- `functions/crime_intelligence_api/app/bundle-manifest.json` - API bundle integrity contract; locally valid.
- Catalyst Development deployment for function `crime_intelligence_api` - active faulty artifact.

## Proposed Remediation

1. Rebuild the API function from the clean `main` checkout.
2. Re-run the API bundle inspector and local entry-point load check.
3. Deploy only `crime_intelligence_api` to Catalyst Development; do not deploy `intelligence_refresh` because its current generated manifest is independently stale.
4. Reconfirm the seven required runtime configuration keys without printing or replacing secret values.
5. Reproduce the authenticated workspace request and verify HTTP 200 in Catalyst access logs and a rendered ACE workspace in the live browser.
6. If a clean redeploy reproduces the same runtime parser failure, stop and escalate to Catalyst with the captured `FlavourHandler.loadCustomerCode` trace; do not mask it in the frontend.

## Files Likely to Change

- Generated API bundle files only if `npm run catalyst:build` produces a deterministic difference.
- `.specify/bugs/workspace-internal-error/fix.md` for the remediation record.
- `.specify/bugs/workspace-internal-error/test.md` for post-deployment validation.

No frontend source change is warranted by the evidence.

## Tests to Add or Update

- No product-code regression test is required for the current root cause because the local API bundle and entry point already pass their integrity checks.
- Treat the currently failing authenticated live `/v1/workspace` request as the red deployment acceptance test.
- Run existing API bundle inspection and local load checks before deployment.
- After deployment, verify authenticated `/v1/workspace` returns 200 and the Command Centre/selector renders without `INTERNAL_ERROR`.

## Risks and Considerations

- Function deployment can reset or omit secret environment variables; verify configuration immediately after deployment without exposing values.
- Deploying both functions would unnecessarily include the stale refresh manifest, so scope the deployment to the API function.
- A frontend fallback would hide a broken security/data boundary and is explicitly rejected.
- Catalyst log indexing can lag by up to five minutes; use the live UI plus access logs for final confirmation.

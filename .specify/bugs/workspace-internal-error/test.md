# Bug Verification: ACE workspace bootstrap restored

- **Slug**: `workspace-internal-error`
- **Tested**: 2026-07-26
- **Assessment**: ./assessment.md
- **Fix**: ./fix.md
- **Result**: verified

## Summary

The original full-page `INTERNAL_ERROR` no longer reproduces. The authenticated Command Centre completes workspace bootstrap, Catalyst records fresh HTTP 200 responses for `/v1/workspace`, and the live Utilities catalogue loads from the redeployed API.

## Checks Performed

| Check | Command / Action | Result | Notes |
|-------|------------------|--------|-------|
| Reproduction (post-fix) | Reload authenticated `https://ace.onslate.in/?persona=COMMAND_CENTER` | pass | Command Centre shell and State Crime Intelligence dashboard rendered; no full-page failure gate. |
| Catalyst access evidence | Refresh `crime_intelligence_api` logs | pass | Fresh `/v1/workspace` responses returned 200 in 161-775 ms; `/v1/utilities` returned 200 in 131 ms. |
| Live feature smoke | Command Centre -> Utilities | pass | `Intelligence Utilities` rendered with four configured utilities and category filters. |
| API regression suite | `node --test tests/catalyst/api-bootstrap.test.mjs tests/reporting/workspace-services.test.mjs` | pass | 22 passed, 0 failed. |
| Router regression suite | `npm.cmd run test --workspace web -- --run src/app/router.test.jsx` | pass | 24 passed, 0 failed. Initial sandbox run could not write Vite temp files; approved rerun passed. |
| Production web build | `npm.cmd run web:build` | pass | Vite built 3,330 modules; bundle budget check passed. |
| API bundle integrity | `npm.cmd run catalyst:inspect` | pass (API target) | API Node 24 bundle: 47 files, zero manifest/import/forbidden-file errors. |
| Runtime configuration | Catalyst Development function configuration | pass | Seven required keys present; preserved audit secret restored with length 64. |

## Output Excerpts

```text
tests 22; pass 22; fail 0
Test Files 1 passed (1); Tests 24 passed (24)
PASS: web bundle budgets (main 98068 B gzip; Studio 5129 B gzip; 21 JS chunks).
/server/crime_intelligence_api/v1/workspace ... GET 200
/server/crime_intelligence_api/v1/utilities ... GET 200
```

## Residual Risks

- Several dashboard report executions return safe per-card 403/500 unavailable states. They do not block workspace or Utilities bootstrap and are a separate report-execution defect.
- The undeployed `intelligence_refresh` generated manifest has four digest mismatches. It was deliberately excluded from this API-only correction.
- Catalyst Development deployment clears secrets not declared in the checked-in function config; future deploy procedures must preserve and restore the audit secret as this fix did.

## Recommendation

Close `workspace-internal-error` as verified end-to-end. Open separate assessed bugs for report execution failures and the stale refresh bundle before the next all-functions deployment.

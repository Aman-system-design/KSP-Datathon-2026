# Bug Fix: Restore ACE workspace bootstrap

- **Slug**: `workspace-internal-error`
- **Fixed**: 2026-07-26
- **Assessment**: ./assessment.md
- **Status**: applied

## Summary

Rebuilt and redeployed only the verified `crime_intelligence_api` bundle to Catalyst Development, replacing the malformed runtime artifact. The deployment-cleared audit secret was preserved and restored to the same function, and the authenticated Command Centre now passes workspace bootstrap instead of rendering the full-page `INTERNAL_ERROR` gate.

## Changes

| File / Resource | Change | Notes |
|------|--------|-------|
| `functions/crime_intelligence_api/app` | rebuilt | Deterministic API-only Node 24 bundle; no Git diff produced. |
| Catalyst Development `crime_intelligence_api` | redeployed | Targeted deployment only; `intelligence_refresh` was not deployed. |
| Catalyst Development function variables | restored | Reinstated the preserved `KSP_AUDIT_KEY`; verified all seven required keys without changing the secret. |
| `.specify/bugs/workspace-internal-error/assessment.md` | added | Root-cause evidence and remediation contract. |
| `.specify/bugs/workspace-internal-error/fix.md` | added | This remediation record. |

## Tests Added or Updated

- No product test was added because the failure occurred in Catalyst's deployed runtime metadata before customer code loaded; existing bundle integrity checks already cover the local artifact.
- The authenticated live `/v1/workspace` failure served as the red deployment acceptance test.

## Local Verification

- `npm.cmd run catalyst:inspect` -> API target valid: Node 24, 47 files, zero manifest/import/forbidden-file errors.
- Local configured `require('./functions/crime_intelligence_api/index.cjs')` -> Express export and handler both load as functions.
- API-only rebuild -> 47-file Node 24 artifact, deterministic with no tracked-file diff.
- `catalyst.cmd deploy --only functions:crime_intelligence_api -ni` -> deployment successful.
- Catalyst configuration inspection -> all seven required variables present; audit secret length 64.
- Authenticated live browser reload -> full-page `INTERNAL_ERROR` replaced by the Command Centre shell and State Crime Intelligence dashboard.

## Deviations from Assessment

None. The separate stale `intelligence_refresh` manifest was observed but not rebuilt or deployed.

## Follow-ups

- Run `/speckit-bug-test slug=workspace-internal-error` and record the final deployment verdict.
- Treat individual dashboard report-card failures as separate report-execution defects; they no longer block workspace bootstrap.

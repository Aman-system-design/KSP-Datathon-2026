# Catalyst Development Deployment Ledger

## Controlled target

- Project: `KSPDatathon2026`
- Project ID: `43492000000013049`
- Organization/environment ID: `60077844198`
- Environment: Development only
- Data classification: synthetic only

Secrets, Catalyst tokens, session material, personal invitation addresses, HMAC key values, and future identity-provider credentials are never recorded in this ledger or committed to Git.

## Checkpoints

| IST time | Commit | Checkpoint | Remote mutation | Resources/IDs | Verification | Rollback | Verdict |
|---|---|---|---|---|---|---|---|
| 2026-07-20 20:14:30 IST | `8a47eeb` | Pre-scaffold Catalyst CLI state | None; local Function scaffolding only | CLI `1.27.0`; project `43492000000013049`; branch `codex/catalyst-development` | Remote preflight passed; clean tree; Development and synthetic-only locks active | Delete uncommitted local scaffold files | PASS |
| 2026-07-20 21:10:14 IST | `08aa290` | Authorize intelligence schema creation | Create exactly 21 additive tables from `schema/catalyst/intelligence-schema.json` in Development; do not alter the existing 29 tables; seed no rows | API bundle `7F1C208B70E344DDF4C9FB235EDCDF741A3166DABABBF78A50FACA088580EA13`; Job bundle `D71705BD2792DE0610E01FDAB0E2321BE7D25338CADC84F7796F835766308171` | 141 tests passed; both schema validators passed; both bundles passed; clean remote preflight passed; challenge review from `main` passed semantic inspection | If verification fails, delete only newly created empty tables in reverse load order; never touch the existing 29 tables | AUTHORIZED |
| 2026-07-20 22:17:04 IST | `a456560` | Verify intelligence schema creation | Created 21 additive Development tables and 220 manifest columns; corrected the empty `INT_NetworkEdge.NetworkEdgeID` column by recreating it with the required unique constraint; inserted no rows; denied Select/Update/Insert/Delete to App User on every new table | Table IDs below; export job `43492000000063001`; ZIP SHA-256 `EF1BB413D78A6C5F5BC193EE12F80409C991FE0AE35B74D7C710CB4A07470D50` | Fresh Catalyst IaC export passed a strict combined comparison: all 50 Development tables and 611 manifest columns match the source and intelligence manifests, including foreign keys, parent `ROWID`, `ON-DELETE-SET-NULL`, types, lengths, defaults, uniqueness, mandatory, search-index and PII settings; 21/21 permissions pages independently showed all App User table permissions denied | Delete only these 21 empty additive tables in reverse load order if this checkpoint must be rolled back; never alter the existing 29 source/ingestion tables | PASS |
| 2026-07-20 22:20:13 IST | `f78c6c4` | Authorize targeted Function deployment | Deploy only `crime_intelligence_api` and `intelligence_refresh` to Development so their Function resources exist; do not invoke bootstrap, create schedules, configure Authentication/API Gateway, seed data or deploy Production | API manifest SHA-256 `7F1C208B70E344DDF4C9FB235EDCDF741A3166DABABBF78A50FACA088580EA13`; Job manifest SHA-256 `D71705BD2792DE0610E01FDAB0E2321BE7D25338CADC84F7796F835766308171` | 141 tests passed; both schema validators and both bundle inspections passed; combined 50-table export comparison passed; challenge alignment and clean Development remote preflight passed | Delete only the two newly deployed Development Functions if targeted deployment verification fails; never modify tables or Production resources | AUTHORIZED |
| 2026-07-20 22:36:22 IST | `4ea848a` | Verify targeted Function deployment | Deployed the exact authorized API and Job bundles to Development; configured the five required Development environment-variable names through attended Catalyst configuration; never read or recorded the HMAC value; invoked no Job and seeded no rows | API `crime_intelligence_api` ID `43492000000065001`; Job `intelligence_refresh` ID `43492000000066001`; API URL `https://kspdatathon2026-60077844198.development.catalystserverless.in/server/crime_intelligence_api/` | Catalyst reported both targeted deployments successful; API and Job configuration each exposed all five required key names; an initially invalid attended secret failed safely with sanitized `500 INTERNAL_ERROR`; after the user replaced it with a compliant value, the approved unauthenticated brief route returned `401 UNAUTHENTICATED`, JSON, `no-store`, a request ID and no stack or operational details | Delete only Function IDs `43492000000065001` and `43492000000066001` and their Function configuration if rollback is required; do not alter Data Store or Production | PASS |

## Intelligence table IDs

| Table | Catalyst table ID | Table | Catalyst table ID |
|---|---:|---|---:|
| `CFG_UserAccess` | `43492000000054003` | `TRN_CaseFeature` | `43492000000054362` |
| `TRN_LocationFeature` | `43492000000054721` | `TRN_PersonResolution` | `43492000000055080` |
| `TRN_DistrictContext` | `43492000000055439` | `INT_AnalysisRun` | `43492000000055798` |
| `INT_Hotspot` | `43492000000056157` | `INT_Anomaly` | `43492000000056516` |
| `INT_Pattern` | `43492000000056875` | `INT_AreaRisk` | `43492000000057234` |
| `INT_NetworkNode` | `43492000000057593` | `INT_NetworkEdge` | `43492000000057952` |
| `INT_RepeatOffenderSignal` | `43492000000058311` | `INT_FindingEvidence` | `43492000000058670` |
| `WF_Alert` | `43492000000059029` | `WF_Command` | `43492000000059388` |
| `WF_AlertEvidence` | `43492000000059747` | `WF_Assignment` | `43492000000060106` |
| `WF_AnalystConclusion` | `43492000000060465` | `WF_Outcome` | `43492000000060824` |
| `WF_AuditEvent` | `43492000000061183` |  |  |

The evidence ZIP and extracted Catalyst template remain under ignored `artifacts/catalyst-development/` paths. No source or intelligence rows and no Production resources were created at this checkpoint.

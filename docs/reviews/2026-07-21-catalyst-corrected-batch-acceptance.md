# Catalyst Corrected Batch Acceptance

## Verdict

**PASS**

The corrected PDF-semantic synthetic batch executed through the deployed Catalyst Job Function, persisted source and analytical outputs, and passed independent read-only acceptance checks in Development.

## Controlled execution

- Project: `43492000000013049` (`KSPDatathon2026`)
- Environment: Development only
- Function: `intelligence_refresh` (`43492000000066001`)
- Job Pool: `IntelligenceRefreshPool` (`43492000000052011`)
- Job: `KSPBootstrap20260720` (`43492000000064695`)
- Operation: `BOOTSTRAP_SYNTHETIC`
- Batch key: `KSP-DEMO-20260720-V1`
- Seed: `20260720`
- Synthetic-only: `true`
- Retries: `0`
- Corrected ingestion batch ROWID: `43492000000068005`
- Production mutations, schedules, and new batch keys: none

## Remote acceptance evidence

| Check | Observed result | Verdict |
|---|---:|---|
| Job execution | `success` | PASS |
| Source rows / accepted / rejected | `411 / 411 / 0` | PASS |
| `SRC_CaseMaster` FIRs | `50` | PASS |
| `TRN_SourceKeyMap` rows | `411` | PASS |
| `INT_AnalysisRun` rows | `7` | PASS |
| 18-digit `CrimeNo` values | `50 / 50` | PASS |
| `CaseNo` equals final nine `CrimeNo` digits | `50 / 50` | PASS |
| Unique police-station + `CaseNo` pairs | `50 / 50` | PASS |
| Valid incident-from <= incident-to <= information-received chronology | `50 / 50` | PASS |
| Hotspots / anomalies / patterns | `1 / 1 / 1` | PASS |
| Repeat-offender signals / area risks | `2 / 1` | PASS |
| Network edges | `58` | PASS |
| Actionable workflow alerts | `1` | PASS |

The twenty globally repeated `CaseNo` strings are valid because the PDF defines the serial within police-station, category, and year scope. The authoritative uniqueness check is the station-plus-case-number pair; `CaseMasterID` remains the global case primary key.

## Safety and production-shape checks

- All five required Function configuration key names were present after deployment; the audit-key value was entered privately and was never read or recorded.
- The rejected invalid batch was removed before reload, and the same approved batch key was reused exactly once.
- Analytical results are persisted and version-linked; dashboard requests do not execute the analytical pipeline.
- No real person data, Production resource, recurring job, or unsupported predictive-policing claim was introduced.

## Decision

The corrected Catalyst Development batch is accepted as the data and intelligence foundation for the frontend/API MVP. Frontend work may consume this batch through the governed API contracts; it must not replace persisted findings with hard-coded demo values.

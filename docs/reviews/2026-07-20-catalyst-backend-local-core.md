# Challenge Alignment Review

## Verdict

**PASS**

One-sentence reason: The local backend core implements the approved Challenge 02 intelligence, geographic disclosure, coherent refresh, accountable workflow, and tamper-evident audit boundaries with observed tests; Catalyst SDK packaging and Development deployment remain a separate, unclaimed gate.

## Change reviewed

- Review range: `9a020fe...6a97d47` on `codex-builder`
- Changed files: Direct delivery — `packages/intelligence-core/**`, `src/backend/{refresh,services,workflow}/**`, `src/backend/security/disclosure.mjs`, and their backend/intelligence tests. Enabling infrastructure — `config/access-policy.json`, `schema/catalyst/intelligence-schema.json`, `src/backend/{http,repository,security}/**`, package manifests, validators, and compatibility tests. Neutral maintenance — deterministic runbooks and import-path updates. Every file reported by the alignment script is covered by one of these groups; no scope-drift file was found.
- Intended outcome: Complete the production-shaped local core behind the twelve approved APIs before any Catalyst Development mutation.
- Classification: Direct and Enabling; Neutral maintenance is limited to deterministic documentation/import updates; no Drift.

## Requirement impact

| Requirement ID | Impact | Evidence |
|---|---|---|
| CH02-01 | Improved | PDF-aligned fragmented seed/validation remains intact; coherent refresh stages accepted data and publishes findings only as one complete group (`tests/backend/refresh.test.mjs`). |
| CH02-02 | Improved | Four versioned, idempotent alert commands complete assignment-to-outcome with immutable artifacts and audit (`tests/backend/workflow.test.mjs`). |
| CH02-03 | Not affected | This phase supplies the twelve backend operations required by the future React dashboards/maps; UI and Catalyst hosting are explicitly outside this local-core review. |
| CH02-04 | Improved | Scoped hotspot API returns versioned, evidence-linked, limitation-labelled output (`tests/backend/read-services.test.mjs`). |
| CH02-05 | Improved | Unit-tree scope, district-context filtering, and cross-district redaction are enforced (`tests/backend/security.test.mjs`, `tests/backend/read-services.test.mjs`). |
| CH02-06 | Improved | Trend/anomaly output retains baseline method, evidence, confidence, version, and recommendation (`tests/intelligence/anomaly.test.mjs`, `tests/backend/read-services.test.mjs`). |
| CH02-07 | Improved | Evidence-labelled case/person/co-accused networks are served with field-level geographic redaction (`tests/intelligence/network.test.mjs`, `tests/backend/read-services.test.mjs`). |
| CH02-08 | Improved | Person-node networks expose authorized repeated appearances while redacting other-district case identifiers (`tests/backend/read-services.test.mjs`). |
| CH02-09 | Improved | District Context now returns aggregate Pearson context comparison with source period, synthetic label, sample limitation, and `CORRELATION_IS_NOT_CAUSATION` (`src/backend/refresh/finding-projection.mjs`, `tests/backend/read-services.test.mjs`). |
| CH02-10 | Preserved | Area/time-only weighted score remains explainable, evidence-linked, completeness-aware, and explicitly not an individual prediction (`tests/intelligence/area-risk.test.mjs`). |
| CH02-11 | Improved | Cross-district fusion and all seven analysis types are coherently versioned and published; positive and negative controls remain green (`tests/intelligence/evaluate.test.mjs`, `tests/backend/refresh.test.mjs`). |

## Gate results

| Gate | Result | Evidence or finding |
|---|---|---|
| Official challenge | PASS | All affected CH02 capabilities have executable methods, stored evidence contracts, and observed tests; dashboard/map rendering is not falsely claimed. |
| Product architecture | PASS | The implemented flow is accepted fragmented records → analytics → scoped explainable intelligence → assignment/acknowledgement → conclusion/outcome → audit. |
| Catalyst-native services | PASS | The boundary targets Catalyst Data Store, Functions, API Gateway/Authentication, and Job Functions. No third-party platform substitution exists. Remote adapters and deployment remain the next gate. |
| Data and schema | PASS | Source validator: 29 tables/26 PDF mappings; backend validator: 21 tables; synthetic provenance, rejection visibility, PII classification, and safe FK rules pass. |
| AI and policing safety | PASS | No individual future-crime prediction or sensitive-demographic feature; pattern similarity and network links carry human-review limitations; context is aggregate and non-causal. |
| Authorization and audit | PASS | Caller identity is injected from the trusted boundary, profile/action/unit/case assignment checks fail closed, hidden case IDs are removed across nested fields, later commands wait for prior audit completion, and read/persona/denial/workflow events are HMAC-signed. |
| Verification | PASS | Fresh 98/98 suite, Node 18/24 compatibility, schema checks, demo, runbook, alignment script, credential-pattern scan, and `git diff --check` all passed. |

## Findings

No unresolved findings.

Resolved during this review: hidden cross-district identifiers in nested pattern/network metadata; ineffective losing concurrent assignments; acceptance of a later command before the prior audit completed; refresh publication that changed run metadata without replacing visible findings; missing request/persona audit events; and missing explicit repeat-appearance and aggregate correlation projections.

## Verification observed

- Commands run: `npm.cmd run compat:node18`; direct Node 18 refresh/core tests; `npm.cmd run compat:node24`; `npm.cmd test`; both schema validators; intelligence demo; intelligence runbook generation; alignment required-file script with base `9a020fe`; credential/private-key/personal-email grep; `git diff --check`; `git status --short`.
- Tests and results: 98 passed, 0 failed; Node 18 core passed; direct Node 18 refresh/core 6 passed; Node 24 core passed; 29 source tables/26 PDF mappings valid; 21 backend tables valid; intelligence demo `1.0.0` passed.
- Fixtures inspected: deterministic PDF-aligned 50-case synthetic seed, planted hotspot/anomaly/cross-district/repeat-person/co-accused controls, seasonal negative control, and same-name false-match control.
- Manual evidence inspected: scoped pattern and person-network projections, aggregate district correlation object, access/workflow audit fields, command recovery state, current-run selection, secret/identity/idempotency storage paths, and tracked credential-pattern scan.

## Decision

- Push/deploy allowed: Push of the reviewed local branch is allowed. Catalyst deployment is not yet allowed or claimed; it requires the next SDK/Functions/API Gateway/Authentication/Development acceptance plan and its own PASS.
- Required fixes: None for this local-core review.
- WARN justification, owner, and follow-up date: Not applicable.

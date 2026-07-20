# MVP Data Bridge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the approved architecture and verified local intelligence engine into one executable MVP contract, an exact lean Catalyst intelligence/workflow schema, and deterministic PDF-aligned fragmented synthetic extracts.

**Architecture:** Preserve all 26 PDF-defined source tables and business IDs, generate separate extracts, validate them, and adapt accepted records into the canonical intelligence-engine contract. Define new `TRN_*`, `INT_*`, and `WF_*` tables separately so source fidelity is never weakened. This plan stops before remote table mutation, Functions, APIs, Authentication, or UI deployment.

**Tech Stack:** Node.js 24 ESM, `node:test`, JSON schema manifests, Markdown runbooks, existing Catalyst Data Store project.

---

## Task 1: Lock the authoritative MVP build contract

**Files:**
- Create: `docs/architecture/mvp-build-contract.md`
- Modify: `docs/architecture/business-architecture-blueprint.md`
- Modify: `docs/architecture/role-access-and-experience-design.md`
- Modify: `docs/architecture/ai-ml-intelligence-strategy.md`
- Modify: `docs/PROJECT_MEMORY.md`
- Test: `tests/architecture/mvp-contract.test.mjs`

- [ ] **Step 1: Write a failing architecture-contract test**

The test reads the build contract and requires: all eleven CH02 IDs; the four MVP routes `/leadership`, `/district/:unitId`, `/analyst/alerts/:alertId`, `/operations`; the twelve API paths defined by the AI strategy; the three full roles and one light role; explicit deferred features; and the phrase `single source of truth`.

- [ ] **Step 2: Run the test and verify it fails**

Run: `node --test tests/architecture/mvp-contract.test.mjs`  
Expected: FAIL because the contract file does not exist.

- [ ] **Step 3: Create the contract and remove stale statements**

The contract must lock:

- product: KSP Crime Decision Intelligence Platform;
- flagship: Cross-District Pattern Fusion;
- full experiences: State Leadership, District/Division Leadership, Crime Analyst;
- light experience: Station/Investigator Operations;
- four routes listed in Step 1;
- exact API inventory from `ai-ml-intelligence-strategy.md`;
- Catalyst services: Data Store, Functions, Authentication, API Gateway, Stratus, Slate/Web Client Hosting, Cron/Jobs, QuickML after the vertical slice;
- page-level acceptance evidence;
- strict exclusions for CCTV/social/event expansion;
- implementation order: data bridge, Catalyst backend, UI/workflow, QuickML/pitch.

Update stale statuses and already-answered questions in the four existing documents. Do not reopen approved roles, scope, flagship, or safety decisions.

- [ ] **Step 4: Run the architecture test and full suite**

Run: `node --test tests/architecture/mvp-contract.test.mjs`  
Expected: PASS.  
Run: `npm.cmd test`  
Expected: all tests pass.

- [ ] **Step 5: Commit**

```powershell
git add docs/architecture docs/PROJECT_MEMORY.md tests/architecture/mvp-contract.test.mjs
git commit -m "docs: lock authoritative MVP build contract"
```

## Task 2: Define the lean Catalyst intelligence/workflow manifest

**Files:**
- Create: `schema/catalyst/intelligence-schema.json`
- Create: `scripts/schema/validate-intelligence-schema.mjs`
- Test: `tests/schema/intelligence-schema.test.mjs`
- Modify: `package.json`

- [ ] **Step 1: Write failing schema tests**

Require exactly these 19 tables:

```text
TRN_CaseFeature
TRN_LocationFeature
TRN_PersonResolution
TRN_DistrictContext
INT_AnalysisRun
INT_Hotspot
INT_Anomaly
INT_Pattern
INT_AreaRisk
INT_NetworkNode
INT_NetworkEdge
INT_RepeatOffenderSignal
INT_FindingEvidence
WF_Alert
WF_AlertEvidence
WF_Assignment
WF_AnalystConclusion
WF_Outcome
WF_AuditEvent
```

Tests must require every table to have a unique application ID, `SyntheticData`, and the relevant run/evidence/version fields. Foreign keys must name an existing parent table and use `On Delete = Null`. `INT_AreaRisk` must contain `AreaType`, `AreaID`, `PeriodStart`, `PeriodEnd`, `Score`, `ComponentsJSON`, `MethodVersion`, and `Limitation` but no person reference.

- [ ] **Step 2: Run tests and verify failure**

Run: `node --test tests/schema/intelligence-schema.test.mjs`  
Expected: FAIL because the manifest and validator do not exist.

- [ ] **Step 3: Implement manifest and validator**

Use the same column descriptors as `schema/catalyst/source-schema.json`: `name`, `type`, `maxLength`, `mandatory`, `unique`, `indexed`, `pii`, `parentTable`, and `onDelete`. The validator rejects duplicate tables/columns, unknown parents, cascade deletion, missing synthetic labels, missing business IDs, and any person-level area-risk field.

Add:

```json
"intelligence-schema:validate": "node scripts/schema/validate-intelligence-schema.mjs"
```

to `package.json`.

- [ ] **Step 4: Run manifest tests and validators**

Run: `node --test tests/schema/intelligence-schema.test.mjs`  
Expected: PASS.  
Run: `npm.cmd run intelligence-schema:validate`  
Expected: `PASS: 19 Catalyst intelligence/workflow tables are valid.`

- [ ] **Step 5: Commit**

```powershell
git add schema/catalyst/intelligence-schema.json scripts/schema/validate-intelligence-schema.mjs tests/schema/intelligence-schema.test.mjs package.json
git commit -m "feat: define Catalyst intelligence schema"
```

## Task 3: Generate PDF-aligned 50-FIR source records

**Files:**
- Create: `src/synthetic/source-seed.mjs`
- Create: `scripts/synthetic/generate-source-seed.mjs`
- Test: `tests/synthetic/source-seed.test.mjs`
- Modify: `.gitignore`

- [ ] **Step 1: Write failing seed tests**

Tests import `generateSourceSeed()` and require:

- exactly 26 keys matching `schema/catalyst/pdf-contract.json`;
- exactly 50 `CaseMaster` rows;
- every generated source row contains every PDF-defined column for its table and no missing column;
- unique `CaseMasterID` and `CrimeNo`;
- every child `CaseMasterID` resolves to a case;
- all names and `BriefFacts` visibly synthetic;
- deterministic output for seed `20260720`;
- the planted case IDs map back to canonical `CASE-001` through `CASE-050` using `CaseMasterID` 200000001 through 200000050.

- [ ] **Step 2: Run tests and verify failure**

Run: `node --test tests/synthetic/source-seed.test.mjs`  
Expected: FAIL because the generator does not exist.

- [ ] **Step 3: Implement the generator**

Create lookup/master rows first, then organizational hierarchy, employees, cases, complainants, victims, accused, acts/sections, arrests, and chargesheets. Tables that legitimately have no case-dependent row still receive the necessary master data. Preserve exact PDF spelling and types. Do not generate Catalyst `ROWID` or `*Ref` values; those belong to the loader after parent insertion.

`generate-source-seed.mjs` writes one JSON and CSV file per PDF table plus `manifest.json` containing fixture version, seed, table counts, SHA-256 hashes, and `SyntheticData=true` to `artifacts/source-seed/`.

Add `artifacts/source-seed/` to `.gitignore`.

- [ ] **Step 4: Run tests and generator**

Run: `node --test tests/synthetic/source-seed.test.mjs`  
Expected: PASS.  
Run: `node scripts/synthetic/generate-source-seed.mjs`  
Expected: 26 JSON files, 26 CSV files, and one manifest.

- [ ] **Step 5: Commit**

```powershell
git add src/synthetic/source-seed.mjs scripts/synthetic/generate-source-seed.mjs tests/synthetic/source-seed.test.mjs .gitignore
git commit -m "feat: generate PDF-aligned synthetic FIR extracts"
```

## Task 4: Validate fragmented extracts and expose rejected rows

**Files:**
- Create: `src/ingestion/validate-source-seed.mjs`
- Test: `tests/ingestion/validate-source-seed.test.mjs`

- [ ] **Step 1: Write failing validation tests**

Tests require an untouched generated seed to reconcile with zero rejects. Mutated copies must reject: duplicate `CaseMasterID`, orphan accused `CaseMasterID`, invalid latitude, incident end before start, non-synthetic provenance, and missing mandatory business ID. Rejected rows must include `table`, `sourceKey`, `reasonCode`, and redacted row hash—not the full person payload.

- [ ] **Step 2: Run tests and verify failure**

Run: `node --test tests/ingestion/validate-source-seed.test.mjs`  
Expected: FAIL because the validator does not exist.

- [ ] **Step 3: Implement validation and reconciliation**

Export `validateSourceSeed(seed)` returning:

```js
{
  accepted,
  rejected,
  reconciliation: { sourceRows, acceptedRows, rejectedRows, balanced }
}
```

No rejected row may appear in `accepted`.

- [ ] **Step 4: Run tests**

Run: `node --test tests/ingestion/validate-source-seed.test.mjs`  
Expected: all positive and negative cases pass.

- [ ] **Step 5: Commit**

```powershell
git add src/ingestion/validate-source-seed.mjs tests/ingestion/validate-source-seed.test.mjs
git commit -m "feat: validate fragmented FIR extracts"
```

## Task 5: Adapt accepted PDF records into the intelligence engine

**Files:**
- Create: `src/ingestion/to-intelligence-input.mjs`
- Test: `tests/ingestion/to-intelligence-input.test.mjs`

- [ ] **Step 1: Write failing adapter tests**

Generate and validate the source seed, adapt it, and require exactly 50 canonical cases. Require case IDs, district/station, classification, gravity, incident time, coordinates, acts, sections, accused and `BriefFacts`. Run `runIntelligencePipeline()` and require the hidden evaluation to pass without the adapter importing `demo-truth.json`.

- [ ] **Step 2: Run tests and verify failure**

Run: `node --test tests/ingestion/to-intelligence-input.test.mjs`  
Expected: FAIL because the adapter does not exist.

- [ ] **Step 3: Implement the adapter**

Join by original PDF business IDs. Create canonical case IDs using the deterministic mapping from `CaseMasterID`; never match people by name. Mark coordinate/relationship completeness explicitly. Output the same `schemaVersion`, `fixtureVersion`, `asOf`, `cases`, and `weeklySeries` contract consumed by `pipeline.mjs`.

- [ ] **Step 4: Run integration tests and demo**

Run: `node --test tests/ingestion/to-intelligence-input.test.mjs`  
Expected: PASS.  
Run: `npm.cmd test`  
Expected: full suite passes.

- [ ] **Step 5: Commit**

```powershell
git add src/ingestion/to-intelligence-input.mjs tests/ingestion/to-intelligence-input.test.mjs
git commit -m "feat: bridge FIR schema to intelligence engine"
```

## Task 6: Generate Catalyst console runbook for the 19 new tables

**Files:**
- Create: `scripts/schema/generate-intelligence-runbook.mjs`
- Create: `docs/runbooks/catalyst-intelligence-tables.md`
- Test: `tests/schema/intelligence-runbook.test.mjs`
- Modify: `package.json`

- [ ] **Step 1: Write failing deterministic-runbook test**

Require creation order, every table/column, mandatory/unique/index/PII settings, every foreign-key parent and `On Delete = Null`, post-creation verification checklist, and an explicit Development-only warning.

- [ ] **Step 2: Verify failure**

Run: `node --test tests/schema/intelligence-runbook.test.mjs`  
Expected: FAIL.

- [ ] **Step 3: Implement generator and runbook**

The generator reads only `intelligence-schema.json`; no table definition may be duplicated in code. Add `intelligence-schema:runbook` to `package.json`.

- [ ] **Step 4: Generate and test**

Run: `npm.cmd run intelligence-schema:runbook`  
Expected: runbook generated.  
Run: `node --test tests/schema/intelligence-runbook.test.mjs`  
Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add scripts/schema/generate-intelligence-runbook.mjs docs/runbooks/catalyst-intelligence-tables.md tests/schema/intelligence-runbook.test.mjs package.json
git commit -m "docs: generate Catalyst intelligence table runbook"
```

## Task 7: Final challenge-alignment gate

**Files:**
- Create: `docs/reviews/2026-07-20-mvp-data-bridge.md`
- Modify: `docs/PROJECT_MEMORY.md`

- [ ] **Step 1: Run all verification**

```powershell
npm.cmd test
npm.cmd run schema:validate
npm.cmd run intelligence-schema:validate
npm.cmd run intelligence:demo
git diff --check
```

- [ ] **Step 2: Run the requested alignment skill gate**

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File skills/reviewing-challenge-alignment/scripts/check-required-files.ps1
```

- [ ] **Step 3: Inspect outputs**

Verify 26 PDF extracts, 50 FIRs, zero validation rejects in the clean seed, planted negative controls, 19 new table definitions, no Production mutation, and no real-person content.

- [ ] **Step 4: Write the exact review template**

Require PASS for data/schema fidelity, challenge traceability, synthetic labels, rejection observability, evidence lineage, Catalyst-native design, and scope control. A WARN or FAIL blocks remote table creation.

- [ ] **Step 5: Update memory and commit**

```powershell
git add docs/reviews/2026-07-20-mvp-data-bridge.md docs/PROJECT_MEMORY.md
git commit -m "docs: verify MVP data bridge"
```

## Plan self-review

- Scope is limited to the contract, synthetic source bridge, lean table schema, and runbook.
- Remote Catalyst mutation, Functions, APIs, Authentication, UI, QuickML, and Production remain separate gated work.
- All generated source entities preserve PDF names; Catalyst references are populated only after parent `ROWID` values exist.
- No placeholder or unspecified implementation step remains.
- The adapter consumes accepted data only and cannot read evaluation truth.


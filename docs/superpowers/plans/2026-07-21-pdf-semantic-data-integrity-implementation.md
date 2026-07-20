# PDF Semantic Data Integrity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace structural-only PDF alignment with tested semantic alignment across all 26 FIR entities, then safely reload the single corrected synthetic batch into Catalyst Development.

**Architecture:** A machine-readable PDF semantic contract drives pre-write validation while focused generator helpers produce deterministic compliant values. A separate, visibly synthetic identity-authority fixture supplies cross-case identity evidence without misusing `Accused.PersonID`; Catalyst projection receives an independent chronology gate. Remote correction uses an inspect-first, exact-batch, Development-only reset runbook and requires explicit approval before deletion.

**Tech Stack:** Node.js 18/24 ESM, `node:test`, Catalyst Serverless Functions, Catalyst Data Store, Catalyst Job Scheduling, ZCQL Console, JSON contracts.

---

## File map

- Create `schema/catalyst/pdf-semantic-contract.json`: stable PDF rule IDs and documented assumptions.
- Create `fixtures/intelligence/synthetic-identity-authority.json`: synthetic-only cross-case identity evidence, separate from PDF extracts.
- Create `src/ingestion/pdf-semantic-rules.mjs`: contract loader and reusable semantic rule functions.
- Modify `src/synthetic/source-seed.mjs`: compliant identifiers, times, enums, indicators, hierarchy values, and appearance ordering.
- Modify `src/ingestion/validate-source-seed.mjs`: generic and entity-specific semantic enforcement.
- Modify `src/ingestion/to-intelligence-input.mjs`: consume governed identity authority instead of `Accused.PersonID` as identity.
- Modify `scripts/catalyst/source-row-projector.mjs`: Asia/Kolkata projection and projected chronology validation.
- Modify `src/backend/refresh/refresh-service.mjs`: reject a synthetic bootstrap containing any invalid source row.
- Modify `scripts/catalyst/build-functions.mjs`: materialize semantic contract and identity authority in both required bundles.
- Create `scripts/catalyst/generate-development-batch-reset-runbook.mjs`: deterministic inspect/delete/verify ZCQL runbook generation; never executes deletion.
- Add or modify focused tests under `tests/ingestion`, `tests/synthetic`, `tests/catalyst`, `tests/backend`, and `tests/schema`.
- Update `docs/KSP DEVELOPMENT TEAM FYI.md`, `docs/PROJECT_MEMORY.md`, deployment ledger, and challenge review with verified evidence.

### Task 1: Lock the semantic contract

**Files:**
- Create: `schema/catalyst/pdf-semantic-contract.json`
- Create: `src/ingestion/pdf-semantic-rules.mjs`
- Create: `tests/ingestion/pdf-semantic-rules.test.mjs`
- Modify: `scripts/catalyst/build-functions.mjs`

- [ ] **Step 1: Write the failing contract test**

```js
test('semantic contract covers every PDF entity and stable rule id', () => {
  assert.deepEqual(Object.keys(contract.entities), Object.keys(pdfContract.tables));
  const rules = Object.values(contract.entities).flatMap(entity => entity.rules);
  assert.equal(rules.length > 26, true);
  assert.equal(new Set(rules.map(rule => rule.id)).size, rules.length);
  assert.equal(rules.every(rule => /^PDF-[A-Z0-9-]+$/u.test(rule.id)), true);
});
```

- [ ] **Step 2: Run the test and observe RED**

Run: `node --test tests/ingestion/pdf-semantic-rules.test.mjs`  
Expected: FAIL because the contract and loader do not exist.

- [ ] **Step 3: Add the contract and loader**

The contract must include these exact high-risk rules and entity entries for all remaining PDF tables:

```json
{
  "contractVersion": "1.0.0",
  "sourceDocument": "Police_FIR_ER_Diagram.pdf",
  "timezone": "Asia/Kolkata",
  "entities": {
    "CaseMaster": {
      "rules": [
        {"id":"PDF-CASE-CRIME-NO","page":1,"kind":"crime_number","fields":["CrimeNo","CaseCategoryID","PoliceStationID","CrimeRegisteredDate"]},
        {"id":"PDF-CASE-CASE-NO","page":1,"kind":"case_number","fields":["CaseNo","CrimeNo"]},
        {"id":"PDF-CASE-CHRONOLOGY","page":2,"kind":"chronology","fields":["IncidentFromDate","IncidentToDate","InfoReceivedPSDate"]}
      ]
    },
    "Accused": {"rules":[{"id":"PDF-ACCUSED-ORDER","page":3,"kind":"pattern","field":"PersonID","pattern":"^A[1-9][0-9]*$"}]},
    "Victim": {"rules":[{"id":"PDF-VICTIM-POLICE","page":2,"kind":"allowed_values","field":"VictimPolice","values":["0","1"]}]},
    "ChargesheetDetails": {"rules":[{"id":"PDF-CS-TYPE","page":7,"kind":"allowed_values","field":"cstype","values":["A","B","C"]}]}
  }
}
```

`pdf-semantic-rules.mjs` must export `semanticContract`, `formatKarnatakaDateTime`, `parseInstant`, `buildCrimeIdentity`, and `validateSemanticSeed`. `buildCrimeIdentity` receives explicit category, district, station, year, and serial values and returns frozen `CrimeNo`/`CaseNo` strings.

- [ ] **Step 4: Materialize non-imported JSON assets**

Update both Function bundle branches to copy:

```js
materializeFile({
  repositoryRoot, appRoot,
  sourcePath: 'schema/catalyst/pdf-semantic-contract.json',
  destinationPath: 'schema/pdf-semantic-contract.json',
});
```

- [ ] **Step 5: Run focused tests GREEN**

Run: `node --test tests/ingestion/pdf-semantic-rules.test.mjs tests/catalyst/bundle.test.mjs`  
Expected: PASS with all 26 entity keys and both bundles containing the semantic contract.

- [ ] **Step 6: Commit**

```bash
git add schema/catalyst/pdf-semantic-contract.json src/ingestion/pdf-semantic-rules.mjs tests/ingestion/pdf-semantic-rules.test.mjs scripts/catalyst/build-functions.mjs
git commit -m "feat: add PDF semantic source contract"
```

### Task 2: Generate compliant values for all 26 entities

**Files:**
- Modify: `src/synthetic/source-seed.mjs`
- Modify: `tests/synthetic/source-seed.test.mjs`

- [ ] **Step 1: Add failing identifier and value tests**

```js
test('all FIR identifiers implement the PDF station-scoped format', () => {
  const { tables } = generateSourceSeed(20260720);
  const districtByStation = new Map(tables.Unit.map(row => [row.UnitID, row.DistrictID]));
  for (const row of tables.CaseMaster) {
    assert.match(row.CrimeNo, /^\d{18}$/u);
    assert.match(row.CaseNo, /^\d{9}$/u);
    assert.equal(row.CaseNo, row.CrimeNo.slice(-9));
    assert.equal(row.CrimeNo.slice(1, 5), String(districtByStation.get(row.PoliceStationID)).padStart(4, '0'));
    assert.equal(row.CrimeNo.slice(5, 9), String(row.PoliceStationID).padStart(4, '0'));
    assert.equal(row.CrimeNo.slice(9, 13), row.CrimeRegisteredDate.slice(0, 4));
  }
});

test('PDF enums, indicators and accused ordering are preserved', () => {
  const { tables } = generateSourceSeed(20260720);
  assert.deepEqual(new Set(tables.ChargesheetDetails.map(row => row.cstype)), new Set(['A']));
  assert.equal(tables.Victim.every(row => ['0', '1'].includes(row.VictimPolice)), true);
  const accusedByCase = new Map();
  for (const row of tables.Accused) accusedByCase.set(row.CaseMasterID, [...(accusedByCase.get(row.CaseMasterID) ?? []), row]);
  for (const rows of accusedByCase.values()) {
    assert.deepEqual(rows.map(row => row.PersonID), rows.map((_, index) => `A${index + 1}`));
  }
});
```

- [ ] **Step 2: Run and observe RED**

Run: `node --test tests/synthetic/source-seed.test.mjs`  
Expected: FAIL on `SYN-KSP-*`, `SYN-*`, `SYNTHETIC_FINAL`, `N`, and cross-case `PERSON-*` values.

- [ ] **Step 3: Implement deterministic scoped serials and local time**

Use a `Map` keyed by `CaseCategoryID|DistrictID|PoliceStationID|year`. Sort canonical cases by incident instant then case ID before incrementing. Normalize every generated DateTime through:

```js
const IST_OFFSET_MS = 330 * 60 * 1000;
const formatKarnatakaInstant = value => {
  const shifted = new Date(new Date(value).valueOf() + IST_OFFSET_MS);
  return `${shifted.toISOString().slice(0, 19)}+05:30`;
};
const plusHours = (value, hours) => formatKarnatakaInstant(
  new Date(new Date(value).valueOf() + hours * 3_600_000),
);
```

Generate `CrimeNo`, `CaseNo`, `PersonID`, `VictimPolice`, `cstype`, `CaseCategory.LookupValue`, and `UnitType.CityDistState` from the approved contract. Align registering and charge-sheet officers with the case station unless a documented cross-unit assignment is explicitly planted.

- [ ] **Step 4: Run seed and existing intelligence bridge tests GREEN**

Run: `node --test tests/synthetic/source-seed.test.mjs tests/ingestion/to-intelligence-input.test.mjs`  
Expected: PASS with 50 unique compliant FIRs and unchanged planted spatial/temporal controls.

- [ ] **Step 5: Commit**

```bash
git add src/synthetic/source-seed.mjs tests/synthetic/source-seed.test.mjs
git commit -m "fix: generate PDF-compliant synthetic FIR values"
```

### Task 3: Enforce all entity semantics before persistence

**Files:**
- Modify: `src/ingestion/validate-source-seed.mjs`
- Modify: `tests/ingestion/validate-source-seed.test.mjs`
- Modify: `tests/schema/source-schema.test.mjs`

- [ ] **Step 1: Add a failing 26-entity mutation matrix**

Create one mutation per entity. The matrix must include malformed crime number, wrong case-number suffix, duplicate scoped serial, invalid incident order, `PersonID='PERSON-007'`, `VictimPolice='N'`, `cstype='SYNTHETIC_FINAL'`, orphan legal mappings, inconsistent court state/district, employee/unit mismatch, cyclic unit hierarchy, invalid boolean values, empty lookup names, and duplicate composite business keys.

```js
for (const scenario of semanticMutations) {
  test(`rejects ${scenario.ruleId}`, () => {
    const seed = structuredClone(generateSourceSeed(20260720));
    scenario.mutate(seed.tables);
    const result = validateSourceSeed(seed);
    assert.equal(result.rejected.some(row => row.reasonCode === scenario.ruleId), true);
    assert.equal(result.reconciliation.balanced, true);
  });
}
```

- [ ] **Step 2: Run and observe RED**

Run: `node --test tests/ingestion/validate-source-seed.test.mjs`  
Expected: FAIL because the current validator checks only business-key presence/duplicates, coordinates, incident range, and case orphans.

- [ ] **Step 3: Implement contract-driven validation**

Call `validateSemanticSeed({ seed, reject })` after generic business-key checks. Preserve the first stable reason per row. Build lookup maps once, validate references and hierarchy without recursion, and never include rejected payloads in results.

Add a clean-seed assertion:

```js
const result = validateSourceSeed(generateSourceSeed(20260720));
assert.deepEqual(result.reconciliation, {
  sourceRows: 411, acceptedRows: 411, rejectedRows: 0, balanced: true,
});
```

- [ ] **Step 4: Run validation suites GREEN**

Run: `node --test tests/ingestion/validate-source-seed.test.mjs tests/schema/source-schema.test.mjs`  
Expected: PASS for all 26 positive entities and every negative mutation.

- [ ] **Step 5: Commit**

```bash
git add src/ingestion/validate-source-seed.mjs tests/ingestion/validate-source-seed.test.mjs tests/schema/source-schema.test.mjs
git commit -m "feat: enforce PDF semantics before source writes"
```

### Task 4: Separate accused ordering from cross-case identity

**Files:**
- Create: `fixtures/intelligence/synthetic-identity-authority.json`
- Modify: `src/ingestion/to-intelligence-input.mjs`
- Modify: `tests/ingestion/to-intelligence-input.test.mjs`
- Modify: `tests/intelligence/identity.test.mjs`
- Modify: `scripts/catalyst/build-functions.mjs`

- [ ] **Step 1: Add failing identity-boundary tests**

```js
test('adapter never treats within-case PersonID as canonical identity', () => {
  const accepted = validateSourceSeed(generateSourceSeed(20260720)).accepted;
  const input = toIntelligenceInput(accepted);
  assert.equal(input.cases.flatMap(row => row.accused).some(row => /^A\d+$/u.test(row.personId)), false);
  assert.equal(input.cases.flatMap(row => row.accused).every(row => row.identityEvidenceLabel === 'SYNTHETIC_AUTHORITY'), true);
});
```

- [ ] **Step 2: Run and observe RED**

Run: `node --test tests/ingestion/to-intelligence-input.test.mjs tests/intelligence/identity.test.mjs`  
Expected: FAIL because the adapter currently assigns `person.PersonID` directly to `personId`.

- [ ] **Step 3: Add and consume the visible authority fixture**

The JSON contains `authorityVersion`, `syntheticOnly`, and entries keyed by `AccusedMasterID` with `canonicalPersonKey`, `resolutionStatus`, and `evidenceLabel`. The adapter fails closed if an entry is missing; only `CONFIRMED` entries become canonical IDs. Same-name negative controls receive distinct keys.

Materialize the fixture as `data/synthetic-identity-authority.json` in the refresh bundle and rewrite its source path during bundling, matching the existing synthetic input transformation.

- [ ] **Step 4: Run identity and network suites GREEN**

Run: `node --test tests/ingestion/to-intelligence-input.test.mjs tests/intelligence/identity.test.mjs tests/intelligence/network.test.mjs`  
Expected: PASS with confirmed repeat identity, distinct same-name identities, and unchanged evidence-labelled network edges.

- [ ] **Step 5: Commit**

```bash
git add fixtures/intelligence/synthetic-identity-authority.json src/ingestion/to-intelligence-input.mjs tests/ingestion/to-intelligence-input.test.mjs tests/intelligence/identity.test.mjs scripts/catalyst/build-functions.mjs
git commit -m "fix: govern synthetic repeat identity evidence"
```

### Task 5: Preserve chronology through Catalyst projection and bootstrap

**Files:**
- Modify: `scripts/catalyst/source-row-projector.mjs`
- Modify: `src/backend/refresh/refresh-service.mjs`
- Modify: `tests/catalyst/source-writer.test.mjs`
- Modify: `tests/backend/refresh.test.mjs`

- [ ] **Step 1: Add failing projection and zero-reject tests**

```js
test('projected Catalyst CaseMaster chronology remains ordered', () => {
  const projected = projector.projectAccepted({ accepted, batchKey: 'B1', batchRowId: '99', keyMap });
  for (const row of projected.find(item => item.sourceName === 'CaseMaster').records.map(item => item.row)) {
    assert.equal(row.IncidentFromDate <= row.IncidentToDate, true);
    assert.equal(row.IncidentToDate <= row.InfoReceivedPSDate, true);
  }
});
```

Add a bootstrap test that injects one semantic rejection and expects `DATA_NOT_READY` before any repository write.

- [ ] **Step 2: Run and observe RED**

Run: `node --test tests/catalyst/source-writer.test.mjs tests/backend/refresh.test.mjs`  
Expected: FAIL because projection strips offsets without converting to Karnataka time and bootstrap permits nonzero rejects.

- [ ] **Step 3: Implement projected-value and batch gates**

Convert DateTimes to Asia/Kolkata wall time before removing the offset. Validate the three projected case timestamps before `insertRows`. In `BOOTSTRAP_SYNTHETIC`, require `rejectedRows === 0` and `acceptedRows === sourceRows`.

- [ ] **Step 4: Run focused suites GREEN**

Run: `node --test tests/catalyst/source-writer.test.mjs tests/backend/refresh.test.mjs tests/catalyst/refresh-bootstrap.test.mjs`  
Expected: PASS with zero writes on invalid data.

- [ ] **Step 5: Commit**

```bash
git add scripts/catalyst/source-row-projector.mjs src/backend/refresh/refresh-service.mjs tests/catalyst/source-writer.test.mjs tests/backend/refresh.test.mjs tests/catalyst/refresh-bootstrap.test.mjs
git commit -m "fix: preserve source chronology at Catalyst boundary"
```

### Task 6: Build, verify, document, and authorize corrected deployment

**Files:**
- Modify: generated files under `functions/crime_intelligence_api/app/`
- Modify: generated files under `functions/intelligence_refresh/app/`
- Modify: `docs/KSP DEVELOPMENT TEAM FYI.md`
- Modify: `docs/PROJECT_MEMORY.md`
- Create: `docs/reviews/2026-07-21-pdf-semantic-data-integrity-implementation.md`
- Modify: `docs/deployment/catalyst-development-ledger.md`

- [ ] **Step 1: Run complete verification**

```powershell
npm.cmd test
npm.cmd run schema:validate
npm.cmd run intelligence-schema:validate
npm.cmd run intelligence:demo
npm.cmd run catalyst:build
npm.cmd run catalyst:inspect
git diff --check
```

Expected: every command exits zero; the full test count is at least 144 plus the new semantic cases; both Function bundles contain no forbidden files or unresolved imports.

- [ ] **Step 2: Run challenge alignment**

Use `skills/reviewing-challenge-alignment/SKILL.md`. The review must classify the correction as direct CH02-01 integrity work, inspect the PDF, fixture, validator, adapter, Function bundle, and observed tests, and return PASS before deployment authorization.

- [ ] **Step 3: Document corrected assumptions**

Record that `CrimeNo` and `CaseNo` are digit-only text, `PersonID` is within-case ordering, timestamps use Karnataka civil time, and confirmed cross-case identity requires a separate governed authority. Remove or qualify any earlier claim that structural tests alone proved PDF alignment.

- [ ] **Step 4: Commit implementation evidence**

```bash
git add functions docs schema src scripts tests fixtures
git commit -m "docs: verify PDF semantic integrity correction"
```

### Task 7: Produce and approve the exact Development reset

**Files:**
- Create: `scripts/catalyst/generate-development-batch-reset-runbook.mjs`
- Create: `tests/catalyst/development-batch-reset-runbook.test.mjs`
- Create: `artifacts/catalyst-development/reset-KSP-DEMO-20260720-V1.md` (ignored evidence artifact)

- [ ] **Step 1: Write the failing runbook safety test**

```js
test('reset runbook is exact-batch, reverse-order and Development-only', () => {
  const text = generateResetRunbook({ projectId: '43492000000013049', environment: 'Development', batchKey: 'KSP-DEMO-20260720-V1', batchRowId: '43492000000075002' });
  assert.match(text, /READ-ONLY DRY RUN/u);
  assert.match(text, /IsSynthetic = true/u);
  assert.equal(text.includes('TRUNCATE'), false);
  assert.equal(text.includes('Production'), false);
  assert.ok(text.indexOf('SRC_ChargesheetDetails') < text.indexOf('TRN_IngestionBatch'));
});
```

- [ ] **Step 2: Run and observe RED**

Run: `node --test tests/catalyst/development-batch-reset-runbook.test.mjs`  
Expected: FAIL because the generator does not exist.

- [ ] **Step 3: Generate inspect, delete, and verify sections**

The tool accepts only the approved project, `Development`, exact batch key, and explicit batch ROWID. It emits count queries first, reverse-load-order `DELETE` queries scoped by `SourceBatchRef`/`BatchRef`, then zero-count verification queries. It rejects wildcard identifiers, omits any command execution API, and never connects to Catalyst.

- [ ] **Step 4: Run the remote dry run only**

Use the Catalyst ZCQL Console through the authenticated browser. Record counts for all 26 source tables, `TRN_SourceKeyMap`, `TRN_RejectedRecord`, `TRN_IngestionBatch`, and all intelligence/workflow tables. Stop if any targeted row is not synthetic, any batch reference differs, or counts differ from the documented snapshot.

- [ ] **Step 5: Request explicit deletion approval**

Present the exact dry-run counts and affected tables. Do not execute a `DELETE` query until the user approves that snapshot.

- [ ] **Step 6: After approval, execute and verify cleanup**

Execute only the generated statements in order. Verify zero rows for the batch and preserve screenshots/log evidence under ignored artifacts. Add the exact action and rollback boundary to the deployment ledger.

### Task 8: Deploy, reload, and accept the corrected batch

**Files:**
- Modify: `docs/deployment/catalyst-development-ledger.md`
- Create: `docs/reviews/2026-07-21-catalyst-corrected-batch-acceptance.md`

- [ ] **Step 1: Run clean remote preflight**

Run: `npm.cmd run catalyst:preflight:remote`  
Expected: PASS for project `43492000000013049`, environment `Development`, branch `codex/catalyst-development`, synthetic-only configuration, and clean Git tree.

- [ ] **Step 2: Deploy only `intelligence_refresh`**

Run: `catalyst.cmd deploy --only functions:intelligence_refresh`  
Expected: targeted Development deployment succeeds; no table, API Gateway, schedule, or Production mutation occurs.

- [ ] **Step 3: Restore Function variables safely**

Restore and verify only the five required key names. The user enters `KSP_AUDIT_KEY`; never read, log, copy, or commit its value.

- [ ] **Step 4: Submit exactly one same-key Job**

Use `BOOTSTRAP_SYNTHETIC`, batch key `KSP-DEMO-20260720-V1`, seed `20260720`, `syntheticOnly=true`, and zero retries. Do not create a cron or a new batch key.

- [ ] **Step 5: Verify remote acceptance**

Verify 26 entities, 50 valid FIRs, exact reconciliation, zero rejects, all identifier derivations, chronology, Catalyst foreign keys, seven coherent analysis runs, and persisted findings/alerts. Run read-only queries and inspect safe logs; do not infer success from Job status alone.

- [ ] **Step 6: Record acceptance and commit**

```bash
git add docs/deployment/catalyst-development-ledger.md docs/reviews/2026-07-21-catalyst-corrected-batch-acceptance.md
git commit -m "docs: record corrected Catalyst batch acceptance"
```

Expected final state: corrected synthetic source and intelligence rows exist only in Catalyst Development; no Production resources, recurring jobs, real-person data, or unreviewed source rules exist.

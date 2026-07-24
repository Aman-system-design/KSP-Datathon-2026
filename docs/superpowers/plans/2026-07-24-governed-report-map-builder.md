# Governed Report and Map Builder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a production-shaped governed reporting platform in which authorized users can build reusable tables, charts, and operational maps from 5,200 deterministic synthetic FIRs spanning Karnataka's 31 districts, with all hotspot, anomaly, network, pattern, and risk results produced by the existing analytics pipeline.

**Architecture:** Extend the existing PDF-aligned source generator and Catalyst ingestion path instead of introducing a parallel data model. Keep the current semantic-source reporting backend as the authorization boundary, enrich its report definition contract, and compose the existing MapLibre/deck.gl map through saved governed map views. The React UI becomes a small staged builder with separate source, visualization, configuration, style, and review components; saved reports remain reusable dashboard content.

**Tech Stack:** Node.js 24, Catalyst Serverless Functions, Catalyst Data Store, React 19, Vite, Vitest, MapLibre GL, deck.gl, H3, PMTiles, Supercluster, existing semantic reporting services, existing intelligence-core algorithms.

---

## Task 1: Protect the baseline and define the statewide generation contract

**Files:**
- Modify: `tests/synthetic/source-seed.test.mjs`
- Create: `tests/synthetic/statewide-source-seed.test.mjs`
- Modify: `src/synthetic/source-seed.mjs`

- [ ] **Step 1: Record the current working tree and run focused baseline tests**

Run:

```powershell
git status --short
npm.cmd test -- --test-name-pattern="seed|report"
npm.cmd run web:test -- --run web/src/features/reports/ReportBuilder.test.jsx
```

Expected: existing tests pass; the three known unrelated working-tree files remain untouched.

- [ ] **Step 2: Write the failing statewide seed contract**

Add tests asserting that `generateSourceSeed({ seed: 20260724, caseCount: 5200 })`:

```js
assert.equal(seed.tables.CaseMaster.length, 5200);
assert.equal(seed.tables.District.length, 31);
assert.equal(new Set(seed.tables.CaseMaster.map(row => row.DistrictID)).size, 31);
assert.equal(new Set(seed.tables.CaseMaster.map(row => row.CrimeNo)).size, 5200);
assert.equal(seed.fixtureVersion, 'pdf-aligned-statewide-2.0.0');
```

Also assert determinism, all 26 PDF entities, no orphan case children, valid Karnataka coordinates, station-scoped CrimeNo sequencing, and visibly synthetic person/narrative fields.

- [ ] **Step 3: Run the new test and confirm it fails for the missing scalable API**

Run:

```powershell
node --test tests/synthetic/statewide-source-seed.test.mjs
```

Expected: FAIL because the current generator only accepts a numeric seed and always returns 50 FIRs in three districts.

- [ ] **Step 4: Refactor generation inputs without breaking the 50-case smoke fixture**

Implement a backwards-compatible input normalizer:

```js
const normalizeOptions = input => typeof input === 'number'
  ? { seed: input, caseCount: 50, profile: 'smoke' }
  : { seed: 20260720, caseCount: 50, profile: 'smoke', ...input };
```

Move the 31 district/station catalogue, deterministic random generator, offence catalogue, and planted scenario definitions into named constants in `src/synthetic/source-seed.mjs`. Preserve the existing exact 50-case output when called with `generateSourceSeed(20260720)`.

- [ ] **Step 5: Run smoke and statewide tests**

Run:

```powershell
node --test tests/synthetic/source-seed.test.mjs tests/synthetic/statewide-source-seed.test.mjs
```

Expected: PASS.

- [ ] **Step 6: Commit the generator contract**

```powershell
git add tests/synthetic/source-seed.test.mjs tests/synthetic/statewide-source-seed.test.mjs src/synthetic/source-seed.mjs
git commit -m "feat: define statewide synthetic FIR generation"
```

## Task 2: Generate 5,200 PDF-aligned FIRs with planted evidence and negative controls

**Files:**
- Modify: `src/synthetic/source-seed.mjs`
- Modify: `scripts/synthetic/generate-source-seed.mjs`
- Create: `scripts/synthetic/statewide-profile.mjs`
- Create: `tests/synthetic/statewide-scenarios.test.mjs`

- [ ] **Step 1: Write failing scenario-distribution tests**

Test that the 5,200-case profile contains:

```js
assert.ok(vehicleTheftCases.length >= 900);
assert.ok(cyberCases.length >= 700);
assert.ok(nightCases.length >= 1000);
assert.ok(seed.truth.hotspots.length >= 6);
assert.ok(seed.truth.patterns.length >= 4);
assert.ok(seed.truth.anomalies.length >= 4);
assert.ok(seed.truth.negativeControls.length >= 3);
```

Each planted finding must reference real generated CaseMasterIDs, cover more than one district where applicable, and include an explicit truth label used only by evaluation tests—not by the production algorithm.

- [ ] **Step 2: Run the scenario test and confirm failure**

Run:

```powershell
node --test tests/synthetic/statewide-scenarios.test.mjs
```

Expected: FAIL because statewide scenarios and truth metadata do not exist.

- [ ] **Step 3: Implement the deterministic statewide profile**

Create `scripts/synthetic/statewide-profile.mjs` exporting:

```js
export const STATEWIDE_CASE_COUNT = 5200;
export const STATEWIDE_SEED = 20260724;
export const STATEWIDE_OUTPUT = 'artifacts/source-seed-statewide';
```

Generate incident dates across 24 months so Median/MAD has history, distribute coordinates within deterministic district bounding boxes, create repeat identities with non-name corroboration, co-accused structures, cross-district modus-operandi patterns, hotspot clusters, seasonal controls, and ordinary unrelated cases.

- [ ] **Step 4: Keep all 26 PDF entities internally consistent**

Generate per-district Unit, Court, Employee, and station rows. Populate every case child table with PDF column names exactly as listed in `schema/catalyst/pdf-contract.json`. Continue deriving `CrimeNo` and `CaseNo` through `buildCrimeIdentity`; never synthesize display identifiers independently.

- [ ] **Step 5: Add CLI profile selection and manifest metadata**

Support:

```powershell
node scripts/synthetic/generate-source-seed.mjs --profile statewide
```

The manifest must include `caseCount`, `districtCount`, `stationCount`, `tableCount`, row counts, SHA-256 hashes, seed, fixture version, scenario counts, and `SyntheticData: true`.

- [ ] **Step 6: Generate and validate the artifacts**

Run:

```powershell
node scripts/synthetic/generate-source-seed.mjs --profile statewide
node --test tests/synthetic/*.test.mjs tests/ingestion/*.test.mjs
```

Expected: PASS and manifest reports 5,200 cases, 31 districts, and 26 tables.

- [ ] **Step 7: Commit generation code, tests, and the small manifest only**

Do not commit the large generated CSV/JSON payloads. Commit the reproducible generator and manifest contract.

```powershell
git add src/synthetic scripts/synthetic tests/synthetic .gitignore
git commit -m "feat: generate 5200 statewide synthetic FIRs"
```

## Task 3: Make Catalyst ingestion bounded, idempotent, and observable at 5,200 cases

**Files:**
- Modify: `functions/intelligence_refresh/app/src/backend/repository/catalyst/source-writer.mjs`
- Modify: `functions/intelligence_refresh/app/src/backend/refresh/refresh-service.mjs`
- Modify: `functions/intelligence_refresh/app/src/backend/repository/catalyst/catalyst-repository.mjs`
- Create: `tests/catalyst/statewide-ingestion.test.mjs`
- Modify: `docs/deployment/catalyst-development-ledger.md`

- [ ] **Step 1: Write failing tests for bounded batches and resumability**

Use an in-memory repository spy to assert:

```js
assert.ok(maximumWriteBatch <= 200);
assert.equal(result.caseCount, 5200);
assert.equal(result.duplicateBusinessKeys, 0);
assert.equal(result.checkpoint.completed, true);
```

Simulate failure after batch 7, resume with the same run key, and assert no duplicate CaseMaster business IDs.

- [ ] **Step 2: Run the ingestion test and confirm failure**

```powershell
node --test tests/catalyst/statewide-ingestion.test.mjs
```

- [ ] **Step 3: Implement chunked writes and durable run checkpoints**

Use a fixed batch size of 200 rows, an idempotency key composed from fixture version plus table name plus source primary key, and checkpoint fields `{ tableName, batchIndex, writtenRows, status }`. Log one structured progress record per completed batch; do not log person-facing content.

- [ ] **Step 4: Add data-quality gates before intelligence execution**

Reject a run if it has orphan CaseMaster references, duplicate CrimeNo values, invalid coordinates, unknown district/station relationships, or row-count drift from the manifest. Persist the validation summary with the run.

- [ ] **Step 5: Run Catalyst repository and ingestion tests**

```powershell
node --test tests/catalyst/*.test.mjs tests/ingestion/*.test.mjs
```

Expected: PASS.

- [ ] **Step 6: Rebuild function bundles and commit**

```powershell
npm.cmd run catalyst:build
npm.cmd run catalyst:inspect
git add functions/intelligence_refresh tests/catalyst docs/deployment/catalyst-development-ledger.md
git commit -m "feat: harden statewide Catalyst ingestion"
```

## Task 4: Verify the real intelligence pipeline at statewide scale

**Files:**
- Create: `scripts/intelligence/run-statewide-evaluation.mjs`
- Create: `tests/intelligence/statewide-pipeline.test.mjs`
- Modify: `scripts/intelligence/benchmark-scale.mjs`
- Modify: `packages/intelligence-core/src/pipeline.mjs` only if the failing test proves a boundedness defect

- [ ] **Step 1: Write a failing end-to-end evaluation test**

Transform the statewide PDF-aligned seed through the existing ingestion adapter and run the actual pipeline. Assert that every planted positive is discovered within the declared tolerance, negative controls are not promoted, evidence CaseMasterIDs exist, and every finding has method, confidence, limitations, model version, and run ID.

- [ ] **Step 2: Run the evaluation and capture the real failure mode**

```powershell
node --test tests/intelligence/statewide-pipeline.test.mjs
```

Expected: initially FAIL until the statewide weekly series and scenario projection are wired correctly. Do not loosen thresholds merely to turn the test green.

- [ ] **Step 3: Add the statewide evaluation CLI**

Emit machine-readable metrics:

```json
{
  "cases": 5200,
  "hotspotPrecision": 0.0,
  "hotspotRecall": 0.0,
  "patternPrecision": 0.0,
  "patternRecall": 0.0,
  "anomalyPrecision": 0.0,
  "anomalyRecall": 0.0,
  "candidateReductionRatio": 0.0,
  "elapsedMs": 0
}
```

Values must be computed from results and truth metadata, never constants.

- [ ] **Step 4: Fix only demonstrated scaling defects**

If candidate counts or runtime are unbounded, improve the existing candidate indexes or chunking. Do not replace DBSCAN, Median/MAD, Pattern Fusion, graph analytics, TF-IDF, identity resolution, or area-risk scoring with mocks.

- [ ] **Step 5: Run correctness and scale suites**

```powershell
npm.cmd run intelligence:test
node scripts/intelligence/run-statewide-evaluation.mjs
npm.cmd run intelligence:benchmark
```

Expected: all planted scenarios recovered within the declared evaluation tolerance; benchmark candidate comparisons remain below the full pair count.

- [ ] **Step 6: Commit**

```powershell
git add scripts/intelligence tests/intelligence packages/intelligence-core
git commit -m "test: verify statewide intelligence pipeline"
```

## Task 5: Extend governed report definitions without exposing raw tables

**Files:**
- Modify: `functions/crime_intelligence_api/app/src/backend/reporting/report-definition.mjs`
- Modify: `functions/crime_intelligence_api/app/src/backend/reporting/report-execution.mjs`
- Modify: `functions/crime_intelligence_api/app/src/backend/reporting/semantic-sources.mjs`
- Modify: `tests/reporting/report-definition.test.mjs`
- Modify: `tests/reporting/report-execution.test.mjs`

- [ ] **Step 1: Write failing definition tests for the approved visual grammar**

Add coverage for `number`, `table`, `bar`, `line`, and `map`; labels, legend visibility, color palette token, date range, one or two dimensions, validated filters, validated sorting, and maximum row limits. Reject raw table names, arbitrary SQL, unknown fields, unsafe style values, and maps without a governed map view.

- [ ] **Step 2: Run focused tests and confirm failure**

```powershell
node --test tests/reporting/report-definition.test.mjs tests/reporting/report-execution.test.mjs
```

- [ ] **Step 3: Extend the normalized contract**

Add a small allowlisted presentation object:

```js
presentation: {
  title: 'Vehicle theft by district',
  showLegend: true,
  palette: 'ksp-blue',
  valueFormat: 'integer'
}
```

Keep map definitions as references to a saved governed `mapViewId`; map layer data remains compiled by the geospatial service.

- [ ] **Step 4: Add human-readable semantic metadata**

Each source exposes description, freshness, eligible roles, field label, type, dimensions, aggregates, filter operators, and supported visualizations. Add a governed `cases` analytical source only if it returns disclosure-safe case projections rather than raw FIR rows.

- [ ] **Step 5: Execute table/chart definitions through existing services**

Keep authorization and scope resolution in the backend. Return a normalized result envelope with columns, items, totals, provenance, execution time, and freshness.

- [ ] **Step 6: Run reporting tests and commit**

```powershell
node --test tests/reporting/*.test.mjs tests/backend/intelligence-run-*.test.mjs
git add functions/crime_intelligence_api/app/src/backend/reporting tests/reporting
git commit -m "feat: extend governed report definitions"
```

## Task 6: Add report catalogue APIs and controlled sharing

**Files:**
- Modify: `functions/crime_intelligence_api/app/src/backend/reporting/report-service.mjs`
- Modify: `functions/crime_intelligence_api/app/src/backend/reporting/workspace-services.mjs`
- Modify: `functions/crime_intelligence_api/app/src/backend/http/dispatch.mjs`
- Modify: `tests/reporting/report-service.test.mjs`
- Modify: `tests/reporting/workspace-services.test.mjs`

- [ ] **Step 1: Write failing catalogue tests**

Cover `mine`, `shared`, `role`, and `organization` views; owner edit/delete; permitted share; forbidden cross-scope share; read-only consumer execution; report duplication; and add-to-dashboard.

- [ ] **Step 2: Implement minimal catalogue operations**

Reuse `CFG_ReportDefinition`, `CFG_ContentShare`, `CFG_Dashboard`, and `CFG_DashboardItem`. Do not add a second report store. Ensure viewers re-execute reports under their own role and geographic scope.

- [ ] **Step 3: Add HTTP routes using the existing envelope and error model**

Provide list, get, create, update, duplicate, delete, execute, share, and add-to-dashboard operations under `/v1/reports`.

- [ ] **Step 4: Run reporting and security scope tests**

```powershell
node --test tests/reporting/*.test.mjs tests/security/*.test.mjs
```

- [ ] **Step 5: Commit**

```powershell
git add functions/crime_intelligence_api/app/src/backend tests/reporting
git commit -m "feat: add governed report catalogue"
```

## Task 7: Build the report library and staged builder shell

**Files:**
- Create: `web/src/features/reports/ReportLibrary.jsx`
- Create: `web/src/features/reports/report-builder-state.js`
- Modify: `web/src/features/reports/ReportBuilder.jsx`
- Modify: `web/src/features/reports/ReportBuilder.test.jsx`
- Create: `web/src/features/reports/ReportLibrary.test.jsx`

- [ ] **Step 1: Write failing UI tests for the catalogue and five stages**

Test keyboard-accessible tabs for My, Shared, Role, and Organization; search; create report; draft restoration; five-stage navigation; disabled Review until required inputs are present; server errors rendered inline; and scope labels shown without exposing internal IDs.

- [ ] **Step 2: Run focused web tests and confirm failure**

```powershell
npm.cmd run web:test -- --run web/src/features/reports/ReportBuilder.test.jsx web/src/features/reports/ReportLibrary.test.jsx
```

- [ ] **Step 3: Implement one reducer/state module**

Use a serializable draft:

```js
{
  step: 'data',
  name: '',
  sourceKey: '',
  visualization: { type: 'table' },
  dimensions: [],
  measures: [],
  filters: [],
  sort: [],
  presentation: { showLegend: true, palette: 'ksp-blue', valueFormat: 'integer' },
  limit: 100
}
```

The reducer owns validation and resets incompatible configuration when source or visualization changes.

- [ ] **Step 4: Build the Catalyst-like library screen**

Use the approved white shell, Roboto typography, compact toolbar, a dense accessible table, status/freshness columns, owner/share indicators, and one primary `Create report` action. No oversized cards or novelty graphics.

- [ ] **Step 5: Run tests and commit**

```powershell
npm.cmd run web:test -- --run web/src/features/reports
git add web/src/features/reports
git commit -m "feat: add report library and builder workflow"
```

## Task 8: Implement separate builder stages and real previews

**Files:**
- Create: `web/src/features/reports/ReportDataStep.jsx`
- Create: `web/src/features/reports/ReportVisualizationStep.jsx`
- Create: `web/src/features/reports/ReportConfigureStep.jsx`
- Create: `web/src/features/reports/ReportStyleStep.jsx`
- Create: `web/src/features/reports/ReportReviewStep.jsx`
- Create: `web/src/features/reports/ReportPreview.jsx`
- Create: `web/src/features/reports/ReportPreview.test.jsx`
- Modify: `web/src/features/reports/ReportBuilder.jsx`

- [ ] **Step 1: Write preview tests before components**

Test number, table, bar, line, empty, loading, error, stale, and map states. The map test must render `EmbeddedMapView` with the backend execution result; it must not render a placeholder image or hardcoded coordinates.

- [ ] **Step 2: Implement the five stage components**

Each stage receives only `{ draft, source, onChange, errors }`. Keep network orchestration in `ReportBuilder.jsx`. Use native/shadcn-compatible semantic controls already present in the project; do not add a form library.

- [ ] **Step 3: Implement execute-before-save preview**

Use an authorized preview endpoint or a transient validated definition so users can inspect real results before persisting. Cancel/ignore stale responses through an incrementing request generation and show backend method/freshness provenance.

- [ ] **Step 4: Integrate the governed map**

For map visualization, select or create a saved map view, then render the existing MapLibre/deck.gl surface with layer controls, time range, clustering, zoom, legend, and drilldown. Do not duplicate the map engine in the report feature.

- [ ] **Step 5: Run focused UI tests**

```powershell
npm.cmd run web:test -- --run web/src/features/reports
```

- [ ] **Step 6: Commit**

```powershell
git add web/src/features/reports
git commit -m "feat: build governed report and map composer"
```

## Task 9: Integrate reports with role dashboards and navigation

**Files:**
- Modify: `web/src/features/dashboards/DashboardPages.jsx`
- Modify: `web/src/features/dashboards/DashboardWorkspace.jsx`
- Modify: `web/src/features/dashboards/DashboardWorkspace.test.jsx`
- Modify: `web/src/app/routes.jsx`
- Modify: `web/src/app/AppShell.jsx`

- [ ] **Step 1: Write failing journey tests**

Test that an analyst can create a map report and add it to a personal dashboard; an administrator can publish a role-default dashboard; leadership can open the report read-only; a station user sees only authorized station data; and Command Centre can open the same saved map in presentation mode.

- [ ] **Step 2: Add Reports and Dashboards navigation**

Use permission-aware routes. Preserve the approved compact header hierarchy: tenant logo, tenant name, and `Analytics · Crime · Enforcement` subtitle. The role/persona switch remains in the profile control for the MVP.

- [ ] **Step 3: Reuse report definitions as dashboard widgets**

Dashboard items reference report IDs and layout only. They do not copy analytics data. Every refresh executes the report under the viewer's scope.

- [ ] **Step 4: Run dashboard and route tests**

```powershell
npm.cmd run web:test -- --run web/src/features/dashboards web/src/app
```

- [ ] **Step 5: Commit**

```powershell
git add web/src/features/dashboards web/src/app
git commit -m "feat: connect reports to role dashboards"
```

## Task 10: Apply production-shaped responsive styling and accessibility

**Files:**
- Modify: `web/src/styles/tokens.css`
- Modify: the existing feature stylesheet containing `.builder-layout` and `.report-form`
- Modify: report component tests where accessibility assertions belong

- [ ] **Step 1: Add responsive and accessibility assertions**

Cover visible focus, labelled controls, keyboard stage navigation, no horizontal viewport overflow at 1280px, builder pane collapse below 1024px, and scroll only inside result/table regions when content exceeds the viewport.

- [ ] **Step 2: Implement the approved visual system**

Use Roboto/system sans, white surfaces, subtle blue-gray borders, KSP blue actions, compact 40px controls, 8px spacing rhythm, restrained shadows, and status colors with text/icon redundancy. Do not use the tri-color decorative line, dark WorldMonitor styling, oversized KPI tiles, or tiny 10px operational text.

- [ ] **Step 3: Verify at desktop and tablet widths**

Run the local app and browser-test at 1920×1080, 1440×900, 1280×720, and 1024×768. Capture issues in the implementation notes before fixing them.

- [ ] **Step 4: Run web tests/build and commit**

```powershell
npm.cmd run web:test
npm.cmd run web:build
git add web/src/styles web/src/features/reports
git commit -m "style: finish responsive governed analytics UI"
```

## Task 11: Full verification, challenge alignment, and release artifacts

**Files:**
- Modify: `Memory.md`
- Modify: `docs/deployment/catalyst-development-ledger.md`
- Modify: `docs/architecture/*` only where the implemented behavior differs from the current documented architecture

- [ ] **Step 1: Run the complete repository verification**

```powershell
npm.cmd run verify
npm.cmd run geospatial:verify
node scripts/intelligence/run-statewide-evaluation.mjs
```

Expected: every command exits 0. Record actual test counts, evaluation metrics, build sizes, and benchmark timings; do not report aspirational numbers.

- [ ] **Step 2: Cross-check Challenge 02 capability coverage**

Run the repository's `skills/reviewing-challenge-alignment/SKILL.md` workflow and confirm evidence for interactive dashboards, geospatial maps, hotspot detection, district drilldowns, trend/anomaly alerts, criminal networks, repeat offenders, socio-economic correlation boundary, area-risk scoring, and AI/ML pattern detection. Document any honest gap.

- [ ] **Step 3: Update durable project memory and deployment ledger**

Record the dataset version, generator command, Catalyst run IDs, model methods/versions, report builder routes, schema changes, deployment version, and known limitations. Never store passwords, tokens, or personal data.

- [ ] **Step 4: Commit verified documentation**

```powershell
git add Memory.md docs
git commit -m "docs: record statewide analytics release"
```

## Task 12: Deploy, load 5,200 FIRs, and verify the live journey

**Files:**
- Generated bundle outputs from `npm.cmd run catalyst:build`
- No source-only changes unless live verification exposes a reproducible defect

- [ ] **Step 1: Confirm Catalyst target before mutation**

Run:

```powershell
catalyst project:status
npm.cmd run catalyst:preflight:remote
```

Expected: project ID `43492000000013049`, Development environment, correct Slate client, required tables, Functions, and Authentication configuration.

- [ ] **Step 2: Deploy functions and web client**

```powershell
npm.cmd run catalyst:build
catalyst deploy
```

Record deployed component IDs and the release commit.

- [ ] **Step 3: Submit the statewide ingestion/refresh job**

Use the generated manifest and the existing authenticated job endpoint. Monitor structured logs until source validation, ingestion, feature projection, model execution, finding persistence, and alert projection complete. If a job fails, preserve its run ID, diagnose the first failing stage, fix through TDD, and resume from its checkpoint.

- [ ] **Step 4: Verify Catalyst row counts and intelligence outputs**

Confirm 5,200 CaseMaster rows, all child relationship counts, 31 districts, no duplicate CrimeNo, and persisted outputs for hotspot, anomaly, patterns, repeat identities, networks, area risk, and alerts. Compare model results with the evaluation truth report; do not manually insert findings.

- [ ] **Step 5: Browser-test the live production-shaped journey**

At `https://aiksp.onslate.in/` verify:

1. unauthenticated root opens the Catalyst sign-in screen;
2. authenticated KSP Intelligence user selects Analyst;
3. Reports opens the catalogue;
4. Create report selects a governed FIR/intelligence source;
5. Map visualization opens Karnataka with real generated layers;
6. filter/drilldown changes backend results;
7. save and add to dashboard persists;
8. switch to State Leadership and Command Centre re-executes under their scope;
9. logout returns to the root sign-in flow.

- [ ] **Step 6: Push the verified main branch**

```powershell
git status --short
git log -1 --oneline
git push origin main
```

Only push after live smoke tests and local verification both pass.

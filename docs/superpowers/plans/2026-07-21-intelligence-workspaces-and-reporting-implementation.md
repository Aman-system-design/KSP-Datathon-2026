# Intelligence Workspaces and Reporting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a tested Catalyst-backed reporting/dashboard platform and React role workspace that exposes the existing AI crime intelligence through a persistent, evidence-linked alert workflow.

**Architecture:** Extend the existing configuration/workflow schema and modular `crime_intelligence_api`; reuse governed read services through a server-owned semantic reporting registry. Add one React/Vite SPA under `web/` with feature boundaries for reports, dashboards, alerts and challenge analytics. No arbitrary query language, fake Copilot, third Function, component framework or client-side authorization layer is introduced.

**Tech Stack:** Node.js 24, native `node:test`, Catalyst Serverless/Data Store/Authentication/API Gateway/Slate, React 19.2.7, React Router 7.18.1, Vite 8.1.5, Leaflet 1.9.4, React Leaflet 5.0.0, Vitest 4.1.10, Testing Library 16.3.2.

---

## File Structure

### Backend

- Modify `schema/catalyst/intelligence-schema.json`: add five configuration and two workflow tables.
- Modify `src/backend/repository/contract.mjs`: add report/dashboard/share/preference/note/escalation methods.
- Modify `src/backend/repository/memory-repository.mjs`: deterministic repository implementation used by tests.
- Modify `src/backend/repository/catalyst/catalyst-repository.mjs`: Data Store persistence and scoped reads.
- Create `src/backend/reporting/semantic-sources.mjs`: fixed source/field/measure/filter registry.
- Create `src/backend/reporting/report-definition.mjs`: request validation and normalized definitions.
- Create `src/backend/reporting/report-service.mjs`: ownership, viewer scope, execution and deletion rules.
- Create `src/backend/reporting/dashboard-service.mjs`: dashboards, items, sharing, defaults and landing resolution.
- Create `src/backend/services/alert-services.mjs`: alert list/detail projections.
- Modify `src/backend/workflow/state-machine.mjs`: same-state note and explicit escalation transitions.
- Modify `src/backend/workflow/command-service.mjs`: note/escalation artifacts.
- Modify `src/backend/http/api-contract.mjs`: declare reporting/dashboard/alert routes.
- Modify `src/backend/http/dispatch.mjs`: dispatch validated resource and workflow operations.
- Modify `src/backend/catalyst/api-bootstrap.mjs`: compose the new services.
- Mirror backend changes into Function bundles only through `npm run catalyst:build`.

### Frontend

- Create `web/package.json`, `web/vite.config.js`, `web/index.html`.
- Create `web/src/main.jsx` and `web/src/app/*`: runtime, router, shell and access context.
- Create `web/src/api/client.js`: typed-by-contract fetch wrapper with safe errors.
- Create `web/src/features/reports/*`: library, builder and preview.
- Create `web/src/features/dashboards/*`: dashboard resolution, renderer and editor.
- Create `web/src/features/alerts/*`: persistent centre, inbox, detail and workflow actions.
- Create `web/src/features/intelligence/*`: brief, map, patterns, anomalies, risk and network projections.
- Create `web/src/components/*`: minimal accessible primitives.
- Create `web/src/styles/*`: Command Navy tokens and responsive layouts.
- Create `web/src/test/*`: controlled API fixtures and setup used only by tests.

### Tests and docs

- Add backend tests under `tests/reporting/`, `tests/backend/` and `tests/schema/`.
- Add frontend tests beside features as `*.test.jsx`.
- Modify root `package.json`, `Architecture.md`, `PRD.md`, `Phases.md`, and `docs/PROJECT_MEMORY.md` after observed completion.

## Task 1: Configuration and Workflow Schema

**Files:**
- Modify: `schema/catalyst/intelligence-schema.json`
- Modify: `tests/schema/intelligence-schema.test.mjs`
- Create: `tests/schema/reporting-schema.test.mjs`

- [ ] **Step 1: Write failing schema tests**

Assert exactly these additions and relationships:

```js
const expected = [
  'CFG_ReportDefinition', 'CFG_Dashboard', 'CFG_DashboardItem',
  'CFG_ContentShare', 'CFG_UserPreference', 'WF_AlertNote', 'WF_Escalation',
];
assert.deepEqual(expected.filter(name => !byName.has(name)), []);
assert.equal(byName.get('CFG_DashboardItem').columns.find(c => c.name === 'DashboardRef').parentTable, 'CFG_Dashboard');
assert.equal(byName.get('CFG_DashboardItem').columns.find(c => c.name === 'ReportRef').parentTable, 'CFG_ReportDefinition');
assert.equal(byName.get('WF_AlertNote').columns.find(c => c.name === 'AlertRef').parentTable, 'WF_Alert');
assert.equal(byName.get('WF_Escalation').columns.find(c => c.name === 'AlertRef').parentTable, 'WF_Alert');
```

- [ ] **Step 2: Run the focused test and confirm failure**

Run: `node --test tests/schema/reporting-schema.test.mjs`

Expected: FAIL because the seven tables do not exist.

- [ ] **Step 3: Add the minimal table definitions**

Use application IDs, ownership, optimistic versions and fixed JSON configuration fields. `CFG_ContentShare` has exactly one populated target among `TargetUserID`, `TargetRole`, and `TargetUnitID`. `WF_AlertNote` and `WF_Escalation` reference both `WF_Alert` and `WF_Command`; escalation records target unit, priority and reason.

- [ ] **Step 4: Validate focused and complete schema tests**

Run: `node --test tests/schema/reporting-schema.test.mjs tests/schema/intelligence-schema.test.mjs`

Expected: PASS with no schema validation errors.

- [ ] **Step 5: Commit**

```powershell
git add schema/catalyst/intelligence-schema.json tests/schema/reporting-schema.test.mjs tests/schema/intelligence-schema.test.mjs
git commit -m "feat(schema): add reporting configuration"
```

## Task 2: Semantic Reporting Contract

**Files:**
- Create: `src/backend/reporting/semantic-sources.mjs`
- Create: `src/backend/reporting/report-definition.mjs`
- Create: `tests/reporting/report-definition.test.mjs`

- [ ] **Step 1: Write failing contract tests**

Cover all seven initial sources, immutable registry output, rejected raw table/field/ZCQL input, bounded periods, permitted visualization types, duplicate dimensions, unsupported aggregation, and normalized sort/limit.

```js
const definition = normalizeReportDefinition({
  name: 'District anomaly trend', sourceKey: 'anomalies',
  dimensions: ['unitId', 'period'], measures: [{ field: 'observed', aggregate: 'sum' }],
  filters: [{ field: 'severity', operator: 'gte', value: 0.5 }],
  visualization: { type: 'line' }, limit: 100,
}, anomalySource);
assert.equal(definition.sourceKey, 'anomalies');
assert.equal(definition.limit, 100);
assert.throws(() => normalizeReportDefinition({ sourceKey: 'SRC_CaseMaster' }, anomalySource), /invalid/i);
```

- [ ] **Step 2: Confirm tests fail**

Run: `node --test tests/reporting/report-definition.test.mjs`

Expected: FAIL because reporting modules are absent.

- [ ] **Step 3: Implement fixed semantic sources and normalization**

Export `REPORT_SOURCES`, `getReportSource(sourceKey)` and `normalizeReportDefinition(input, source)`. Source executors name existing governed service operations; definitions never contain functions, table names or query fragments.

- [ ] **Step 4: Run focused tests**

Run: `node --test tests/reporting/report-definition.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/backend/reporting tests/reporting/report-definition.test.mjs
git commit -m "feat(reporting): define governed sources"
```

## Task 3: Reporting and Dashboard Domain Services

**Files:**
- Modify: `src/backend/repository/contract.mjs`
- Modify: `src/backend/repository/memory-repository.mjs`
- Create: `src/backend/reporting/report-service.mjs`
- Create: `src/backend/reporting/dashboard-service.mjs`
- Create: `tests/reporting/report-service.test.mjs`
- Create: `tests/reporting/dashboard-service.test.mjs`

- [ ] **Step 1: Write failing domain tests**

Tests must demonstrate:

- owner create/update/delete with expected version;
- viewer execution uses viewer `authorizedUnitIds`, never owner scope;
- personal content is invisible to others;
- user/role/unit sharing exposes configuration but not hidden data;
- only administrator permission publishes global content or sets a role default;
- report deletion is blocked while referenced;
- dashboard items validate the 12-column bounded grid;
- personal landing overrides role default without modifying the role dashboard;
- stale updates return `VERSION_CONFLICT`.

- [ ] **Step 2: Confirm focused failures**

Run: `node --test tests/reporting/report-service.test.mjs tests/reporting/dashboard-service.test.mjs`

Expected: FAIL because services and repository methods are missing.

- [ ] **Step 3: Implement repository and services**

Add repository methods for definitions, dashboards, items, shares and preferences. Services accept `{ access, actor, now, idFactory }`, validate permissions before repository access, and return cloned DTOs without Catalyst metadata.

- [ ] **Step 4: Run focused tests**

Run: `node --test tests/reporting/report-service.test.mjs tests/reporting/dashboard-service.test.mjs tests/backend/repository.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/backend/repository src/backend/reporting tests/reporting tests/backend/repository.test.mjs
git commit -m "feat(reporting): persist reports and dashboards"
```

## Task 4: Alert Discovery, Notes and Escalation

**Files:**
- Create: `src/backend/services/alert-services.mjs`
- Modify: `src/backend/workflow/state-machine.mjs`
- Modify: `src/backend/workflow/command-service.mjs`
- Modify: `src/backend/repository/memory-repository.mjs`
- Create: `tests/backend/alert-services.test.mjs`
- Modify: `tests/backend/workflow.test.mjs`

- [ ] **Step 1: Write failing alert tests**

Prove list filtering, geographic redaction, complete explanation fields, authorized case evidence, note append without finding mutation, escalation only to an authorized parent/higher unit, required reason/priority, optimistic concurrency, idempotent retry and audit completion.

```js
const detail = await alerts.getAlertDetail({ access: districtAccess, params: { alertId: 'ALERT-1' } });
assert.equal(detail.data.syntheticData, true);
assert.ok(detail.data.explanation.methodVersion);
assert.ok(Array.isArray(detail.data.evidence));
assert.equal(detail.data.originalFinding.status, 'IMMUTABLE');
```

- [ ] **Step 2: Confirm tests fail**

Run: `node --test tests/backend/alert-services.test.mjs tests/backend/workflow.test.mjs`

Expected: FAIL for absent alert services and command types.

- [ ] **Step 3: Implement alert services and workflow artifacts**

Add `NOTE` as a same-state versioned command for non-closed alerts and `ESCALATE` as a versioned assignment to a verified parent/higher unit. Extend artifact reconciliation and audit hashing; never edit `OriginalFindingJSON`.

- [ ] **Step 4: Run focused tests**

Run: `node --test tests/backend/alert-services.test.mjs tests/backend/workflow.test.mjs tests/backend/repository.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/backend/services/alert-services.mjs src/backend/workflow src/backend/repository/memory-repository.mjs tests/backend
git commit -m "feat(alerts): add discovery and escalation"
```

## Task 5: HTTP Contract and Catalyst Repository

**Files:**
- Modify: `src/backend/http/api-contract.mjs`
- Modify: `src/backend/http/dispatch.mjs`
- Modify: `src/backend/catalyst/api-bootstrap.mjs`
- Modify: `src/backend/repository/catalyst/catalyst-repository.mjs`
- Modify: `tests/backend/api-contract.test.mjs`
- Modify: `tests/backend/dispatcher.test.mjs`
- Create: `tests/catalyst/reporting-repository.test.mjs`
- Modify: `tests/catalyst/api-bootstrap.test.mjs`

- [ ] **Step 1: Write failing API/repository tests**

Declare exactly the routes from the approved design. Verify strict bodies, safe codes, pagination, viewer scope, idempotency on mutations, Catalyst metadata stripping, fixed table names, parent-first writes and compare-and-swap updates.

- [ ] **Step 2: Confirm failures**

Run: `node --test tests/backend/api-contract.test.mjs tests/backend/dispatcher.test.mjs tests/catalyst/reporting-repository.test.mjs tests/catalyst/api-bootstrap.test.mjs`

Expected: FAIL because the new routes/repository methods are absent.

- [ ] **Step 3: Implement routing and Catalyst persistence**

Extend operations with `kind: 'read' | 'resource' | 'workflow'`. Preserve the existing read/workflow paths. Resource handlers receive normalized route params, query, body, access and actor; dispatcher maps `VERSION_CONFLICT` to 409 and `RESOURCE_IN_USE` to 409.

- [ ] **Step 4: Run focused and integration tests**

Run: `node --test tests/backend/api-contract.test.mjs tests/backend/dispatcher.test.mjs tests/catalyst/reporting-repository.test.mjs tests/catalyst/api-bootstrap.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/backend/http src/backend/catalyst src/backend/repository/catalyst tests/backend tests/catalyst
git commit -m "feat(api): expose reporting workspaces"
```

## Task 6: Function Bundle and Root Workspace

**Files:**
- Modify: `scripts/catalyst/build-functions.mjs`
- Modify: `tests/catalyst/bundle.test.mjs`
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `web/package.json`

- [ ] **Step 1: Write failing bundle/workspace assertions**

Assert the API bundle includes reporting/services/schema assets, excludes tests, and root scripts expose `web:dev`, `web:test`, `web:build` and `verify`.

- [ ] **Step 2: Confirm failure**

Run: `node --test tests/catalyst/bundle.test.mjs`

Expected: FAIL until bundle inventory and workspace scripts change.

- [ ] **Step 3: Add the web workspace and install only approved dependencies**

Run:

```powershell
npm.cmd install --workspace web react@19.2.7 react-dom@19.2.7 react-router-dom@7.18.1 leaflet@1.9.4 react-leaflet@5.0.0
npm.cmd install --workspace web --save-dev vite@8.1.5 @vitejs/plugin-react@6.0.3 vitest@4.1.10 @testing-library/react@16.3.2 @testing-library/jest-dom@7.0.0 jsdom@29.1.1
```

- [ ] **Step 4: Build and inspect Functions**

Run: `npm.cmd run catalyst:build`

Expected: both deterministic Function bundles build and include reporting modules.

- [ ] **Step 5: Run bundle tests and commit**

Run: `node --test tests/catalyst/bundle.test.mjs`

Expected: PASS.

```powershell
git add package.json package-lock.json web/package.json scripts/catalyst/build-functions.mjs tests/catalyst/bundle.test.mjs functions
git commit -m "build: add React workspace"
```

## Task 7: React Foundation and API Client

**Files:**
- Create: `web/index.html`
- Create: `web/vite.config.js`
- Create: `web/src/main.jsx`
- Create: `web/src/app/router.jsx`
- Create: `web/src/app/AppShell.jsx`
- Create: `web/src/app/runtime.js`
- Create: `web/src/api/client.js`
- Create: `web/src/styles/tokens.css`
- Create: `web/src/styles/app.css`
- Create: `web/src/test/setup.js`
- Create: `web/src/app/AppShell.test.jsx`
- Create: `web/src/api/client.test.js`

- [ ] **Step 1: Write failing shell/client tests**

Test safe runtime parsing, credentialed requests, stable error DTOs, role/access display, navigation, dashboard switcher, synthetic/freshness status and Alert Centre trigger. Reject missing API base outside test mode.

- [ ] **Step 2: Confirm failure**

Run: `npm.cmd run web:test -- --run`

Expected: FAIL because the SPA does not exist.

- [ ] **Step 3: Implement minimal accessible shell**

Use BrowserRouter, semantic navigation/main/aside, native buttons/forms/dialog behavior, Command Navy CSS variables, responsive grid and visible focus. No component or global-state library.

- [ ] **Step 4: Run test and build**

Run: `npm.cmd run web:test -- --run`

Expected: PASS.

Run: `npm.cmd run web:build`

Expected: Vite production build succeeds.

- [ ] **Step 5: Commit**

```powershell
git add web package.json package-lock.json
git commit -m "feat(web): add role workspace shell"
```

## Task 8: Report Builder and Dashboard Workspace

**Files:**
- Create: `web/src/features/reports/ReportLibrary.jsx`
- Create: `web/src/features/reports/ReportBuilder.jsx`
- Create: `web/src/features/reports/ReportView.jsx`
- Create: `web/src/features/reports/report-model.js`
- Create: `web/src/features/dashboards/DashboardWorkspace.jsx`
- Create: `web/src/features/dashboards/DashboardEditor.jsx`
- Create: `web/src/features/dashboards/ReportWidget.jsx`
- Create: `web/src/features/reports/ReportBuilder.test.jsx`
- Create: `web/src/features/dashboards/DashboardWorkspace.test.jsx`

- [ ] **Step 1: Write failing end-to-end component tests**

Use mocked HTTP only at the fetch boundary. Prove source/field/filter/visualization selection, preview, save, share, add/remove, grid move/resize, personal landing selection, role/global badges, independent widget failures and reload persistence.

- [ ] **Step 2: Confirm failure**

Run: `npm.cmd run web:test -- --run ReportBuilder DashboardWorkspace`

Expected: FAIL because feature components are absent.

- [ ] **Step 3: Implement practical builder and bounded dashboard grid**

Use native form controls and CSS Grid. Move/resize uses explicit keyboard-accessible controls plus pointer buttons; drag-and-drop is not required for acceptance. ReportWidget renders number/table/bar/line/map from the governed report envelope and always exposes the configured drilldown link.

- [ ] **Step 4: Run focused tests and build**

Run: `npm.cmd run web:test -- --run ReportBuilder DashboardWorkspace`

Expected: PASS.

Run: `npm.cmd run web:build`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add web/src/features/reports web/src/features/dashboards web/src/app/router.jsx
git commit -m "feat(web): add reports and dashboards"
```

## Task 9: Alert Centre and Challenge Intelligence Views

**Files:**
- Create: `web/src/features/alerts/AlertCentre.jsx`
- Create: `web/src/features/alerts/AlertInbox.jsx`
- Create: `web/src/features/alerts/AlertDetail.jsx`
- Create: `web/src/features/alerts/AlertActions.jsx`
- Create: `web/src/features/intelligence/LeadershipView.jsx`
- Create: `web/src/features/intelligence/HotspotMap.jsx`
- Create: `web/src/features/intelligence/PatternDetail.jsx`
- Create: `web/src/features/intelligence/NetworkView.jsx`
- Create: `web/src/features/intelligence/TrendView.jsx`
- Create: `web/src/features/alerts/AlertJourney.test.jsx`
- Create: `web/src/features/intelligence/IntelligenceViews.test.jsx`

- [ ] **Step 1: Write failing alert/intelligence tests**

Verify Alert Centre appears on every route; filters and safe counts work; detail exposes method, period, confidence, quality, limitations and evidence; map/network/timeline agree on selected pattern; note/escalate/assign/acknowledge/conclude/outcome send expected versions and idempotency keys; conflict retains draft and offers reload.

- [ ] **Step 2: Confirm failures**

Run: `npm.cmd run web:test -- --run AlertJourney IntelligenceViews`

Expected: FAIL because features are absent.

- [ ] **Step 3: Implement governed views**

Use React Leaflet only for real coordinates and OpenStreetMap tiles with attribution. Use native SVG for compact bars/lines/network; every graphic has a text/table alternative. Do not display a relationship as guilt or a risk as person prediction.

- [ ] **Step 4: Run focused/full frontend verification**

Run: `npm.cmd run web:test -- --run`

Expected: all frontend tests pass.

Run: `npm.cmd run web:build`

Expected: production build succeeds.

- [ ] **Step 5: Commit**

```powershell
git add web/src/features/alerts web/src/features/intelligence web/src/app
git commit -m "feat(web): expose actionable intelligence"
```

## Task 10: Integration, Documentation and Quality Gates

**Files:**
- Modify: `Architecture.md`
- Modify: `PRD.md`
- Modify: `Phases.md`
- Modify: `docs/PROJECT_MEMORY.md`
- Create: `docs/reviews/2026-07-21-intelligence-workspaces-and-reporting-implementation.md`

- [ ] **Step 1: Run the complete local verification**

Run:

```powershell
npm.cmd test
npm.cmd run web:test -- --run
npm.cmd run web:build
npm.cmd run catalyst:build
npm.cmd run catalyst:inspect
npm.cmd run schema:validate
npm.cmd run intelligence-schema:validate
```

Expected: every command exits 0; no suite is skipped.

- [ ] **Step 2: Run challenge-alignment and defect reviews**

Run the required-files script, review the complete branch diff, inspect every new route and authorization path, and write the review using the challenge template. Review-agent output must be `No findings.` or all findings must be fixed and reverified.

- [ ] **Step 3: Update truth documents from observed evidence**

Record exact test/build counts, implemented routes, remaining deferrals and Catalyst Development deployment state. Do not claim remote deployment until separately approved and observed.

- [ ] **Step 4: Commit verified implementation**

```powershell
git add Architecture.md PRD.md Phases.md docs/PROJECT_MEMORY.md docs/reviews/2026-07-21-intelligence-workspaces-and-reporting-implementation.md
git commit -m "docs: verify intelligence workspaces"
```

- [ ] **Step 5: Request explicit Catalyst deployment approval**

Do not mutate Catalyst or push/merge until the user approves the reviewed local implementation and deployment target.

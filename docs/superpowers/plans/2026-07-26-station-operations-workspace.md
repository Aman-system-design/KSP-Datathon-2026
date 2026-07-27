# Station Operations Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a premium, interactive, station-scoped operations dashboard with editable reports, open/ageing case analysis, and governed full case detail.

**Architecture:** Add a narrowly projected station-case repository/service boundary and expose it through the existing report engine and one read-only case endpoint. Reuse the Command Centre dashboard controller and report renderers behind a Station Operations shell, with local cross-report selection state and the existing persisted layout API. Build the role-default dashboard from real report definitions; never seed visible metric values in the browser.

**Tech Stack:** Node.js ESM services and `node:test`; Catalyst Data Store repository; React 19, React Router, Vitest, Testing Library, Lucide, existing ACE CSS tokens and report renderers.

---

## File map

- `src/backend/cases/station-case-service.mjs`: approved case projection, ageing derivation, list/detail scope enforcement.
- `src/backend/repository/memory-repository.mjs`: synthetic source-case reads for tests and local runtime.
- `src/backend/repository/catalyst/catalyst-repository.mjs`: Catalyst source-table case reads and master-data joins.
- `src/backend/reporting/semantic-sources.mjs`: station-case report contract.
- `src/backend/reporting/report-execution.mjs`: projection of case envelopes into report rows.
- `src/backend/reporting/workspace-services.mjs`: case resource methods and station display metadata.
- `src/backend/http/api-contract.mjs`: governed case routes.
- `src/backend/catalyst/api-bootstrap.mjs`: service composition.
- `web/src/features/station-operations/station-dashboard-template.js`: default report definitions and layout.
- `web/src/features/station-operations/StationOperationsShell.jsx`: station page composition and interactive filter state.
- `web/src/features/station-operations/StationCaseTable.jsx`: case workload table and navigation.
- `web/src/features/station-operations/StationCaseDetail.jsx`: read-only full case page.
- `web/src/features/station-operations/station-operations.css`: Catalyst-inspired station-specific layout and responsive states.
- `web/src/features/command-center/CommandCenterReportSurface.jsx`: reuse full report renderers and report-selection callback.
- `web/src/features/command-center/useCommandCenterDashboard.js`: optional dashboard-item filter execution input.
- `web/src/app/router.jsx`: Station Operations shell and case-detail routes.
- `web/src/app/workspace-navigation.js`: restore Reports for Station Operations.
- `tests/cases/station-case-service.test.mjs`: backend projection, ageing, and authorization.
- `tests/reporting/station-case-reports.test.mjs`: report-source execution.
- `web/src/features/station-operations/*.test.jsx`: station interactions and detail rendering.

The root `src` tree is authoritative. `npm run catalyst:build` copies verified backend code into `functions/crime_intelligence_api/app`; do not hand-edit both trees.

### Task 1: Governed station-case domain service

**Files:**
- Create: `src/backend/cases/station-case-service.mjs`
- Modify: `src/backend/repository/memory-repository.mjs`
- Test: `tests/cases/station-case-service.test.mjs`

- [ ] **Step 1: Write failing scope and ageing tests**

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import { createStationCaseService } from '../../src/backend/cases/station-case-service.mjs';

const rows = [
  { caseId: 'CASE-1', caseNumber: '01/2026', unitId: 1001, status: 'Under Investigation', registeredAt: '2026-07-20T00:00:00Z', incidentAt: '2026-07-19T22:00:00Z', majorHead: 'Theft', minorHead: 'Vehicle Theft', syntheticData: true },
  { caseId: 'CASE-2', caseNumber: '02/2026', unitId: 2001, status: 'Under Investigation', registeredAt: '2026-04-01T00:00:00Z', incidentAt: '2026-04-01T00:00:00Z', majorHead: 'Property', minorHead: 'Burglary', syntheticData: true },
];
const repository = { async listStationCaseRows() { return rows; }, async getStationCaseRow(id) { return rows.find(row => row.caseId === id); } };
const service = createStationCaseService({ repository, now: () => new Date('2026-07-26T00:00:00Z') });
const access = { scopeUnitId: 1001, authorizedUnitIds: new Set([1001]) };

test('station case list returns only authorized units with deterministic ageing', async () => {
  const result = await service.list({ access, query: {} });
  assert.deepEqual(result.data.items.map(({ caseId, ageDays, ageingBucket }) => ({ caseId, ageDays, ageingBucket })), [
    { caseId: 'CASE-1', ageDays: 6, ageingBucket: '0–7 days' },
  ]);
});

test('case detail fails closed outside the station scope', async () => {
  await assert.rejects(service.get({ access, caseId: 'CASE-2' }), { code: 'NOT_FOUND' });
});
```

- [ ] **Step 2: Run the focused test and confirm it fails**

Run: `node --test tests/cases/station-case-service.test.mjs`

Expected: FAIL because `station-case-service.mjs` does not exist.

- [ ] **Step 3: Add source reads to the memory repository**

Add methods that project only the source collections needed by the service:

```js
async listStationCaseRows() {
  const source = this.#state.source?.tables ?? {};
  const units = new Map((source.Unit ?? []).map(row => [Number(row.UnitID), row.UnitName]));
  const statuses = new Map((source.CaseStatusMaster ?? []).map(row => [Number(row.CaseStatusID), row.CaseStatusName]));
  const majors = new Map((source.CrimeMajorHeadMaster ?? []).map(row => [Number(row.CrimeMajorHeadID), row.CrimeMajorHeadName]));
  const minors = new Map((source.CrimeMinorHeadMaster ?? []).map(row => [Number(row.CrimeMinorHeadID), row.CrimeMinorHeadName]));
  return clone((source.CaseMaster ?? []).map(row => ({
    caseId: String(row.CaseMasterID), caseNumber: row.CaseNo ?? row.CrimeNo,
    unitId: Number(row.PoliceStationID), unitName: units.get(Number(row.PoliceStationID)),
    status: statuses.get(Number(row.CaseStatusID)) ?? 'Unknown',
    registeredAt: row.FIRDate ?? row.InfoReceivedPSDate,
    incidentAt: row.IncidentFromDate, majorHead: majors.get(Number(row.CrimeMajorHeadID)) ?? 'Other',
    minorHead: minors.get(Number(row.CrimeMinorHeadID)) ?? 'Other', syntheticData: true,
  })));
}

async getStationCaseRow(caseId) {
  return (await this.listStationCaseRows()).find(row => row.caseId === String(caseId));
}
```

- [ ] **Step 4: Implement the case service**

```js
import { fail } from '../services/errors.mjs';

const openStatus = value => !/closed|disposed|acquitted|convicted|false|mistake/iu.test(String(value ?? ''));
export function ageInDays(registeredAt, now) {
  return Math.max(0, Math.floor((now.getTime() - new Date(registeredAt).getTime()) / 86_400_000));
}
export function ageingBucket(days) {
  if (days <= 7) return '0–7 days';
  if (days <= 30) return '8–30 days';
  if (days <= 60) return '31–60 days';
  return '60+ days';
}
const project = (row, now) => {
  const ageDays = ageInDays(row.registeredAt, now);
  return Object.freeze({ ...row, ageDays, ageingBucket: ageingBucket(ageDays), isOpen: openStatus(row.status), recordCount: 1 });
};
export function createStationCaseService({ repository, now = () => new Date() }) {
  const allowed = (row, access) => access?.authorizedUnitIds?.has(Number(row.unitId));
  return Object.freeze({
    async list({ access, query = {} }) {
      const rows = (await repository.listStationCaseRows()).filter(row => allowed(row, access)).map(row => project(row, now()));
      const filtered = query.openOnly === false ? rows : rows.filter(row => row.isOpen);
      return { data: { items: filtered.slice(0, Math.min(Number(query.limit) || 200, 200)) }, syntheticData: true };
    },
    async get({ access, caseId }) {
      const row = await repository.getStationCaseRow(caseId);
      if (!row || !allowed(row, access)) fail('NOT_FOUND');
      return { data: project(row, now()), syntheticData: true };
    },
  });
}
```

- [ ] **Step 5: Run the service tests**

Run: `node --test tests/cases/station-case-service.test.mjs`

Expected: PASS.

- [ ] **Step 6: Commit the domain slice**

```bash
git add src/backend/cases/station-case-service.mjs src/backend/repository/memory-repository.mjs tests/cases/station-case-service.test.mjs
git commit -m "feat: add governed station case service"
```

### Task 2: Catalyst repository projection and case HTTP resources

**Files:**
- Modify: `src/backend/repository/catalyst/catalyst-repository.mjs`
- Modify: `src/backend/reporting/workspace-services.mjs`
- Modify: `src/backend/catalyst/api-bootstrap.mjs`
- Modify: `src/backend/http/api-contract.mjs`
- Test: `tests/catalyst/repository-reads.test.mjs`
- Test: `tests/reporting/workspace-services.test.mjs`

- [ ] **Step 1: Write failing Catalyst projection and workspace resource tests**

Add assertions that the Catalyst repository joins `SRC_CaseMaster` to unit, status, major-head, and minor-head masters without returning `BriefFacts`, and add:

```js
test('workspace case detail uses the effective viewer scope', async () => {
  const detail = await services.getStationCase({ access: station, params: { caseId: '200000001' } });
  assert.equal(detail.data.caseId, '200000001');
  await assert.rejects(
    services.getStationCase({ access: { ...station, authorizedUnitIds: new Set([9999]) }, params: { caseId: '200000001' } }),
    { code: 'NOT_FOUND' },
  );
});
```

- [ ] **Step 2: Run tests and confirm failure**

Run: `node --test tests/catalyst/repository-reads.test.mjs tests/reporting/workspace-services.test.mjs`

Expected: FAIL because case reads/resources are absent.

- [ ] **Step 3: Implement Catalyst source joins**

Add `listStationCaseRows()` and `getStationCaseRow(caseId)` using `this.#read(SOURCE_TABLES.CaseMaster)` and the existing source master tables. Normalize numeric IDs and datetimes exactly as Task 1's memory projection and return no narrative or personal fields.

```js
async getStationCaseRow(caseId) {
  return (await this.listStationCaseRows()).find(row => row.caseId === String(caseId));
}
```

- [ ] **Step 4: Compose and expose case services**

In `createWorkspaceServices`, accept `caseService` and expose:

```js
async listStationCases({ access, query }) { return caseService.list({ access, query }); },
async getStationCase({ access, params }) { return caseService.get({ access, caseId: params.caseId }); },
```

In `api-bootstrap.mjs`, create one `stationCaseService` from the repository and inject it into workspace services. Add contracts:

```js
Object.freeze({ method: 'GET', path: '/v1/cases', kind: 'resource', service: 'listStationCases' }),
Object.freeze({ method: 'GET', path: '/v1/cases/:caseId', kind: 'resource', service: 'getStationCase' }),
```

- [ ] **Step 5: Run focused backend tests**

Run: `node --test tests/catalyst/repository-reads.test.mjs tests/reporting/workspace-services.test.mjs`

Expected: PASS, including inaccessible-case `NOT_FOUND` behavior.

- [ ] **Step 6: Commit the HTTP slice**

```bash
git add src/backend/repository/catalyst/catalyst-repository.mjs src/backend/reporting/workspace-services.mjs src/backend/catalyst/api-bootstrap.mjs src/backend/http/api-contract.mjs tests/catalyst/repository-reads.test.mjs tests/reporting/workspace-services.test.mjs
git commit -m "feat: expose scoped station cases"
```

### Task 3: Station cases as an editable report source

**Files:**
- Modify: `src/backend/reporting/semantic-sources.mjs`
- Modify: `src/backend/reporting/report-execution.mjs`
- Modify: `src/backend/reporting/report-service.mjs`
- Test: `tests/reporting/report-definition.test.mjs`
- Test: `tests/reporting/report-projection.test.mjs`
- Test: `tests/reporting/station-case-reports.test.mjs`

- [ ] **Step 1: Write failing report contract tests**

```js
test('station cases expose only approved analytical fields', () => {
  const source = getReportSource('stationCases');
  assert.deepEqual(Object.keys(source.fields), [
    'caseId', 'caseNumber', 'unitId', 'unitName', 'status', 'registeredAt', 'incidentAt',
    'majorHead', 'minorHead', 'ageDays', 'ageingBucket', 'isOpen', 'recordCount',
  ]);
  assert.equal(source.fields.recordCount.aggregates.includes('sum'), true);
});
```

Add an execution test creating an ageing-bucket bar report and assert only station-authorized case rows are aggregated.

- [ ] **Step 2: Run focused report tests and confirm failure**

Run: `node --test tests/reporting/report-definition.test.mjs tests/reporting/report-projection.test.mjs tests/reporting/station-case-reports.test.mjs`

Expected: FAIL because `stationCases` is not registered.

- [ ] **Step 3: Register the semantic source**

```js
stationCases: source({
  key: 'stationCases', label: 'Station cases', service: 'listStationCases',
  fields: {
    caseId: field('string', { dimension: true }), caseNumber: field('string', { dimension: true }),
    unitId: field('string', { dimension: true }), unitName: field('string', { dimension: true }),
    status: field('string', { dimension: true }), registeredAt: field('date', { dimension: true }),
    incidentAt: field('date', { dimension: true }), majorHead: field('string', { dimension: true }),
    minorHead: field('string', { dimension: true }), ageDays: field('number', { aggregates: ['avg', 'min', 'max'] }),
    ageingBucket: field('string', { dimension: true }), isOpen: field('boolean', { dimension: true }),
    recordCount: field('number', { aggregates: ['sum', 'count'] }),
  },
  visualizations: ['number', 'table', 'bar', 'line', 'pie', 'funnel'],
}),
```

- [ ] **Step 4: Project case rows and wire report execution**

In `projectReportRows`:

```js
if (sourceKey === 'stationCases') return rows.map(row => ({
  caseId: row.caseId, caseNumber: row.caseNumber, unitId: row.unitId, unitName: row.unitName,
  status: row.status, registeredAt: row.registeredAt, incidentAt: row.incidentAt,
  majorHead: row.majorHead, minorHead: row.minorHead, ageDays: row.ageDays,
  ageingBucket: row.ageingBucket, isOpen: row.isOpen, recordCount: 1,
}));
```

Inject `caseService.list` into the `readServices` object under `listStationCases` in the API bootstrap.

- [ ] **Step 5: Run focused report tests**

Run: `node --test tests/reporting/report-definition.test.mjs tests/reporting/report-projection.test.mjs tests/reporting/station-case-reports.test.mjs`

Expected: PASS with station-scoped aggregates.

- [ ] **Step 6: Commit the semantic source**

```bash
git add src/backend/reporting src/backend/catalyst/api-bootstrap.mjs tests/reporting
git commit -m "feat: add station cases report source"
```

### Task 4: Reusable premium report surface and station dashboard template

**Files:**
- Create: `web/src/features/station-operations/station-dashboard-template.js`
- Modify: `web/src/features/command-center/CommandCenterReportSurface.jsx`
- Modify: `web/src/features/command-center/CommandCenterDashboardCanvas.jsx`
- Test: `web/src/features/command-center/CommandCenterReportSurface.test.jsx`
- Test: `web/src/features/station-operations/station-dashboard-template.test.js`

- [ ] **Step 1: Write failing renderer and template tests**

Test that a chart item uses `ReportPreview`, forwards `onSelect`, a table case cell produces a case link callback, and the template contains nine report definitions without visible seeded result values.

```js
expect(STATION_REPORTS.map(report => report.sourceKey)).toEqual([
  'stationCases', 'stationCases', 'stationCases', 'alerts', 'stationCases',
  'stationCases', 'stationCases', 'stationCases', 'stationCases',
]);
```

- [ ] **Step 2: Run frontend tests and confirm failure**

Run: `npm run test --workspace web -- CommandCenterReportSurface station-dashboard-template`

Expected: FAIL because the station template and reusable visualization path do not exist.

- [ ] **Step 3: Create report definitions and layout**

Export `STATION_REPORTS` for Open Cases, 60+ Day Cases, New Cases, Active Alerts, Case Ageing, Lifecycle, Crime Category, Incident Hour, and Open Case Register. Use `stationCases` filters and approved fields, plus `alerts` for active alert count. Export a 12-column layout that places the summary row first, ageing and register next, then pattern charts.

- [ ] **Step 4: Render real visualizations in dashboard widgets**

Replace the local raw-table-only body with the existing renderer:

```jsx
<ReportPreview
  preview={item.data ?? []}
  definition={item.definition}
  density="dashboard"
  hasRun
  provenance={item.syntheticData ? 'Demonstration data' : ''}
  onSelect={selection => onSelect(item, selection)}
/>
```

Retain isolated report error and governed map handling. Thread `onSelect` through `CommandCenterDashboardCanvas` without changing Command Centre defaults.

- [ ] **Step 5: Run focused frontend tests**

Run: `npm run test --workspace web -- CommandCenterReportSurface station-dashboard-template`

Expected: PASS.

- [ ] **Step 6: Commit the reusable rendering slice**

```bash
git add web/src/features/command-center web/src/features/station-operations
git commit -m "feat: add interactive station dashboard reports"
```

### Task 5: Station Operations shell and interactive workload

**Files:**
- Create: `web/src/features/station-operations/StationOperationsShell.jsx`
- Create: `web/src/features/station-operations/StationCaseTable.jsx`
- Create: `web/src/features/station-operations/station-operations.css`
- Create: `web/src/features/station-operations/StationOperationsShell.test.jsx`
- Modify: `web/src/features/command-center/useCommandCenterDashboard.js`
- Modify: `web/src/app/router.jsx`
- Modify: `web/src/app/workspace-navigation.js`
- Modify: `web/src/styles/app.css`

- [ ] **Step 1: Write failing shell interaction tests**

```jsx
test('selecting the 60+ ageing segment filters the station case register', async () => {
  renderStationWorkspace();
  fireEvent.click(await screen.findByRole('button', { name: /60\+ days/i }));
  expect(screen.getByRole('status')).toHaveTextContent('Ageing: 60+ days');
  expect(screen.getByRole('row', { name: /CASE-OLD/i })).toBeInTheDocument();
  expect(screen.queryByRole('row', { name: /CASE-NEW/i })).not.toBeInTheDocument();
});

test('edit mode exposes layout controls and cancel restores the persisted layout', async () => {
  renderStationWorkspace();
  fireEvent.click(await screen.findByRole('button', { name: 'Edit dashboard' }));
  expect(screen.getByRole('button', { name: 'Save changes' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Cancel editing' }));
  expect(screen.queryByRole('button', { name: 'Save changes' })).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run the station shell tests and confirm failure**

Run: `npm run test --workspace web -- StationOperationsShell`

Expected: FAIL because the station shell does not exist.

- [ ] **Step 3: Implement the shell composition**

Use the existing dashboard controller and toolbar, add a compact station header, and maintain one selection object:

```jsx
const [selection, setSelection] = useState(null);
const visibleCases = useMemo(() => cases.filter(row => {
  if (!selection) return true;
  return selection.field === 'ageingBucket' ? row.ageingBucket === selection.value
    : selection.field === 'majorHead' ? row.majorHead === selection.value
      : selection.field === 'status' ? row.status === selection.value : true;
}), [cases, selection]);
```

Show the selection as a removable status line, pass chart selections into `setSelection`, and render `StationCaseTable` with `visibleCases`.

- [ ] **Step 4: Route the station persona and restore Reports navigation**

In `router.jsx`, choose `StationOperationsShell` for `STATION_OPERATIONS` on `/` and `/dashboards`; preserve the normal `AppShell` for Reports, Alerts, Utilities, Geospatial, and case detail. In `workspace-navigation.js`, use the full intelligence module list for Station Operations instead of filtering `/reports`.

- [ ] **Step 5: Add Catalyst-inspired visual and responsive states**

Use existing tokens for true-white surfaces, navy text, blue selection, 1px borders, 10–12px radii, 150–180ms transitions, visible focus rings, and `prefers-reduced-motion`. Keep the visual order consistent at every breakpoint: four-metric strip, all analytical charts, then the full-width case register; do not add a marketing hero.

- [ ] **Step 6: Run station, router, and navigation tests**

Run: `npm run test --workspace web -- StationOperationsShell router workspace-navigation`

Expected: PASS.

- [ ] **Step 7: Commit the station shell**

```bash
git add web/src/features/station-operations web/src/features/command-center/useCommandCenterDashboard.js web/src/app/router.jsx web/src/app/workspace-navigation.js web/src/styles/app.css
git commit -m "feat: build station operations workspace"
```

### Task 6: Full governed case-detail page

**Files:**
- Create: `web/src/features/station-operations/StationCaseDetail.jsx`
- Create: `web/src/features/station-operations/StationCaseDetail.test.jsx`
- Modify: `web/src/features/station-operations/StationCaseTable.jsx`
- Modify: `web/src/app/router.jsx`

- [ ] **Step 1: Write failing case navigation and detail tests**

```jsx
test('case row preserves the station persona when opening detail', () => {
  render(<MemoryRouter initialEntries={['/?persona=STATION_OPERATIONS']}><StationCaseTable cases={[caseRow]} /></MemoryRouter>);
  expect(screen.getByRole('link', { name: /01\/2026/i })).toHaveAttribute('href', '/cases/CASE-1?persona=STATION_OPERATIONS');
});

test('detail renders approved case facts without an edit action', async () => {
  renderCaseDetail();
  expect(await screen.findByRole('heading', { name: 'Case 01/2026' })).toBeInTheDocument();
  expect(screen.getByText('60+ days')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /edit/i })).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run case-detail tests and confirm failure**

Run: `npm run test --workspace web -- StationCaseDetail StationCaseTable`

Expected: FAIL because the page and links do not exist.

- [ ] **Step 3: Implement the governed detail page**

Load `/v1/cases/${encodeURIComponent(caseId)}` through `useLoad`. Render a back link, lifecycle/status, age and ageing bucket, registration and incident times, crime classification, and station name. Use existing Busy/Failure components so 404/403 behavior remains generic and governed.

- [ ] **Step 4: Add the case route and row links**

```jsx
<Route path="/cases/:caseId" element={<StationCaseDetail api={api} />} />
```

Build links with `governedAppLocation(`/cases/${encodeURIComponent(caseId)}`, location)`.

- [ ] **Step 5: Run focused case-detail tests**

Run: `npm run test --workspace web -- StationCaseDetail StationCaseTable router`

Expected: PASS.

- [ ] **Step 6: Commit case detail**

```bash
git add web/src/features/station-operations web/src/app/router.jsx
git commit -m "feat: add governed station case detail"
```

### Task 7: Default dashboard bootstrap, regression suite, and production bundle

**Files:**
- Modify: `web/src/features/station-operations/station-dashboard-template.js`
- Modify: `web/src/features/station-operations/StationOperationsShell.jsx`
- Test: `web/src/features/station-operations/station-dashboard-template.test.js`
- Generated: `functions/crime_intelligence_api/app/**`

- [ ] **Step 1: Test idempotent default-dashboard creation**

Assert the template reuses reports by name, reuses the user's existing `Station Operations` dashboard, creates missing definitions only once, and writes all nine placements.

- [ ] **Step 2: Implement idempotent bootstrap**

Follow the established state-template API pattern: fetch `/v1/reports`, reuse exact-name reports, create missing reports, reuse or create the owned Station Operations dashboard, replace its items with the approved layout, and then open it. Do not catch authorization or validation failures as successful setup.

- [ ] **Step 3: Run complete backend and frontend tests**

Run: `npm test`

Expected: all Node tests PASS.

Run: `npm run web:test`

Expected: all Vitest suites PASS.

- [ ] **Step 4: Build and inspect deployment artifacts**

Run: `npm run web:build`

Expected: Vite build and bundle-size check PASS.

Run: `npm run catalyst:build && npm run catalyst:inspect`

Expected: Catalyst function bundle rebuilt from root `src` and inspection PASS.

- [ ] **Step 5: Run schema and preflight checks**

Run: `npm run schema:validate && npm run intelligence-schema:validate && npm run catalyst:preflight`

Expected: all checks PASS with no missing bundled source.

- [ ] **Step 6: Browser fidelity and interaction verification**

Use the in-app Browser at desktop and narrow widths. Verify:

1. Station Operations opens without a marketing hero.
2. The first viewport shows station context, summary, ageing, and case workload.
3. Charts render using real report output and selected segments visibly filter cases.
4. Case rows open full detail while preserving `persona=STATION_OPERATIONS`.
5. Edit, rearrange/resize, Save, and Cancel function.
6. One failed report does not collapse sibling widgets.
7. Keyboard focus is visible and reduced motion is respected.

Capture the latest implementation screenshot and compare it with the approved Catalyst reference using `view_image`; fix spacing, typography, palette, borders, density, chart legibility, and icon mismatches before completion.

- [ ] **Step 7: Commit the verified bundle**

```bash
git add web functions/crime_intelligence_api/app src tests
git commit -m "feat: complete station operations MVP"
```

## Plan self-review

- Spec coverage: station scoping, real metrics, ageing, patterns, alerts, interactive filtering, full case detail, editable reports, failure isolation, responsive UI, and verification each map to a task above.
- Scope: one vertical Station Operations feature; it does not add case mutation or a second case-management system.
- Type consistency: the shared case projection uses `caseId`, `caseNumber`, `unitId`, `unitName`, `status`, `registeredAt`, `incidentAt`, `majorHead`, `minorHead`, `ageDays`, `ageingBucket`, `isOpen`, and `recordCount` throughout repository, service, report, and UI layers.
- Placeholder scan: the plan contains no deferred requirements; visual values are explicitly derived from governed report execution.

# Persona Dashboard Workspaces Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give District Leadership, Crime Analyst, and Police Station role-appropriate editable experiences inside the existing Dashboards area while preserving every existing persona homepage and governed report behavior.

**Architecture:** Add three focused persona workspace components and one small role-aware route component. District, Analyst, and Police Station compose the existing dashboard controller, toolbar, canvas, report drawer, and deletion dialog; `StationOperationsShell` remains the homepage only. Restore the shared dashboard compatibility contract first, then extend the report drawer only enough to honor persona predicates and return context.

**Tech Stack:** React 19, React Router 7, Vitest, Testing Library, existing KSP ACE Catalyst UI CSS and governed reporting APIs.

---

## File Map

- Create `web/src/features/dashboards/DistrictDashboardWorkspace.jsx`: District-specific labels, report-source predicate, shared edit canvas composition.
- Create `web/src/features/dashboards/AnalystDashboardWorkspace.jsx`: Analyst-specific labels, report-source predicate, shared edit canvas composition.
- Create `web/src/features/dashboards/PoliceStationDashboardWorkspace.jsx`: Police Station labels, station-only report predicate, shared edit canvas composition.
- Create `web/src/features/dashboards/PersonaDashboardRoute.jsx`: role-only selection among District, Analyst, Station, and the unchanged generic dashboard page.
- Create `web/src/features/dashboards/PersonaDashboardRoute.test.jsx`: routing isolation and regression coverage.
- Create `web/src/features/dashboards/DistrictDashboardWorkspace.test.jsx`: District behavior and authorized report picker coverage.
- Create `web/src/features/dashboards/AnalystDashboardWorkspace.test.jsx`: Analyst behavior and authorized report picker coverage.
- Create `web/src/features/dashboards/PoliceStationDashboardWorkspace.test.jsx`: Police Station behavior and station-only report picker coverage.
- Modify `web/src/features/command-center/CommandCenterAddReportDrawer.jsx`: accept a report predicate and governed return target; keep defaults backward compatible.
- Modify `web/src/features/command-center/CommandCenterAddReportDrawer.test.jsx`: predicate and persona-context tests.
- Modify `web/src/app/router.jsx`: delegate only `/dashboards/:dashboardId` to the role-aware route.
- Modify `web/src/styles/app.css`: minimal shared persona-dashboard shell styling using current tokens.

### Task 0: Restore the clean regression baseline

**Files:**
- Modify: `web/src/features/command-center/CommandCenterDashboardCanvas.jsx`
- Modify: `web/src/features/command-center/CommandCenterReportSurface.jsx`
- Modify: `web/src/features/admin/PersonaDirectory.test.jsx`
- Modify: `web/src/app/AppShell.test.jsx`
- Test: `web/src/features/station-operations/StationOperationsShell.test.jsx`

- [ ] **Step 1: Use the existing failures as the red tests**

Run: `npm.cmd test -- --run src/features/station-operations/StationOperationsShell.test.jsx src/features/admin/PersonaDirectory.test.jsx src/app/AppShell.test.jsx`

Expected: FAIL because the shared canvas no longer forwards station selection/presentation hooks and two assertions describe intentionally removed UI state.

- [ ] **Step 2: Restore the shared canvas compatibility props**

Extend the current signature without removing modern props:

```jsx
export function CommandCenterDashboardCanvas({
  dashboard, activeTab = 'overview', editing = false, onStage = () => {},
  onRemove = () => {}, onSelect, allowRemove = false, showPreviewMeta = true,
  getPlacementClassName = () => '', returnTo = '',
})
```

Apply `getPlacementClassName(item)` to each placement, pass `onSelect` and `showPreviewMeta` to `CommandCenterReportSurface`, and make remove available when either `allowRemove` or the modern edit surface requests it.

- [ ] **Step 3: Restore report selection without removing modern controls**

Restore `normalizedSelection` and extend the current surface signature:

```jsx
export function CommandCenterReportSurface({
  item, editing = false, onRemove = () => {}, onSelect,
  showPreviewMeta = true, returnTo = '',
})
```

Pass `showMeta={showPreviewMeta}` and the normalized `onSelect` callback to `ReportPreview`. Keep the current Edit report, Remove report, visualization variants, governed return target, and footer behavior.

- [ ] **Step 4: Correct the two stale regression assertions**

Change Persona Directory's expected Open workspace link count from `5` to `4`, matching the approved Regional Leadership removal. Change App Shell's `Unit 101` expectation to `Analyst Workbench`, matching the safe navigation-label fallback when `scopeUnit.name` is absent.

- [ ] **Step 5: Run the baseline regression set**

Run: `npm.cmd test -- --run src/features/station-operations/StationOperationsShell.test.jsx src/features/admin/PersonaDirectory.test.jsx src/app/AppShell.test.jsx src/features/command-center/CommandCenterDashboardCanvas.test.jsx src/features/command-center/CommandCenterReportSurface.test.jsx`

Expected: PASS.

- [ ] **Step 6: Commit the baseline repair**

```powershell
git add web/src/features/command-center/CommandCenterDashboardCanvas.jsx web/src/features/command-center/CommandCenterReportSurface.jsx web/src/features/admin/PersonaDirectory.test.jsx web/src/app/AppShell.test.jsx
git commit -m "fix: restore shared dashboard compatibility"
```

### Task 1: Make the shared report drawer persona-aware

**Files:**
- Modify: `web/src/features/command-center/CommandCenterAddReportDrawer.jsx`
- Test: `web/src/features/command-center/CommandCenterAddReportDrawer.test.jsx`

- [ ] **Step 1: Write failing predicate and return-context tests**

Add tests that render the drawer at `/?persona=CRIME_ANALYST`, pass `reportPredicate={report => report.definition?.sourceKey === 'anomalies'}` and `returnTo="dashboards"`, and assert an analyst report is present, a station report is absent, and Create new report links to `/reports/new?persona=CRIME_ANALYST&returnTo=dashboards`.

```jsx
render(<MemoryRouter initialEntries={['/?persona=CRIME_ANALYST']}>
  <CommandCenterAddReportDrawer api={api} open
    reportPredicate={report => report.definition?.sourceKey === 'anomalies'}
    returnTo="dashboards" />
</MemoryRouter>);
expect(await screen.findByRole('button', { name: 'Add Anomaly evidence' })).toBeVisible();
expect(screen.queryByRole('button', { name: 'Add Open cases' })).not.toBeInTheDocument();
expect(screen.getByRole('link', { name: 'Create new report' }))
  .toHaveAttribute('href', '/reports/new?persona=CRIME_ANALYST&returnTo=dashboards');
```

- [ ] **Step 2: Run the focused test and confirm failure**

Run: `npm test -- --run src/features/command-center/CommandCenterAddReportDrawer.test.jsx`

Working directory: `web`

Expected: FAIL because `reportPredicate` and `returnTo` are ignored.

- [ ] **Step 3: Implement backward-compatible drawer filtering**

Change the signature and filtering while keeping Command Centre defaults:

```jsx
export function CommandCenterAddReportDrawer({
  api, open = false, onAdd = () => {}, onClose = () => {},
  reportPredicate = () => true, returnTo = 'command-center', recommendedReports = RECOMMENDED_COMMAND_REPORTS,
}) {
  // existing state
  const eligible = useMemo(() => reports.filter(reportPredicate), [reports, reportPredicate]);
  const filtered = useMemo(() => eligible.filter(report =>
    report.name?.toLowerCase().includes(query.toLowerCase())), [eligible, query]);
  const recommended = useMemo(() => recommendedReports
    .filter(reportPredicate)
    .filter(definition => !reports.some(report => report.name === definition.name))
    .filter(definition => definition.name.toLowerCase().includes(query.toLowerCase())),
  [recommendedReports, reportPredicate, reports, query]);
  reportParams.set('returnTo', returnTo);
}
```

- [ ] **Step 4: Run the drawer tests**

Run: `npm test -- --run src/features/command-center/CommandCenterAddReportDrawer.test.jsx`

Expected: PASS, including existing Command Centre tests.

- [ ] **Step 5: Commit the shared drawer change**

```powershell
git add web/src/features/command-center/CommandCenterAddReportDrawer.jsx web/src/features/command-center/CommandCenterAddReportDrawer.test.jsx
git commit -m "feat: scope dashboard report picker by persona"
```

### Task 2: Add the District dashboard workspace

**Files:**
- Create: `web/src/features/dashboards/DistrictDashboardWorkspace.jsx`
- Create: `web/src/features/dashboards/DistrictDashboardWorkspace.test.jsx`

- [ ] **Step 1: Write a failing District workspace test**

Mock a district dashboard and executions. Assert the authorized district name is shown, Edit dashboard opens editing controls, Add chart opens the drawer, and only reports backed by `brief`, `patterns`, `hotspots`, `anomalies`, `areaRisk`, `districtContext`, `alerts`, or `catalog.caseMaster` are offered.

```jsx
render(<MemoryRouter initialEntries={['/dashboards/D-1?persona=DISTRICT_LEADERSHIP']}>
  <DistrictDashboardWorkspace api={api} workspace={workspace} dashboardId="D-1" />
</MemoryRouter>);
expect(await screen.findByRole('heading', { name: 'Mysuru District Intelligence' })).toBeVisible();
fireEvent.click(screen.getByRole('button', { name: 'Edit dashboard' }));
fireEvent.click(screen.getByRole('button', { name: 'Add report' }));
expect(await screen.findByRole('button', { name: 'Add District FIR trend' })).toBeVisible();
expect(screen.queryByRole('button', { name: 'Add Station case register' })).not.toBeInTheDocument();
```

- [ ] **Step 2: Run the District test and confirm failure**

Run: `npm test -- --run src/features/dashboards/DistrictDashboardWorkspace.test.jsx`

Expected: FAIL because the component does not exist.

- [ ] **Step 3: Implement the District composition**

Create a thin component using `useCommandCenterDashboard`, `CommandCenterDashboardCanvas`, `CommandCenterAddReportDrawer`, `CommandCenterWorkspaceToolbar`, and `DashboardDeleteDialog`. Use this stable predicate and heading:

```jsx
const DISTRICT_SOURCES = new Set([
  'brief', 'patterns', 'hotspots', 'anomalies', 'areaRisk',
  'districtContext', 'alerts', 'catalog.caseMaster',
]);
export const isDistrictReport = report => DISTRICT_SOURCES.has(report?.definition?.sourceKey);

const districtName = workspace?.scopeUnit?.name?.trim() || 'Authorized District';
<h1>{districtName} District Intelligence</h1>
```

The component must pass `requestedDashboardId={dashboardId}`, `reportPredicate={isDistrictReport}`, `returnTo="dashboards"`, `allowRemove`, and `returnTo="dashboards"` to shared primitives. Save and Cancel call the controller directly. Delete uses `api.delete('/v1/dashboards/:id')` and the supplied `onDeleted` callback.

- [ ] **Step 4: Run the District tests**

Run: `npm test -- --run src/features/dashboards/DistrictDashboardWorkspace.test.jsx src/features/command-center/useCommandCenterDashboard.test.jsx`

Expected: PASS.

- [ ] **Step 5: Commit the District workspace**

```powershell
git add web/src/features/dashboards/DistrictDashboardWorkspace.jsx web/src/features/dashboards/DistrictDashboardWorkspace.test.jsx
git commit -m "feat: add district dashboard workspace"
```

### Task 3: Add the Analyst dashboard workspace

**Files:**
- Create: `web/src/features/dashboards/AnalystDashboardWorkspace.jsx`
- Create: `web/src/features/dashboards/AnalystDashboardWorkspace.test.jsx`

- [ ] **Step 1: Write a failing Analyst workspace test**

Assert the Analyst Evidence Dashboard heading, human-review notice, edit controls, and source filtering for `brief`, `patterns`, `hotspots`, `anomalies`, `areaRisk`, `alerts`, and `catalog.caseMaster`.

```jsx
expect(await screen.findByRole('heading', { name: 'Analyst Evidence Dashboard' })).toBeVisible();
expect(screen.getByText(/signals require human review/i)).toBeVisible();
fireEvent.click(screen.getByRole('button', { name: 'Edit dashboard' }));
fireEvent.click(screen.getByRole('button', { name: 'Add report' }));
expect(await screen.findByRole('button', { name: 'Add Anomaly evidence' })).toBeVisible();
expect(screen.queryByRole('button', { name: 'Add Station case register' })).not.toBeInTheDocument();
```

- [ ] **Step 2: Run the Analyst test and confirm failure**

Run: `npm test -- --run src/features/dashboards/AnalystDashboardWorkspace.test.jsx`

Expected: FAIL because the component does not exist.

- [ ] **Step 3: Implement the Analyst composition**

Mirror the shared composition contract without importing the District component. Keep only analyst policy and presentation local:

```jsx
const ANALYST_SOURCES = new Set([
  'brief', 'patterns', 'hotspots', 'anomalies', 'areaRisk',
  'alerts', 'catalog.caseMaster',
]);
export const isAnalystReport = report => ANALYST_SOURCES.has(report?.definition?.sourceKey);
```

Render `Analyst Evidence Dashboard`, the immutable-evidence/human-review message, the existing shared toolbar/canvas, drawer with `returnTo="dashboards"`, and deletion dialog. Use the controller for add/remove/move/resize/cancel/save so report behavior stays identical.

- [ ] **Step 4: Run Analyst and shared controller tests**

Run: `npm test -- --run src/features/dashboards/AnalystDashboardWorkspace.test.jsx src/features/command-center/useCommandCenterDashboard.test.jsx`

Expected: PASS.

- [ ] **Step 5: Commit the Analyst workspace**

```powershell
git add web/src/features/dashboards/AnalystDashboardWorkspace.jsx web/src/features/dashboards/AnalystDashboardWorkspace.test.jsx
git commit -m "feat: add analyst dashboard workspace"
```

### Task 4: Add the Police Station dashboard workspace

**Files:**
- Create: `web/src/features/dashboards/PoliceStationDashboardWorkspace.jsx`
- Create: `web/src/features/dashboards/PoliceStationDashboardWorkspace.test.jsx`

- [ ] **Step 1: Write a failing Police Station dashboard test**

Render the new component directly with a `STATION_OPERATIONS` workspace and an authorized dashboard ID. Assert the station name, Police Station Dashboard heading, edit controls, and a report picker restricted to `stationCases` and `alerts`. Assert Station Operations homepage-only copy and period controls are absent.

```jsx
expect(await screen.findByRole('heading', { name: 'Police Station Dashboard' })).toBeVisible();
expect(screen.getByText('Central Police Station')).toBeVisible();
expect(screen.queryByRole('group', { name: 'Station reporting period' })).not.toBeInTheDocument();
fireEvent.click(screen.getByRole('button', { name: 'Edit dashboard' }));
fireEvent.click(screen.getByRole('button', { name: 'Add report' }));
expect(await screen.findByRole('button', { name: 'Add Open case register' })).toBeVisible();
expect(screen.queryByRole('button', { name: 'Add District FIR trend' })).not.toBeInTheDocument();
```

- [ ] **Step 2: Run the Police Station test and confirm failure**

Run: `npm.cmd test -- --run src/features/dashboards/PoliceStationDashboardWorkspace.test.jsx`

Expected: FAIL because the component does not exist.

- [ ] **Step 3: Implement the Police Station composition**

Use the same shared dashboard controller, toolbar, canvas, drawer, and deletion dialog as the other new workspaces. Keep station policy local:

```jsx
const POLICE_STATION_SOURCES = new Set(['stationCases', 'alerts']);
export const isPoliceStationReport = report => POLICE_STATION_SOURCES.has(report?.definition?.sourceKey);
```

Use `workspace.scopeUnit.name || 'Local station'`, `requestedDashboardId={dashboardId}`, `reportPredicate={isPoliceStationReport}`, and `returnTo="dashboards"`. Do not import `StationOperationsShell`, its bootstrap template, period filtering, case-detail navigation, or homepage CSS.

- [ ] **Step 4: Run Police Station and homepage regressions**

Run: `npm.cmd test -- --run src/features/dashboards/PoliceStationDashboardWorkspace.test.jsx src/features/station-operations/StationOperationsShell.test.jsx`

Expected: PASS.

- [ ] **Step 5: Commit the Police Station dashboard**

```powershell
git add web/src/features/dashboards/PoliceStationDashboardWorkspace.jsx web/src/features/dashboards/PoliceStationDashboardWorkspace.test.jsx
git commit -m "feat: add police station dashboard workspace"
```

### Task 5: Route dashboards by existing persona

**Files:**
- Create: `web/src/features/dashboards/PersonaDashboardRoute.jsx`
- Create: `web/src/features/dashboards/PersonaDashboardRoute.test.jsx`
- Modify: `web/src/app/router.jsx`

- [ ] **Step 1: Write failing role-selection tests**

Mock the four child surfaces and assert exact selection for `DISTRICT_LEADERSHIP`, `CRIME_ANALYST`, `STATION_OPERATIONS`, and `STATE_LEADERSHIP`. Also assert an unavailable station dashboard stays inside Station Operations rather than falling back to generic content.

```jsx
expect(renderRoute('DISTRICT_LEADERSHIP')).toHaveTextContent('district:D-1');
expect(renderRoute('CRIME_ANALYST')).toHaveTextContent('analyst:D-1');
expect(renderRoute('STATION_OPERATIONS')).toHaveTextContent('station:D-1');
expect(renderRoute('STATE_LEADERSHIP')).toHaveTextContent('generic:D-1');
```

- [ ] **Step 2: Run the route test and confirm failure**

Run: `npm test -- --run src/features/dashboards/PersonaDashboardRoute.test.jsx`

Expected: FAIL because the route component does not exist.

- [ ] **Step 3: Implement the exact role switch**

```jsx
export function PersonaDashboardRoute({ api, workspace, dashboardId, onDeleted }) {
  const workspaceProps = { api, workspace, dashboardId, onDeleted };
  if (workspace.role === 'DISTRICT_LEADERSHIP') return <DistrictDashboardWorkspace {...workspaceProps} />;
  if (workspace.role === 'CRIME_ANALYST') return <AnalystDashboardWorkspace {...workspaceProps} />;
  if (workspace.role === 'STATION_OPERATIONS') return <PoliceStationDashboardWorkspace {...workspaceProps} />;
  return <DashboardPage api={api} dashboardId={dashboardId} onDeleted={onDeleted} />;
}
```

- [ ] **Step 4: Replace only the dashboard-detail route in `router.jsx`**

Have `StationDashboardRoute` render `PersonaDashboardRoute` and keep the current Suspense fallback. Do not change `/`, `/reports`, `/intelligence`, or persona authorization branches.

- [ ] **Step 5: Run route and router regressions**

Run: `npm test -- --run src/features/dashboards/PersonaDashboardRoute.test.jsx src/app/router.test.jsx src/app/workspace-navigation.test.js`

Expected: PASS.

- [ ] **Step 6: Commit role-aware routing**

```powershell
git add web/src/features/dashboards/PersonaDashboardRoute.jsx web/src/features/dashboards/PersonaDashboardRoute.test.jsx web/src/app/router.jsx
git commit -m "feat: route dashboards to persona workspaces"
```

### Task 6: Apply Catalyst-consistent responsive styling

**Files:**
- Modify: `web/src/styles/app.css`
- Test: `web/src/styles/viewport-layout.test.js`

- [ ] **Step 1: Add a failing CSS contract test**

Read `app.css` and assert `.persona-dashboard-workspace`, `.persona-dashboard-workspace__header`, and the existing mobile breakpoint contain the required layout selectors.

```js
expect(css).toMatch(/\.persona-dashboard-workspace__header/);
expect(css).toMatch(/@media[^}]+max-width:\s*760px/s);
```

- [ ] **Step 2: Run the CSS contract test and confirm failure**

Run: `npm test -- --run src/styles/viewport-layout.test.js`

Expected: FAIL because the persona dashboard selectors are absent.

- [ ] **Step 3: Add minimal token-based styling**

Add an open workspace shell, compact identity header, restrained status copy, and responsive stacked action layout. Reuse existing CSS variables and command-center classes; do not duplicate report-card, drawer, grid, button, or chart styling.

```css
.persona-dashboard-workspace { min-width: 0; display: grid; gap: 14px; }
.persona-dashboard-workspace__header { display: flex; align-items: end; justify-content: space-between; gap: 20px; }
.persona-dashboard-workspace__header h1 { margin: 0; color: var(--ink-strong); }
@media (max-width: 760px) {
  .persona-dashboard-workspace__header { align-items: stretch; flex-direction: column; }
}
```

Use actual token names already present in `tokens.css`; if `--ink-strong` is absent, select the existing primary text token rather than adding a duplicate token.

- [ ] **Step 4: Run style and component tests**

Run: `npm test -- --run src/styles/viewport-layout.test.js src/features/dashboards/DistrictDashboardWorkspace.test.jsx src/features/dashboards/AnalystDashboardWorkspace.test.jsx`

Expected: PASS.

- [ ] **Step 5: Commit styling**

```powershell
git add web/src/styles/app.css web/src/styles/viewport-layout.test.js
git commit -m "style: align persona dashboards with catalyst ui"
```

### Task 7: Full regression and browser verification

**Files:**
- Modify only if verification exposes a defect in files already listed above.

- [ ] **Step 1: Run the complete web test suite**

Run: `npm test`

Working directory: `web`

Expected: all tests PASS.

- [ ] **Step 2: Run the production build**

Run: `npm run build`

Working directory: `web`

Expected: Vite build succeeds and the existing bundle-budget check remains within its configured limit.

- [ ] **Step 3: Browser-check all three persona dashboard paths**

Run the local Vite server and inspect:

- `/?persona=DISTRICT_LEADERSHIP` then `/dashboards/:authorizedId?persona=DISTRICT_LEADERSHIP`
- `/?persona=CRIME_ANALYST` then `/dashboards/:authorizedId?persona=CRIME_ANALYST`
- `/?persona=STATION_OPERATIONS` then `/dashboards/:authorizedId?persona=STATION_OPERATIONS`

Verify desktop and mobile widths, dashboard loading/empty states, Edit dashboard, Add report, report-source filtering, move/resize, Cancel, Save, Open/Edit report, isolated tile failure, and Delete confirmation. Confirm State Leadership and Command Centre dashboard paths are visually and functionally unchanged.

- [ ] **Step 4: Run the final focused regression set after any browser fixes**

Run: `npm test -- --run src/features/dashboards src/features/command-center src/features/station-operations src/app/router.test.jsx src/app/workspace-navigation.test.js && npm run build`

Expected: all tests PASS and build succeeds.

- [ ] **Step 5: Commit verification fixes only if needed**

```powershell
git add web/src/features/dashboards web/src/features/command-center/CommandCenterAddReportDrawer.jsx web/src/features/command-center/CommandCenterAddReportDrawer.test.jsx web/src/app/router.jsx web/src/styles/app.css web/src/styles/viewport-layout.test.js
git commit -m "fix: complete persona dashboard verification"
```

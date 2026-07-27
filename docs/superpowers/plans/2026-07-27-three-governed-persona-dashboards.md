# Three Governed Persona Dashboards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provision three distinct editable owned dashboards with governed reports, show them across every authorized persona, and open each dashboard with its stored composition instead of the current persona's composition.

**Architecture:** Three focused template modules describe District, Analyst, and Police Station content. A shared idempotent provisioner creates canonical reports and dashboards without resetting completed/user-edited dashboards; a small React provisioning boundary refreshes the workspace before the application renders. Dashboard routing selects the specialized presentation from dashboard identity, while authorization continues to scope execution results.

**Tech Stack:** React 19, React Router 7, Vitest, Testing Library, Catalyst REST API, Vite.

---

## File Structure

- Create `web/src/features/dashboards/templates/district-dashboard-template.js`: district-only report definitions, layout, marker, and metadata.
- Create `web/src/features/dashboards/templates/analyst-dashboard-template.js`: analyst-only report definitions, layout, marker, and metadata.
- Create `web/src/features/dashboards/templates/police-station-dashboard-template.js`: adapter around the proven station report definitions and layout.
- Create `web/src/features/dashboards/templates/persona-dashboard-templates.js`: frozen registry of the three independent templates.
- Create `web/src/features/dashboards/templates/provision-dashboard-template.js`: generic idempotent report/dashboard provisioning.
- Create `web/src/features/dashboards/templates/provision-persona-dashboards.js`: role-aware orchestration and refreshed workspace return.
- Create matching `*.test.js` files for definitions, idempotency, concurrency, and preservation.
- Create `web/src/features/dashboards/ProvisionedDashboardApplication.jsx`: non-blocking provisioning boundary with retry-safe failure handling.
- Modify `web/src/app/router.jsx`: place the boundary after initial authorization and use its refreshed workspace.
- Modify `web/src/features/dashboards/PersonaDashboardRoute.jsx`: resolve specialized UI from dashboard identity, not current persona.
- Modify the three specialized workspace files: remove persona-based report filtering from stored composition and add-report choices.
- Modify `web/src/features/station-operations/StationOperationsShell.jsx`: recognize the provisioned Police Station Dashboard and avoid a duplicate legacy bootstrap.

### Task 1: Define three independent dashboard templates

**Files:**
- Create: `web/src/features/dashboards/templates/district-dashboard-template.js`
- Create: `web/src/features/dashboards/templates/analyst-dashboard-template.js`
- Create: `web/src/features/dashboards/templates/police-station-dashboard-template.js`
- Create: `web/src/features/dashboards/templates/persona-dashboard-templates.js`
- Test: `web/src/features/dashboards/templates/persona-dashboard-templates.test.js`

- [ ] **Step 1: Write the failing template-contract test**

```js
import { describe, expect, test } from 'vitest';
import { PERSONA_DASHBOARD_TEMPLATES } from './persona-dashboard-templates.js';

describe('persona dashboard templates', () => {
  test('defines three separate dashboards with unique reports and complete layouts', () => {
    expect(PERSONA_DASHBOARD_TEMPLATES.map(value => value.name)).toEqual([
      'District Intelligence Dashboard', 'Crime Analyst Dashboard', 'Police Station Dashboard',
    ]);
    for (const template of PERSONA_DASHBOARD_TEMPLATES) {
      expect(template.reports.length).toBeGreaterThan(5);
      expect(template.layout).toHaveLength(template.reports.length);
      expect(new Set(template.reports.map(report => report.name)).size).toBe(template.reports.length);
    }
    expect(PERSONA_DASHBOARD_TEMPLATES[0].reports.map(value => value.name))
      .not.toEqual(PERSONA_DASHBOARD_TEMPLATES[1].reports.map(value => value.name));
  });
});
```

- [ ] **Step 2: Run the test and verify the missing registry failure**

Run: `npm.cmd test -- --run src/features/dashboards/templates/persona-dashboard-templates.test.js`

Expected: FAIL because `persona-dashboard-templates.js` does not exist.

- [ ] **Step 3: Implement the distinct definitions**

Use frozen definitions with stable keys:

```js
export const DISTRICT_DASHBOARD_TEMPLATE = Object.freeze({
  key: 'district-intelligence/v1', name: 'District Intelligence Dashboard',
  marker: '[ACE:district-intelligence:v1:complete]', roles: ['DISTRICT_LEADERSHIP'],
  reports: Object.freeze([
    report('District Monthly FIR Trend', ['IncidentMonth'], 'line'),
    report('District Station Workload', ['PoliceStationName'], 'bar'),
    report('District Crime Category Mix', ['CrimeMajorHeadName'], 'pie'),
    report('District Case Lifecycle', ['CaseStatusLabel'], 'funnel'),
    report('District Hotspot Evidence', ['DistrictCode'], 'map'),
    report('District Investigation Backlog', ['CaseStatusLabel'], 'bar'),
  ]),
  layout: DISTRICT_LAYOUT,
});
```

The analyst template uses its own names and composition: `Analyst Incident Pattern`, `Analyst Hotspot Evidence`, `Analyst Major Offence Comparison`, `Analyst Monthly Change Signal`, `Analyst Case Status Evidence`, and `Analyst Evidence Table`. The police-station template imports `STATION_REPORTS` and `STATION_LAYOUT`, renames only the dashboard record, and retains the existing station report definitions.

- [ ] **Step 4: Run the template tests**

Run: `npm.cmd test -- --run src/features/dashboards/templates/persona-dashboard-templates.test.js src/features/station-operations/station-dashboard-template.test.js`

Expected: PASS; existing station definitions remain unchanged.

- [ ] **Step 5: Commit the template definitions**

```powershell
git add web/src/features/dashboards/templates
git commit -m "feat: define three governed dashboard templates"
```

### Task 2: Build the shared idempotent template provisioner

**Files:**
- Create: `web/src/features/dashboards/templates/provision-dashboard-template.js`
- Test: `web/src/features/dashboards/templates/provision-dashboard-template.test.js`

- [ ] **Step 1: Write failing tests for create, retry, and preservation**

```js
test('creates canonical reports and one owned dashboard', async () => {
  const result = await provisionDashboardTemplate({ api, template, reports: [], dashboards: [] });
  expect(result.dashboard.name).toBe(template.name);
  expect(api.post).toHaveBeenCalledTimes(template.reports.length + 1);
  expect(api.put).toHaveBeenCalledWith(`/v1/dashboards/${result.dashboard.id}/items`, {
    items: expect.arrayContaining([expect.objectContaining({ reportId: expect.any(String) })]),
  });
});

test('returns a completed dashboard without replacing user placements', async () => {
  const completed = { id: 'D-1', name: template.name, description: template.marker, relationship: 'OWNED' };
  await provisionDashboardTemplate({ api, template, reports, dashboards: [completed] });
  expect(api.put).not.toHaveBeenCalled();
});
```

Add a concurrent-call test that expects one in-flight operation per `api + template.key`, and a reconciliation test where POST throws after persistence and the provisioner recovers by re-listing.

- [ ] **Step 2: Run the test and verify failure**

Run: `npm.cmd test -- --run src/features/dashboards/templates/provision-dashboard-template.test.js`

Expected: FAIL because `provisionDashboardTemplate` is missing.

- [ ] **Step 3: Implement canonical matching and marker lifecycle**

```js
export async function provisionDashboardTemplate({ api, template, reports, dashboards }) {
  const completed = dashboards.find(value => value.relationship === 'OWNED'
    && value.name === template.name && value.description === template.marker);
  if (completed) return { dashboard: completed, reports };
  // Reuse canonical owned reports; create missing reports with `${template.key}/report/${index}`.
  // Create/adopt a pending dashboard, write placements once, then patch its marker to complete.
  // On ambiguous writes, re-list and verify before failing.
}
```

Use canonical object serialization from the proven station bootstrap. Completed markers are the customization boundary: never rewrite their placements.

- [ ] **Step 4: Run the provisioner tests**

Run: `npm.cmd test -- --run src/features/dashboards/templates/provision-dashboard-template.test.js`

Expected: PASS for create, retry, concurrency, and preservation.

- [ ] **Step 5: Commit the engine**

```powershell
git add web/src/features/dashboards/templates/provision-dashboard-template*
git commit -m "feat: add idempotent dashboard template provisioner"
```

### Task 3: Orchestrate role-aware provisioning and workspace refresh

**Files:**
- Create: `web/src/features/dashboards/templates/provision-persona-dashboards.js`
- Test: `web/src/features/dashboards/templates/provision-persona-dashboards.test.js`

- [ ] **Step 1: Write the failing orchestration tests**

```js
test('provisions templates authorized for the active persona and returns refreshed workspace', async () => {
  const result = await provisionPersonaDashboards({ api, workspace: districtWorkspace });
  expect(provisionDashboardTemplate).toHaveBeenCalledWith(expect.objectContaining({
    template: expect.objectContaining({ name: 'District Intelligence Dashboard' }),
  }));
  expect(api.get).toHaveBeenLastCalledWith('/v1/workspace');
  expect(result.availableDashboards).toEqual(expect.arrayContaining([
    expect.objectContaining({ name: 'District Intelligence Dashboard' }),
  ]));
});
```

Also assert that already-visible completed templates are skipped and one template failure is returned as a warning without discarding the original workspace.

- [ ] **Step 2: Run and verify failure**

Run: `npm.cmd test -- --run src/features/dashboards/templates/provision-persona-dashboards.test.js`

Expected: FAIL because the orchestrator is missing.

- [ ] **Step 3: Implement sequential role-aware orchestration**

```js
export async function provisionPersonaDashboards({ api, workspace }) {
  const eligible = PERSONA_DASHBOARD_TEMPLATES.filter(template =>
    template.roles.includes(workspace.role) || completedTemplateIsVisible(template, workspace));
  const warnings = [];
  for (const template of eligible) {
    try { await provisionDashboardTemplate({ api, template, reports, dashboards }); }
    catch (error) { warnings.push({ key: template.key, error }); }
  }
  const refreshed = (await api.get('/v1/workspace')).data;
  return { workspace: refreshed, warnings };
}
```

Sequential writes reduce duplicate remote mutations. Each persona creates only templates whose semantic sources it is authorized to define; owned results remain visible across persona switches.

- [ ] **Step 4: Run orchestration and station compatibility tests**

Run: `npm.cmd test -- --run src/features/dashboards/templates/provision-persona-dashboards.test.js src/features/station-operations/station-dashboard-template.test.js`

Expected: PASS.

- [ ] **Step 5: Commit orchestration**

```powershell
git add web/src/features/dashboards/templates/provision-persona-dashboards*
git commit -m "feat: provision persona dashboards by governed role"
```

### Task 4: Add the authenticated provisioning boundary

**Files:**
- Create: `web/src/features/dashboards/ProvisionedDashboardApplication.jsx`
- Test: `web/src/features/dashboards/ProvisionedDashboardApplication.test.jsx`
- Modify: `web/src/app/router.jsx`
- Test: `web/src/app/router.test.jsx`

- [ ] **Step 1: Write failing component tests**

```jsx
test('renders the application with the refreshed five-dashboard workspace', async () => {
  render(<ProvisionedDashboardApplication api={api} workspace={workspace}>
    {value => <output>{value.availableDashboards.map(item => item.name).join('|')}</output>}
  </ProvisionedDashboardApplication>);
  expect(await screen.findByText(/District Intelligence Dashboard/)).toBeInTheDocument();
  expect(screen.getByText(/Crime Analyst Dashboard/)).toBeInTheDocument();
  expect(screen.getByText(/Police Station Dashboard/)).toBeInTheDocument();
});

test('keeps the original workspace usable when provisioning fails', async () => {
  api.get.mockRejectedValueOnce(new Error('offline'));
  renderBoundary();
  expect(await screen.findByTestId('application')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run and verify failure**

Run: `npm.cmd test -- --run src/features/dashboards/ProvisionedDashboardApplication.test.jsx src/app/router.test.jsx`

Expected: FAIL because the boundary is missing.

- [ ] **Step 3: Implement the boundary and route integration**

The boundary loads once per `api + workspace.role`, displays a short setup status only while a matching missing template is being created, and passes either the refreshed or original workspace to a render function. Extract the existing post-authorization route tree into a component receiving `workspace`; wrap both Command Centre and AppShell branches so every persona sees the same owned dashboard library after switching.

- [ ] **Step 4: Run router tests**

Run: `npm.cmd test -- --run src/features/dashboards/ProvisionedDashboardApplication.test.jsx src/app/router.test.jsx`

Expected: PASS with existing authentication and persona routing unchanged.

- [ ] **Step 5: Commit the boundary**

```powershell
git add web/src/features/dashboards/ProvisionedDashboardApplication* web/src/app/router.jsx web/src/app/router.test.jsx
git commit -m "feat: prepare governed dashboards after authentication"
```

### Task 5: Route by dashboard identity and preserve exact composition

**Files:**
- Modify: `web/src/features/dashboards/PersonaDashboardRoute.jsx`
- Test: `web/src/features/dashboards/PersonaDashboardRoute.test.jsx`
- Modify: `web/src/features/dashboards/DistrictDashboardWorkspace.jsx`
- Modify: `web/src/features/dashboards/AnalystDashboardWorkspace.jsx`
- Modify: `web/src/features/dashboards/PoliceStationDashboardWorkspace.jsx`
- Modify: `web/src/features/dashboards/GovernedPersonaDashboardWorkspace.jsx`
- Test: the three existing workspace test files

- [ ] **Step 1: Write failing identity-routing tests**

```jsx
test.each([
  ['District Intelligence Dashboard', 'Authorized District Intelligence'],
  ['Crime Analyst Dashboard', 'Analyst Evidence Dashboard'],
  ['Police Station Dashboard', 'Police Station Dashboard'],
])('opens %s with its own presentation under another persona', async (name, heading) => {
  renderRoute({ workspace: stationWorkspaceWith({ id: 'D-X', name }), dashboardId: 'D-X' });
  expect(await screen.findByRole('heading', { name: heading })).toBeInTheDocument();
});

test('uses the ordinary dashboard page for State Crime Intelligence', () => {
  expect(dashboardWorkspaceComponent({ name: 'State Crime Intelligence' })).toBe(DashboardPage);
});
```

- [ ] **Step 2: Run and verify the current persona-based failure**

Run: `npm.cmd test -- --run src/features/dashboards/PersonaDashboardRoute.test.jsx src/features/dashboards`

Expected: FAIL because routing currently selects from `workspace.role`.

- [ ] **Step 3: Implement identity routing and remove report predicates**

```js
const SPECIALIZED_BY_NAME = Object.freeze({
  'District Intelligence Dashboard': DistrictDashboardWorkspace,
  'Crime Analyst Dashboard': AnalystDashboardWorkspace,
  'Police Station Dashboard': PoliceStationDashboardWorkspace,
});

export function dashboardWorkspaceComponent(dashboard) {
  return SPECIALIZED_BY_NAME[dashboard?.name] ?? DashboardPage;
}
```

Resolve the summary from `workspace.availableDashboards` by `dashboardId`. Do not pass a persona source predicate into `useCommandCenterDashboard` or the add-report drawer; the dashboard's stored items remain intact and the API remains the visibility authority.

- [ ] **Step 4: Run all dashboard workspace tests**

Run: `npm.cmd test -- --run src/features/dashboards src/features/command-center/useCommandCenterDashboard.test.jsx`

Expected: PASS; State Crime Intelligence no longer masquerades as a persona dashboard and Police Station placements no longer disappear.

- [ ] **Step 5: Commit identity routing**

```powershell
git add web/src/features/dashboards
git commit -m "fix: open dashboards by governed template identity"
```

### Task 6: Preserve Station Operations home compatibility

**Files:**
- Modify: `web/src/features/station-operations/StationOperationsShell.jsx`
- Modify: `web/src/features/station-operations/station-dashboard-template.js`
- Test: `web/src/features/station-operations/StationOperationsShell.test.jsx`
- Test: `web/src/features/station-operations/station-dashboard-template.test.js`

- [ ] **Step 1: Write the failing compatibility test**

```jsx
test('reuses the provisioned Police Station Dashboard without creating Station Operations again', async () => {
  renderShell({ workspace: stationWorkspaceWith({
    id: 'D-POLICE', name: 'Police Station Dashboard',
    description: '[ACE:station-operations:v1:complete]', relationship: 'OWNED',
  }) });
  expect(await screen.findByRole('heading', { name: 'Station Operations' })).toBeInTheDocument();
  expect(api.post).not.toHaveBeenCalledWith('/v1/dashboards', expect.anything());
});
```

- [ ] **Step 2: Run and verify failure**

Run: `npm.cmd test -- --run src/features/station-operations/StationOperationsShell.test.jsx src/features/station-operations/station-dashboard-template.test.js`

Expected: FAIL because `isStationDashboard` recognizes only `Station Operations`.

- [ ] **Step 3: Recognize the new dashboard while preserving legacy dashboards**

Update the predicate to accept the completed marker or either supported name. Keep legacy adoption and duplicate-race repair, but ensure new provisioning does not change the user's landing preference outside Station Operations.

- [ ] **Step 4: Run station tests**

Run: `npm.cmd test -- --run src/features/station-operations`

Expected: PASS.

- [ ] **Step 5: Commit station compatibility**

```powershell
git add web/src/features/station-operations
git commit -m "fix: reuse provisioned police station dashboard"
```

### Task 7: Full verification and deployed-browser contract

**Files:**
- Modify only if a failing regression demonstrates a necessary compatibility fix.

- [ ] **Step 1: Run focused feature tests**

Run: `npm.cmd test -- --run src/features/dashboards src/features/station-operations src/features/command-center`

Expected: all focused tests pass.

- [ ] **Step 2: Run the complete web suite**

Run: `npm.cmd test`

Expected: all test files and tests pass.

- [ ] **Step 3: Build and check bundle budgets**

Run: `npm.cmd run web:build`

Expected: Vite build succeeds and `PASS: web bundle budgets` is printed.

- [ ] **Step 4: Review the final diff and workspace isolation**

Run: `git diff --check` and `git status --short`.

Expected: no whitespace errors; only planned web files and plan/spec changes belong to the feature branch. Unrelated backend, presentation, and artifact files in the user's main worktree remain untouched.

- [ ] **Step 5: Browser-test the exact three dashboards after deployment**

On `https://ace.onslate.in`, verify the Dashboard Library contains all five named dashboards. Open District Intelligence Dashboard, Crime Analyst Dashboard, and Police Station Dashboard under at least one non-owning persona; confirm each keeps its distinct report titles, report results are viewer-scoped, and the Dashboard Options edit menu exposes Add chart, Cancel editing, and Save dashboard. Do not save destructive browser-test changes.

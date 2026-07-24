# Command Centre Dashboard Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the empty Command Centre canvas with a functional governed dashboard workspace that opens the default dashboard, discovers authorized dashboards, renders real reports, switches tabs, supports view/edit modes, resizes report placements, and saves layouts.

**Architecture:** Keep the existing Command Centre shell and backend dashboard/report contracts. Add a focused workspace controller that loads authorized dashboard definitions and executes referenced reports independently, then compose small discovery, toolbar, canvas, and report-surface components around it. Treat dashboard layouts as staged client state in edit mode and persist through the existing `PUT /v1/dashboards/{dashboardId}/items` endpoint.

**Tech Stack:** React 19, React Router 7, Vitest and Testing Library, existing Catalyst API client, existing MapLibre/deck.gl embedded map component, CSS custom properties and pointer events.

---

## File Structure

- Create `web/src/features/command-center/command-center-dashboard-model.js`: normalize authorized dashboards, tabs, placements, and report executions without UI concerns.
- Create `web/src/features/command-center/useCommandCenterDashboard.js`: own dashboard selection, per-report loading, staged editing, save/cancel, and stale/error state.
- Create `web/src/features/command-center/CommandCenterDashboardPicker.jsx`: recent/owned/shared/system discovery panel and Open all navigation.
- Create `web/src/features/command-center/CommandCenterWorkspaceToolbar.jsx`: selected dashboard context, filters, collapsible tabs, edit/save/cancel, and presentation density.
- Create `web/src/features/command-center/CommandCenterReportSurface.jsx`: authentic governed report metadata, result rendering, isolated failure state, and edit affordances.
- Create `web/src/features/command-center/CommandCenterDashboardCanvas.jsx`: free placement, pointer resizing/moving, keyboard alternatives, and empty states.
- Create `web/src/features/command-center/CommandCenterDashboardWorkspace.jsx`: compose the controller, picker, toolbar, and canvas.
- Modify `web/src/features/command-center/CommandCenterRail.jsx`: expose the Dashboard rail action as a functional picker trigger.
- Modify `web/src/features/command-center/CommandCenterShell.jsx`: receive `api` and `workspace`, render the dashboard workspace, and coordinate shell menus.
- Modify `web/src/app/router.jsx`: pass the governed API and workspace into Command Centre and preserve safe route/query behavior.
- Modify `web/src/styles/app.css`: add native Catalyst-aligned dashboard, report, edit, dark, presentation, and responsive styles.
- Create focused tests beside each new module and extend router/shell/responsive tests.

### Task 0: Expose Safe Dashboard Relationship Metadata

**Files:**
- Modify: `src/backend/reporting/dashboard-service.mjs`
- Modify: `functions/crime_intelligence_api/app/src/backend/reporting/dashboard-service.mjs`
- Modify: `tests/backend/reporting-workspaces.test.mjs`

- [ ] **Step 1: Write failing service tests**

Extend the reporting workspace tests with an owner, a role-shared dashboard, and a global default. Assert `listDashboards` returns only visible dashboards and decorates each with exactly one safe relationship value:

```js
expect(result.data.map(({ id, relationship }) => ({ id, relationship }))).toEqual([
  { id: 'D-OWNED', relationship: 'OWNED' },
  { id: 'D-SHARED', relationship: 'SHARED' },
  { id: 'D-SYSTEM', relationship: 'SYSTEM' },
]);
```

Do not expose share targets or unrelated owner identity.

- [ ] **Step 2: Run the backend test and verify RED**

Run: `npm.cmd test -- tests/backend/reporting-workspaces.test.mjs`

Expected: FAIL because dashboard summaries do not contain `relationship`.

- [ ] **Step 3: Add relationship classification to `dashboard-service.list`**

Classify after authorization succeeds:

```js
if (owns(dashboard, access)) relationship = 'OWNED';
else if (dashboard.visibility === 'GLOBAL' || dashboard.defaultRole === access.role) relationship = 'SYSTEM';
else relationship = 'SHARED';
visible.push({ ...dashboard, relationship });
```

Apply the identical tested source change to the deployable function mirror.

- [ ] **Step 4: Run backend regression tests**

Run: `npm.cmd test -- tests/backend/reporting-workspaces.test.mjs tests/backend/api-contract.test.mjs`

Expected: dashboard relationship tests and API contract tests pass.

- [ ] **Step 5: Commit**

```powershell
git add src/backend/reporting/dashboard-service.mjs functions/crime_intelligence_api/app/src/backend/reporting/dashboard-service.mjs tests/backend/reporting-workspaces.test.mjs
git commit -m "feat: classify authorized dashboards"
```

### Task 1: Normalize Governed Dashboard Data

**Files:**
- Create: `web/src/features/command-center/command-center-dashboard-model.js`
- Create: `web/src/features/command-center/command-center-dashboard-model.test.js`

- [ ] **Step 1: Write failing model tests**

```js
import { describe, expect, test } from 'vitest';
import { dashboardSections, normalizeDashboard, placementStyle } from './command-center-dashboard-model.js';

test('groups only authorized dashboard summaries by ownership metadata', () => {
  const sections = dashboardSections([
    { id: 'D-1', name: 'State overview', relationship: 'SYSTEM' },
    { id: 'D-2', name: 'Night crime', relationship: 'OWNED' },
    { id: 'D-3', name: 'Election watch', relationship: 'SHARED' },
  ]);
  expect(sections.system.map(item => item.id)).toEqual(['D-1']);
  expect(sections.owned.map(item => item.id)).toEqual(['D-2']);
  expect(sections.shared.map(item => item.id)).toEqual(['D-3']);
});

test('normalizes legacy dashboard items into the overview tab', () => {
  const dashboard = normalizeDashboard({ id: 'D-1', name: 'State overview', items: [
    { id: 'I-1', reportId: 'R-1', column: 1, row: 1, width: 4, height: 3 },
  ] });
  expect(dashboard.tabs[0].id).toBe('overview');
  expect(dashboard.tabs[0].items[0].reportId).toBe('R-1');
});

test('converts a twelve-column placement into bounded percentages', () => {
  expect(placementStyle({ column: 4, row: 2, width: 3, height: 2 })).toMatchObject({
    left: '25%', width: '25%', top: '96px', height: '192px',
  });
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `npm.cmd test -- command-center-dashboard-model.test.js`

Expected: FAIL because the model module does not exist.

- [ ] **Step 3: Implement immutable normalization helpers**

```js
const OVERVIEW = Object.freeze({ id: 'overview', name: 'Overview' });

export function dashboardSections(items = []) {
  const visible = Array.isArray(items) ? items : [];
  return Object.freeze({
    recent: visible.slice(0, 5),
    owned: visible.filter(item => item.relationship === 'OWNED'),
    shared: visible.filter(item => item.relationship === 'SHARED'),
    system: visible.filter(item => item.relationship === 'SYSTEM'),
  });
}

export function normalizeDashboard(value = {}) {
  const declaredTabs = Array.isArray(value.tabs) && value.tabs.length ? value.tabs : [OVERVIEW];
  const items = Array.isArray(value.items) ? value.items : [];
  return Object.freeze({ ...value, tabs: declaredTabs.map(tab => Object.freeze({
    ...tab, items: items.filter(item => (item.tabId ?? OVERVIEW.id) === tab.id),
  })) });
}

export function placementStyle(item) {
  return Object.freeze({
    left: `${((item.column - 1) / 12) * 100}%`, width: `${(item.width / 12) * 100}%`,
    top: `${(item.row - 1) * 96}px`, height: `${item.height * 96}px`,
  });
}
```

- [ ] **Step 4: Run the model tests and verify GREEN**

Run: `npm.cmd test -- command-center-dashboard-model.test.js`

Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```powershell
git add web/src/features/command-center/command-center-dashboard-model.js web/src/features/command-center/command-center-dashboard-model.test.js
git commit -m "feat: model command center dashboards"
```

### Task 2: Load Dashboards and Execute Reports Independently

**Files:**
- Create: `web/src/features/command-center/useCommandCenterDashboard.js`
- Create: `web/src/features/command-center/useCommandCenterDashboard.test.jsx`

- [ ] **Step 1: Write failing controller tests**

```jsx
import { renderHook, waitFor } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { useCommandCenterDashboard } from './useCommandCenterDashboard.js';

test('loads the landing dashboard and contains one failed report', async () => {
  const api = { get: vi.fn(async path => ({ data: path === '/v1/dashboards/D-1'
    ? { id: 'D-1', items: [{ id: 'I-1', reportId: 'R-1', column: 1, row: 1, width: 6, height: 3 }, { id: 'I-2', reportId: 'R-2', column: 7, row: 1, width: 6, height: 3 }] }
    : [] })), post: vi.fn(async path => {
      if (path.includes('R-2')) throw Object.assign(new Error('unavailable'), { code: 'REPORT_FAILED' });
      return { data: { definition: { name: 'Crime trend', definition: { visualization: { type: 'line' } } }, result: { data: { items: [{ day: '2026-07-24', case_count: 12 }] } } } };
    }) };
  const workspace = { landingDashboard: { id: 'D-1' }, availableDashboards: [{ id: 'D-1', name: 'State overview' }] };
  const { result } = renderHook(() => useCommandCenterDashboard({ api, workspace }));
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.dashboard.items[0].status).toBe('ready');
  expect(result.current.dashboard.items[1].status).toBe('error');
});
```

- [ ] **Step 2: Run the hook test and verify RED**

Run: `npm.cmd test -- useCommandCenterDashboard.test.jsx`

Expected: FAIL because the hook does not exist.

- [ ] **Step 3: Implement the controller**

Implement a hook that:

```js
const selectedId = requestedId ?? workspace.landingDashboard?.id ?? workspace.availableDashboards?.[0]?.id;
const definition = (await api.get(`/v1/dashboards/${selectedId}`)).data;
const executions = await Promise.allSettled((definition.items ?? []).map(item =>
  api.post(`/v1/reports/${item.reportId}/execute`, {})));
```

Map each settled result onto its placement with `status`, `title`, `visualization`, `data`, `mapExecution`, `freshness`, and safe `errorCode`. Expose `selectDashboard`, `selectTab`, `beginEdit`, `stageItems`, `cancelEdit`, and `saveItems`. `saveItems` calls:

```js
await api.put(`/v1/dashboards/${dashboard.id}/items`, {
  items: stagedItems.map(({ reportId, column, row, width, height }) => ({ reportId, column, row, width, height })),
});
```

Retain the last loaded dashboard while refreshing and mark it `stale` when refresh fails.

- [ ] **Step 4: Verify focused hook tests**

Run: `npm.cmd test -- useCommandCenterDashboard.test.jsx`

Expected: loading, isolation, selection, save, cancel, and stale-state tests pass.

- [ ] **Step 5: Commit**

```powershell
git add web/src/features/command-center/useCommandCenterDashboard.js web/src/features/command-center/useCommandCenterDashboard.test.jsx
git commit -m "feat: load governed command center dashboards"
```

### Task 3: Add Dashboard Discovery and Collapsible Tabs

**Files:**
- Create: `web/src/features/command-center/CommandCenterDashboardPicker.jsx`
- Create: `web/src/features/command-center/CommandCenterDashboardPicker.test.jsx`
- Create: `web/src/features/command-center/CommandCenterWorkspaceToolbar.jsx`
- Create: `web/src/features/command-center/CommandCenterWorkspaceToolbar.test.jsx`
- Modify: `web/src/features/command-center/CommandCenterRail.jsx`

- [ ] **Step 1: Write failing interaction tests**

Test that the Dashboard rail button opens a dialog-like panel named `Dashboards`; search filters authorized summaries; Recent, Owned by you, Shared with you, and System sections render only when populated; selecting a dashboard invokes `onSelect(id)` and closes; Open all invokes `onOpenAll`; the compact tab button opens a menu and selecting a tab invokes `onTab(id)`.

```jsx
fireEvent.click(screen.getByRole('button', { name: 'Dashboards' }));
expect(screen.getByRole('dialog', { name: 'Dashboards' })).toBeInTheDocument();
fireEvent.change(screen.getByRole('searchbox', { name: 'Search dashboards' }), { target: { value: 'night' } });
fireEvent.click(screen.getByRole('button', { name: 'Night crime' }));
expect(onSelect).toHaveBeenCalledWith('D-2');
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `npm.cmd test -- CommandCenterDashboardPicker.test.jsx CommandCenterWorkspaceToolbar.test.jsx CommandCenterShell.test.jsx`

Expected: FAIL because the picker and toolbar do not exist and the rail button only changes local selection.

- [ ] **Step 3: Implement picker, toolbar, and rail contract**

The rail accepts `onDashboardOpen` and maps the existing `apps`/grid destination to an accessible `Dashboards` button. The picker uses `dashboardSections`, closes after selection, restores focus to the rail trigger, and never derives inaccessible resources client-side. The toolbar renders dashboard name, scope, freshness, tabs, Edit/Save/Cancel, and Present actions from passed state.

- [ ] **Step 4: Run interaction tests and verify GREEN**

Run: `npm.cmd test -- CommandCenterDashboardPicker.test.jsx CommandCenterWorkspaceToolbar.test.jsx CommandCenterShell.test.jsx`

Expected: picker, tab, close, focus, and shell regression tests pass.

- [ ] **Step 5: Commit**

```powershell
git add web/src/features/command-center/CommandCenterDashboardPicker.jsx web/src/features/command-center/CommandCenterDashboardPicker.test.jsx web/src/features/command-center/CommandCenterWorkspaceToolbar.jsx web/src/features/command-center/CommandCenterWorkspaceToolbar.test.jsx web/src/features/command-center/CommandCenterRail.jsx web/src/features/command-center/CommandCenterShell.test.jsx
git commit -m "feat: add command center dashboard discovery"
```

### Task 4: Render Authentic Governed Reports

**Files:**
- Create: `web/src/features/command-center/CommandCenterReportSurface.jsx`
- Create: `web/src/features/command-center/CommandCenterReportSurface.test.jsx`
- Create: `web/src/features/command-center/CommandCenterDashboardCanvas.jsx`
- Create: `web/src/features/command-center/CommandCenterDashboardCanvas.test.jsx`

- [ ] **Step 1: Write failing report-surface tests**

Cover ready scalar/table/chart/map results, freshness, jurisdiction/time metadata, safe unavailable state, evidence navigation, and edit controls hidden in view mode. Inject a test map component to prove a map report does not affect siblings.

```jsx
expect(screen.getByRole('heading', { name: 'Crime trend' })).toBeInTheDocument();
expect(screen.getByText('Updated 2 minutes ago')).toBeInTheDocument();
expect(screen.queryByRole('button', { name: 'Edit Crime trend report' })).not.toBeInTheDocument();
expect(screen.getByRole('alert', { name: 'Report unavailable' })).toHaveTextContent('Reference REPORT_FAILED');
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `npm.cmd test -- CommandCenterReportSurface.test.jsx CommandCenterDashboardCanvas.test.jsx`

Expected: FAIL because the report and canvas components do not exist.

- [ ] **Step 3: Implement report surfaces using existing visualization paths**

Reuse `EmbeddedMapView` for map executions. Render tabular result fields honestly for unsupported chart shapes rather than fabricating metrics. Add a small native SVG renderer only for governed categorical/time-series rows with explicit numeric fields. Every surface renders its real report name, returned scope/freshness metadata, safe failure reference, refresh, and Open report link.

- [ ] **Step 4: Implement canvas composition**

Use `placementStyle` for absolute placement inside a relative canvas. Filter placements by active tab. Render purposeful states for no dashboard, no tab reports, loading, unauthorized/unavailable, and stale data. Keep each report in an error boundary so a render error is contained.

- [ ] **Step 5: Run report and canvas tests**

Run: `npm.cmd test -- CommandCenterReportSurface.test.jsx CommandCenterDashboardCanvas.test.jsx DashboardWorkspace.test.jsx`

Expected: all new tests and existing dashboard rendering tests pass.

- [ ] **Step 6: Commit**

```powershell
git add web/src/features/command-center/CommandCenterReportSurface.jsx web/src/features/command-center/CommandCenterReportSurface.test.jsx web/src/features/command-center/CommandCenterDashboardCanvas.jsx web/src/features/command-center/CommandCenterDashboardCanvas.test.jsx
git commit -m "feat: render governed command center reports"
```

### Task 5: Add Staged Free-Canvas Editing

**Files:**
- Modify: `web/src/features/command-center/CommandCenterDashboardCanvas.jsx`
- Modify: `web/src/features/command-center/CommandCenterDashboardCanvas.test.jsx`
- Modify: `web/src/features/command-center/CommandCenterReportSurface.jsx`
- Modify: `web/src/features/command-center/CommandCenterReportSurface.test.jsx`

- [ ] **Step 1: Write failing move, resize, and cancel tests**

Test pointer movement translated to the persisted twelve-column contract, arbitrary width/height changes within server bounds, keyboard move/resize alternatives, hover/focus report controls, Cancel restoration, and unsaved-change confirmation.

```jsx
fireEvent.pointerDown(screen.getByRole('button', { name: 'Move Crime trend' }), { clientX: 100, clientY: 100 });
fireEvent.pointerMove(document, { clientX: 260, clientY: 196 });
fireEvent.pointerUp(document);
expect(onStage).toHaveBeenCalledWith(expect.arrayContaining([
  expect.objectContaining({ id: 'I-1', column: 3, row: 2 }),
]));
```

- [ ] **Step 2: Run tests and verify RED**

Run: `npm.cmd test -- CommandCenterDashboardCanvas.test.jsx CommandCenterReportSurface.test.jsx`

Expected: FAIL because edit gestures and report controls are absent.

- [ ] **Step 3: Implement accessible edit gestures**

Use pointer capture on explicit move and resize handles, calculate columns from canvas width, calculate rows in 96-pixel increments, clamp `column + width - 1 <= 12`, and keep minimum width/height at one. Add arrow-key movement and Shift+Arrow resizing. Announce the resulting column, row, width, and height through a polite live region.

- [ ] **Step 4: Add report edit navigation and placement actions**

In edit mode expose Edit report, duplicate placement, refresh, and remove placement. Edit report navigates to `/reports/{reportId}` with safe `returnDashboard`, `returnTab`, and `returnPlacement` query values produced through the governed runtime helpers. Placement actions change only staged dashboard items.

- [ ] **Step 5: Run edit tests and verify GREEN**

Run: `npm.cmd test -- CommandCenterDashboardCanvas.test.jsx CommandCenterReportSurface.test.jsx useCommandCenterDashboard.test.jsx`

Expected: all move, resize, keyboard, save/cancel, and safe-navigation tests pass.

- [ ] **Step 6: Commit**

```powershell
git add web/src/features/command-center/CommandCenterDashboardCanvas.jsx web/src/features/command-center/CommandCenterDashboardCanvas.test.jsx web/src/features/command-center/CommandCenterReportSurface.jsx web/src/features/command-center/CommandCenterReportSurface.test.jsx web/src/features/command-center/useCommandCenterDashboard.js web/src/features/command-center/useCommandCenterDashboard.test.jsx
git commit -m "feat: edit command center dashboard layouts"
```

### Task 6: Integrate the Real Workspace into Command Centre

**Files:**
- Create: `web/src/features/command-center/CommandCenterDashboardWorkspace.jsx`
- Create: `web/src/features/command-center/CommandCenterDashboardWorkspace.test.jsx`
- Modify: `web/src/features/command-center/CommandCenterShell.jsx`
- Modify: `web/src/features/command-center/CommandCenterShell.test.jsx`
- Modify: `web/src/app/router.jsx`
- Modify: `web/src/app/router.test.jsx`

- [ ] **Step 1: Write failing integration tests**

Render `Application` with a governed presenter workspace containing `landingDashboard` and `availableDashboards`. Assert the default dashboard endpoint and report execution endpoint are called, real report content appears, the dashboard picker changes dashboards in place, and persona/all-workspace routing continues to preserve `release`.

- [ ] **Step 2: Run integration tests and verify RED**

Run: `npm.cmd test -- CommandCenterDashboardWorkspace.test.jsx CommandCenterShell.test.jsx router.test.jsx`

Expected: FAIL because `CommandCenterShell` does not receive `api` or `workspace` and its canvas is empty.

- [ ] **Step 3: Compose and route the workspace**

Render:

```jsx
<CommandCenterDashboardWorkspace
  api={api}
  workspace={workspace}
  onOpenAll={() => navigate({ pathname: '/dashboards', search: personaSearch(location.search, 'COMMAND_CENTER') })}
/>
```

Pass `api` and `workspace` from the `requestedPersona === 'COMMAND_CENTER'` router branch. Preserve the existing presenter authorization check, persona picker, settings menu, and all-workspaces behavior.

- [ ] **Step 4: Run integration tests and verify GREEN**

Run: `npm.cmd test -- CommandCenterDashboardWorkspace.test.jsx CommandCenterShell.test.jsx router.test.jsx`

Expected: the governed default dashboard loads and every existing Command Centre navigation test still passes.

- [ ] **Step 5: Commit**

```powershell
git add web/src/features/command-center/CommandCenterDashboardWorkspace.jsx web/src/features/command-center/CommandCenterDashboardWorkspace.test.jsx web/src/features/command-center/CommandCenterShell.jsx web/src/features/command-center/CommandCenterShell.test.jsx web/src/app/router.jsx web/src/app/router.test.jsx
git commit -m "feat: integrate command center dashboard workspace"
```

### Task 7: Apply Native Catalyst Styling and Presentation Density

**Files:**
- Modify: `web/src/styles/app.css`
- Modify: `web/src/features/command-center/CommandCenterResponsive.test.js`
- Modify: `web/src/features/command-center/CommandCenterDashboardWorkspace.test.jsx`

- [ ] **Step 1: Write failing CSS contract and accessibility tests**

Assert the default light appearance, dark semantic tokens, analytical report spacing, command-wall density class, picker overlay, edit handles, focus-visible styles, reduced motion, and narrow-screen editing constraint. Test that Present toggles `command-center-dashboard--wall` without changing report data.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `npm.cmd test -- CommandCenterResponsive.test.js CommandCenterDashboardWorkspace.test.jsx`

Expected: FAIL because the workspace style contracts do not exist.

- [ ] **Step 3: Add authentic application styles**

Use existing `--color-*`, typography, border, and surface conventions from `app.css`. Avoid a new visual token family. Use borders and elevation only to express hierarchy, semantic colors only for data meaning, and the existing Roboto stack. Add dark values under the existing Command Centre appearance selector and make command-wall mode reduce gaps, toolbar height, and report metadata density without browser zoom.

- [ ] **Step 4: Add responsive and reduced-motion behavior**

At unsupported narrow widths keep view mode usable, disable the Edit Dashboard action with an explanation, and preserve horizontal canvas integrity. Restore focus, visible outlines, minimum 44-pixel targets, and `prefers-reduced-motion` behavior.

- [ ] **Step 5: Run focused and full frontend verification**

Run:

```powershell
npm.cmd test -- CommandCenterResponsive.test.js CommandCenterDashboardWorkspace.test.jsx
npm.cmd test
npm.cmd run build
```

Expected: all frontend tests pass and Vite produces the production bundle; existing size warnings may remain but no build error is allowed.

- [ ] **Step 6: Commit**

```powershell
git add web/src/styles/app.css web/src/features/command-center/CommandCenterResponsive.test.js web/src/features/command-center/CommandCenterDashboardWorkspace.test.jsx
git commit -m "style: finish catalyst command center workspace"
```

### Task 8: Verify, Deploy, and Inspect the Real Application

**Files:**
- Modify only if verification reveals a scoped defect.

- [ ] **Step 1: Run repository verification**

```powershell
git diff --check
npm.cmd test
npm.cmd run build
npm.cmd run catalyst:preflight:remote
```

Expected: clean diff, all tests pass, build succeeds, preflight reports Development, synthetic-only, correct branch, and clean Git status.

- [ ] **Step 2: Deploy only the existing Slate target**

Run: `catalyst.cmd deploy --only slate:ksp-crime-intelligence`

Expected: Catalyst reports the Slate deployment initiated/completed. Do not deploy functions or mutate production.

- [ ] **Step 3: Verify live desktop behavior at 100% zoom**

Using the in-app browser, verify the new asset hash is active and inspect:

- default governed dashboard content;
- Dashboard rail picker sections and selection;
- Open all dashboard navigation;
- tab menu;
- view/edit transition;
- move and resize persistence after reload;
- cancel restoration;
- isolated failed report;
- analytical/command-wall density;
- light/dark appearance; and
- persona and All workspaces menus.

- [ ] **Step 4: Verify narrow view and accessibility**

Verify no shell overlay or accidental page zoom, view mode remains usable, editing explains its desktop requirement, tab/picker focus is restored, and keyboard report movement/resizing announces changes.

- [ ] **Step 5: Record final evidence**

Report the deployed commit, live URL, test totals, build result, measured shell dimensions, dashboard/report requests observed, and any backend data limitation that produced an honest empty state.

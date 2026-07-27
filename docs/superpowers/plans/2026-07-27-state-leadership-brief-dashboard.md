# State Leadership Brief Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give `STATE_LEADERSHIP` a distinct, editable Catalyst-style `State Leadership Brief` homepage matching the approved reference without changing Command Center or any other persona/dashboard.

**Architecture:** Add a State Leadership-only idempotent template that reuses or creates five governed reports and one owned dashboard through existing APIs. A focused bootstrap hook selects that dashboard only inside `StateLeadershipDashboard`; the shared dashboard controller remains generic and Command Center keeps its existing landing identity. State-specific header, verified-run card, filters, action menu, and responsive CSS wrap the existing editable canvas.

**Tech Stack:** React 19, React Router 7, Vitest/Testing Library, existing dashboard/report APIs, CSS, Lucide icons, Catalyst Slate.

---

## File map

- Create `web/src/features/intelligence/state-leadership-brief-template.js`: immutable governed report definitions, default placements, and idempotent dashboard creation.
- Create `web/src/features/intelligence/state-leadership-brief-template.test.js`: proves reuse, creation, exact layout, and Command Center isolation.
- Create `web/src/features/intelligence/useStateLeadershipBrief.js`: State Leadership-only bootstrap state that supplies the dedicated dashboard to the shared controller.
- Create `web/src/features/intelligence/useStateLeadershipBrief.test.jsx`: proves existing-dashboard selection, one-time creation, cancellation safety, and bounded errors.
- Create `web/src/features/intelligence/StateLeadershipDashboardMenu.jsx`: accessible three-dot menu for edit, add, manage, save, and cancel actions.
- Create `web/src/features/intelligence/StateLeadershipDashboardMenu.test.jsx`: menu interaction and authorization tests.
- Modify `web/src/features/intelligence/StateLeadershipDashboard.jsx`: compose the State-specific bootstrap, reference header, status card, filters, menu, drawer, and existing editable canvas.
- Modify `web/src/features/intelligence/StateLeadershipDashboard.test.jsx`: reference composition, editing, report isolation, and other-dashboard non-mutation tests.
- Modify `web/src/features/command-center/useCommandCenterDashboard.js`: remove the State-specific `State Crime Intelligence` name override so the hook honors its supplied landing dashboard generically.
- Modify `web/src/features/command-center/useCommandCenterDashboard.test.jsx`: replace the legacy name-coupling test with generic landing/requested-dashboard precedence tests.
- Modify `web/src/styles/app.css`: Catalyst-style State Leadership composition and responsive contracts.
- Modify `web/src/styles/viewport-layout.test.js`: desktop/mobile overflow and layout assertions.

### Task 1: Define the isolated State Leadership template

**Files:**
- Create: `web/src/features/intelligence/state-leadership-brief-template.js`
- Create: `web/src/features/intelligence/state-leadership-brief-template.test.js`

- [ ] **Step 1: Write the failing template tests**

```js
import { expect, test, vi } from 'vitest';
import { createStateLeadershipBrief, STATE_LEADERSHIP_BRIEF_LAYOUT, STATE_LEADERSHIP_BRIEF_REPORTS } from './state-leadership-brief-template.js';

test('creates a dedicated five-report State Leadership brief without touching Command Center dashboards', async () => {
  const api = {
    get: vi.fn(async path => path === '/v1/reports' ? { data: [] } : { data: [] }),
    post: vi.fn(async (path, body) => ({ data: { id: path === '/v1/dashboards' ? 'D-LEADERSHIP' : `R-${body.name}`, ...body } })),
    put: vi.fn(async () => ({ data: [] })),
  };
  const dashboards = [{ id: 'D-COMMAND', name: 'State Crime Intelligence', relationship: 'OWNED' }];
  const created = await createStateLeadershipBrief({ api, dashboards });
  expect(created).toMatchObject({ id: 'D-LEADERSHIP', name: 'State Leadership Brief' });
  expect(api.post).toHaveBeenCalledWith('/v1/dashboards', expect.objectContaining({ name: 'State Leadership Brief' }));
  expect(api.put).toHaveBeenCalledWith('/v1/dashboards/D-LEADERSHIP/items', {
    items: expect.arrayContaining(STATE_LEADERSHIP_BRIEF_LAYOUT.map((layout, index) => expect.objectContaining(layout))),
  });
  expect(dashboards[0]).toEqual({ id: 'D-COMMAND', name: 'State Crime Intelligence', relationship: 'OWNED' });
  expect(STATE_LEADERSHIP_BRIEF_REPORTS).toHaveLength(5);
});

test('reuses the owned brief and existing named reports idempotently', async () => {
  const reports = STATE_LEADERSHIP_BRIEF_REPORTS.map((definition, index) => ({ id: `R-${index}`, name: definition.name }));
  const dashboard = { id: 'D-LEADERSHIP', name: 'State Leadership Brief', relationship: 'OWNED' };
  const api = { get: vi.fn(async () => ({ data: reports })), post: vi.fn(), put: vi.fn(async () => ({ data: [] })) };
  expect(await createStateLeadershipBrief({ api, dashboards: [dashboard] })).toBe(dashboard);
  expect(api.post).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run the template test and verify RED**

Run: `npm.cmd test -- --run src/features/intelligence/state-leadership-brief-template.test.js` from `web`.

Expected: FAIL because the template module does not exist.

- [ ] **Step 3: Implement the five governed definitions and placements**

```js
const reportStyle = overrides => ({
  titleVisible: true, subtitleVisible: true, legend: 'right', valueLabels: true,
  palette: 'ksp', tableDensity: 'compact', ...overrides,
});

export const STATE_LEADERSHIP_BRIEF_REPORTS = Object.freeze([
  { name: 'Crime Category Composition', description: 'Statewide category distribution.', sourceKey: 'catalog.caseMaster', dimensions: ['CrimeMajorHeadName'], measures: [{ field: 'RecordCount', aggregate: 'sum' }], filters: [], sort: [{ field: 'RecordCount_sum', direction: 'desc' }], visualization: { type: 'pie', variant: 'doughnut' }, style: reportStyle({ legend: 'right' }), limit: 8 },
  { name: 'District Crime Volume & Movement', description: 'Highest-volume Karnataka districts.', sourceKey: 'catalog.caseMaster', dimensions: ['DistrictName'], measures: [{ field: 'RecordCount', aggregate: 'sum' }], filters: [], sort: [{ field: 'RecordCount_sum', direction: 'desc' }], visualization: { type: 'bar', variant: 'horizontal' }, style: reportStyle({ legend: 'none' }), limit: 10 },
  { name: '24-Hour Crime Occurrence Curve', description: 'Incident demand across the 24-hour cycle.', sourceKey: 'catalog.caseMaster', dimensions: ['IncidentHour'], measures: [{ field: 'RecordCount', aggregate: 'sum' }], filters: [], sort: [{ field: 'IncidentHour', direction: 'asc' }], visualization: { type: 'line', variant: 'area' }, style: reportStyle({ legend: 'none' }), limit: 24 },
  { name: 'Crime-Mix Divergence from State Baseline', description: 'District and category comparison for unusual concentration review.', sourceKey: 'catalog.caseMaster', dimensions: ['DistrictName', 'CrimeMajorHeadName'], measures: [{ field: 'RecordCount', aggregate: 'sum' }], filters: [], sort: [{ field: 'RecordCount_sum', direction: 'desc' }], visualization: { type: 'table' }, style: reportStyle({ legend: 'none' }), limit: 31 },
  { name: 'Leadership Intervention Queue', description: 'Governed intelligence alerts requiring leadership review.', sourceKey: 'alerts', dimensions: ['alertType', 'state', 'createdAt'], measures: [{ field: 'severity', aggregate: 'avg' }], filters: [], sort: [{ field: 'createdAt', direction: 'desc' }], visualization: { type: 'table' }, style: reportStyle({ legend: 'none' }), limit: 10 },
]);

export const STATE_LEADERSHIP_BRIEF_LAYOUT = Object.freeze([
  { column: 1, row: 1, width: 6, height: 4 }, { column: 7, row: 1, width: 6, height: 4 },
  { column: 1, row: 5, width: 6, height: 4 }, { column: 7, row: 5, width: 6, height: 4 },
  { column: 1, row: 9, width: 12, height: 4 },
]);

export async function createStateLeadershipBrief({ api, dashboards = [] }) {
  const response = await api.get('/v1/reports');
  const existingReports = Array.isArray(response?.data) ? response.data : response?.data?.items ?? [];
  const reports = [];
  for (const definition of STATE_LEADERSHIP_BRIEF_REPORTS) {
    const existing = existingReports.find(report => report.name === definition.name);
    reports.push(existing ?? (await api.post('/v1/reports', definition)).data);
  }
  const existingDashboard = dashboards.find(item => item.name === 'State Leadership Brief' && item.relationship === 'OWNED');
  const dashboard = existingDashboard ?? (await api.post('/v1/dashboards', {
    name: 'State Leadership Brief',
    description: 'Statewide category, district, time-pattern, divergence, and intervention intelligence.',
  })).data;
  if (!existingDashboard) await api.put(`/v1/dashboards/${dashboard.id}/items`, {
    items: reports.map((report, index) => ({ reportId: report.id, ...STATE_LEADERSHIP_BRIEF_LAYOUT[index] })),
  });
  return dashboard;
}
```

- [ ] **Step 4: Run the template test and verify GREEN**

Run: `npm.cmd test -- --run src/features/intelligence/state-leadership-brief-template.test.js`.

Expected: 2 tests PASS.

- [ ] **Step 5: Commit the isolated template**

```powershell
git add web/src/features/intelligence/state-leadership-brief-template.js web/src/features/intelligence/state-leadership-brief-template.test.js
git commit -m "feat: define state leadership brief template"
```

### Task 2: Bootstrap only the dedicated State Leadership dashboard

**Files:**
- Create: `web/src/features/intelligence/useStateLeadershipBrief.js`
- Create: `web/src/features/intelligence/useStateLeadershipBrief.test.jsx`
- Modify: `web/src/features/command-center/useCommandCenterDashboard.js:60-65`
- Modify: `web/src/features/command-center/useCommandCenterDashboard.test.jsx:11-24`

- [ ] **Step 1: Write failing bootstrap and generic-controller tests**

```jsx
test('selects an existing owned State Leadership Brief without API mutation', async () => {
  const dashboard = { id: 'D-LEADERSHIP', name: 'State Leadership Brief', relationship: 'OWNED' };
  const { result } = renderHook(() => useStateLeadershipBrief({ api, workspace: { role: 'STATE_LEADERSHIP', availableDashboards: [dashboard] } }));
  await waitFor(() => expect(result.current.ready).toBe(true));
  expect(result.current.workspace.landingDashboard).toBe(dashboard);
  expect(api.post).not.toHaveBeenCalled();
});

test('creates the brief only for State Leadership and exposes a bounded failure', async () => {
  const api = { get: vi.fn(async () => ({ data: [] })), post: vi.fn(async () => { throw Object.assign(new Error('failed'), { code: 'CREATE_FAILED' }); }), put: vi.fn() };
  const { result } = renderHook(() => useStateLeadershipBrief({ api, workspace: { role: 'STATE_LEADERSHIP', availableDashboards: [] } }));
  await waitFor(() => expect(result.current.error?.code).toBe('CREATE_FAILED'));
  expect(result.current.ready).toBe(false);
});

test('the shared dashboard controller honors the supplied landing dashboard without dashboard-name coupling', async () => {
  const workspace = { role: 'STATE_LEADERSHIP', landingDashboard: { id: 'D-LEADERSHIP' }, availableDashboards: [{ id: 'D-COMMAND', name: 'State Crime Intelligence' }, { id: 'D-LEADERSHIP', name: 'State Leadership Brief' }] };
  renderHook(() => useCommandCenterDashboard({ api, workspace }));
  await waitFor(() => expect(api.get).toHaveBeenCalledWith('/v1/dashboards/D-LEADERSHIP'));
});
```

- [ ] **Step 2: Run both test files and verify RED**

Run: `npm.cmd test -- --run src/features/intelligence/useStateLeadershipBrief.test.jsx src/features/command-center/useCommandCenterDashboard.test.jsx`.

Expected: FAIL because the new hook is absent and the shared controller still selects `State Crime Intelligence` by name.

- [ ] **Step 3: Implement the State-only bootstrap hook**

```js
import { useEffect, useMemo, useState } from 'react';
import { createStateLeadershipBrief } from './state-leadership-brief-template.js';

export function useStateLeadershipBrief({ api, workspace }) {
  const existing = workspace?.availableDashboards?.find(item => item.name === 'State Leadership Brief' && item.relationship === 'OWNED');
  const [dashboard, setDashboard] = useState(existing ?? null);
  const [error, setError] = useState(null);
  useEffect(() => {
    if (workspace?.role !== 'STATE_LEADERSHIP' || dashboard) return undefined;
    let active = true;
    createStateLeadershipBrief({ api, dashboards: workspace.availableDashboards ?? [] })
      .then(created => active && setDashboard({ ...created, relationship: created.relationship ?? 'OWNED' }))
      .catch(failure => active && setError(failure));
    return () => { active = false; };
  }, [api, workspace, dashboard]);
  return useMemo(() => ({
    ready: Boolean(dashboard), error,
    workspace: dashboard ? { ...workspace, landingDashboard: dashboard, availableDashboards: [...(workspace.availableDashboards ?? []).filter(item => item.id !== dashboard.id), dashboard] } : { ...workspace, landingDashboard: undefined, availableDashboards: [] },
  }), [dashboard, error, workspace]);
}
```

- [ ] **Step 4: Remove the shared controller's State-specific name lookup**

Replace the `stateIntelligenceId` branch with:

```js
const initialId = requestedDashboardId ?? workspace?.landingDashboard?.id ?? workspace?.availableDashboards?.[0]?.id ?? null;
```

- [ ] **Step 5: Run both test files and verify GREEN**

Run: `npm.cmd test -- --run src/features/intelligence/useStateLeadershipBrief.test.jsx src/features/command-center/useCommandCenterDashboard.test.jsx`.

Expected: all tests PASS; no test expects `State Crime Intelligence` name precedence.

- [ ] **Step 6: Commit the bootstrap boundary**

```powershell
git add web/src/features/intelligence/useStateLeadershipBrief.js web/src/features/intelligence/useStateLeadershipBrief.test.jsx web/src/features/command-center/useCommandCenterDashboard.js web/src/features/command-center/useCommandCenterDashboard.test.jsx
git commit -m "feat: isolate state leadership dashboard bootstrap"
```

### Task 3: Add the Catalyst reference header and three-dot action menu

**Files:**
- Create: `web/src/features/intelligence/StateLeadershipDashboardMenu.jsx`
- Create: `web/src/features/intelligence/StateLeadershipDashboardMenu.test.jsx`
- Modify: `web/src/features/intelligence/StateLeadershipDashboard.jsx`
- Modify: `web/src/features/intelligence/StateLeadershipDashboard.test.jsx`

- [ ] **Step 1: Write failing menu and composition tests**

```jsx
test('offers State Leadership dashboard actions from one three-dot menu', () => {
  const handlers = { onEdit: vi.fn(), onAdd: vi.fn(), onManage: vi.fn() };
  render(<StateLeadershipDashboardMenu canEdit {...handlers} />);
  fireEvent.click(screen.getByRole('button', { name: 'Dashboard options' }));
  for (const name of ['Edit dashboard', 'Add report', 'Manage dashboards']) expect(screen.getByRole('menuitem', { name })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('menuitem', { name: 'Add report' }));
  expect(handlers.onAdd).toHaveBeenCalledOnce();
});

test('renders the approved State Leadership brief composition and never the Command Center map dashboard', async () => {
  render(<MemoryRouter initialEntries={['/?persona=STATE_LEADERSHIP']}><StateLeadershipDashboard api={api} workspace={workspace} /></MemoryRouter>);
  expect(await screen.findByRole('heading', { name: 'State Intelligence Brief' })).toBeInTheDocument();
  expect(screen.getByText('Data as of')).toBeInTheDocument();
  expect(screen.getByText('Latest verified run')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Dashboard options' })).toBeInTheDocument();
  expect(screen.queryByText('FIRs by Karnataka District')).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run focused UI tests and verify RED**

Run: `npm.cmd test -- --run src/features/intelligence/StateLeadershipDashboardMenu.test.jsx src/features/intelligence/StateLeadershipDashboard.test.jsx`.

Expected: FAIL because the menu/status composition does not exist.

- [ ] **Step 3: Implement the accessible menu**

Create a focused component using `MoreHorizontal`, local `open` state, `aria-expanded`, `role="menu"`, and `role="menuitem"`. In view mode render `Edit dashboard` and `Add report` only when `canEdit`; always render `Manage dashboards`. In edit mode render `Add report`, `Cancel editing`, `Save dashboard`, and `Manage dashboards`. Every action must close the menu.

```jsx
<StateLeadershipDashboardMenu
  canEdit={canEdit}
  editing={controller.editing}
  saving={controller.saving}
  onEdit={controller.beginEdit}
  onAdd={() => { if (!controller.editing) controller.beginEdit(); setReportPickerOpen(true); }}
  onCancel={controller.cancelEdit}
  onSave={controller.saveItems}
  onManage={() => navigate(governedAppLocation('/dashboards', location))}
/>
```

- [ ] **Step 4: Compose the dedicated bootstrap and reference header**

In `StateLeadershipDashboard`, call `useStateLeadershipBrief`, pass its scoped workspace to `useCommandCenterDashboard`, and render:

```jsx
<header className="state-leadership-dashboard__header">
  <div><span className="role-kicker">Statewide decision intelligence</span><h1>State Intelligence Brief</h1><p>Synthetic decision brief. Evidence-linked patterns require human review.</p></div>
  <div className="state-leadership-dashboard__header-actions">
    <div className="data-as-of"><i /><span>Data as of</span><strong>Latest verified run</strong></div>
    <StateLeadershipDashboardMenu ... />
  </div>
</header>
```

Show `Preparing State Leadership Brief…` while the template bootstraps, a safe retry/error surface on bootstrap failure, the existing filters, and the existing canvas/drawer after readiness.

- [ ] **Step 5: Run focused UI tests and verify GREEN**

Run: `npm.cmd test -- --run src/features/intelligence/StateLeadershipDashboardMenu.test.jsx src/features/intelligence/StateLeadershipDashboard.test.jsx`.

Expected: all tests PASS, including edit/add/save/cancel and view-only authorization.

- [ ] **Step 6: Commit the State Leadership UI composition**

```powershell
git add web/src/features/intelligence/StateLeadershipDashboardMenu.jsx web/src/features/intelligence/StateLeadershipDashboardMenu.test.jsx web/src/features/intelligence/StateLeadershipDashboard.jsx web/src/features/intelligence/StateLeadershipDashboard.test.jsx
git commit -m "feat: build editable state leadership brief home"
```

### Task 4: Match the Catalyst reference responsively

**Files:**
- Modify: `web/src/styles/app.css:724-752`
- Modify: `web/src/styles/viewport-layout.test.js`

- [ ] **Step 1: Write failing responsive CSS contracts**

```js
test('keeps the State Leadership brief in a Catalyst two-column desktop hierarchy', () => {
  expect(appCss).toMatch(/\.state-leadership-dashboard__header-actions\s*{[^}]*display:\s*flex/s);
  expect(appCss).toMatch(/\.state-leadership-dashboard\s*>\s*\.command-center-dashboard-canvas\s*{[^}]*border:\s*0/s);
});

test('stacks State Leadership reports without horizontal page overflow on mobile', () => {
  expect(appCss).toMatch(/@media \(max-width:\s*760px\)[\s\S]*\.state-leadership-dashboard \.command-center-dashboard-placement\s*{[^}]*width:\s*100%/s);
  expect(appCss).toMatch(/\.state-leadership-dashboard__menu\s*>\s*button\s*{[^}]*min-width:\s*44px/s);
});
```

- [ ] **Step 2: Run the CSS contract test and verify RED**

Run: `npm.cmd test -- --run src/styles/viewport-layout.test.js`.

Expected: FAIL on missing header-actions/menu contracts and canvas reference styling.

- [ ] **Step 3: Implement the Catalyst reference styling**

Update only State Leadership selectors:

- Header uses `display:flex`, a 1px `#dce4ed` divider, 30px navy heading, and the status/actions cluster.
- Status card uses white surface, 1px border, 8px radius, green verification dot, and compact two-line typography.
- Filters remain compact outlined controls with 44px minimum touch height.
- Canvas loses the Image 2 map-workspace frame treatment and uses a transparent borderless container.
- Report placements retain white cards, subtle borders, compact uppercase report headings, blue/teal visualization palette, and the existing editable handles.
- At `760px`, header/actions and every placement stack to 100% width; the menu trigger remains 44x44px; no horizontal overflow is introduced.

- [ ] **Step 4: Run CSS and component tests and verify GREEN**

Run: `npm.cmd test -- --run src/styles/viewport-layout.test.js src/features/intelligence/StateLeadershipDashboard.test.jsx src/features/intelligence/StateLeadershipDashboardMenu.test.jsx`.

Expected: all focused tests PASS.

- [ ] **Step 5: Commit the scoped visual contract**

```powershell
git add web/src/styles/app.css web/src/styles/viewport-layout.test.js
git commit -m "style: match catalyst state leadership brief"
```

### Task 5: Verify isolation, build, deploy, and visually accept

**Files:**
- Verify only; update deployment evidence only if the repository's current release workflow requires it after a successful deployment.

- [ ] **Step 1: Run the complete focused regression set**

Run from `web`:

```powershell
npm.cmd test -- --run src/features/intelligence/state-leadership-brief-template.test.js src/features/intelligence/useStateLeadershipBrief.test.jsx src/features/intelligence/StateLeadershipDashboardMenu.test.jsx src/features/intelligence/StateLeadershipDashboard.test.jsx src/features/command-center/useCommandCenterDashboard.test.jsx src/features/command-center/CommandCenterShell.test.jsx src/app/router.test.jsx src/styles/viewport-layout.test.js
```

Expected: all tests PASS. Command Center tests prove its dashboard composition and navigation are unchanged.

- [ ] **Step 2: Run the deployable web build and bundle budget**

Run from repository root: `npm.cmd run web:build`.

Expected: Vite build succeeds and `PASS: web bundle budgets` is printed.

- [ ] **Step 3: Inspect the exact diff boundary**

Run:

```powershell
git diff --check
git diff --name-only HEAD~4..HEAD
```

Expected: only the files named in this plan plus the approved spec/plan are present; no Command Center component, other persona component, Function, schema, Job, authentication, or Production configuration changed except the generic controller's removal of State-only name coupling.

- [ ] **Step 4: Deploy only Catalyst Slate Development**

Run: `catalyst.cmd deploy --only slate:ksp-crime-intelligence`.

Expected: Catalyst reports Slate deployment complete. Do not deploy Functions, Data Store, Jobs, API Gateway, Authentication, or Production.

- [ ] **Step 5: Perform live desktop acceptance**

In the in-app Browser, navigate to `https://ace.onslate.in/?persona=STATE_LEADERSHIP` and verify:

- Page identity and title are correct.
- State Intelligence Brief, verified-run card, filters, and five intended report cards render.
- No `FIRs by Karnataka District` map-first home composition appears.
- The three-dot menu exposes Edit dashboard, Add report, and Manage dashboards.
- Enter edit mode, move/resize a placement, cancel, and confirm the persisted layout returns.
- Add report opens the governed picker without mutating until Save.
- DOM root is non-empty, no framework overlay appears, and no relevant console error occurs.

- [ ] **Step 6: Perform live mobile acceptance**

Set a mobile viewport near 390x844, reload, and confirm one-column report stacking, usable 44px controls, no horizontal scrolling, non-clipped legends, and a usable menu. Reset the viewport override afterward.

- [ ] **Step 7: Verify Command Center and another persona are unchanged**

Navigate to `/?persona=COMMAND_CENTER` and `/?persona=CRIME_ANALYST`. Confirm their original landing content, dashboard identity, navigation, and responsive shell remain intact. Do not save dashboard changes during this check.

- [ ] **Step 8: Capture screenshots and report evidence**

Save desktop and mobile screenshots outside the repository, report the new hashed bundle, focused test totals, build/budget result, live interaction evidence, and any unrelated pre-existing suite failures separately.


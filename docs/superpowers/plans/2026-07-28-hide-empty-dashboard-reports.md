# Hide Empty Dashboard Reports Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hide successful zero-row report cards from dashboard view while preserving legitimate zero values, failures, editing controls, and the existing structurally empty dashboard state.

**Architecture:** Add one exact, fail-open predicate beside the shared dashboard canvas. Filter only view-mode placements at render time; keep saved dashboard definitions and edit-mode placements unchanged. Command Center and governed persona dashboards inherit the behavior through their existing shared canvas.

**Tech Stack:** React 19, React Router, Vitest, Testing Library, Vite

---

### Task 1: Define the successful-empty dashboard contract

**Files:**
- Modify: `web/src/features/command-center/CommandCenterDashboardCanvas.test.jsx`
- Modify: `web/src/features/command-center/CommandCenterDashboardCanvas.jsx`

- [ ] **Step 1: Add failing predicate tests**

Change the import and add a table test:

```jsx
import { CommandCenterDashboardCanvas, isSuccessfulEmptyReport } from './CommandCenterDashboardCanvas.jsx';

test.each([
  [{ status: 'ready', data: [] }, true],
  [{ status: 'ready', data: [{ count: 0 }] }, false],
  [{ status: 'error', data: [] }, false],
  [{ status: 'loading', data: [] }, false],
  [{ status: 'ready' }, false],
  [{ status: 'ready', data: null }, false],
])('classifies only an exact successful zero-row report as empty', (item, expected) => {
  expect(isSuccessfulEmptyReport(item)).toBe(expected);
});
```

- [ ] **Step 2: Run the predicate test and verify RED**

Run from `web/`:

```powershell
npm.cmd test -- src/features/command-center/CommandCenterDashboardCanvas.test.jsx -t "classifies only an exact successful zero-row report as empty"
```

Expected: FAIL because `isSuccessfulEmptyReport` is not exported.

- [ ] **Step 3: Implement the exact predicate**

Add above the component:

```jsx
export const isSuccessfulEmptyReport = item => item?.status === 'ready'
  && Array.isArray(item.data)
  && item.data.length === 0;
```

- [ ] **Step 4: Run the predicate test and verify GREEN**

Run the command from Step 2.

Expected: PASS for all six cases.

- [ ] **Step 5: Commit the contract**

```powershell
git add -- web/src/features/command-center/CommandCenterDashboardCanvas.jsx web/src/features/command-center/CommandCenterDashboardCanvas.test.jsx
git commit -m "test: define empty dashboard report contract"
```

### Task 2: Filter empty cards in view mode only

**Files:**
- Modify: `web/src/features/command-center/CommandCenterDashboardCanvas.test.jsx`
- Modify: `web/src/features/command-center/CommandCenterDashboardCanvas.jsx`

- [ ] **Step 1: Correct the active-tab fixture to remain non-empty**

In `places only reports belonging to the active tab`, change both fixture rows from `data: []` to non-empty governed rows:

```jsx
{ id: 'I-1', reportId: 'R-1', title: 'Governed result', status: 'ready', data: [{ count: 1 }], column: 1, row: 1, width: 6, height: 3 }
{ id: 'I-2', reportId: 'R-2', title: 'Other result', status: 'ready', data: [{ count: 2 }], column: 1, row: 1, width: 6, height: 3 }
```

- [ ] **Step 2: Add failing view-mode behavior tests**

Add these tests:

```jsx
test('hides successful zero-row reports while keeping non-empty zero values and failures', () => {
  const dashboard = { id: 'D-1', tabs: [{ id: 'overview', items: [
    { id: 'I-empty', reportId: 'R-empty', title: 'Empty evidence', status: 'ready', data: [], column: 1, row: 1, width: 4, height: 3 },
    { id: 'I-zero', reportId: 'R-zero', title: 'Zero is evidence', status: 'ready', data: [{ count: 0 }], column: 5, row: 1, width: 4, height: 3 },
    { id: 'I-error', reportId: 'R-error', title: 'Unavailable evidence', status: 'error', data: [], column: 9, row: 1, width: 4, height: 3 },
  ] }] };

  render(<MemoryRouter><CommandCenterDashboardCanvas dashboard={dashboard} /></MemoryRouter>);

  expect(screen.queryByLabelText('Empty evidence')).not.toBeInTheDocument();
  expect(screen.getByLabelText('Zero is evidence')).toBeInTheDocument();
  expect(screen.getByLabelText('Unavailable evidence')).toBeInTheDocument();
});

test('keeps successful empty reports addressable while editing', () => {
  const report = { id: 'I-empty', reportId: 'R-empty', title: 'Empty evidence', status: 'ready', data: [], column: 1, row: 1, width: 6, height: 3 };
  const dashboard = { id: 'D-1', tabs: [{ id: 'overview', items: [report] }] };

  render(<MemoryRouter><CommandCenterDashboardCanvas dashboard={dashboard} editing /></MemoryRouter>);

  expect(screen.getByLabelText('Empty evidence')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Drag Empty evidence' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Remove Empty evidence report' })).toBeInTheDocument();
});

test('summarizes a configured dashboard when every report has zero rows', () => {
  const dashboard = { id: 'D-1', tabs: [{ id: 'overview', items: [
    { id: 'I-empty', reportId: 'R-empty', title: 'Empty evidence', status: 'ready', data: [], column: 1, row: 1, width: 6, height: 3 },
  ] }] };

  render(<MemoryRouter><CommandCenterDashboardCanvas dashboard={dashboard} /></MemoryRouter>);

  expect(screen.getByText('No reports currently have matching records.')).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'Open report library' })).not.toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'Create report' })).not.toBeInTheDocument();
});
```

- [ ] **Step 3: Run the canvas suite and verify RED**

```powershell
npm.cmd test -- src/features/command-center/CommandCenterDashboardCanvas.test.jsx --reporter=verbose
```

Expected: the three new behavior tests fail because view mode still renders every item.

- [ ] **Step 4: Derive view-mode items without changing saved items**

After the existing `items` calculation, add:

```jsx
const displayItems = editing ? items : items.filter(item => !isSuccessfulEmptyReport(item));
```

Replace the returned canvas body with three explicit states:

```jsx
{items.length === 0 ? <div className="command-center-dashboard-empty"><BarChart3 aria-hidden="true" /><strong>This dashboard has no reports yet.</strong><span>Add governed reports when you are ready. No sample intelligence is shown.</span><div><Link to="/reports">Open report library</Link><Link className="primary" to="/reports/new"><Plus aria-hidden="true" />Create report</Link></div></div>
  : displayItems.length === 0 ? <div className="command-center-dashboard-empty"><BarChart3 aria-hidden="true" /><strong>No reports currently have matching records.</strong><span>Configured reports will appear here when governed results are available.</span></div>
    : displayItems.map(item => <div className={`command-center-dashboard-placement ${getPlacementClassName(item)}`.trim()} style={placementStyle(item)} key={item.id}>{editing ? <><button className="command-center-placement-drag" type="button" aria-label={`Drag ${item.title}`} onPointerDown={event => startPointerEdit(event, item, 'drag')}><GripHorizontal aria-hidden="true" /></button>{controls(item)}<button className="command-center-placement-resize" type="button" aria-label={`Resize ${item.title}`} onPointerDown={event => startPointerEdit(event, item, 'resize')} /></> : null}<CommandCenterReportSurface item={item} editing={editing} onRemove={onRemove} onSelect={onSelect} showPreviewMeta={showPreviewMeta} returnTo={returnTo} /></div>)}
```

- [ ] **Step 5: Run the canvas suite and verify GREEN**

Run the command from Step 3.

Expected: all canvas tests pass, including the existing structurally empty dashboard and editing tests.

- [ ] **Step 6: Commit view-mode filtering**

```powershell
git add -- web/src/features/command-center/CommandCenterDashboardCanvas.jsx web/src/features/command-center/CommandCenterDashboardCanvas.test.jsx
git commit -m "feat: hide empty reports from dashboard view"
```

### Task 3: Verify shared persona behavior and deploy Development safely

**Files:**
- Verify: `web/src/features/command-center/CommandCenterDashboardCanvas.jsx`
- Verify: `web/src/features/command-center/CommandCenterDashboardCanvas.test.jsx`
- Verify: `web/src/features/dashboards/PersonaDashboardHome.test.jsx`
- Verify: `web/src/features/dashboards/DistrictDashboardWorkspace.test.jsx`

- [ ] **Step 1: Run shared dashboard regression tests**

From `web/`:

```powershell
npm.cmd test -- src/features/command-center/CommandCenterDashboardCanvas.test.jsx src/features/command-center/CommandCenterShell.test.jsx src/features/dashboards/PersonaDashboardHome.test.jsx src/features/dashboards/DistrictDashboardWorkspace.test.jsx --reporter=verbose
```

Expected: all listed test files pass.

- [ ] **Step 2: Run the full frontend suite**

```powershell
npm.cmd test -- --reporter=dot
```

Expected: zero failed test files and zero failed tests.

- [ ] **Step 3: Build the production frontend**

```powershell
npm.cmd run build
```

Expected: Vite exits with code 0 and produces `web/dist/index.html` plus hashed assets.

- [ ] **Step 4: Record Production isolation baseline**

Read `https://acep.onslate.in/` and record its exact hashed `/assets/index-*.js` module URL.

- [ ] **Step 5: Deploy Slate to Development only**

From the repository root:

```powershell
catalyst.cmd -p 43492000000013049 --dc in -ni deploy slate ksp-crime-intelligence -m "Hide empty dashboard report cards"
```

Expected: Development serves the new Slate asset at `https://ace.onslate.in`; the command contains no `--production` flag.

- [ ] **Step 6: Verify the live District dashboard**

Open `https://ace.onslate.in/?persona=DISTRICT_LEADERSHIP&release=hide-empty-dashboard-reports` and verify:

- `District Pattern Evidence` is absent when its result contains zero rows;
- `District Command Brief` remains visible with `patternCount` equal to `0`;
- no report-execution error card is suppressed;
- the application root remains rendered.

- [ ] **Step 7: Verify Production remains unchanged**

Re-read `https://acep.onslate.in/` and confirm its module asset URL exactly matches the baseline from Step 4.

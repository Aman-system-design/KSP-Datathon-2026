# Compact Filtered Dashboard Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Repack visible dashboard reports into the earliest available grid spaces after empty reports are filtered, without stretching cards or changing saved/edit-mode coordinates.

**Architecture:** Add a pure first-fit compaction helper to the existing dashboard model. The shared canvas will pass only view-mode visible items through this helper; edit mode will continue to render the original item list and coordinates.

**Tech Stack:** JavaScript, React 19, Vitest, Testing Library, Vite

---

### Task 1: Add a pure twelve-column compaction helper

**Files:**
- Modify: `web/src/features/command-center/command-center-dashboard-model.test.js`
- Modify: `web/src/features/command-center/command-center-dashboard-model.js`

- [ ] **Step 1: Add failing model tests**

Update the import and append these tests:

```js
import { compactDashboardItems, dashboardSections, normalizeDashboard, placementStyle } from './command-center-dashboard-model.js';

test('compacts reports into the first available grid positions without changing dimensions', () => {
  const items = [
    { id: 'top-left', column: 1, row: 1, width: 7, height: 5 },
    { id: 'from-below', column: 1, row: 6, width: 5, height: 5 },
    { id: 'next-row', column: 8, row: 6, width: 6, height: 4 },
  ];

  expect(compactDashboardItems(items)).toEqual([
    { id: 'top-left', column: 1, row: 1, width: 7, height: 5 },
    { id: 'from-below', column: 8, row: 1, width: 5, height: 5 },
    { id: 'next-row', column: 1, row: 6, width: 6, height: 4 },
  ]);
});

test('sorts by saved visual order and does not mutate dashboard items', () => {
  const items = [
    { id: 'lower', column: 7, row: 5, width: 6, height: 3 },
    { id: 'upper', column: 1, row: 1, width: 6, height: 3 },
  ];
  const snapshot = structuredClone(items);

  expect(compactDashboardItems(items).map(item => item.id)).toEqual(['upper', 'lower']);
  expect(compactDashboardItems(items).map(({ column, row, width, height }) => ({ column, row, width, height }))).toEqual([
    { column: 1, row: 1, width: 6, height: 3 },
    { column: 7, row: 1, width: 6, height: 3 },
  ]);
  expect(items).toEqual(snapshot);
});

test('fails open when any placement has invalid grid dimensions', () => {
  const items = [
    { id: 'valid', column: 7, row: 4, width: 6, height: 3 },
    { id: 'invalid', column: 1, row: 1, width: 13, height: 3 },
  ];

  expect(compactDashboardItems(items)).toEqual(items);
});
```

- [ ] **Step 2: Run the new tests and verify RED**

From `web/` run:

```powershell
npm.cmd test -- src/features/command-center/command-center-dashboard-model.test.js -t "compacts reports|sorts by saved|fails open"
```

Expected: FAIL because `compactDashboardItems` is not exported.

- [ ] **Step 3: Implement the minimal pure helper**

Add before `placementStyle`:

```js
const isGridPlacement = item => Number.isInteger(item?.column)
  && item.column >= 1
  && Number.isInteger(item?.row)
  && item.row >= 1
  && Number.isInteger(item?.width)
  && item.width >= 1
  && item.width <= 12
  && Number.isInteger(item?.height)
  && item.height >= 1
  && item.column + item.width <= 13;

export function compactDashboardItems(items = []) {
  if (!Array.isArray(items) || items.some(item => !isGridPlacement(item))) {
    return Array.isArray(items) ? items.map(item => ({ ...item })) : [];
  }

  const ordered = items
    .map((item, index) => ({ item, index }))
    .sort((left, right) => left.item.row - right.item.row
      || left.item.column - right.item.column
      || left.index - right.index);
  const occupied = new Set();
  const fits = (row, column, width, height) => {
    if (column + width > 13) return false;
    for (let y = row; y < row + height; y += 1) {
      for (let x = column; x < column + width; x += 1) {
        if (occupied.has(`${x}:${y}`)) return false;
      }
    }
    return true;
  };
  const reserve = (row, column, width, height) => {
    for (let y = row; y < row + height; y += 1) {
      for (let x = column; x < column + width; x += 1) occupied.add(`${x}:${y}`);
    }
  };

  return ordered.map(({ item }) => {
    for (let row = 1; ; row += 1) {
      for (let column = 1; column <= 13 - item.width; column += 1) {
        if (!fits(row, column, item.width, item.height)) continue;
        reserve(row, column, item.width, item.height);
        return { ...item, column, row };
      }
    }
  });
}
```

- [ ] **Step 4: Run the model suite and verify GREEN**

```powershell
npm.cmd test -- src/features/command-center/command-center-dashboard-model.test.js --reporter=verbose
```

Expected: all model tests pass.

- [ ] **Step 5: Commit the helper**

```powershell
git add -- web/src/features/command-center/command-center-dashboard-model.js web/src/features/command-center/command-center-dashboard-model.test.js
git commit -m "feat: compact visible dashboard placements"
```

### Task 2: Apply compaction only to filtered view mode

**Files:**
- Modify: `web/src/features/command-center/CommandCenterDashboardCanvas.jsx`
- Modify: `web/src/features/command-center/CommandCenterDashboardCanvas.test.jsx`

- [ ] **Step 1: Add failing canvas integration tests**

Append these tests:

```jsx
test('fills a hidden report gap with the next visible report', () => {
  const dashboard = { id: 'D-1', tabs: [{ id: 'overview', items: [
    { id: 'left', reportId: 'R-left', title: 'Left report', status: 'ready', data: [{ count: 1 }], column: 1, row: 1, width: 7, height: 5 },
    { id: 'empty', reportId: 'R-empty', title: 'Empty report', status: 'ready', data: [], column: 8, row: 1, width: 5, height: 5 },
    { id: 'lower', reportId: 'R-lower', title: 'Lower report', status: 'ready', data: [{ count: 0 }], column: 1, row: 6, width: 5, height: 5 },
  ] }] };

  render(<MemoryRouter><CommandCenterDashboardCanvas dashboard={dashboard} /></MemoryRouter>);

  const placement = screen.getByLabelText('Lower report').closest('.command-center-dashboard-placement');
  expect(screen.queryByLabelText('Empty report')).not.toBeInTheDocument();
  expect(placement).toHaveStyle({ left: `${(7 / 12) * 100}%`, top: '0px', width: `${(5 / 12) * 100}%`, height: '480px' });
});

test('keeps saved report coordinates while editing instead of compacting', () => {
  const dashboard = { id: 'D-1', tabs: [{ id: 'overview', items: [
    { id: 'left', reportId: 'R-left', title: 'Left report', status: 'ready', data: [{ count: 1 }], column: 1, row: 1, width: 7, height: 5 },
    { id: 'empty', reportId: 'R-empty', title: 'Empty report', status: 'ready', data: [], column: 8, row: 1, width: 5, height: 5 },
    { id: 'lower', reportId: 'R-lower', title: 'Lower report', status: 'ready', data: [{ count: 0 }], column: 1, row: 6, width: 5, height: 5 },
  ] }] };

  render(<MemoryRouter><CommandCenterDashboardCanvas dashboard={dashboard} editing /></MemoryRouter>);

  const placement = screen.getByLabelText('Lower report').closest('.command-center-dashboard-placement');
  expect(screen.getByLabelText('Empty report')).toBeInTheDocument();
  expect(placement).toHaveStyle({ left: '0%', top: '480px', width: `${(5 / 12) * 100}%`, height: '480px' });
});
```

- [ ] **Step 2: Run the integration tests and verify RED**

```powershell
npm.cmd test -- src/features/command-center/CommandCenterDashboardCanvas.test.jsx -t "fills a hidden report gap|keeps saved report coordinates"
```

Expected: the gap-filling test fails because `Lower report` remains at row 6; the edit-mode test passes as a guard.

- [ ] **Step 3: Apply the model helper in view mode**

Change the model import:

```jsx
import { compactDashboardItems, placementStyle } from './command-center-dashboard-model.js';
```

Replace the `displayItems` calculation with:

```jsx
const visibleItems = editing ? items : items.filter(item => !isSuccessfulEmptyReport(item));
const displayItems = editing ? visibleItems : compactDashboardItems(visibleItems);
```

Do not modify the existing three rendering states or edit controls.

- [ ] **Step 4: Run the canvas suite and verify GREEN**

```powershell
npm.cmd test -- src/features/command-center/CommandCenterDashboardCanvas.test.jsx --reporter=verbose
```

Expected: all canvas tests pass, including filtering, compaction, error visibility, all-empty state, and edit-mode placement.

- [ ] **Step 5: Commit the canvas integration**

```powershell
git add -- web/src/features/command-center/CommandCenterDashboardCanvas.jsx web/src/features/command-center/CommandCenterDashboardCanvas.test.jsx
git commit -m "feat: fill dashboard gaps after filtering"
```

### Task 3: Verify shared dashboards and deploy Development safely

**Files:**
- Verify: `web/src/features/command-center/command-center-dashboard-model.test.js`
- Verify: `web/src/features/command-center/CommandCenterDashboardCanvas.test.jsx`
- Verify: `web/src/features/command-center/CommandCenterShell.test.jsx`
- Verify: `web/src/features/dashboards/PersonaDashboardHome.test.jsx`
- Verify: `web/src/features/dashboards/DistrictDashboardWorkspace.test.jsx`

- [ ] **Step 1: Run focused shared dashboard regressions**

```powershell
npm.cmd test -- src/features/command-center/command-center-dashboard-model.test.js src/features/command-center/CommandCenterDashboardCanvas.test.jsx src/features/command-center/CommandCenterShell.test.jsx src/features/dashboards/PersonaDashboardHome.test.jsx src/features/dashboards/DistrictDashboardWorkspace.test.jsx --reporter=verbose
```

Expected: all listed test files pass.

- [ ] **Step 2: Run the full frontend suite**

```powershell
npm.cmd test -- --reporter=dot
```

Expected: zero failed test files and zero failed tests.

- [ ] **Step 3: Build the frontend**

```powershell
npm.cmd run build
```

Expected: Vite exits with code 0 and writes `web/dist/index.html` plus hashed assets.

- [ ] **Step 4: Record the Production isolation baseline**

Read `https://acep.onslate.in/` and record its exact `/assets/index-*.js` module URL.

- [ ] **Step 5: Deploy Slate to Development only**

From the repository root:

```powershell
catalyst.cmd -p 43492000000013049 --dc in -ni deploy slate ksp-crime-intelligence -m "Compact filtered dashboard reports"
```

Expected: `https://ace.onslate.in` serves the new Slate build. The command contains no `--production` flag.

- [ ] **Step 6: Verify the live District dashboard**

Open `https://ace.onslate.in/?persona=DISTRICT_LEADERSHIP&release=compact-filtered-dashboard-layout` and verify:

- empty reports remain absent;
- `District Command Brief` remains visible with `patternCount 0`;
- reports formerly below/right fill the earliest grid gaps without stretching;
- the page has no unnecessary blank rows between visible report cards;
- account and persona controls remain rendered.

- [ ] **Step 7: Confirm Production remains unchanged**

Re-read `https://acep.onslate.in/` and confirm its module asset URL exactly matches the baseline from Step 4.

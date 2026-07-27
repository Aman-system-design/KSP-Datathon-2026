# Dashboard Deletion and Catalyst Modernization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let every MVP persona delete any visible dashboard from a shared modernized Catalyst dashboard library while preserving all reports.

**Architecture:** The dashboard service authorizes deletion through the existing visibility policy, while repository implementations remove only dashboard-owned records. A shared library and deletion dialog serve every persona; direct dashboard views reuse the dialog and return to the persona-preserving library after deletion.

**Tech Stack:** React 19, React Router, Testing Library, Vitest, Node test runner, Zoho Catalyst datastore repository, Lucide icons, CSS.

---

## File map

- Modify `src/backend/reporting/dashboard-service.mjs`: authorize removal of any visible MVP dashboard.
- Modify `src/backend/repository/catalyst/catalyst-repository.mjs`: delete dashboard shares alongside items and landing preferences, never reports.
- Modify `tests/reporting/dashboard-service.test.mjs`: prove visible deletion, inaccessible protection, cleanup, and report preservation.
- Modify `tests/catalyst/reporting-repository.test.mjs`: prove datastore cleanup semantics.
- Create `web/src/features/dashboards/DashboardDeleteDialog.jsx`: shared accessible confirmation, pending, and error UI.
- Create `web/src/features/dashboards/DashboardDeleteDialog.test.jsx`: cover cancel, submit, pending, and report-preservation copy.
- Modify `web/src/features/command-center/CommandCenterDashboardLibrary.jsx`: consume the shared dialog and add refined cards, overflow menu, success/error states, and local removal.
- Modify `web/src/features/command-center/CommandCenterDashboardLibrary.test.jsx`: cover cancellation, success, failure, and local removal.
- Modify `web/src/features/dashboards/DashboardPages.jsx`: render the modern library for standard personas and add direct-view deletion.
- Modify `web/src/features/dashboards/DashboardPage.test.jsx`: cover direct-view deletion and return navigation.
- Modify `web/src/app/router.jsx`: route every persona, including Station Operations, to the shared dashboard library.
- Modify `web/src/app/router.test.jsx`: prove cross-persona library routing.
- Modify `web/src/styles/app.css`: implement the approved refined-library visual system and responsive dialog/card states.
- Regenerate `functions/crime_intelligence_api/app/**` with the existing Catalyst build command; do not hand-edit generated mirrors.

### Task 1: Governed MVP deletion semantics

**Files:**
- Modify: `tests/reporting/dashboard-service.test.mjs`
- Modify: `src/backend/reporting/dashboard-service.mjs`

- [ ] **Step 1: Write the failing service tests**

Add tests that create a report, attach it to a dashboard, share the dashboard with `VIEWER`, delete it as that visible viewer, and assert the dashboard and item are gone while `repository.getReport('R-KEEP')` still returns the report. Add a second test asserting an unshared viewer receives `NOT_FOUND`.

```js
test('any visible dashboard may be deleted without deleting its reports', async () => {
  const { service, repository } = harness();
  const owner = access('OWNER');
  const viewer = access('VIEWER');
  await repository.createReport({ id: 'R-KEEP', ownerUserId: 'OWNER', name: 'Keep me', visibility: 'PRIVATE', version: 1 });
  const dashboard = await service.create({ access: owner, input: { name: 'Shared operations' } });
  await repository.createDashboardItem({ id: 'I-1', dashboardId: dashboard.id, reportId: 'R-KEEP', column: 1, row: 1, width: 4, height: 2, version: 1 });
  await repository.createContentShare({ id: 'S-1', contentType: 'DASHBOARD', contentId: dashboard.id, targetUserId: 'VIEWER', permission: 'VIEW', version: 1 });

  assert.deepEqual(await service.remove({ access: viewer, dashboardId: dashboard.id }), { deleted: true });
  assert.equal(await repository.getDashboard(dashboard.id), undefined);
  assert.deepEqual(await repository.listDashboardItems(dashboard.id), []);
  assert.equal((await repository.getReport('R-KEEP')).id, 'R-KEEP');
});

test('an invisible dashboard cannot be deleted', async () => {
  const { service } = harness();
  const dashboard = await service.create({ access: access('OWNER'), input: { name: 'Private operations' } });
  await assert.rejects(service.remove({ access: access('STRANGER'), dashboardId: dashboard.id }), { code: 'NOT_FOUND' });
});
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `node --test tests/reporting/dashboard-service.test.mjs --test-name-pattern="visible dashboard|invisible dashboard"`

Expected: the visible-viewer test fails with `FORBIDDEN_ACTION` because `remove` still calls `requireOwner`.

- [ ] **Step 3: Implement the minimal policy change**

Change only dashboard removal authorization:

```js
async remove({ access, dashboardId }) {
  await requireVisible(dashboardId, access);
  await repository.deleteDashboard(dashboardId);
  return { deleted: true };
},
```

- [ ] **Step 4: Run the focused and full dashboard service tests**

Run: `node --test tests/reporting/dashboard-service.test.mjs`

Expected: PASS with no warnings.

- [ ] **Step 5: Commit the service behavior**

```powershell
git add -- src/backend/reporting/dashboard-service.mjs tests/reporting/dashboard-service.test.mjs
git commit -m "feat: allow deletion of visible dashboards"
```

### Task 2: Catalyst cleanup without report deletion

**Files:**
- Modify: `src/backend/repository/catalyst/catalyst-repository.mjs`
- Test: `tests/catalyst/reporting-repository.test.mjs`

- [ ] **Step 1: Write a failing Catalyst repository cleanup test**

Seed a dashboard, dashboard item, dashboard content share, landing preference, and referenced report through the existing fake Catalyst datastore harness. Delete the dashboard and assert the dashboard item, share, preference, and dashboard rows are removed while the report row remains.

The key assertions must be equivalent to:

```js
assert.equal(await repository.getDashboard('D-DELETE'), undefined);
assert.deepEqual(await repository.listDashboardItems('D-DELETE'), []);
assert.deepEqual(await repository.listContentShares('DASHBOARD', 'D-DELETE'), []);
assert.equal(await repository.getUserPreference('VIEWER'), undefined);
assert.equal((await repository.getReport('R-KEEP')).id, 'R-KEEP');
```

- [ ] **Step 2: Run that test and verify RED**

Run: `node --test tests/catalyst/reporting-repository.test.mjs`

Expected: FAIL because the Catalyst implementation currently leaves the dashboard content-share row behind.

- [ ] **Step 3: Delete only dashboard share rows in the Catalyst repository**

Before deleting the dashboard record, add:

```js
for (const share of await this.#read(TABLES.contentShares)) {
  if (share.ContentType === 'DASHBOARD' && share.ContentBusinessID === id) {
    await this.#delete(TABLES.contentShares, share.ROWID);
  }
}
```

- [ ] **Step 4: Run repository and reporting regression tests**

Run: `node --test tests/catalyst/*.test.mjs tests/reporting/dashboard-service.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit repository cleanup**

```powershell
git add -- src/backend/repository/catalyst/catalyst-repository.mjs tests/catalyst
git commit -m "fix: clean dashboard references on deletion"
```

### Task 3: Test-first dashboard library deletion flow

**Files:**
- Create: `web/src/features/dashboards/DashboardDeleteDialog.jsx`
- Create: `web/src/features/dashboards/DashboardDeleteDialog.test.jsx`
- Modify: `web/src/features/command-center/CommandCenterDashboardLibrary.test.jsx`
- Modify: `web/src/features/command-center/CommandCenterDashboardLibrary.jsx`

- [ ] **Step 1: Write failing interaction tests**

Add separate tests for cancel, success, and failure. Drive the interface by accessible labels:

```jsx
test('confirms dashboard deletion while explaining reports remain', async () => {
  const api = { delete: vi.fn(async () => ({ data: { deleted: true } })) };
  render(<CommandCenterDashboardLibrary api={api} dashboards={[{ id: 'D-1', name: 'Night crime', relationship: 'SYSTEM' }]} />);
  fireEvent.click(screen.getByRole('button', { name: 'More actions for Night crime' }));
  fireEvent.click(screen.getByRole('menuitem', { name: 'Delete dashboard' }));
  const dialog = screen.getByRole('dialog', { name: 'Delete Night crime?' });
  expect(within(dialog).getByText(/Reports used by this dashboard will remain available/i)).toBeVisible();
  fireEvent.click(within(dialog).getByRole('button', { name: 'Delete dashboard' }));
  await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/v1/dashboards/D-1'));
  expect(screen.queryByText('Night crime')).not.toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent('Night crime was deleted');
});
```

The cancel test must assert `api.delete` was not called. The failure test must reject with `new Error('Unavailable')`, retain the card, and show an alert in the dialog. Keep dialog-only behavior in `DashboardDeleteDialog.test.jsx` and API/list behavior in the library test.

- [ ] **Step 2: Run the component tests and verify RED**

Run: `npm run test --workspace web -- CommandCenterDashboardLibrary.test.jsx`

Expected: FAIL because the card action menu and deletion dialog do not exist.

- [ ] **Step 3: Implement local list and deletion state**

Create `DashboardDeleteDialog` with props `{ dashboard, deleting, error, onCancel, onConfirm }`. In `CommandCenterDashboardLibrary`, add state for `visibleDashboards`, `menuDashboardId`, `pendingDelete`, `deleting`, `deleteError`, and `notice`. Sync `visibleDashboards` when the `dashboards` prop changes. Render a `MoreHorizontal` trigger per card, a menu item with `Trash2`, and the shared dialog.

The mutation must be exactly:

```js
const removeDashboard = async () => {
  if (!pendingDelete || deleting) return;
  setDeleting(true);
  setDeleteError('');
  try {
    await api.delete(`/v1/dashboards/${pendingDelete.id}`);
    setVisibleDashboards(current => current.filter(item => item.id !== pendingDelete.id));
    setNotice(`${pendingDelete.name} was deleted. Reports remain available.`);
    setPendingDelete(null);
  } catch (failure) {
    setDeleteError(failure.message || 'Dashboard could not be deleted.');
  } finally {
    setDeleting(false);
  }
};
```

Dialog copy must state that the action removes the dashboard and its layout only, and that reports remain available. Disable both destructive re-submission and card menu actions while deleting.

- [ ] **Step 4: Run the component tests and verify GREEN**

Run: `npm run test --workspace web -- CommandCenterDashboardLibrary.test.jsx`

Expected: PASS.

- [ ] **Step 5: Run command-center regressions**

Run: `npm run test --workspace web -- src/features/command-center`

Expected: PASS.

- [ ] **Step 6: Commit the interaction**

```powershell
git add -- web/src/features/dashboards/DashboardDeleteDialog.jsx web/src/features/dashboards/DashboardDeleteDialog.test.jsx web/src/features/command-center/CommandCenterDashboardLibrary.jsx web/src/features/command-center/CommandCenterDashboardLibrary.test.jsx
git commit -m "feat: delete dashboards from library"
```

### Task 4: Make deletion available to every persona and direct dashboard view

**Files:**
- Modify: `web/src/features/dashboards/DashboardPages.jsx`
- Modify: `web/src/features/dashboards/DashboardPage.test.jsx`
- Modify: `web/src/app/router.jsx`
- Modify: `web/src/app/router.test.jsx`

- [ ] **Step 1: Write failing cross-persona and direct-deletion tests**

Add router tests showing both `STATION_OPERATIONS` and `CRIME_ANALYST` render **Dashboard Library** at `/dashboards`. In `DashboardPage.test.jsx`, open dashboard options, select Delete, confirm, and assert `api.delete('/v1/dashboards/D-1')` plus navigation to `/dashboards?persona=CRIME_ANALYST`.

```jsx
fireEvent.click(screen.getByRole('button', { name: 'Dashboard options' }));
fireEvent.click(screen.getByRole('menuitem', { name: 'Delete dashboard' }));
fireEvent.click(screen.getByRole('button', { name: 'Delete dashboard' }));
await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/v1/dashboards/D-1'));
expect(screen.getByTestId('location')).toHaveTextContent('/dashboards?persona=CRIME_ANALYST');
```

- [ ] **Step 2: Run tests and verify RED**

Run: `npm run test --workspace web -- src/app/router.test.jsx src/features/dashboards/DashboardPage.test.jsx`

Expected: FAIL because Station Operations still substitutes its operational shell at `/dashboards`, and direct deletion is absent.

- [ ] **Step 3: Share the modern library across routes**

Make the standard `DashboardLibrary` wrapper render `CommandCenterDashboardLibrary` with `api`, `workspace.availableDashboards`, and persona-preserving navigation callbacks. Change the Station Operations `/dashboards` route to that same wrapper. Preserve `StationOperationsShell` for `/` and `/dashboards/:dashboardId`.

```jsx
<Route path="/dashboards" element={<DashboardLibrary api={api} workspace={workspace} />} />
```

- [ ] **Step 4: Add direct-view deletion using the shared dialog**

In `DashboardPage`, render a dashboard options menu containing Delete and `DashboardDeleteDialog`. After success, call `navigate(governedAppLocation('/dashboards', location))` to preserve only the governed persona query.

- [ ] **Step 5: Run cross-persona regressions**

Run: `npm run test --workspace web -- src/app/router.test.jsx src/features/dashboards src/features/command-center`

Expected: PASS.

- [ ] **Step 6: Commit cross-persona support**

```powershell
git add -- web/src/features/dashboards/DashboardPages.jsx web/src/features/dashboards/DashboardPage.test.jsx web/src/app/router.jsx web/src/app/router.test.jsx
git commit -m "feat: support dashboard deletion across personas"
```

### Task 5: Implement the approved refined-library styling

**Files:**
- Modify: `web/src/styles/app.css`
- Modify: `web/src/styles/viewport-layout.test.js`

- [ ] **Step 1: Add a failing CSS contract test**

Extend the existing style contract test to require dedicated card-action, menu, modal backdrop, dialog, destructive action, success notice, dark-mode, and mobile rules:

```js
expect(css).toMatch(/\.command-center-dashboard-card__actions/);
expect(css).toMatch(/\.command-center-dashboard-delete-backdrop/);
expect(css).toMatch(/\.command-center-dashboard-delete-dialog/);
expect(css).toMatch(/\.command-center-dashboard-delete-dialog__danger/);
expect(css).toMatch(/@media\(max-width:720px\)/);
```

- [ ] **Step 2: Run the style contract and verify RED**

Run: `npm run test --workspace web -- src/styles/viewport-layout.test.js`

Expected: FAIL on the new selectors.

- [ ] **Step 3: Apply the approved visual system**

Update the library max width to match the available command-center canvas, use 10–12px card radii, 1px blue-gray borders, subtle hover elevation, stronger 16px card titles, and a compact overflow trigger beside the Open action. Add a fixed translucent backdrop and a centered dialog no wider than 440px, with visible focus styles and a restrained red destructive button. Preserve the current white page background and Catalyst blue primary action.

At `max-width:720px`, stack the page header, make the primary action full-width, keep cards single-column, and constrain the dialog to `calc(100vw - 28px)`.

- [ ] **Step 4: Run style and component tests**

Run: `npm run test --workspace web -- src/styles/viewport-layout.test.js CommandCenterDashboardLibrary.test.jsx`

Expected: PASS.

- [ ] **Step 5: Commit visual modernization**

```powershell
git add -- web/src/styles/app.css web/src/styles/viewport-layout.test.js
git commit -m "style: modernize Catalyst dashboard library"
```

### Task 6: Build, browser verification, and generated Catalyst bundle

**Files:**
- Regenerate: `functions/crime_intelligence_api/app/**`
- Verify: all files changed by Tasks 1–4

- [ ] **Step 1: Run focused verification**

Run: `node --test tests/reporting/dashboard-service.test.mjs tests/catalyst/*.test.mjs`

Run: `npm run test --workspace web -- src/features/command-center/CommandCenterDashboardLibrary.test.jsx src/styles/viewport-layout.test.js`

Expected: all tests PASS without warnings.

- [ ] **Step 2: Regenerate the Catalyst function bundle**

Run: `npm run catalyst:build`

Expected: source mirrors and bundle manifest update successfully. Review the diff to ensure only intended source synchronization and manifest changes occurred.

- [ ] **Step 3: Run production checks**

Run: `npm run web:build`

Run: `npm run catalyst:inspect`

Expected: both commands PASS.

- [ ] **Step 4: Verify the rendered workflow**

Start the existing web development server and use the in-app browser. At the approved desktop viewport, verify search, card hierarchy, overflow menu, confirmation copy, cancel, successful deletion, success notice, and that Reports still lists the referenced report. Repeat the library and modal check at a mobile-sized viewport and verify Command Center, Crime Analyst, and Station Operations persona routes. Capture the final implementation screenshot and compare it with the approved Option A concept using `view_image`.

- [ ] **Step 5: Record the fidelity ledger**

Check and document at least: page copy, card-grid layout, Catalyst palette, typography hierarchy, border/radius treatment, overflow-menu alignment, confirmation-dialog spacing, desktop responsiveness, and mobile collapse. Fix every material mismatch before proceeding.

- [ ] **Step 6: Run the full relevant regression suite**

Run: `npm run web:test`

Run: `npm test`

Expected: all tests PASS.

- [ ] **Step 7: Commit generated bundle and final fixes**

```powershell
git add -- functions/crime_intelligence_api/app web/src src/backend tests
git commit -m "build: package dashboard deletion for Catalyst"
```

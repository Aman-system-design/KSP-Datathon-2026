# KSP ACE Submission Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a consistent, recordable KSP ACE experience with an insight-led Command Center, credible District Leadership and Crime Analyst workspaces, and Utilities available wherever the governed role permits them.

**Architecture:** Keep the existing governed API, report builder, dashboard editor, and persona routing. First normalize shared navigation/header contracts, then extend the governed FIR reporting projection with non-PII time and organizational dimensions, and finally compose persona-specific insight surfaces from editable reports. Alerts remain a dedicated workflow; the Command Center only shows a compact notification entry point rather than duplicating the Alerts page.

**Tech Stack:** React 19, React Router, Vitest/Testing Library, Catalyst Advanced I/O functions, Catalyst Data Store, Vite, Deck.gl/MapLibre.

---

## Delivery order

1. **P0 — Record blockers:** shared header, navigation, Utilities visibility, loading/error consistency.
2. **P1 — Command Center:** insight-led reports and corrected lifecycle visualization.
3. **P1 — District Leadership:** scoped operational pulse using the same governed report primitives.
4. **P1 — Crime Analyst:** evidence-first analysis workspace with governed drill-downs.
5. **P0 — Video QA:** deterministic persona tour, responsive check, deployment verification.

Do not begin later phases while a P0 phase is red. Each phase must remain independently deployable.

### Task 1: Establish one platform chrome contract

**Files:**
- Modify: `web/src/app/PlatformHeader.jsx`
- Modify: `web/src/app/AppShell.jsx`
- Modify: `web/src/features/command-center/CommandCenterHeader.jsx`
- Modify: `web/src/features/command-center/CommandCenterShell.jsx`
- Modify: `web/src/styles/app.css`
- Test: `web/src/app/AppShell.test.jsx`
- Test: `web/src/features/command-center/CommandCenterShell.test.jsx`

- [ ] **Step 1: Write failing cross-shell contract tests**

Add assertions that both shells expose utilities in this exact order: notifications/alerts, settings, account; use the same emblem/title; and never render Search or Support.

```jsx
expect(within(screen.getByTestId('platform-header-utilities'))
  .getAllByRole('button').map(button => button.getAttribute('aria-label')))
  .toEqual(['Notifications', 'Open settings', 'Open account menu']);
expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
expect(screen.queryByRole('button', { name: 'Support' })).not.toBeInTheDocument();
```

- [ ] **Step 2: Verify the tests fail on inconsistent labels or order**

Run: `npm.cmd run test --workspace web -- AppShell.test.jsx CommandCenterShell.test.jsx`

Expected: FAIL until both header implementations satisfy the same contract.

- [ ] **Step 3: Extract shared identity and utility ordering**

Keep each shell's layout, but render the same shared identity strings and the same utility sequence. Do not add global search or support controls.

```jsx
<HeaderIdentity emblem={emblem} title="Karnataka State Police" />
<HeaderUtilities notifications settings account />
```

- [ ] **Step 4: Run focused and responsive tests**

Run: `npm.cmd run test --workspace web -- AppShell.test.jsx CommandCenterShell.test.jsx CommandCenterResponsive.test.js`

Expected: all focused tests PASS.

### Task 2: Make Utilities consistently reachable for authorized personas

**Files:**
- Modify: `web/src/app/workspace-navigation.js`
- Modify: `web/src/app/AppSidebar.jsx`
- Modify: `web/src/features/command-center/command-center-navigation.js`
- Modify: `web/src/features/command-center/CommandCenterShell.jsx`
- Modify: `web/src/app/router.jsx`
- Test: `web/src/app/workspace-navigation.test.js`
- Test: `web/src/features/command-center/CommandCenterShell.test.jsx`
- Test: `web/src/app/router.test.jsx`

- [ ] **Step 1: Write a role-route matrix test**

```js
for (const role of ['COMMAND_CENTER', 'STATE_LEADERSHIP', 'REGIONAL_LEADERSHIP',
  'DISTRICT_LEADERSHIP', 'CRIME_ANALYST', 'STATION_OPERATIONS', 'PLATFORM_ADMIN']) {
  expect(pathsFor(role)).toContain('/utilities');
}
expect(pathsFor('INVESTIGATOR')).not.toContain('/utilities');
```

- [ ] **Step 2: Verify the matrix exposes the current gaps**

Run: `npm.cmd run test --workspace web -- workspace-navigation.test.js CommandCenterShell.test.jsx router.test.jsx`

Expected: FAIL for any persona that displays a Utilities icon without a working route.

- [ ] **Step 3: Route every authorized Utilities control to the governed catalogue**

Command Center must navigate to `/utilities?persona=COMMAND_CENTER`; standard shells must preserve their allowlisted persona query. Remove placeholder-only module handling.

- [ ] **Step 4: Verify direct URLs and navigation clicks**

Run: `npm.cmd run test --workspace web -- workspace-navigation.test.js CommandCenterShell.test.jsx router.test.jsx UtilityPage.test.jsx`

Expected: PASS with no unauthorized role gaining Utilities access.

### Task 3: Extend the governed FIR report dimensions for real insights

**Files:**
- Modify: `src/backend/repository/catalyst/catalyst-repository.mjs`
- Modify: `functions/crime_intelligence_api/app/src/backend/repository/catalyst/catalyst-repository.mjs`
- Modify: `src/backend/reporting/semantic-sources.mjs`
- Modify: `functions/crime_intelligence_api/app/src/backend/reporting/semantic-sources.mjs`
- Modify: `src/backend/repository/memory-repository.mjs`
- Test: `tests/reporting/report-definition.test.mjs`
- Test: `tests/reporting/report-service.test.mjs`
- Test: `tests/catalyst/api-bootstrap.test.mjs`

- [ ] **Step 1: Write failing tests for safe dimensions**

The governed `catalog.caseMaster` source must expose only non-PII analytical dimensions:

```js
expect(source.fields).toMatchObject({
  DistrictName: { type: 'string', dimension: true },
  PoliceStationName: { type: 'string', dimension: true },
  IncidentMonth: { type: 'string', dimension: true },
  RegisteredMonth: { type: 'string', dimension: true },
});
```

- [ ] **Step 2: Verify the new fields are rejected before implementation**

Run: `node --test tests/reporting/report-definition.test.mjs tests/reporting/report-service.test.mjs`

Expected: FAIL with `Unknown field`.

- [ ] **Step 3: Project the dimensions from governed source rows**

Derive month keys as `YYYY-MM`, resolve district/station names through `SRC_Unit`, and preserve authorized-unit filtering before projection. Do not project crime numbers, names, brief facts, or coordinates into generic reports.

```js
return {
  DistrictCode: String(districtId ?? 'UNASSIGNED'),
  DistrictName: districtById.get(String(districtId))?.UnitName ?? 'Unassigned',
  PoliceStationName: station?.UnitName ?? 'Unassigned',
  IncidentMonth: monthKey(row.IncidentFromDate),
  RegisteredMonth: monthKey(row.CrimeRegisteredDate),
  CrimeMajorHeadName: majorName,
  CrimeMinorHeadName: minorName,
  CaseStatusLabel: statusName,
  RecordCount: 1,
};
```

- [ ] **Step 4: Mirror the source and packaged function implementations**

Keep `src/backend/**` and `functions/crime_intelligence_api/app/src/backend/**` byte-equivalent for the changed projection and semantic source sections.

- [ ] **Step 5: Run backend security and reporting tests**

Run: `node --test tests/reporting/*.test.mjs tests/backend/security.test.mjs tests/catalyst/api-bootstrap.test.mjs`

Expected: PASS; no PII field appears in report execution rows.

### Task 4: Recompose the Command Center around changes and concentrations

**Files:**
- Modify: `web/src/features/command-center/state-intelligence-template.js`
- Modify: `web/src/features/command-center/submission-synthetic-results.js`
- Modify: `web/src/features/command-center/CommandCenterAddReportDrawer.jsx`
- Modify: `web/src/features/command-center/CommandCenterDashboardCanvas.jsx`
- Test: `web/src/features/command-center/CommandCenterAddReportDrawer.test.jsx`
- Test: `web/src/features/command-center/submission-synthetic-results.test.js`
- Test: `web/src/features/command-center/CommandCenterDashboardCanvas.test.jsx`

- [ ] **Step 1: Write failing tests for the default insight set**

The default dashboard must contain these editable governed reports:

```js
expect(names).toEqual([
  'FIRs by Karnataka District',
  'Monthly FIR Trend',
  'District FIR Concentration',
  'Fastest Growing Crime Categories',
  'Case Lifecycle',
  'Crime Category Mix',
]);
```

Keep `24-Hour Crime Pattern` in the Add chart library, not in the leadership default.

- [ ] **Step 2: Verify the new insight templates are absent**

Run: `npm.cmd run test --workspace web -- CommandCenterAddReportDrawer.test.jsx submission-synthetic-results.test.js`

Expected: FAIL for missing templates/rows.

- [ ] **Step 3: Add governed definitions and a decision-first layout**

Use: map `7x5`, monthly trend `5x3`, district concentration `5x4`, crime growth `7x4`, lifecycle `6x3`, category mix `6x3`. Every card remains removable, resizable, and linked to report editing.

- [ ] **Step 4: Keep Alerts as a compact notification entry point**

The bell may display an unread indicator and open `/alerts`; do not place an alert table or placeholder card inside the dashboard.

- [ ] **Step 5: Verify editing, resizing, saving, and reload persistence**

Run: `npm.cmd run test --workspace web -- CommandCenterDashboardCanvas.test.jsx useCommandCenterDashboard.test.jsx CommandCenterDashboardWorkspace.test.jsx`

Expected: PASS, including live resize before save.

### Task 5: Replace the lifecycle bars with a compact insight visualization

**Files:**
- Modify: `web/src/features/reports/renderers/FunnelReport.jsx`
- Modify: `web/src/styles/app.css`
- Test: `web/src/features/reports/__tests__/report-renderers.test.jsx`

- [ ] **Step 1: Write the failing lifecycle semantics test**

```jsx
expect(screen.getByText('80%')).toBeInTheDocument();
expect(screen.getByText('20%')).toBeInTheDocument();
expect(screen.getByText('Chargesheet conversion')).toBeInTheDocument();
expect(screen.getByText('25%')).toBeInTheDocument();
```

- [ ] **Step 2: Verify the current two bars fail the test**

Run: `npm.cmd run test --workspace web -- report-renderers.test.jsx`

Expected: FAIL because percentages and conversion summary do not exist.

- [ ] **Step 3: Render balanced lifecycle stages**

Calculate each stage share from the total and show count, share, and a concise conversion summary. Use a centered grid in dashboard density; remove minimum widths and avoid height-filling bars.

```jsx
<button className="report-funnel__stage">
  <span>{point.label}</span>
  <strong>{formatNumber(point.value)}</strong>
  <small>{formatPercent(point.value / total)}</small>
</button>
```

- [ ] **Step 4: Verify compact and responsive rendering**

Run: `npm.cmd run test --workspace web -- report-renderers.test.jsx CommandCenterResponsive.test.js`

Expected: PASS at dashboard and workbench density.

### Task 6: Finish the District Leadership workspace

**Files:**
- Modify: `web/src/features/workspaces/PersonaWorkspace.jsx`
- Create: `web/src/features/workspaces/DistrictLeadershipDashboard.jsx`
- Create: `web/src/features/workspaces/DistrictLeadershipDashboard.test.jsx`
- Modify: `web/src/styles/app.css`

- [ ] **Step 1: Write failing scope and content tests**

Assert the page shows authorized district name, monthly FIR trend, station concentration, crime mix, lifecycle health, and links to Maps/Reports/Utilities. Assert it never shows statewide totals outside scope.

- [ ] **Step 2: Verify the current generic jurisdiction page fails**

Run: `npm.cmd run test --workspace web -- DistrictLeadershipDashboard.test.jsx PersonaWorkspace.test.jsx`

Expected: FAIL for missing district insight sections.

- [ ] **Step 3: Compose the dashboard from viewer-scoped report executions**

Reuse `ReportPreview` and governed report definitions. Do not duplicate query logic in the browser and do not display individual FIRs on the landing page.

- [ ] **Step 4: Verify partial-data and unavailable states**

Run: `npm.cmd run test --workspace web -- DistrictLeadershipDashboard.test.jsx PersonaWorkspace.test.jsx`

Expected: PASS with clear partial/unavailable messaging and no fake operational values.

### Task 7: Finish the Crime Analyst workspace

**Files:**
- Modify: `web/src/features/workspaces/PersonaWorkspace.jsx`
- Create: `web/src/features/workspaces/CrimeAnalystDashboard.jsx`
- Create: `web/src/features/workspaces/CrimeAnalystDashboard.test.jsx`
- Modify: `web/src/styles/app.css`

- [ ] **Step 1: Write failing analyst workflow tests**

Assert the workspace answers: what changed, where it concentrates, when it occurs, which governed utility produced the finding, and how to open supporting evidence.

- [ ] **Step 2: Verify the generic analyst page fails the workflow test**

Run: `npm.cmd run test --workspace web -- CrimeAnalystDashboard.test.jsx PersonaWorkspace.test.jsx`

Expected: FAIL for missing comparison/evidence actions.

- [ ] **Step 3: Build the evidence-first workspace**

Use compact monthly/category/district comparisons, links to Geospatial and Networks, and explicit governed evidence actions. Utilities are discoverable from both navigation and finding context.

- [ ] **Step 4: Verify keyboard, responsive, and empty states**

Run: `npm.cmd run test --workspace web -- CrimeAnalystDashboard.test.jsx PersonaWorkspace.test.jsx AppShell.test.jsx`

Expected: PASS without horizontal overflow or inaccessible controls.

### Task 8: Execute the video-readiness gate

**Files:**
- Create: `docs/video-demo-runbook.md`
- Modify: tests only if the run reveals a reproducible regression

- [ ] **Step 1: Build and run the full automated gate**

Run: `npm.cmd test`

Expected: all tests PASS.

Run: `npm.cmd run web:build`

Expected: Vite build and bundle-budget check PASS.

- [ ] **Step 2: Browser-test the exact recording path**

Test: All workspaces → Command Center → dashboard edit/resize/save → Map district selection → Alerts → Utilities → District Leadership → Crime Analyst → report drill-down.

Expected: consistent header, no blank canvas, no framework overlay, no relevant console error, and no dead navigation control.

- [ ] **Step 3: Record viewport evidence**

Verify desktop `1920x1080` and laptop `1366x768`. Capture one screenshot per persona home and note synthetic-data provenance where displayed.

- [ ] **Step 4: Deploy Development, verify assets, then deploy Production**

Run: `catalyst.cmd deploy slate ksp-crime-intelligence`

Expected: Development build succeeds.

Run after Production Slate is activated in the console: `catalyst.cmd deploy slate ksp-crime-intelligence --production`

Expected: Production deployment succeeds and `https://ace.onslate.in` serves the new hashed assets.

- [ ] **Step 5: Write the deterministic recording runbook**

The runbook must list URLs, persona order, clicks, expected insight on each screen, and a recovery route if network data is unavailable. Do not depend on unsaved dashboard edits during recording.


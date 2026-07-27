# Frontend Demonstration Labels Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove a leading `Synthetic` token from user-facing frontend values while retaining truthful `Demonstration data` provenance and leaving backend data unchanged.

**Architecture:** Add a pure display-text helper and reuse it at report, workspace-scope, and case-detail presentation boundaries. Raw API objects remain untouched; normalization happens only while constructing rendered strings.

**Tech Stack:** React 19, JavaScript, Vitest, Testing Library, Vite, Catalyst Slate

---

## File map

- Create `web/src/lib/display-text.js` and its unit test for pure label normalization.
- Modify `web/src/features/reports/report-preview-adapters.js` to delegate report labels to the helper.
- Modify `web/src/app/AppSidebar.jsx`, `web/src/app/AccountMenu.jsx`, the persona dashboard workspaces, and station views at their render boundaries.
- Modify command-center and utility provenance copy without changing their `syntheticData` conditions.

### Task 1: Shared display normalization

**Files:**
- Create: `web/src/lib/display-text.js`
- Create: `web/src/lib/display-text.test.js`
- Modify: `web/src/features/reports/report-preview-adapters.js`
- Test: `web/src/features/reports/__tests__/report-preview-adapters.test.js`

- [ ] **Step 1: Write the failing tests**

```js
import { expect, test } from 'vitest';
import { demonstrationLabel } from './display-text.js';

test.each([
  ['Synthetic Bagalkot District', 'Bagalkot District'],
  ['synthetic   Property Crime', 'Property Crime'],
  ['Non-synthetic evidence', 'Non-synthetic evidence'],
  [42, 42],
])('normalizes frontend demonstration label %j', (value, expected) => {
  expect(demonstrationLabel(value)).toBe(expected);
});
```

Add an adapter assertion that `Synthetic Property Crime` renders as `Property Crime` when demonstration provenance is true.

- [ ] **Step 2: Verify RED**

Run: `npm.cmd --prefix web test -- --run src/lib/display-text.test.js src/features/reports/__tests__/report-preview-adapters.test.js`

Expected: FAIL because `display-text.js` does not exist.

- [ ] **Step 3: Implement the minimum helper**

```js
export function demonstrationLabel(value) {
  return typeof value === 'string' ? value.replace(/^Synthetic\s+/iu, '').trim() : value;
}
```

Import it in `report-preview-adapters.js` and return `demonstration ? demonstrationLabel(value) : value` from `cleanReportLabel`.

- [ ] **Step 4: Verify GREEN**

Run the Step 2 command. Expected: both test files pass.

- [ ] **Step 5: Commit**

```powershell
git add web/src/lib web/src/features/reports/report-preview-adapters.js web/src/features/reports/__tests__/report-preview-adapters.test.js
git commit -m "feat: normalize frontend demonstration labels"
```

### Task 2: Workspace and case presentation boundaries

**Files:**
- Modify: `web/src/app/AppSidebar.jsx`
- Modify: `web/src/app/AccountMenu.jsx`
- Modify: `web/src/features/dashboards/DistrictDashboardWorkspace.jsx`
- Modify: `web/src/features/dashboards/PoliceStationDashboardWorkspace.jsx`
- Modify: `web/src/features/station-operations/StationOperationsShell.jsx`
- Modify: `web/src/features/station-operations/StationCaseDetail.jsx`
- Test: related colocated `*.test.jsx` files

- [ ] **Step 1: Add failing component regressions**

Use fixtures with `scopeUnit.name: 'Synthetic Bagalkot District'` and `scopeUnit.name: 'Synthetic Bagalkot Central Police Station'`. Assert rendered headings, chips, navigation labels, and representative case facts contain cleaned values and no leading `Synthetic`. Assert the case provenance cue reads `Demonstration data`.

- [ ] **Step 2: Verify RED**

```powershell
npm.cmd --prefix web test -- --run src/app/AppSidebar.test.jsx src/app/AccountMenu.test.jsx src/features/dashboards/DistrictDashboardWorkspace.test.jsx src/features/dashboards/PoliceStationDashboardWorkspace.test.jsx src/features/station-operations/StationOperationsShell.test.jsx src/features/station-operations/StationCaseDetail.test.jsx
```

Expected: FAIL on the visible raw labels.

- [ ] **Step 3: Normalize only during rendering**

Import `demonstrationLabel`, wrap scope names and string case-fact values immediately before rendering, and map `SYNTHETIC` provenance to `Demonstration data`. Do not mutate workspace or case response objects.

- [ ] **Step 4: Verify GREEN**

Run the Step 2 command. Expected: all selected tests pass.

- [ ] **Step 5: Commit**

```powershell
git add web/src/app web/src/features/dashboards web/src/features/station-operations
git commit -m "feat: clean demonstration names in persona views"
```

### Task 3: Provenance copy and full verification

**Files:**
- Modify: `web/src/features/command-center/CommandCenterReportSurface.jsx`
- Modify: `web/src/features/utilities/UtilityPage.jsx`
- Test: related colocated tests

- [ ] **Step 1: Add failing copy tests**

Assert synthetic-result surfaces show `Demonstration data`, never `Submission synthetic data` or `Synthetic demonstration data`.

- [ ] **Step 2: Verify RED**

Run: `npm.cmd --prefix web test -- --run src/features/command-center/CommandCenterReportSurface.test.jsx src/features/utilities/UtilityPage.test.jsx`

Expected: FAIL on the old copy.

- [ ] **Step 3: Replace only provenance copy**

Render `Demonstration data` while retaining the existing `syntheticData` condition.

- [ ] **Step 4: Run complete verification**

Run: `npm.cmd run verify`

Expected: backend, frontend, production build, bundle inspection, and both schema validations pass.

- [ ] **Step 5: Commit and push**

```powershell
git add web/src/features/command-center web/src/features/utilities
git commit -m "fix: keep demonstration provenance professional"
git push origin HEAD:main
```

### Task 4: Deploy and end-to-end browser verification

**Files:** No source changes expected.

- [ ] **Step 1: Deploy**

Run `catalyst.cmd deploy -p 43492000000013049 --only functions:crime_intelligence_api,slate:ksp-crime-intelligence`, then restore `KSP_AUDIT_KEY` after function deployment.

- [ ] **Step 2: Verify five persona homes**

Open Command Center, State Leadership, District Leadership, Crime Analyst, and Station Operations. Confirm the intended dashboard loads, reports render, and no alert/error surface or browser console error appears.

- [ ] **Step 3: Verify station flow**

Check all nine station cards, period switching, one chart selection, one open-report route, and return navigation. Confirm metric descriptions wrap in sentence case and no report error appears.

- [ ] **Step 4: Verify display and provenance contract**

Confirm no visible name or categorical value begins with `Synthetic`, while `Demonstration data` remains visible on a provenance surface.

- [ ] **Step 5: Record evidence**

Report persona headings, report counts, station scope, errors found (expected none), and deployed commit hash.

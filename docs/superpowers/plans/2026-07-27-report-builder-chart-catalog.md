# Governed Report Builder Chart Catalogue Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show all seven report visualizations, reuse the governed Karnataka map flow, identify approved Data Store-backed sources, and remove competing builder scrollbars without altering existing report definitions.

**Architecture:** Add a pure frontend catalogue/compatibility module that describes every visible visualization while treating the server-provided source contract as authoritative. `ReportBuilder` uses that result to gate forward navigation, Save, and Run; existing payload construction and map execution stay unchanged. Layout changes remain isolated to report-builder CSS and responsive regression tests.

**Tech Stack:** React 19, React Router, Lucide React, Vitest, Testing Library, Vite, existing report semantic-source API and map renderer.

---

## File structure

- Create `web/src/features/reports/report-visualization-catalog.js`: immutable catalogue, labels, icons keys, and compatibility reasoning.
- Create `web/src/features/reports/report-visualization-catalog.test.js`: pure compatibility contract tests.
- Modify `web/src/features/reports/ReportBuilderFields.jsx`: governed source presentation and seven-card Type step.
- Modify `web/src/features/reports/ReportBuilder.jsx`: pass compatibility state and gate unsafe actions without changing payloads.
- Modify `web/src/features/reports/ReportBuilder.test.jsx`: end-to-end builder compatibility and existing-payload regressions.
- Modify `web/src/styles/app.css`: fitted card grid and single-owner scrolling.
- Modify `web/src/styles/viewport-layout.test.js`: static responsive overflow contract.

### Task 1: Define the immutable chart catalogue and compatibility rules

**Files:**
- Create: `web/src/features/reports/report-visualization-catalog.js`
- Create: `web/src/features/reports/report-visualization-catalog.test.js`

- [ ] **Step 1: Write failing catalogue tests**

```js
import { describe, expect, test } from 'vitest';
import { chartCompatibility, REPORT_VISUALIZATIONS } from './report-visualization-catalog.js';

const source = {
  visualizations: ['table', 'bar', 'map'],
  fields: {
    district: { type: 'string', dimension: true },
    count: { type: 'number', aggregates: ['sum'] },
  },
};

describe('report visualization catalogue', () => {
  test('lists every approved builder choice in stable order', () => {
    expect(REPORT_VISUALIZATIONS.map(item => item.type)).toEqual([
      'table', 'number', 'bar', 'line', 'pie', 'funnel', 'map',
    ]);
    expect(REPORT_VISUALIZATIONS.at(-1).label).toBe('Karnataka Map');
  });

  test('requires server approval before a chart can be saved or run', () => {
    expect(chartCompatibility({ source, type: 'bar' })).toEqual({ compatible: true, reason: '' });
    expect(chartCompatibility({ source, type: 'pie' })).toEqual({
      compatible: false,
      reason: 'This governed source does not support Pie reports.',
    });
  });

  test('reports missing numeric and geographic requirements clearly', () => {
    expect(chartCompatibility({ source: { ...source, visualizations: ['number'], fields: {} }, type: 'number' }).reason)
      .toBe('KPI Number requires a numeric measure.');
    expect(chartCompatibility({ source: { ...source, visualizations: ['map'], fields: {} }, type: 'map' }).reason)
      .toBe('Karnataka Map requires an approved geographic source.');
  });
});
```

- [ ] **Step 2: Run the tests and verify the missing module failure**

Run: `npm.cmd test --workspace web -- --run src/features/reports/report-visualization-catalog.test.js`

Expected: FAIL because `report-visualization-catalog.js` does not exist.

- [ ] **Step 3: Implement the minimal pure catalogue**

```js
export const REPORT_VISUALIZATIONS = Object.freeze([
  { type: 'table', label: 'Table' },
  { type: 'number', label: 'KPI Number' },
  { type: 'bar', label: 'Bar' },
  { type: 'line', label: 'Line' },
  { type: 'pie', label: 'Pie' },
  { type: 'funnel', label: 'Funnel' },
  { type: 'map', label: 'Karnataka Map' },
].map(Object.freeze));

const hasMeasure = source => Object.values(source?.fields ?? {})
  .some(field => field.type === 'number' && field.aggregates?.length > 0);
const hasDimension = source => Object.values(source?.fields ?? {}).some(field => field.dimension);
const hasGeography = source => ['areaId', 'unitId', 'latitude', 'longitude']
  .some(field => Object.hasOwn(source?.fields ?? {}, field));
const labelFor = type => REPORT_VISUALIZATIONS.find(item => item.type === type)?.label ?? type;

export function chartCompatibility({ source, type }) {
  if (!source?.visualizations?.includes(type)) return {
    compatible: false,
    reason: `This governed source does not support ${labelFor(type)} reports.`,
  };
  if (type === 'number' && !hasMeasure(source)) return { compatible: false, reason: 'KPI Number requires a numeric measure.' };
  if (['bar', 'line', 'pie', 'funnel'].includes(type) && (!hasDimension(source) || !hasMeasure(source))) return {
    compatible: false,
    reason: `${labelFor(type)} requires a grouping field and numeric measure.`,
  };
  if (type === 'map' && !hasGeography(source)) return { compatible: false, reason: 'Karnataka Map requires an approved geographic source.' };
  return { compatible: true, reason: '' };
}
```

- [ ] **Step 4: Run the catalogue tests**

Run: `npm.cmd test --workspace web -- --run src/features/reports/report-visualization-catalog.test.js`

Expected: all catalogue tests PASS.

- [ ] **Step 5: Commit the pure compatibility unit**

```powershell
git add web/src/features/reports/report-visualization-catalog.js web/src/features/reports/report-visualization-catalog.test.js
git commit -m "feat: define governed report chart catalogue"
```

### Task 2: Render all seven choices and governed Data Store source language

**Files:**
- Modify: `web/src/features/reports/ReportBuilderFields.jsx`
- Modify: `web/src/features/reports/ReportBuilder.test.jsx`

- [ ] **Step 1: Add failing builder tests for source and chart discovery**

```jsx
test('shows governed Data Store sources and the complete chart catalogue', async () => {
  const api = { get: vi.fn(async () => ({ data: [anomalySource] })), post: vi.fn() };
  renderNew(api);
  await screen.findByRole('option', { name: 'Trend anomalies' });
  expect(screen.getByText('Approved Data Store source')).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Report name'), { target: { value: 'Chart discovery' } });
  next();
  for (const label of ['Table', 'KPI Number', 'Bar', 'Line', 'Pie', 'Funnel', 'Karnataka Map']) {
    expect(screen.getByRole('radio', { name: new RegExp(label, 'i') })).toBeInTheDocument();
  }
});
```

- [ ] **Step 2: Run the focused builder test and verify it fails**

Run: `npm.cmd test --workspace web -- --run src/features/reports/ReportBuilder.test.jsx -t "complete chart catalogue"`

Expected: FAIL because only source-advertised types render.

- [ ] **Step 3: Expand icons and Type-step props**

In `ReportBuilderFields.jsx`, import `PieChart`, `Filter`, and `MapPinned`; map all seven types to distinct icons. Change `TypeStep` to accept `choices`, render every catalogue item, preserve `role="radio"`, and render an inline reason when the selected choice is incompatible. Keep the hidden select synchronized for accessibility.

Use this source descriptor directly below the source select:

```jsx
<small className="report-source-governance">Approved Data Store source · viewer scoped</small>
```

- [ ] **Step 4: Run the builder test and verify it passes**

Run: `npm.cmd test --workspace web -- --run src/features/reports/ReportBuilder.test.jsx -t "complete chart catalogue"`

Expected: PASS with all seven labels and the governed-source descriptor.

- [ ] **Step 5: Commit discovery UI**

```powershell
git add web/src/features/reports/ReportBuilderFields.jsx web/src/features/reports/ReportBuilder.test.jsx
git commit -m "feat: show governed report chart choices"
```

### Task 3: Gate incompatible new definitions without changing existing payloads

**Files:**
- Modify: `web/src/features/reports/ReportBuilder.jsx`
- Modify: `web/src/features/reports/ReportBuilder.test.jsx`

- [ ] **Step 1: Add failing safety regressions**

```jsx
test('does not save a chart rejected by the governed source contract', async () => {
  const api = { get: vi.fn(async () => ({ data: [anomalySource] })), post: vi.fn() };
  renderNew(api);
  await screen.findByRole('option', { name: 'Trend anomalies' });
  fireEvent.change(screen.getByLabelText('Report name'), { target: { value: 'Unsafe pie' } });
  next();
  fireEvent.click(screen.getByRole('radio', { name: /Pie/i }));
  expect(screen.getByText('This governed source does not support Pie reports.')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Run' })).toBeDisabled();
  expect(api.post).not.toHaveBeenCalled();
});

// Add this assertion to the existing
// "creates and executes a governed report through the progressive workflow" test:
expect(api.post).toHaveBeenNthCalledWith(1, '/v1/reports', expect.objectContaining({
  name: 'Anomaly watch',
  sourceKey: 'anomalies',
  dimensions: ['unitId'],
  measures: [{ field: 'observed', aggregate: 'sum' }],
  visualization: { type: 'bar' },
}));
```

- [ ] **Step 2: Run the safety test and verify it fails**

Run: `npm.cmd test --workspace web -- --run src/features/reports/ReportBuilder.test.jsx -t "rejected by the governed source"`

Expected: FAIL because unsupported choices are not yet selectable/gated.

- [ ] **Step 3: Connect compatibility to builder controls**

Import the catalogue module, calculate:

```js
const compatibility = chartCompatibility({ source, type: visualization });
const choices = REPORT_VISUALIZATIONS.map(item => ({
  ...item,
  ...chartCompatibility({ source, type: item.type }),
}));
const canRun = Boolean(name.trim() && sourceKey && compatibility.compatible
  && (visualization !== 'map' || mapViewId));
const canAdvance = step === 0
  ? Boolean(name.trim() && sourceKey)
  : step === 1 ? compatibility.compatible : true;
```

Pass `choices` and `compatibility.reason` to `TypeStep`. Do not modify `definition()`, existing edit hydration, API paths, or payload property names.

- [ ] **Step 4: Verify safety and existing payload tests**

Run: `npm.cmd test --workspace web -- --run src/features/reports/ReportBuilder.test.jsx`

Expected: all ReportBuilder tests PASS, including unchanged payload assertions.

- [ ] **Step 5: Commit compatibility gating**

```powershell
git add web/src/features/reports/ReportBuilder.jsx web/src/features/reports/ReportBuilder.test.jsx
git commit -m "feat: block incompatible report definitions"
```

### Task 4: Prove Karnataka Map reuses the existing governed map flow

**Files:**
- Modify: `web/src/features/reports/ReportBuilder.test.jsx`

- [ ] **Step 1: Extend the existing map test with label and payload assertions**

```jsx
expect(screen.getByRole('radio', { name: /Karnataka Map/i })).toBeInTheDocument();
fireEvent.click(screen.getByRole('radio', { name: /Karnataka Map/i }));
// Continue through the existing saved-view flow.
expect(api.post).toHaveBeenCalledWith('/v1/reports', expect.objectContaining({
  sourceKey: 'hotspots',
  visualization: { type: 'map', mapViewId: 'VIEW-1' },
}));
```

- [ ] **Step 2: Run the map-focused tests**

Run: `npm.cmd test --workspace web -- --run src/features/reports/ReportBuilder.test.jsx -t "map"`

Expected: PASS and no new geography component is required.

- [ ] **Step 3: Commit the map regression proof**

```powershell
git add web/src/features/reports/ReportBuilder.test.jsx
git commit -m "test: preserve governed Karnataka map flow"
```

### Task 5: Fit the builder without competing side scrollbars

**Files:**
- Modify: `web/src/styles/app.css`
- Modify: `web/src/styles/viewport-layout.test.js`

- [ ] **Step 1: Add failing CSS contract assertions**

```js
test('fits report authoring and chart cards without nested horizontal scrolling', () => {
  expect(appCss).toMatch(/\.report-builder-workspace[^}]*overflow:\s*hidden/);
  expect(appCss).toMatch(/\.report-builder-authoring[^}]*overflow-x:\s*hidden/);
  expect(appCss).toMatch(/\.report-type-picker[^}]*repeat\(auto-fit,\s*minmax\(120px,\s*1fr\)\)/);
  expect(appCss).toMatch(/@media \(max-width:\s*720px\)[\s\S]*\.report-builder-workspace[^}]*grid-template-columns:\s*1fr/);
});
```

- [ ] **Step 2: Run the viewport test and verify it fails**

Run: `npm.cmd test --workspace web -- --run src/styles/viewport-layout.test.js`

Expected: FAIL because the current fixed card grid and pane overflow permit nested scrollbars.

- [ ] **Step 3: Apply the isolated responsive CSS**

Use these rules, adapting only declarations that already exist:

```css
.report-builder-workspace { overflow: hidden; }
.report-builder-authoring { overflow-x: hidden; overflow-y: auto; }
.report-builder-preview { overflow: hidden; }
.report-builder-preview__canvas { overflow-x: hidden; overflow-y: auto; }
.report-type-picker { grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); }
.report-type-picker button { min-width: 0; }
@media (max-width: 720px) {
  .report-builder-workspace { grid-template-columns: 1fr; overflow: visible; }
  .report-builder-authoring, .report-builder-preview, .report-builder-preview__canvas { overflow: visible; }
}
```

Retain horizontal overflow only in the existing result-table wrapper, where wide tabular output genuinely requires it.

- [ ] **Step 4: Run viewport and report tests**

Run: `npm.cmd test --workspace web -- --run src/styles/viewport-layout.test.js src/features/reports`

Expected: all selected tests PASS.

- [ ] **Step 5: Commit the fitted layout**

```powershell
git add web/src/styles/app.css web/src/styles/viewport-layout.test.js
git commit -m "fix: fit report builder without nested scrolling"
```

### Task 6: Full verification and browser review

**Files:**
- Verify only; no intended source changes.

- [ ] **Step 1: Run the complete web test suite**

Run: `npm.cmd test --workspace web -- --run`

Expected: all test files and tests PASS with zero failures.

- [ ] **Step 2: Build the production web bundle**

Run: `npm.cmd run build --workspace web`

Expected: exit code 0; existing Catalyst SDK and bundle-size warnings may remain, but no build error.

- [ ] **Step 3: Run a safe local visual harness**

Open the builder with a mock `GET /v1/report-sources` response containing one standard source and one geographic source. Verify desktop 1440×900 and mobile 390×844:

- all seven cards fit without an outer horizontal scrollbar;
- the selected incompatible card shows a reason and Save/Run stay disabled;
- `Karnataka Map` uses the existing map configuration step;
- mobile stacks authoring and preview with page-owned vertical scrolling;
- Ask Intelligence does not navigate or reload.

- [ ] **Step 4: Audit isolation**

Run: `git diff --name-only origin/main...HEAD`

Expected: only report-builder source/tests/CSS and the approved design/plan documents; no utilities, authentication, deployment, secrets, or unrelated dashboard files.

- [ ] **Step 5: Confirm clean worktree**

Run: `git status --short`

Expected: no output after any final verification-only commit.

# Report Builder Slim Intelligence Bar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Modernize the existing five-step report builder into a Catalyst-style split workspace with a slim, honest deferred-state Intelligence bar and a persistent large preview, without changing report behavior or backend APIs.

**Architecture:** Keep `ReportBuilder` as the owner of all existing report state and persistence. Add one isolated local-only `ReportIntelligenceBar` component, compose existing step components beside the existing `ReportPreview`, and limit styling changes to report-builder selectors. No QuickML client, backend route, report-definition change, or deployment is included.

**Tech Stack:** React 19, React Router 7, Lucide React, Vitest, Testing Library, existing Catalyst-style CSS.

---

## File Map

### Create

- `web/src/features/reports/ReportIntelligenceBar.jsx` — local prompt input and honest deferred response; no API or draft access.
- `web/src/features/reports/ReportIntelligenceBar.test.jsx` — prompt, disabled state, submission, edit collapse, and no-network contract.

### Modify

- `web/src/features/reports/ReportBuilder.jsx` — persistent split layout and preview composition while retaining all existing state and save/run logic.
- `web/src/features/reports/ReportBuilder.test.jsx` — structural and regression assertions for preview placement and report safety.
- `web/src/styles/app.css` — scoped Catalyst split workspace, slim bar, larger preview, and responsive stacking.

### Reference Only

- `web/src/features/reports/ReportPreview.jsx` — existing output renderer; its data contract remains unchanged.
- `web/src/features/reports/ReportBuilderFields.jsx` — existing step controls; their contracts remain unchanged.

---

### Task 1: Local-Only Intelligence Bar

**Files:**
- Create: `web/src/features/reports/ReportIntelligenceBar.jsx`
- Create: `web/src/features/reports/ReportIntelligenceBar.test.jsx`

- [ ] **Step 1: Write the failing component tests**

```jsx
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';

import { ReportIntelligenceBar } from './ReportIntelligenceBar.jsx';

afterEach(cleanup);

test('keeps Ask disabled until a prompt contains text', () => {
  render(<ReportIntelligenceBar />);
  const ask = screen.getByRole('button', { name: 'Ask Intelligence' });
  expect(ask).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Ask Intelligence'), { target: { value: 'Show FIR count by hour' } });
  expect(ask).toBeEnabled();
});

test('answers honestly without calling a service or changing a report', () => {
  render(<ReportIntelligenceBar />);
  fireEvent.change(screen.getByLabelText('Ask Intelligence'), { target: { value: 'Show FIR count by hour' } });
  fireEvent.click(screen.getByRole('button', { name: 'Ask Intelligence' }));
  expect(screen.getByRole('status')).toHaveTextContent('Intelligence setup is not enabled yet. Your report was not changed.');
});

test('editing the prompt collapses the previous deferred response', () => {
  render(<ReportIntelligenceBar />);
  const prompt = screen.getByLabelText('Ask Intelligence');
  fireEvent.change(prompt, { target: { value: 'Show FIR count by hour' } });
  fireEvent.click(screen.getByRole('button', { name: 'Ask Intelligence' }));
  fireEvent.change(prompt, { target: { value: 'Show open FIR count' } });
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run the focused test and confirm the missing-module failure**

Run: `npm run test --workspace web -- ReportIntelligenceBar.test.jsx`

Expected: FAIL because `ReportIntelligenceBar.jsx` does not exist.

- [ ] **Step 3: Implement the minimal local-only component**

```jsx
import { Sparkles } from 'lucide-react';
import { useState } from 'react';

export function ReportIntelligenceBar() {
  const [prompt, setPrompt] = useState('');
  const [submitted, setSubmitted] = useState(false);

  function updatePrompt(event) {
    setPrompt(event.target.value);
    setSubmitted(false);
  }

  function submit(event) {
    event.preventDefault();
    if (!prompt.trim()) return;
    setSubmitted(true);
  }

  return <section className="report-intelligence" aria-label="Ask Intelligence">
    <form className="report-intelligence__bar" onSubmit={submit}>
      <Sparkles aria-hidden="true" size={17} />
      <label className="visually-hidden" htmlFor="report-intelligence-prompt">Ask Intelligence</label>
      <input
        id="report-intelligence-prompt"
        onChange={updatePrompt}
        placeholder="What do you want to see?"
        value={prompt}
      />
      <button className="primary-button" disabled={!prompt.trim()} type="submit">Ask Intelligence</button>
    </form>
    {submitted ? <p className="report-intelligence__status" role="status">
      Intelligence setup is not enabled yet. Your report was not changed.
    </p> : null}
  </section>;
}
```

- [ ] **Step 4: Run the focused test and verify it passes**

Run: `npm run test --workspace web -- ReportIntelligenceBar.test.jsx`

Expected: PASS with 3 tests and 0 failures.

- [ ] **Step 5: Commit the component**

```bash
git add web/src/features/reports/ReportIntelligenceBar.jsx web/src/features/reports/ReportIntelligenceBar.test.jsx
git commit -m "feat: add safe slim report intelligence bar"
```

---

### Task 2: Persistent Split Workspace and Preview

**Files:**
- Modify: `web/src/features/reports/ReportBuilder.jsx`
- Modify: `web/src/features/reports/ReportBuilder.test.jsx`

- [ ] **Step 1: Add failing layout and safety assertions**

Append these tests to `ReportBuilder.test.jsx`:

```jsx
test('keeps the report preview beside every authoring step', async () => {
  const api = { get: vi.fn(async () => ({ data: [anomalySource] })), post: vi.fn() };
  renderNew(api);
  await screen.findByRole('option', { name: 'Trend anomalies' });
  expect(screen.getByRole('region', { name: 'Report preview workspace' })).toBeInTheDocument();
  expect(screen.getByLabelText('Ask Intelligence')).toBeInTheDocument();
  expect(screen.getByText('Run the report to generate its preview.')).toBeInTheDocument();
  next();
  expect(screen.getByRole('heading', { name: 'Select a visualization' })).toBeInTheDocument();
  expect(screen.getByRole('region', { name: 'Report preview workspace' })).toBeInTheDocument();
});

test('using the deferred Intelligence bar never calls the report API', async () => {
  const api = { get: vi.fn(async () => ({ data: [anomalySource] })), post: vi.fn() };
  renderNew(api);
  await screen.findByRole('option', { name: 'Trend anomalies' });
  fireEvent.change(screen.getByLabelText('Ask Intelligence'), { target: { value: 'Show FIR count by hour' } });
  fireEvent.click(screen.getByRole('button', { name: 'Ask Intelligence' }));
  expect(api.post).not.toHaveBeenCalled();
  expect(screen.getByRole('status')).toHaveTextContent('Your report was not changed');
});
```

- [ ] **Step 2: Run the focused builder tests and verify the new assertions fail**

Run: `npm run test --workspace web -- ReportBuilder.test.jsx`

Expected: FAIL because the preview region and Intelligence bar are not present before Review.

- [ ] **Step 3: Compose the new workspace without changing report state or APIs**

Add the import:

```jsx
import { ReportIntelligenceBar } from './ReportIntelligenceBar.jsx';
```

Inside `ReportBuilder`, add a render-only step selector before the return:

```jsx
const activeStep = step === 0
  ? <DataStep description={description} name={name} onDescription={value => invalidate(() => setDescription(value))} onName={value => invalidate(() => setName(value))} onSource={changeSource} sourceKey={sourceKey} sources={sources} />
  : step === 1
    ? <TypeStep onVisualization={changeVisualization} visualization={visualization} visualizations={source?.visualizations ?? ['table']} />
    : step === 2
      ? <ConfigureStep dimension={dimension} dimensions={dimensions} filter={filter} limit={limit} mapViewId={mapViewId} mapViews={mapViews} measure={measure} measures={measures} onCreateMapView={() => setMapComposerOpen(true)} onDimension={value => invalidate(() => setDimension(value))} onFilter={value => invalidate(() => setFilter(value))} onLimit={value => invalidate(() => setLimit(value))} onMapView={value => invalidate(() => setMapViewId(value))} onMeasure={value => invalidate(() => setMeasure(value))} onSortDirection={value => invalidate(() => setSortDirection(value))} sortDirection={sortDirection} source={source} visualization={visualization} />
      : step === 3
        ? <StyleStep visualization={visualization} />
        : <div className="report-stage report-review"><div><h2>Review and run</h2><p>{source?.label ?? 'Authorized source'} · {fieldLabel(visualization)} · Up to {limit} rows</p></div></div>;

const hasPreview = visualization === 'map' ? Boolean(mapPreview) : Array.isArray(preview) ? preview.length > 0 : Boolean(preview);
```

Replace only the existing `report-editor` form body with:

```jsx
<form className="report-editor report-builder-workspace" onSubmit={event => event.preventDefault()}>
  <section className="report-builder-authoring" aria-label={`${STEPS[step]} report settings`}>
    {activeStep}
  </section>
  <section className="report-builder-preview" aria-label="Report preview workspace">
    <ReportIntelligenceBar />
    <div className="report-builder-preview__canvas">
      {hasPreview
        ? <ReportPreview api={api} EmbeddedMapComponent={EmbeddedMapComponent} mapPreview={mapPreview} preview={preview} visualization={visualization} />
        : <div className="report-builder-preview__empty"><strong>Report preview</strong><span>Run the report to generate its preview.</span></div>}
    </div>
  </section>
</form>
```

Keep the existing header, progress navigation, map-authoring branch, footer, `invalidate`, `definition`, and `save` functions unchanged.

- [ ] **Step 4: Run the focused builder and bar tests**

Run: `npm run test --workspace web -- ReportBuilder.test.jsx ReportIntelligenceBar.test.jsx`

Expected: PASS with all focused tests and 0 failures.

- [ ] **Step 5: Run the complete report-feature test set**

Run: `npm run test --workspace web -- src/features/reports`

Expected: PASS with 0 failures.

- [ ] **Step 6: Commit the split workspace**

```bash
git add web/src/features/reports/ReportBuilder.jsx web/src/features/reports/ReportBuilder.test.jsx
git commit -m "feat: keep report preview visible during authoring"
```

---

### Task 3: Catalyst UI Styling and Responsive Layout

**Files:**
- Modify: `web/src/styles/app.css`

- [ ] **Step 1: Capture the unstyled split workspace at desktop width**

Run: `npm run dev --workspace web -- --host 127.0.0.1`

Open `/reports/new?persona=STATE_LEADERSHIP` at approximately 1440×900 and capture the first viewport. Expected: the structural split exists but does not yet match Option A.

- [ ] **Step 2: Add scoped Catalyst workspace styles**

Append these report-builder-only rules next to the existing report editor rules in `app.css`:

```css
.report-builder-workspace{display:grid;grid-template-columns:minmax(300px,32%) minmax(0,1fr);min-height:0;overflow:hidden;background:#f4f7fb}
.report-builder-authoring{min-width:0;overflow:auto;border-right:1px solid #dce3eb;background:#fff}
.report-builder-authoring>.report-stage{width:auto;min-height:auto;margin:0;padding:24px}
.report-builder-preview{min-width:0;min-height:0;display:grid;grid-template-rows:auto minmax(0,1fr);gap:10px;padding:14px;background:#f4f7fb}
.report-intelligence{position:relative;z-index:1;display:grid;gap:7px}
.report-intelligence__bar{min-height:44px;display:flex;align-items:center;gap:9px;padding:6px 7px 6px 12px;border:1px solid #b9cadd;border-radius:7px;background:#fbfdff;box-shadow:0 1px 2px rgb(19 48 79 / 5%)}
.report-intelligence__bar>svg{flex:0 0 auto;color:#1769aa}
.report-intelligence__bar>input{min-width:0;flex:1;border:0;outline:0;background:transparent;color:#20344e;font:inherit;font-size:13px}
.report-intelligence__bar>button{min-height:32px;padding:0 13px;border:0;border-radius:5px}
.report-intelligence__bar>button:disabled{cursor:not-allowed;opacity:.5}
.report-intelligence__status{margin:0;padding:8px 11px;border:1px solid #cfe0ef;border-radius:6px;background:#f5faff;color:#52677f;font-size:11px}
.report-builder-preview__canvas{min-width:0;min-height:0;overflow:auto;border:1px solid #d9e2ec;border-radius:7px;background:#fff;box-shadow:0 1px 3px rgb(19 48 79 / 5%)}
.report-builder-preview__canvas>.report-preview-canvas{min-height:100%;border:0;border-radius:0;box-shadow:none}
.report-builder-preview__empty{min-height:100%;display:grid;place-content:center;gap:6px;padding:32px;color:#73849a;text-align:center}
.report-builder-preview__empty strong{color:#304a68;font-size:15px;font-weight:650}
.report-builder-preview__empty span{font-size:12px}
@media(max-width:900px){.report-builder-workspace{grid-template-columns:minmax(270px,38%) minmax(0,1fr)}.report-builder-preview{padding:10px}}
@media(max-width:720px){.report-builder-workspace{display:block;overflow:auto}.report-builder-authoring{border-right:0;border-bottom:1px solid #dce3eb}.report-builder-preview{min-height:430px}.report-intelligence__bar{align-items:stretch;flex-wrap:wrap}.report-intelligence__bar>input{min-width:180px}.report-intelligence__bar>button{margin-left:auto}}
```

- [ ] **Step 3: Compare desktop implementation against Option A**

Capture the same 1440×900 viewport and inspect it beside `.superpowers/brainstorm/report-wizard-modernization/content/layout-options.html` from the earlier design worktree. Verify the 32/68 split, slim single-row bar, preview dominance, compact borders, header/progress continuity, and unchanged copy.

- [ ] **Step 4: Verify narrow laptop and mobile behavior**

At approximately 1024×768, verify both columns remain usable and the preview is still dominant. At approximately 390×844, verify authoring stacks above the bar and preview with no horizontal overflow, clipped buttons, or inaccessible footer actions.

- [ ] **Step 5: Commit the scoped styling**

```bash
git add web/src/styles/app.css
git commit -m "style: modernize the report builder workspace"
```

---

### Task 4: Regression and Visual Verification

**Files:**
- Test only; no planned production-file changes.

- [ ] **Step 1: Run the complete web test suite**

Run: `npm run test --workspace web`

Expected: PASS with 0 failures. If an unrelated baseline failure appears, record its exact test name and confirm the focused report tests still pass before making any unrelated change.

- [ ] **Step 2: Run the production web build**

Run: `npm run build --workspace web`

Expected: PASS and produce the Vite `dist` output with no compile errors.

- [ ] **Step 3: Exercise the core browser workflow**

Using the local app only:

1. Open a new report and confirm the preview is visible on Data.
2. Enter a name, move through Type, Configure, Style, and Review.
3. Enter an Intelligence prompt and confirm the deferred message appears without a network request or draft change.
4. Save and Run using the existing API behavior.
5. Open an existing report route and confirm loading alone does not issue PATCH or POST.
6. Exercise the map composer route and confirm it returns to the split builder.

- [ ] **Step 4: Produce the fidelity ledger**

Record at least these comparison points in the final handoff: workspace split, intelligence-bar height and placement, preview size, Catalyst palette/borders, unchanged header and step copy, desktop/narrow/mobile behavior, and the deferred Ask interaction. Fix any visual mismatch that would receive a design-review comment.

- [ ] **Step 5: Confirm the branch contains no backend or generated Function changes**

Run: `git diff --name-only origin/main...HEAD`

Expected files only under:

```text
docs/superpowers/
web/src/features/reports/
web/src/styles/app.css
```

- [ ] **Step 6: Commit any verification-only corrections**

If corrections were required:

```bash
git add web/src/features/reports web/src/styles/app.css
git commit -m "fix: finish slim report builder verification"
```

If no corrections were required, do not create an empty commit.

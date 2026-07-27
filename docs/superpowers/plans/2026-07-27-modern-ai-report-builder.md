# Modern AI-Assisted Report Builder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the report wizard with a Catalyst-styled split editor that safely opens dashboard reports, previews unsaved drafts, and applies validated GLM-4.7-Flash report proposals without changing existing reports implicitly.

**Architecture:** Keep `normalizeReportDefinition` as the single reporting trust boundary. Add non-persisting draft execution and AI-proposal resource endpoints to the existing workspace service; place QuickML behind an injected server adapter whose deployment endpoint and credentials are runtime configuration. On the client, isolate definition conversion/compatibility logic from a composed editor shell, reuse `ReportPreview`, and keep persistence behind explicit Save/Run actions.

**Tech Stack:** Node.js 24 ESM, Zoho Catalyst Advanced I/O function, Catalyst QuickML GLM-4.7-Flash, React 19, React Router 7, Vitest/Testing Library, Node test runner, existing CSS and report renderers.

---

## File Map

### Create

- `src/backend/reporting/report-proposal-service.mjs` — authorized source projection, prompt assembly, QuickML output parsing, one repair attempt, and final normalization.
- `src/backend/reporting/quickml-client.mjs` — bounded server-side HTTP adapter for the configured GLM-4.7-Flash endpoint.
- `tests/reporting/report-proposal-service.test.mjs` — proposal validation, hallucination rejection, repair, and outage tests.
- `tests/reporting/quickml-client.test.mjs` — HTTP payload, timeout, authentication, and response-envelope tests.
- `web/src/features/reports/report-draft.js` — persisted-definition conversion, draft serialization, dirty comparison, and legacy compatibility classification.
- `web/src/features/reports/report-draft.test.js` — pure draft/compatibility tests.
- `web/src/features/reports/ReportAuthoringRail.jsx` — manual authoring sections in the persistent left rail.
- `web/src/features/reports/ReportAiAssistant.jsx` — question, proposal review, Apply, and error states.
- `web/src/features/reports/ReportCompatibilityNotice.jsx` — non-destructive legacy report output and Create editable copy action.

### Modify

- `src/backend/reporting/report-service.mjs` — add normalized, non-persisting draft execution.
- `src/backend/reporting/workspace-services.mjs` — expose draft execution and proposal resources.
- `src/backend/http/api-contract.mjs` — declare draft-preview and AI-proposal routes.
- `src/backend/catalyst/api-bootstrap.mjs` — construct and inject the QuickML adapter from runtime configuration.
- `config/catalyst-development.json` — declare non-secret QuickML model and endpoint configuration keys.
- `.env.example` — document local QuickML configuration names without credentials.
- `tests/reporting/report-service.test.mjs` — prove draft execution performs no repository write.
- `tests/reporting/workspace-services.test.mjs` — prove resource envelopes and identity-derived schemas.
- `tests/catalyst/api-bootstrap.test.mjs` — prove both routes are declared and composed.
- `web/src/features/reports/ReportBuilder.jsx` — compose the split workspace and coordinate draft state.
- `web/src/features/reports/ReportBuilderFields.jsx` — retain reusable governed controls and remove wizard-only wrappers.
- `web/src/features/reports/ReportBuilder.test.jsx` — test loading, preview, save/run, legacy copy, and AI proposal behavior.
- `web/src/features/dashboards/DashboardWorkspace.jsx` — label the report route as Open report.
- `web/src/features/dashboards/DashboardWorkspace.test.jsx` — assert report edit-mode routing.
- `web/src/features/command-center/CommandCenterReportSurface.test.jsx` — retain Open/Edit route assertions.
- `web/src/styles/app.css` — Catalyst split-workspace, rail, preview, assistant, compatibility, and responsive styles.

### Generated Mirror

After source tests pass, run `npm run catalyst:build` to copy backend source changes into `functions/crime_intelligence_api/app/src/backend/**` and refresh the bundle manifest. Do not hand-edit generated mirror files.

---

### Task 1: Pure Draft and Compatibility Model

**Files:**
- Create: `web/src/features/reports/report-draft.js`
- Create: `web/src/features/reports/report-draft.test.js`

- [ ] **Step 1: Write failing conversion and compatibility tests**

```js
import { describe, expect, test } from 'vitest';
import { classifyReportDefinition, draftFromDefinition, definitionFromDraft, sameDefinition } from './report-draft.js';

const source = {
  key: 'anomalies', visualizations: ['table', 'bar', 'line'],
  fields: { unitId: { type: 'string', dimension: true }, observed: { type: 'number', aggregates: ['sum'] } },
};

test('round-trips a compatible persisted definition without semantic loss', () => {
  const definition = {
    name: 'Anomaly watch', description: 'Current posture', sourceKey: 'anomalies',
    dimensions: ['unitId'], measures: [{ field: 'observed', aggregate: 'sum' }],
    filters: [], sort: [{ field: 'observed_sum', direction: 'desc' }],
    visualization: { type: 'bar' }, limit: 100,
  };
  expect(classifyReportDefinition(definition, [source])).toEqual({ editable: true, reason: '' });
  expect(definitionFromDraft(draftFromDefinition(definition))).toEqual(definition);
  expect(sameDefinition(definition, definitionFromDraft(draftFromDefinition(definition)))).toBe(true);
});

test('classifies unknown sources and legacy visualizations without rewriting them', () => {
  expect(classifyReportDefinition({ sourceKey: 'legacy', visualization: { type: 'area' } }, [source]))
    .toEqual({ editable: false, reason: 'This report uses a source that the modern builder cannot reproduce.' });
  expect(classifyReportDefinition({ sourceKey: 'anomalies', visualization: { type: 'area' } }, [source]))
    .toEqual({ editable: false, reason: 'This report uses a visualization that the modern builder cannot reproduce.' });
});
```

- [ ] **Step 2: Run the focused test and confirm the missing-module failure**

Run: `npm run test --workspace web -- report-draft.test.js`

Expected: FAIL because `report-draft.js` does not exist.

- [ ] **Step 3: Implement deterministic conversion and classification**

```js
const clone = value => structuredClone(value);
const canonical = value => JSON.stringify(value);

export function draftFromDefinition(definition = {}) {
  return clone({
    name: definition.name ?? '', description: definition.description ?? '',
    sourceKey: definition.sourceKey ?? '', dimensions: definition.dimensions ?? [],
    measures: definition.measures ?? [], filters: definition.filters ?? [], sort: definition.sort ?? [],
    visualization: definition.visualization ?? { type: 'table' }, limit: definition.limit ?? 100,
  });
}

export function definitionFromDraft(draft) {
  return clone({
    name: draft.name.trim(), description: draft.description.trim(), sourceKey: draft.sourceKey,
    dimensions: draft.dimensions, measures: draft.measures, filters: draft.filters, sort: draft.sort,
    visualization: draft.visualization, limit: draft.limit,
  });
}

export const sameDefinition = (left, right) => canonical(left) === canonical(right);

export function classifyReportDefinition(definition, sources) {
  const source = sources.find(item => item.key === definition?.sourceKey);
  if (!source) return { editable: false, reason: 'This report uses a source that the modern builder cannot reproduce.' };
  if (!source.visualizations.includes(definition?.visualization?.type)) {
    return { editable: false, reason: 'This report uses a visualization that the modern builder cannot reproduce.' };
  }
  const fields = source.fields ?? {};
  const invalidDimension = (definition.dimensions ?? []).some(field => !fields[field]?.dimension);
  const invalidMeasure = (definition.measures ?? []).some(item => !fields[item.field]?.aggregates?.includes(item.aggregate));
  const invalidFilter = (definition.filters ?? []).some(item => !fields[item.field]);
  if (invalidDimension || invalidMeasure || invalidFilter) {
    return { editable: false, reason: 'This report contains fields that the modern builder cannot reproduce.' };
  }
  return { editable: true, reason: '' };
}
```

- [ ] **Step 4: Run the focused test and verify it passes**

Run: `npm run test --workspace web -- report-draft.test.js`

Expected: PASS.

- [ ] **Step 5: Commit the pure model**

```bash
git add web/src/features/reports/report-draft.js web/src/features/reports/report-draft.test.js
git commit -m "feat: model editable report drafts safely"
```

### Task 2: Non-Persisting Draft Execution

**Files:**
- Modify: `src/backend/reporting/report-service.mjs`
- Modify: `src/backend/reporting/workspace-services.mjs`
- Modify: `src/backend/http/api-contract.mjs`
- Modify: `tests/reporting/report-service.test.mjs`
- Modify: `tests/reporting/workspace-services.test.mjs`
- Modify: `tests/catalyst/api-bootstrap.test.mjs`

- [ ] **Step 1: Add a failing service test proving preview does not write**

```js
test('executes a validated draft without creating or updating a report', async () => {
  const repository = memoryRepository();
  const createReport = mock.method(repository, 'createReport');
  const updateReport = mock.method(repository, 'updateReport');
  const reports = createReportService({
    repository, readServices: { listAnomalies: async () => ({ data: { items: [{ observed: 7, unitId: '101' }] } }) },
    now: () => '2026-07-27T00:00:00.000Z', idFactory: () => 'REPORT-X',
  });
  const result = await reports.executeDraft({
    access: ownerAccess,
    input: { name: 'Draft', sourceKey: 'anomalies', dimensions: ['unitId'], measures: [{ field: 'observed', aggregate: 'sum' }], visualization: { type: 'bar' }, limit: 100 },
    requestId: 'REQ-1',
  });
  assert.deepEqual(result.result.data.items, [{ unitId: '101', observed_sum: 7 }]);
  assert.equal(createReport.mock.callCount(), 0);
  assert.equal(updateReport.mock.callCount(), 0);
});
```

- [ ] **Step 2: Run the focused backend test and confirm `executeDraft` is missing**

Run: `node --test tests/reporting/report-service.test.mjs`

Expected: FAIL with `reports.executeDraft is not a function`.

- [ ] **Step 3: Extract shared definition execution and add `executeDraft`**

Add an internal `executeDefinition({ access, definition, requestId })` in `report-service.mjs` that contains the current map/non-map execution branches. Make persisted `execute()` call it after `requireVisible()`, and add:

```js
async executeDraft({ access, input, requestId }) {
  const definition = normalizedReport(input);
  await authorizeMapReference(definition, access, requestId);
  return { definition: { id: null, name: definition.name, version: null, definition },
    result: await executeDefinition({ access, definition, requestId }) };
}
```

Return the same `result.data` and `result.meta` shape used by persisted execution.

- [ ] **Step 4: Declare and expose the draft endpoint**

Add to `api-contract.mjs`:

```js
Object.freeze({ method: 'POST', path: '/v1/reports/preview', kind: 'resource', service: 'previewReport', auditEventType: 'SENSITIVE_READ' }),
```

Add to `workspace-services.mjs`:

```js
async previewReport({ access, body, requestId }) {
  return envelope(await reports.executeDraft({ access, input: body?.definition, requestId }));
},
```

- [ ] **Step 5: Add route/envelope tests and run the reporting suite**

Test that `POST /v1/reports/preview` is declared, returns the normal execution envelope, and leaves repository report counts unchanged.

Run: `node --test tests/reporting/report-service.test.mjs tests/reporting/workspace-services.test.mjs tests/catalyst/api-bootstrap.test.mjs`

Expected: PASS.

- [ ] **Step 6: Commit draft execution**

```bash
git add src/backend/reporting/report-service.mjs src/backend/reporting/workspace-services.mjs src/backend/http/api-contract.mjs tests/reporting/report-service.test.mjs tests/reporting/workspace-services.test.mjs tests/catalyst/api-bootstrap.test.mjs
git commit -m "feat: preview report drafts without persistence"
```

### Task 3: QuickML GLM Client

**Files:**
- Create: `src/backend/reporting/quickml-client.mjs`
- Create: `tests/reporting/quickml-client.test.mjs`
- Modify: `.env.example`
- Modify: `config/catalyst-development.json`

- [ ] **Step 1: Write failing tests for the injected HTTP boundary**

```js
test('requests strict JSON from the configured GLM model', async () => {
  const calls = [];
  const client = createQuickMlClient({
    endpoint: 'https://quickml.example.invalid/chat', model: 'GLM-4.7-Flash', token: 'secret',
    fetchImpl: async (url, init) => { calls.push({ url, init }); return new Response(JSON.stringify({ output: { content: '{"sourceKey":"anomalies"}' } }), { status: 200 }); },
  });
  assert.equal(await client.generate({ system: 'policy', user: 'question' }), '{"sourceKey":"anomalies"}');
  assert.equal(calls[0].url, 'https://quickml.example.invalid/chat');
  assert.equal(calls[0].init.headers.Authorization, 'Bearer secret');
  assert.equal(JSON.parse(calls[0].init.body).model, 'GLM-4.7-Flash');
});

test('maps timeout and invalid envelopes to typed unavailable errors', async () => {
  const client = createQuickMlClient({ endpoint: 'https://quickml.example.invalid/chat', model: 'GLM-4.7-Flash', token: 'secret', fetchImpl: async () => { throw new DOMException('Timed out', 'AbortError'); } });
  await assert.rejects(client.generate({ system: 'policy', user: 'question' }), error => error.code === 'AI_SERVICE_UNAVAILABLE');
});
```

- [ ] **Step 2: Run the test and confirm the module is missing**

Run: `node --test tests/reporting/quickml-client.test.mjs`

Expected: FAIL because `quickml-client.mjs` does not exist.

- [ ] **Step 3: Implement the bounded adapter**

```js
const typed = (code) => Object.assign(new Error(code), { code });

export function createQuickMlClient({ endpoint, model = 'GLM-4.7-Flash', token, fetchImpl = fetch, timeoutMs = 12_000 }) {
  if (!endpoint || !token) return Object.freeze({ async generate() { throw typed('AI_SERVICE_UNAVAILABLE'); } });
  return Object.freeze({
    async generate({ system, user }) {
      try {
        const response = await fetchImpl(endpoint, {
          method: 'POST', signal: AbortSignal.timeout(timeoutMs),
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ model, response_format: { type: 'json_object' }, temperature: 0,
            messages: [{ role: 'system', content: system }, { role: 'user', content: user }] }),
        });
        if (!response.ok) throw typed('AI_SERVICE_UNAVAILABLE');
        const payload = await response.json();
        const content = payload?.output?.content ?? payload?.choices?.[0]?.message?.content;
        if (typeof content !== 'string' || !content.trim()) throw typed('AI_INVALID_RESPONSE');
        return content;
      } catch (error) {
        if (error?.code) throw error;
        throw typed('AI_SERVICE_UNAVAILABLE');
      }
    },
  });
}
```

The two accepted response paths intentionally isolate the only deployment-specific envelope variation. When the hackathon QuickML endpoint exposes its confirmed payload, update this adapter and its test only.

- [ ] **Step 4: Document runtime keys without committing credentials**

Add non-secret keys `quickMlModel` and `quickMlEndpoint` to `config/catalyst-development.json`. Add these names to `.env.example`:

```dotenv
CATALYST_QUICKML_ENDPOINT=
CATALYST_QUICKML_TOKEN=
CATALYST_QUICKML_MODEL=GLM-4.7-Flash
```

- [ ] **Step 5: Run tests and scan for accidental secrets**

Run: `node --test tests/reporting/quickml-client.test.mjs`

Run: `rg -n "Bearer [A-Za-z0-9_-]{16,}|CATALYST_QUICKML_TOKEN=.+" --glob '!node_modules/**'`

Expected: test PASS; secret scan returns no matches.

- [ ] **Step 6: Commit the adapter**

```bash
git add src/backend/reporting/quickml-client.mjs tests/reporting/quickml-client.test.mjs .env.example config/catalyst-development.json
git commit -m "feat: add Catalyst QuickML report adapter"
```

### Task 4: Governed GLM Proposal Service and API

**Files:**
- Create: `src/backend/reporting/report-proposal-service.mjs`
- Create: `tests/reporting/report-proposal-service.test.mjs`
- Modify: `src/backend/reporting/workspace-services.mjs`
- Modify: `src/backend/http/api-contract.mjs`
- Modify: `src/backend/http/dispatch.mjs`
- Modify: `src/backend/catalyst/api-bootstrap.mjs`
- Modify: `tests/reporting/workspace-services.test.mjs`
- Modify: `tests/catalyst/api-bootstrap.test.mjs`

- [ ] **Step 1: Write failing proposal tests**

Cover: valid proposal, unknown source, invented field, unsupported visualization, malformed JSON, one repair success, two invalid responses ending in `AI_INVALID_RESPONSE`, and no raw row data in the model prompt.

```js
test('normalizes a GLM proposal against an authorized source', async () => {
  const generated = [];
  const service = createReportProposalService({
    model: { async generate(input) { generated.push(input); return JSON.stringify({
      definition: { name: 'Anomaly watch', sourceKey: 'anomalies', dimensions: ['unitId'], measures: [{ field: 'observed', aggregate: 'sum' }], filters: [], sort: [], visualization: { type: 'bar' }, limit: 100 },
      explanation: 'Groups observed anomalies by unit.',
    }); } },
    sourceProvider: () => [getReportSource('anomalies')],
  });
  const result = await service.propose({ access: analystAccess, question: 'Show observed anomalies by unit', currentDefinition: null });
  assert.equal(result.definition.sourceKey, 'anomalies');
  assert.equal(result.explanation, 'Groups observed anomalies by unit.');
  assert.equal(generated[0].user.includes('observed anomalies by unit'), true);
  assert.equal(generated[0].user.includes('evidenceCaseIds'), false);
});
```

- [ ] **Step 2: Run the test and confirm the service is missing**

Run: `node --test tests/reporting/report-proposal-service.test.mjs`

Expected: FAIL because the proposal service does not exist.

- [ ] **Step 3: Implement strict prompt projection and one repair attempt**

The service must:

1. Validate `question` as a trimmed string from 3 to 1,000 characters.
2. Obtain sources from the server-owned `sourceProvider(access)`.
3. Project only `key`, `label`, `fields`, and `visualizations` into the prompt.
4. Parse `{ definition, explanation }` from the model JSON.
5. Reject extra top-level keys.
6. Call `normalizeReportDefinition(definition, authorizedSource)`.
7. On one parse/normalization failure, call GLM once more with the safe validation message.
8. Return `{ definition, explanation, changes }` or throw `AI_INVALID_RESPONSE`.

Use `structuredClone` for returned definitions and never include source rows in either prompt.

- [ ] **Step 4: Add the resource route and public typed errors**

Add:

```js
Object.freeze({ method: 'POST', path: '/v1/report-proposals', kind: 'resource', service: 'proposeReport', auditEventType: 'AI_ASSISTED_CONFIGURATION' }),
```

Expose `AI_SERVICE_UNAVAILABLE` as HTTP 503 and `AI_INVALID_RESPONSE` as HTTP 422 in `dispatch.mjs`. Add `proposeReport` in workspace services:

```js
async proposeReport({ access, body }) {
  return envelope(await reportProposalService.propose({
    access, question: body?.question, currentDefinition: body?.currentDefinition ?? null,
  }));
},
```

- [ ] **Step 5: Compose the adapter in Catalyst bootstrap**

Extend `createApiApplication` with an injectable `quickMlClientFactory = createQuickMlClient`. Build the client from `config.quickMlEndpoint`, `config.quickMlModel`, and a server-only token resolver; inject `createReportProposalService(...)` into `createWorkspaceServices`. Tests must inject a fake client and must not require network access.

- [ ] **Step 6: Run service, workspace, dispatcher, and bootstrap tests**

Run: `node --test tests/reporting/report-proposal-service.test.mjs tests/reporting/workspace-services.test.mjs tests/catalyst/api-bootstrap.test.mjs tests/backend/security.test.mjs`

Expected: PASS.

- [ ] **Step 7: Commit the governed proposal endpoint**

```bash
git add src/backend/reporting/report-proposal-service.mjs tests/reporting/report-proposal-service.test.mjs src/backend/reporting/workspace-services.mjs src/backend/http/api-contract.mjs src/backend/http/dispatch.mjs src/backend/catalyst/api-bootstrap.mjs tests/reporting/workspace-services.test.mjs tests/catalyst/api-bootstrap.test.mjs tests/backend/security.test.mjs
git commit -m "feat: validate GLM report proposals"
```

### Task 5: Split Report Builder Workspace

**Files:**
- Create: `web/src/features/reports/ReportAuthoringRail.jsx`
- Create: `web/src/features/reports/ReportCompatibilityNotice.jsx`
- Modify: `web/src/features/reports/ReportBuilder.jsx`
- Modify: `web/src/features/reports/ReportBuilderFields.jsx`
- Modify: `web/src/features/reports/ReportBuilder.test.jsx`

- [ ] **Step 1: Replace wizard expectations with failing workspace tests**

Add tests that prove:

- an existing compatible report loads into labelled controls and executes once to populate the preview without any PATCH;
- changing a field displays `Unsaved changes` and `Preview out of date`;
- Refresh preview calls `POST /v1/reports/preview` with `{ definition }` and does not call PATCH/POST `/v1/reports`;
- Save PATCHes with the loaded version and does not execute;
- Run PATCHes then executes the persisted report;
- a legacy report displays its existing output, disables direct Save, and exposes Create editable copy;
- creating the copy POSTs `/v1/reports` and never PATCHes the original ID.

```jsx
expect(await screen.findByRole('region', { name: 'Report preview' })).toBeInTheDocument();
expect(screen.getByRole('complementary', { name: 'Report configuration' })).toBeInTheDocument();
expect(api.patch).not.toHaveBeenCalled();
fireEvent.change(screen.getByLabelText('Group by'), { target: { value: 'unitId' } });
expect(screen.getByText('Unsaved changes')).toBeInTheDocument();
expect(screen.getByText('Preview out of date')).toBeInTheDocument();
```

- [ ] **Step 2: Run the builder test and confirm the new workspace expectations fail**

Run: `npm run test --workspace web -- ReportBuilder.test.jsx`

Expected: FAIL because the wizard does not expose persistent rail/preview regions.

- [ ] **Step 3: Implement the rail and composed editor shell**

`ReportAuthoringRail` receives `draft`, `sources`, `onChange`, and map-authoring callbacks. It renders native labelled controls using the existing field metadata and visualization choices. `ReportBuilder` owns:

```js
const [draft, setDraft] = useState(null);
const [baseline, setBaseline] = useState(null);
const [result, setResult] = useState(null);
const [previewState, setPreviewState] = useState('empty');
const dirty = draft && baseline ? !sameDefinition(definitionFromDraft(draft), baseline) : Boolean(draft);
const updateDraft = updater => {
  setDraft(previous => typeof updater === 'function' ? updater(previous) : updater);
  setPreviewState(result ? 'stale' : 'empty');
};
```

Render one `aside[aria-label="Report configuration"]` and one `section[aria-label="Report preview"]` simultaneously. Remove step state, progress navigation, and wizard footer. Keep map authoring as a temporary full-workspace mode.

- [ ] **Step 4: Implement safe existing-report and copy behavior**

After sources and report load, call `classifyReportDefinition`. Compatible reports populate draft and baseline. Execute the existing report for initial output but do not save. Legacy reports retain their original definition separately, render any successful existing execution, and show `ReportCompatibilityNotice`. Its Create editable copy action builds a new draft only from source/field/visualization values proven compatible; when no safe subset exists, start a named table draft on the first authorized source. The original report ID is never passed to PATCH in this branch.

- [ ] **Step 5: Implement Refresh, Save, and Run semantics**

Refresh calls `/v1/reports/preview`. Save creates or version-patches and then updates `baseline` and `version`. Run calls Save first, then `/v1/reports/:id/execute`. Preserve the request-generation guard so stale async results cannot replace newer edits.

- [ ] **Step 6: Run builder and preview tests**

Run: `npm run test --workspace web -- ReportBuilder.test.jsx ReportPreview.test.jsx report-draft.test.js`

Expected: PASS.

- [ ] **Step 7: Commit the functional workspace**

```bash
git add web/src/features/reports/ReportBuilder.jsx web/src/features/reports/ReportBuilderFields.jsx web/src/features/reports/ReportAuthoringRail.jsx web/src/features/reports/ReportCompatibilityNotice.jsx web/src/features/reports/ReportBuilder.test.jsx
git commit -m "feat: replace report wizard with split editor"
```

### Task 6: GLM Proposal Review UI

**Files:**
- Create: `web/src/features/reports/ReportAiAssistant.jsx`
- Modify: `web/src/features/reports/ReportBuilder.jsx`
- Modify: `web/src/features/reports/ReportBuilder.test.jsx`

- [ ] **Step 1: Add failing GLM interaction tests**

```jsx
fireEvent.change(screen.getByLabelText('Ask GLM about this report'), { target: { value: 'Show FIR count by incident hour as a line chart' } });
fireEvent.click(screen.getByRole('button', { name: 'Generate proposal' }));
await waitFor(() => expect(api.post).toHaveBeenCalledWith('/v1/report-proposals', expect.objectContaining({
  question: 'Show FIR count by incident hour as a line chart',
})));
expect(await screen.findByText('GLM proposes 4 changes')).toBeInTheDocument();
expect(screen.getByLabelText('Visualization')).not.toHaveValue('line');
fireEvent.click(screen.getByRole('button', { name: 'Apply proposal' }));
expect(screen.getByLabelText('Visualization')).toHaveValue('line');
expect(api.patch).not.toHaveBeenCalled();
```

Also test 422 invalid proposal, 503 unavailable service, double-click prevention while busy, and manual controls remaining enabled after failure.

- [ ] **Step 2: Run the builder test and confirm the assistant is absent**

Run: `npm run test --workspace web -- ReportBuilder.test.jsx`

Expected: FAIL because Ask GLM controls do not exist.

- [ ] **Step 3: Implement proposal request and review**

`ReportAiAssistant` owns only question/busy/error/proposal presentation. The parent passes `currentDefinition` and handles `onApply`. Render the server explanation and a deterministic change summary. Apply calls `updateDraft(draftFromDefinition(proposal.definition))`; it never calls Save, Run, PATCH, or POST `/v1/reports`.

- [ ] **Step 4: Run focused frontend tests**

Run: `npm run test --workspace web -- ReportBuilder.test.jsx`

Expected: PASS.

- [ ] **Step 5: Commit GLM authoring UI**

```bash
git add web/src/features/reports/ReportAiAssistant.jsx web/src/features/reports/ReportBuilder.jsx web/src/features/reports/ReportBuilder.test.jsx
git commit -m "feat: review GLM report proposals"
```

### Task 7: Dashboard Entry Points and Catalyst Styling

**Files:**
- Modify: `web/src/features/dashboards/DashboardWorkspace.jsx`
- Modify: `web/src/features/dashboards/DashboardWorkspace.test.jsx`
- Modify: `web/src/features/command-center/CommandCenterReportSurface.test.jsx`
- Modify: `web/src/styles/app.css`

- [ ] **Step 1: Add failing route-label and layout-contract tests**

Change the generic dashboard assertion from Open evidence to Open report and retain command-center assertions for both Open report and Edit report. Add a CSS contract test or static assertions for:

```js
expect(appCss).toMatch(/\.report-workspace\s*\{[^}]*grid-template-columns:\s*clamp\(280px,/s);
expect(appCss).toMatch(/@media\s*\(max-width:\s*720px\)[\s\S]*\.report-workspace\s*\{[^}]*grid-template-columns:\s*1fr/s);
```

- [ ] **Step 2: Run dashboard and builder tests and confirm the label/style failures**

Run: `npm run test --workspace web -- DashboardWorkspace.test.jsx CommandCenterReportSurface.test.jsx ReportBuilder.test.jsx`

Expected: FAIL on the old Open evidence label and missing split-workspace CSS.

- [ ] **Step 3: Update all report entry labels without changing route semantics**

In `DashboardWorkspace.jsx`, rename Open evidence to Open report while retaining `governedAppLocation('/reports/:reportId', location)`. Do not introduce a separate read-only route. Command-center Open report and Edit report links continue targeting the same builder route and preserve persona/returnTo query parameters.

- [ ] **Step 4: Implement modern Catalyst workspace CSS**

Replace wizard-only progress/footer styles with:

```css
.report-builder-app { min-height: calc(100vh - 132px); background: #f6f8fb; border: 1px solid #d8e1ec; border-radius: 8px; overflow: hidden; }
.report-workspace { min-height: 0; display: grid; grid-template-columns: clamp(280px, 24vw, 360px) minmax(0, 1fr); }
.report-authoring-rail { min-width: 0; padding: 18px; overflow-y: auto; background: #fff; border-right: 1px solid #dbe3ed; }
.report-preview-canvas { min-width: 0; padding: 22px; overflow: auto; background: #f6f8fb; }
.report-ai-assistant { border-top: 3px solid #2f7de1; background: #f8fbff; }
.report-dirty { color: #a45112; }
@media (max-width: 980px) { .report-workspace { grid-template-columns: minmax(260px, 310px) minmax(0, 1fr); } }
@media (max-width: 720px) { .report-workspace { grid-template-columns: 1fr; }.report-authoring-rail { max-height: none; border-right: 0; border-bottom: 1px solid #dbe3ed; }.report-preview-canvas { min-height: 440px; } }
```

Preserve the existing KSP shell and Roboto typography. Use Catalyst blue/navy with orange only for warning/dirty accents; do not imitate Catalyst’s product navigation or copy its logo.

Keep every rail control associated with a visible label, use native buttons/inputs/selects, preserve keyboard focus rings, announce proposal/preview/save status through `role="status"`, and pair dirty/stale colors with explicit text. Add Testing Library assertions for the configuration landmark, preview landmark, GLM status, and keyboard-operable Apply/Refresh actions.

- [ ] **Step 5: Run the focused web tests**

Run: `npm run test --workspace web -- DashboardWorkspace.test.jsx CommandCenterReportSurface.test.jsx ReportBuilder.test.jsx`

Expected: PASS.

- [ ] **Step 6: Commit entry points and styling**

```bash
git add web/src/features/dashboards/DashboardWorkspace.jsx web/src/features/dashboards/DashboardWorkspace.test.jsx web/src/features/command-center/CommandCenterReportSurface.test.jsx web/src/styles/app.css
git commit -m "feat: modernize report builder workspace"
```

### Task 8: Build Mirrors, Full Verification, and Browser QA

**Files:**
- Generated: `functions/crime_intelligence_api/app/src/backend/**`
- Generated: `functions/crime_intelligence_api/app/bundle-manifest.json`
- Verify: all files changed by Tasks 1–7

- [ ] **Step 1: Run the complete backend and frontend suites**

Run: `npm test`

Expected: all Node tests PASS.

Run: `npm run web:test`

Expected: all Vitest tests PASS.

- [ ] **Step 2: Build the Catalyst function mirror**

Run: `npm run catalyst:build`

Expected: backend source is copied into the function app and the bundle manifest is refreshed without errors.

- [ ] **Step 3: Build and inspect production artifacts**

Run: `npm run web:build && npm run catalyst:inspect`

Expected: both commands PASS; no missing imports, bundle boundary violations, or untracked runtime dependencies.

- [ ] **Step 4: Run schema and compatibility checks**

Run: `npm run schema:validate && npm run intelligence-schema:validate && npm run compat:node18`

Expected: PASS.

- [ ] **Step 5: Start the app and verify the visible workflow**

Run: `npm run web:dev -- --host 127.0.0.1`

Using the in-app browser, verify at desktop, approximately 1366×768, and mobile approximately 390×844:

1. Open a dashboard report and confirm the correct `/reports/:reportId` editor loads.
2. Confirm existing compatible output appears without a save request.
3. Change a manual field and confirm dirty/stale states.
4. Refresh preview and confirm no report is created or patched.
5. Ask GLM, review the change summary, Apply, and confirm no persistence.
6. Save and confirm the dirty state clears.
7. Run and confirm the builder renderer matches the dashboard renderer.
8. Open a legacy fixture and confirm Create editable copy leaves the original untouched.
9. Disable QuickML configuration and confirm manual authoring remains usable.

- [ ] **Step 6: Compare implementation to the approved visual direction**

Capture desktop and mobile screenshots. Inspect them alongside the selected split-workspace concept for: persistent rail, preview dominance, Catalyst palette, compact header, copy accuracy, control typography, borders/radii, stale/dirty visibility, responsive stacking, and icon alignment. Fix every material mismatch before continuing.

- [ ] **Step 7: Run final diff and secret checks**

Run: `git diff --check`

Run: `rg -n "Bearer [A-Za-z0-9_-]{16,}|CATALYST_QUICKML_TOKEN=.+" --glob '!node_modules/**'`

Expected: no whitespace errors and no committed token value.

- [ ] **Step 8: Commit generated mirrors and verification fixes**

```bash
git add functions/crime_intelligence_api/app/src/backend functions/crime_intelligence_api/app/bundle-manifest.json
git add web/src src/backend tests config/catalyst-development.json .env.example
git commit -m "build: package modern report builder"
```

## Completion Criteria

- Opening or editing a dashboard report reaches the same preloaded builder route.
- Merely opening a report causes no create, update, or migration write.
- Compatible definitions round-trip without semantic loss.
- Legacy reports cannot overwrite their originals; editable copies use new IDs.
- Draft preview executes governed data without persistence.
- GLM-4.7-Flash proposals are server-side, schema-constrained, authorization-validated, reviewable, and never auto-saved.
- QuickML failure leaves manual authoring fully functional.
- The preview uses the existing report renderers and dominates the workspace visually.
- Desktop, smaller-laptop, and mobile layouts meet the approved Catalyst-styled split direction.
- Full tests, production build, Catalyst packaging, bundle inspection, and secret scan pass.

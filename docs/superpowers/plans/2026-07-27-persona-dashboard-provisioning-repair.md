# Persona Dashboard Provisioning Repair Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provision distinct governed District and Crime Analyst dashboards and make every Police Station dashboard report executable.

**Architecture:** Keep the existing client-side idempotent template provisioner, but make its two leadership/analyst templates conform to the backend semantic registry. Compose the existing authorized alert service into report execution before the report service is created, and expose bounded setup warnings without blocking unrelated modules.

**Tech Stack:** React 19, Vitest, Node.js services, Catalyst Advanced I/O Function, Catalyst Slate.

---

### Task 1: Validate every persona template against the real report contract

**Files:**
- Modify: `web/src/features/dashboards/templates/persona-dashboard-templates.test.js`
- Modify: `web/src/features/dashboards/templates/district-dashboard-template.js`
- Modify: `web/src/features/dashboards/templates/analyst-dashboard-template.js`

- [ ] **Step 1: Write the failing contract test**

Import `REPORT_SOURCES` and `normalizeReportDefinition` from the backend and assert that every template report normalizes against `REPORT_SOURCES[definition.sourceKey]`. Assert unique dashboard names and six reports for District and Analyst.

- [ ] **Step 2: Verify RED**

Run: `npm.cmd run test --workspace web -- src/features/dashboards/templates/persona-dashboard-templates.test.js`

Expected: FAIL with `Invalid report source` or `Unknown field` for District and Analyst definitions.

- [ ] **Step 3: Replace the invalid definitions**

Use only these declared combinations:

```js
{ sourceKey: 'brief', dimensions: ['metric'], measures: [{ field: 'value', aggregate: 'sum' }] }
{ sourceKey: 'patterns', dimensions: ['patternType'], measures: [{ field: 'caseCount', aggregate: 'sum' }] }
{ sourceKey: 'hotspots', dimensions: ['unitId'], measures: [{ field: 'caseCount', aggregate: 'sum' }] }
{ sourceKey: 'anomalies', dimensions: ['signalType'], measures: [{ field: 'observed', aggregate: 'sum' }] }
{ sourceKey: 'districtContext', dimensions: ['indicator'], measures: [{ field: 'value', aggregate: 'sum' }] }
{ sourceKey: 'alerts', dimensions: ['state'], measures: [{ field: 'recordCount', aggregate: 'sum' }] }
```

Use only `number`, `table`, `bar`, `line`, or `pie` visualizations supported by each source. Do not create a map without a governed `mapViewId`.

- [ ] **Step 4: Verify GREEN**

Run the focused template test and expect PASS.

- [ ] **Step 5: Commit**

Commit only the two template files and their contract test with `fix: use governed persona dashboard reports`.

### Task 2: Execute Police Station alert reports through the authorized service

**Files:**
- Modify: `tests/reporting/workspace-services.test.mjs`
- Modify: `src/backend/reporting/workspace-services.mjs`

- [ ] **Step 1: Write the failing integration test**

Create an `alerts` report through `createWorkspaceServices`, execute it with station access and an empty authorized alert list, and assert:

```js
assert.deepEqual(result.data.result.data.items, [{ recordCount_sum: 0 }]);
```

- [ ] **Step 2: Verify RED**

Run: `node --test tests/reporting/workspace-services.test.mjs`

Expected: FAIL with public code `DATA_NOT_READY` because `readServices.listAlerts` is absent.

- [ ] **Step 3: Compose the existing alert service before report execution**

In `createWorkspaceServices`, create `alerts` first, then pass this bounded adapter to `createReportService`:

```js
const reportReadServices = Object.freeze({
  ...readServices,
  listAlerts: input => alerts.listAlerts(input),
});
```

Keep the existing public `listAlerts` and `getAlertDetail` resources unchanged.

- [ ] **Step 4: Verify GREEN**

Run the focused backend test and expect PASS with zero visible alerts represented as a truthful zero.

- [ ] **Step 5: Commit**

Commit the service and test with `fix: execute governed alert reports`.

### Task 3: Surface bounded provisioning failures

**Files:**
- Modify: `web/src/features/dashboards/ProvisionedDashboardApplication.test.jsx`
- Modify: `web/src/features/dashboards/ProvisionedDashboardApplication.jsx`
- Modify: `web/src/styles/app.css`

- [ ] **Step 1: Write the failing UI test**

Make provisioning return one warning and assert that children still render alongside an alert containing `Dashboard setup incomplete` and the stable template key, without an exception message or stack.

- [ ] **Step 2: Verify RED**

Run the focused component test and expect the warning assertion to fail.

- [ ] **Step 3: Render the safe warning**

Wrap the rendered child application and add a compact `role="alert"` notice when `state.warnings?.length > 0`. Project only `warning.key` and `warning.error?.code ?? 'SETUP_FAILED'`.

- [ ] **Step 4: Verify GREEN**

Run the focused component test and expect PASS.

- [ ] **Step 5: Commit**

Commit component, CSS, and test with `fix: expose dashboard setup failures safely`.

### Task 4: Verify, deploy, and smoke-test

**Files:**
- Generated: `functions/crime_intelligence_api/app/**`
- Generated: `functions/intelligence_refresh/app/**`

- [ ] **Step 1: Run focused regression tests**

Run all tests modified in Tasks 1-3 and expect zero failures.

- [ ] **Step 2: Run full verification**

Run backend tests, frontend tests, production web build, Catalyst function build/inspection, and both schema validators. Every command must exit zero.

- [ ] **Step 3: Push the reviewed commits to `main`**

Fast-forward or merge without force-push, preserving unrelated work.

- [ ] **Step 4: Deploy Catalyst Development**

Run `catalyst.cmd deploy` from the clean verified worktree and require successful API Function, Job Function, and Slate deployment results.

- [ ] **Step 5: Browser smoke**

Verify `District Intelligence Dashboard`, `Crime Analyst Dashboard`, and `Police Station Dashboard` exist; open each dashboard; confirm each report card renders or truthfully shows an empty result; confirm Police Station `Active Alerts` no longer reports `DATA_NOT_READY`; confirm both State dashboards still open.

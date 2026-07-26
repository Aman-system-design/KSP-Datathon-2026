# ACE Intelligence Utilities MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a Catalyst-inspired ACE Utilities catalogue and reusable utility lifecycle with real, persisted, scoped alert rules for pattern, hotspot and anomaly intelligence.

**Architecture:** A server-owned registry defines four utilities and their allowed rule contracts. A single reusable React experience renders catalogue and detail views; bounded rules persist in `CFG_UtilityAlertRule`, and deterministic evaluation converts already-persisted findings into evidence-linked `WF_Alert` records without duplicating alerts. QuickML remains absent from the primary UI.

**Tech Stack:** React 19, React Router 7, Vitest, Node.js ESM, Catalyst Functions/Data Store, existing ACE repository/read-service/workflow layers, Roboto, Lucide React.

---

## File structure

New focused modules:

- `src/backend/utilities/utility-registry.mjs` — immutable definitions and category filtering.
- `src/backend/utilities/rule-contract.mjs` — bounded validation and normalization.
- `src/backend/utilities/utility-evaluator.mjs` — finding adapters and deterministic alert candidates.
- `src/backend/utilities/utility-services.mjs` — authorized API resources.
- `web/src/features/utilities/utility-catalog.js` — presentation projection of server keys/stages.
- `web/src/features/utilities/UtilitiesPage.jsx` — catalogue and category filtering.
- `web/src/features/utilities/UtilityPage.jsx` — shared five-stage utility view and progressive disclosure.

Existing boundaries extended:

- `src/backend/http/api-contract.mjs`
- `src/backend/catalyst/api-bootstrap.mjs`
- `src/backend/reporting/workspace-services.mjs`
- `src/backend/repository/contract.mjs`
- `src/backend/repository/memory-repository.mjs`
- `src/backend/repository/catalyst/catalyst-repository.mjs`
- `src/backend/services/alert-services.mjs`
- `src/backend/refresh/finding-projection.mjs`
- `src/backend/refresh/refresh-service.mjs`
- `src/backend/catalyst/refresh-bootstrap.mjs`
- `schema/catalyst/intelligence-schema.json`
- `config/access-policy.json`
- `web/src/app/router.jsx`
- `web/src/app/workspace-navigation.js`
- `web/src/styles/app.css`

Generated Function bundles under `functions/*/app` are rebuilt only with `npm run catalyst:build`.

### Task 1: Server-owned utility registry

**Files:**
- Create: `src/backend/utilities/utility-registry.mjs`
- Create: `tests/backend/utility-registry.test.mjs`

- [ ] **Step 1: Write failing registry tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { getUtility, listUtilities } from '../../src/backend/utilities/utility-registry.mjs';

test('registry exposes four categorized utilities and only three alert-enabled utilities', () => {
  const utilities = listUtilities();
  assert.deepEqual(utilities.map(item => item.key), ['patterns', 'hotspots', 'anomalies', 'area-attention']);
  assert.deepEqual(utilities.filter(item => item.alertPolicy.enabled).map(item => item.key), ['patterns', 'hotspots', 'anomalies']);
  assert.equal(getUtility('area-attention').category, 'risk-prioritization');
  assert.equal(Object.isFrozen(getUtility('hotspots')), true);
});
```

- [ ] **Step 2: Run the focused test and confirm module-not-found failure**

Run: `node --test tests/backend/utility-registry.test.mjs`

Expected: FAIL because `utility-registry.mjs` does not exist.

- [ ] **Step 3: Implement immutable definitions**

Define exact keys, categories, stage labels, source services, method labels, outputs and bounds. Use recursive freezing and return structured clones from list operations. Pattern threshold is `0.65..1`, hotspot minimum cases is `2..50`, anomaly deviation is `1..10`, and all windows are `1..180` days.

- [ ] **Step 4: Run the registry test**

Run: `node --test tests/backend/utility-registry.test.mjs`

Expected: PASS.

### Task 2: Utility catalogue API

**Files:**
- Create: `src/backend/utilities/utility-services.mjs`
- Modify: `src/backend/http/api-contract.mjs`
- Modify: `src/backend/reporting/workspace-services.mjs`
- Modify: `src/backend/catalyst/api-bootstrap.mjs`
- Modify: `tests/backend/api-contract.test.mjs`
- Create: `tests/backend/utility-services.test.mjs`

- [ ] **Step 1: Add failing API/service tests**

Declare and test:

```text
GET /v1/utilities
GET /v1/utilities/categories
GET /v1/utilities/{utilityKey}
```

The list response contains four server definitions; category filtering is optional via `?category=`; an unknown key returns `NOT_FOUND`; Area Attention reports `alertPolicy.enabled=false`.

- [ ] **Step 2: Run tests to confirm undeclared-route failures**

Run: `node --test tests/backend/utility-services.test.mjs tests/backend/api-contract.test.mjs`

Expected: FAIL on missing services/routes.

- [ ] **Step 3: Implement read-only services and composition**

`createUtilityServices()` returns frozen `listUtilities`, `listUtilityCategories`, and `getUtility` methods using the registry. Compose them into `resourceServices`; do not duplicate definitions in workspace services.

- [ ] **Step 4: Run the focused API tests**

Run: `node --test tests/backend/utility-services.test.mjs tests/backend/api-contract.test.mjs`

Expected: PASS.

### Task 3: Catalyst-like Utilities catalogue and reusable detail

**Files:**
- Create: `web/src/features/utilities/utility-catalog.js`
- Create: `web/src/features/utilities/UtilitiesPage.jsx`
- Create: `web/src/features/utilities/UtilityPage.jsx`
- Create: `web/src/features/utilities/UtilitiesPage.test.jsx`
- Create: `web/src/features/utilities/UtilityPage.test.jsx`
- Modify: `web/src/app/router.jsx`
- Modify: `web/src/app/workspace-navigation.js`
- Modify: `web/src/components/icons.jsx`
- Modify: `web/src/styles/app.css`

- [ ] **Step 1: Write failing catalogue and detail tests**

Tests prove:

```text
Utilities renders four API-backed rows.
All is the default category; category filters compose with explicit empty state.
Each row links to /utilities/{utilityKey}.
Detail renders Data -> Analyze -> Explain -> Alert -> Deliver.
Each utility changes identity, method and outputs while reusing one component.
Area Attention never displays active alert configuration.
QuickML, coming-soon controls and fabricated counts are absent.
Unknown utility renders a safe Back to Utilities state.
```

- [ ] **Step 2: Run Vitest and confirm failures**

Run: `npm run test --workspace web -- src/features/utilities/UtilitiesPage.test.jsx src/features/utilities/UtilityPage.test.jsx`

Expected: FAIL because feature files/routes are missing.

- [ ] **Step 3: Implement API-backed pages**

Use `useLoad`, `Busy`, `Failure`, `Link`, `useParams`, Lucide icons and semantic buttons. The catalogue displays one compact lifecycle and category chips. The detail defaults to the five-stage explanation and reveals Input & Logic, Alert Policy and Outputs through tabs; do not show monitoring as the utility definition.

- [ ] **Step 4: Add scoped styling**

Add `.utilities-*` rules after the existing `.command-center-*` block. Reuse global Roboto and ACE navy/blue tokens. Keep the page predominantly white, use restrained borders, no marketing hero and no generic KPI grid. Add a single-column response below 720px.

- [ ] **Step 5: Run focused frontend tests**

Run: `npm run test --workspace web -- src/features/utilities/UtilitiesPage.test.jsx src/features/utilities/UtilityPage.test.jsx src/app/router.test.jsx src/app/workspace-navigation.test.js`

Expected: PASS.

### Task 4: Persist bounded alert rules

**Files:**
- Create: `src/backend/utilities/rule-contract.mjs`
- Create: `tests/backend/utility-rules.test.mjs`
- Modify: `schema/catalyst/intelligence-schema.json`
- Modify: `tests/schema/intelligence-schema.test.mjs`
- Modify: `src/backend/repository/contract.mjs`
- Modify: `src/backend/repository/memory-repository.mjs`
- Modify: `src/backend/repository/catalyst/catalyst-repository.mjs`
- Modify: `tests/backend/repository.test.mjs`
- Modify: `tests/catalyst/repository-reads.test.mjs`
- Modify: `tests/catalyst/repository-writes.test.mjs`

- [ ] **Step 1: Write failing validation/schema/repository tests**

Validate an exact rule payload:

```js
{
  utilityKey: 'hotspots', enabled: true, scopeUnitId: 1001,
  thresholds: { minimumCases: 5 }, evaluationWindowDays: 30,
  severity: 'HIGH', recipientRoles: ['DISTRICT_LEADERSHIP', 'CRIME_ANALYST']
}
```

Reject unknown keys, arbitrary expressions, out-of-bounds values, unauthorized scope, unsupported roles and Area Attention alert rules. Repository updates require `expectedVersion` and return `VERSION_CONFLICT` on stale writes.

- [ ] **Step 2: Add `CFG_UtilityAlertRule` schema contract**

Columns: `RuleID`, `UtilityKey`, `UtilityVersion`, `Enabled`, `ScopeUnitID`, `ThresholdsJSON`, `EvaluationWindowDays`, `Severity`, `RecipientRolesJSON`, `Version`, `CreatedByUserID`, `CreatedAt`, `UpdatedAt`, `SyntheticData`.

- [ ] **Step 3: Implement pure normalization and repository methods**

Add `listUtilityRules`, `getUtilityRule`, `createUtilityRule`, and `updateUtilityRule` to both repositories. Catalyst writes use indexed business IDs, App User permissions remain denied, and JSON is parsed only after service validation.

- [ ] **Step 4: Run focused backend/schema tests**

Run: `node --test tests/backend/utility-rules.test.mjs tests/backend/repository.test.mjs tests/catalyst/repository-reads.test.mjs tests/catalyst/repository-writes.test.mjs tests/schema/intelligence-schema.test.mjs`

Expected: PASS.

### Task 5: Authorized rule API and frontend policy editor

**Files:**
- Modify: `src/backend/utilities/utility-services.mjs`
- Modify: `src/backend/http/api-contract.mjs`
- Modify: `src/backend/catalyst/api-bootstrap.mjs`
- Modify: `config/access-policy.json`
- Modify: `web/src/features/utilities/UtilityPage.jsx`
- Modify: `web/src/features/utilities/UtilityPage.test.jsx`
- Modify: `tests/backend/utility-services.test.mjs`
- Modify: `tests/backend/api-contract.test.mjs`

- [ ] **Step 1: Write failing service and UI tests**

Routes:

```text
GET  /v1/utility-alert-rules?utilityKey={key}
POST /v1/utility-alert-rules
PATCH /v1/utility-alert-rules/{ruleId}
```

Tests prove authorized scope, server-owned bounds, optimistic versioning, exact role routing, success status, saved state reload and Area Attention rejection.

- [ ] **Step 2: Implement permissions and rule resources**

Add `READ_UTILITY`, `MANAGE_UTILITY_RULE`, and `RUN_UTILITY_EVALUATION`. Catalogue reads are available to operational personas; manage/evaluate is limited to approved leadership, analyst and platform-admin roles. Scope must be contained in `access.authorizedUnitIds`.

- [ ] **Step 3: Implement progressive policy editor**

Only the Alert Policy tab loads rules. Show scope, utility-specific threshold, window, severity, recipients, enabled state, version and Save. Disable save while invalid/busy; display version conflicts without discarding local edits. Area Attention shows its analytical limitation and no editor.

- [ ] **Step 4: Run focused tests**

Run: `node --test tests/backend/utility-services.test.mjs tests/backend/api-contract.test.mjs; npm run test --workspace web -- src/features/utilities/UtilityPage.test.jsx`

Expected: PASS.

### Task 6: Deterministic evaluation and evidence-linked alerts

**Files:**
- Create: `src/backend/utilities/utility-evaluator.mjs`
- Create: `tests/backend/utility-evaluator.test.mjs`
- Modify: `src/backend/repository/contract.mjs`
- Modify: `src/backend/repository/memory-repository.mjs`
- Modify: `src/backend/repository/catalyst/catalyst-repository.mjs`
- Modify: `src/backend/services/alert-services.mjs`
- Modify: `tests/backend/alert-services.test.mjs`
- Modify: `src/backend/utilities/utility-services.mjs`
- Modify: `src/backend/http/api-contract.mjs`

- [ ] **Step 1: Write failing evaluator/idempotency tests**

For pattern, hotspot and anomaly fixtures, prove positive and negative thresholds, disabled rule, stale utility version, unauthorized scope, minimized evidence, method/limitation retention and deterministic replay. Repeated evaluation must return the existing alert and leave one stored row.

- [ ] **Step 2: Implement deterministic candidates**

Derive `AlertID` from SHA-256 of `ruleId|ruleVersion|findingType|findingId|analysisRunId`. Normalize `OriginalFindingJSON` to one common envelope containing title, recommendation, confidence/severity, method/version, rule snapshot, unit summaries, authorized evidence, limitations and demonstration provenance.

- [ ] **Step 3: Add idempotent repository insertion**

Add `createAlertIfAbsent`. A unique conflict rereads and returns the deterministic existing alert. Catalyst mapping uses the finding's real type and analysis-run reference; it must not hardcode PATTERN.

- [ ] **Step 4: Add manual evaluation route**

`POST /v1/utility-alert-rules/{ruleId}/evaluate` loads the current published run, scoped persisted findings and exact rule version, then returns matched/suppressed counts and created/existing alert IDs. It does not rerun intelligence algorithms.

- [ ] **Step 5: Normalize alert reads**

Update `alert-services.mjs` so pattern, hotspot and anomaly envelopes render consistently and scope filtering remains fail-closed.

- [ ] **Step 6: Run focused evaluator/alert tests**

Run: `node --test tests/backend/utility-evaluator.test.mjs tests/backend/alert-services.test.mjs tests/backend/utility-services.test.mjs`

Expected: PASS.

### Task 7: Refresh integration and publication safety

**Files:**
- Modify: `src/backend/refresh/finding-projection.mjs`
- Modify: `src/backend/refresh/refresh-service.mjs`
- Modify: `src/backend/catalyst/refresh-bootstrap.mjs`
- Modify: `src/backend/repository/catalyst/catalyst-repository.mjs`
- Modify: `tests/backend/refresh.test.mjs`
- Modify: `tests/catalyst/refresh-bootstrap.test.mjs`

- [ ] **Step 1: Write failing refresh-rule tests**

Prove active rules snapshot their version and create qualifying deterministic candidates; disabled rules create none; retries duplicate none; evaluator failure publishes neither partial alerts nor a new current run group; alert reads expose only alerts tied to the current published run group.

- [ ] **Step 2: Remove unconditional pattern-only projection**

`finding-projection.mjs` normalizes finding envelopes but does not create alerts without rules. Preserve old stored alerts for backward compatibility.

- [ ] **Step 3: Evaluate a rule snapshot during staging**

Load active rules before evaluation, stage candidate alerts with the same run group, and advance the publication pointer only after all findings and alerts are staged. Filter alert reads through the current published analysis-run group so failed staged runs remain invisible.

- [ ] **Step 4: Run refresh tests**

Run: `node --test tests/backend/refresh.test.mjs tests/catalyst/refresh-bootstrap.test.mjs`

Expected: PASS.

### Task 8: Evaluation result UI and real outputs

**Files:**
- Modify: `web/src/features/utilities/UtilityPage.jsx`
- Modify: `web/src/features/utilities/UtilityPage.test.jsx`
- Modify: `web/src/features/alerts/AlertPages.jsx`
- Modify: `web/src/styles/app.css`

- [ ] **Step 1: Write failing interaction tests**

Test Run evaluation busy/success/no-match/failure, evidence-linked alert navigation, and output links: hotspot to Geospatial, anomaly to Reports, pattern to Networks/Reports. Verify no invented count appears before the API response.

- [ ] **Step 2: Implement result disclosure**

Keep the utility definition screen calm. Show evaluation results only after the user runs a rule; link created/existing alerts to `/alerts/{alertId}`. Output actions use existing routes and never claim unavailable sharing or QuickML.

- [ ] **Step 3: Run focused frontend tests**

Run: `npm run test --workspace web -- src/features/utilities/UtilityPage.test.jsx src/features/alerts/AlertPages.test.jsx`

Expected: PASS.

### Task 9: Verification, bundles and truthful release evidence

**Files:**
- Modify: `docs/PROJECT_MEMORY.md`
- Modify: `docs/deployment/catalyst-development-ledger.md` only after an authorized deployment actually occurs.

- [ ] **Step 1: Run whitespace and focused verification**

```powershell
git diff --check
node --test tests/backend/utility-*.test.mjs tests/backend/alert-services.test.mjs tests/backend/refresh.test.mjs
npm run test --workspace web -- src/features/utilities/UtilitiesPage.test.jsx src/features/utilities/UtilityPage.test.jsx
```

Expected: zero failures.

- [ ] **Step 2: Run the complete repository gate**

Run: `npm run verify`

Expected: backend tests, frontend tests, production web build, Function builds/inspection and schema validators all pass.

- [ ] **Step 3: Prove computed intelligence**

Run: `npm run intelligence:demo`

Expected: computed pattern, hotspot and anomaly results from the deterministic demonstration fixture.

- [ ] **Step 4: Rebuild and inspect generated bundles**

Run: `npm run catalyst:build; npm run catalyst:inspect`

Expected: both Function bundles contain the new relative modules with no forbidden files or unresolved imports.

- [ ] **Step 5: Update project memory with observed facts only**

Record exact passing counts, implemented routes, remaining Catalyst table creation/permission work and the unchanged Development-only/QuickML-hidden boundary.

- [ ] **Step 6: Stop before remote deployment if provenance gates fail**

Remote deployment requires the configured branch, clean reviewed tracked tree, reconciled origin divergence, created `CFG_UtilityAlertRule` table with denied App User permissions, restored Function variables, remote preflight and explicit deployment authorization. Never bypass the preflight or touch Production.

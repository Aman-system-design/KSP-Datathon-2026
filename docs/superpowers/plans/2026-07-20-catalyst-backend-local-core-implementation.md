# Catalyst Backend Local Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and verify the complete local backend contract—21-table schema, Node.js 18-compatible intelligence package, authorization/redaction, eight read services, four recoverable workflow services, and coherent refresh—before any Catalyst Development mutation.

**Architecture:** Framework-independent services depend on injected identity, repository, clock, and HMAC providers. A deterministic memory repository proves security, workflow recovery, and API behavior with the PDF-aligned synthetic dataset. Catalyst entry points, SDK adapters, API Gateway rules, remote table creation, and deployment are intentionally reserved for the second implementation plan after this local gate passes.

**Tech Stack:** Node.js 24 development runtime, pinned Node.js 18 compatibility runtime, ESM core modules, `node:test`, JSON manifests/policies, Catalyst Data Store schema conventions.

---

## Scope boundary

This plan produces working and tested local backend software for all twelve API operations. It does not initialize Catalyst Functions, install the Catalyst SDK or Express, create remote tables, configure Authentication/API Gateway, load remote records, or deploy. Those actions require a separate plan because the approved design requires the local security and challenge-alignment gate to pass first.

## Task 1: Expand the Catalyst backend schema from 19 to 21 tables

**Files:**
- Modify: `schema/catalyst/intelligence-schema.json`
- Modify: `scripts/schema/validate-intelligence-schema.mjs`
- Modify: `tests/schema/intelligence-schema.test.mjs`
- Regenerate: `docs/runbooks/catalyst-intelligence-tables.md`
- Test: `tests/schema/intelligence-runbook.test.mjs`

- [ ] **Step 1: Change the schema test first**

Update the expected table boundary to contain `CFG_UserAccess` first and `WF_Command` immediately after `WF_Alert`, for exactly 21 tables. Add these assertions:

```js
const access = schema.tables.find(({ name }) => name === 'CFG_UserAccess');
assert.equal(access.businessId, 'AccessProfileID');
assert.ok(access.columns.some(({ name, unique }) => name === 'CatalystUserID' && unique));

const command = schema.tables.find(({ name }) => name === 'WF_Command');
for (const field of [
  'CommandID', 'IdempotencyKeyHash', 'RequestHash', 'AlertRef',
  'ExpectedAlertState', 'ExpectedAlertVersion', 'TargetAlertState',
  'Status', 'ResponseJSON', 'CreatedAt', 'CompletedAt',
]) assert.ok(command.columns.some(({ name }) => name === field));

const run = schema.tables.find(({ name }) => name === 'INT_AnalysisRun');
for (const field of ['RunGroupID', 'AnalysisType', 'RunTypeKey', 'PublishStatus', 'PublishedAt']) {
  assert.ok(run.columns.some(({ name }) => name === field));
}
assert.equal(run.columns.find(({ name }) => name === 'RunTypeKey').unique, true);
```

Require `WF_Alert.AlertVersion`, `WF_Alert.LastCommandRef`; mandatory `CommandRef` on assignment/conclusion/outcome; optional `CommandRef` plus stream/HMAC fields on audit; and the three assignment evidence-grant fields.

- [ ] **Step 2: Run the changed tests and verify red**

Run: `node --test tests/schema/intelligence-schema.test.mjs tests/schema/intelligence-runbook.test.mjs`  
Expected: FAIL because the manifest still contains 19 tables and lacks the new fields.

- [ ] **Step 3: Implement the exact manifest change**

Add zone `CONFIGURATION`. Add `CFG_UserAccess` and `WF_Command` exactly as specified in `docs/superpowers/specs/2026-07-20-catalyst-backend-vertical-slice-design.md`. All application IDs are mandatory/unique/indexed, all foreign keys use `onDelete: "NULL"`, all non-FK columns declare `pii`, and all tables retain mandatory `SyntheticData=true`.

Add these exact `INT_AnalysisRun` fields:

```json
{"name":"RunGroupID","origin":"SYSTEM","type":"varchar","maxLength":64,"mandatory":true,"unique":false,"indexed":true,"pii":false},
{"name":"AnalysisType","origin":"SYSTEM","type":"varchar","maxLength":32,"mandatory":true,"unique":false,"indexed":true,"pii":false},
{"name":"RunTypeKey","origin":"SYSTEM","type":"varchar","maxLength":128,"mandatory":true,"unique":true,"indexed":true,"pii":false},
{"name":"PublishStatus","origin":"SYSTEM","type":"varchar","maxLength":24,"mandatory":true,"unique":false,"indexed":true,"pii":false},
{"name":"PublishedAt","origin":"SYSTEM","type":"datetime","mandatory":false,"pii":false}
```

Set `WF_Command.loadOrder=41`; retain `WF_Alert.loadOrder=40`; move dependent workflow rows to load order 42 or later. Circular `WF_Alert.LastCommandRef` and `WF_Command.AlertRef` are allowed because foreign keys are created only after all native tables.

- [ ] **Step 4: Harden the validator**

Change the expected count/message to 21 and allow the configuration zone. Add errors for missing/unsafe access, command, publication, alert-version, command-reference, evidence-grant, and audit-HMAC fields. Require `RunTypeKey` unique and prohibit raw `IdempotencyKey` columns:

```js
if (tables.some(table => table.columns.some(({ name }) => name === 'IdempotencyKey'))) {
  errors.push('raw IdempotencyKey must never be persisted');
}
```

- [ ] **Step 5: Regenerate and verify green**

Run:

```powershell
npm.cmd run intelligence-schema:validate
npm.cmd run intelligence-schema:runbook
node --test tests/schema/intelligence-schema.test.mjs tests/schema/intelligence-runbook.test.mjs
git diff --check
```

Expected: validator reports `PASS: 21 Catalyst backend tables are valid.` and both test files pass.

- [ ] **Step 6: Commit**

```powershell
git add schema/catalyst/intelligence-schema.json scripts/schema/validate-intelligence-schema.mjs tests/schema/intelligence-schema.test.mjs tests/schema/intelligence-runbook.test.mjs docs/runbooks/catalyst-intelligence-tables.md
git commit -m "feat: harden Catalyst backend schema"
```

## Task 2: Extract one Node.js 18-compatible intelligence package

**Files:**
- Create: `packages/intelligence-core/package.json`
- Move: `src/intelligence/*.mjs` to `packages/intelligence-core/src/`
- Create: `packages/intelligence-core/index.mjs`
- Modify: `src/ingestion/to-intelligence-input.mjs`
- Modify: `scripts/intelligence/run-demo.mjs`
- Modify: `tests/intelligence/*.test.mjs`
- Modify: `tests/ingestion/to-intelligence-input.test.mjs`
- Create: `tests/compat/node18-core.test.mjs`
- Modify: `package.json`
- Create: `package-lock.json`

- [ ] **Step 1: Add the compatibility test before moving code**

Create a test that imports `runIntelligencePipeline` and `evaluatePipeline` from the package entry point, adapts the accepted PDF seed, and asserts the complete evaluation passes:

```js
test('shared core produces the verified report', () => {
  const accepted = validateSourceSeed(generateSourceSeed(20260720)).accepted;
  const output = runIntelligencePipeline(toIntelligenceInput(accepted));
  assert.equal(evaluatePipeline(output, truth).pass, true);
});
```

Run: `node --test tests/compat/node18-core.test.mjs`  
Expected: FAIL because `packages/intelligence-core/index.mjs` does not exist.

- [ ] **Step 2: Move the analytical source once**

Use `git mv` for all twelve `src/intelligence/*.mjs` files into `packages/intelligence-core/src/`. Do not copy them. Create:

```json
{
  "name": "@ksp/intelligence-core",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "engines": { "node": ">=18 <25" },
  "exports": { ".": "./index.mjs", "./*": "./src/*.mjs" }
}
```

The package entry point explicitly exports the pipeline/evaluator and public calculation functions. Add `"workspaces": ["packages/*"]` and `"@ksp/intelligence-core": "workspace:*"` to the root package, run `npm.cmd install`, and update imports to `@ksp/intelligence-core` or its declared subpath exports. No compatibility wrapper may contain analytical logic.

- [ ] **Step 3: Add pinned runtime commands**

Add scripts:

```json
"compat:node18": "npx --yes node@18.20.8 --test tests/compat/node18-core.test.mjs",
"compat:node24": "node --test tests/compat/node18-core.test.mjs"
```

The first execution may download the pinned runtime and therefore requires network approval. The exact runtime is recorded so a later Node release cannot silently change the result.

- [ ] **Step 4: Verify both runtimes and the regression suite**

Run:

```powershell
npm.cmd run compat:node18
npm.cmd run compat:node24
npm.cmd test
npm.cmd run intelligence:demo
```

Expected: identical passing evaluation gates under Node 18.20.8 and the local Node 24 runtime; all existing tests pass.

- [ ] **Step 5: Commit**

```powershell
git add packages src/ingestion scripts/intelligence tests package.json package-lock.json
git commit -m "refactor: package Node 18 intelligence core"
```

## Task 3: Implement versioned authorization and disclosure policy

**Files:**
- Create: `config/access-policy.json`
- Create: `src/backend/security/identity.mjs`
- Create: `src/backend/security/scope.mjs`
- Create: `src/backend/security/disclosure.mjs`
- Test: `tests/backend/security.test.mjs`

- [ ] **Step 1: Write failing security tests**

Test these exact cases: null/inactive Catalyst user; missing/inactive profile; caller-supplied role ignored; Development demo persona allowed only for an active `DEMO_PRESENTER`; Production persona denied; descendant unit allowed; sibling unit denied; cyclic/missing unit hierarchy fails closed; full/aggregate/hidden pattern disclosure; unauthorized network node returns not-found semantics.

Use the public signatures:

```js
resolveAccess({ currentUser, profile, requestedPersona, environment, policy });
buildAuthorizedUnitSet({ scopeUnitId, units });
projectPattern({ pattern, evidence, access });
```

Run: `node --test tests/backend/security.test.mjs`  
Expected: FAIL because the modules do not exist.

- [ ] **Step 2: Create the exact policy**

`config/access-policy.json` has `version: "1.0.0"` and these exact action assignments:

- `STATE_LEADERSHIP`: all seven read actions; no workflow action.
- `REGIONAL_LEADERSHIP`: all seven read actions plus `ASSIGN_ALERT`.
- `DISTRICT_LEADERSHIP`: all seven read actions plus `ASSIGN_ALERT` and `CLOSE_ALERT`.
- `CRIME_ANALYST`: all seven read actions plus `ACKNOWLEDGE_ALERT` and `CONCLUDE_ALERT`.
- `STATION_OPERATIONS`: `READ_BRIEF`, `READ_PATTERN`, `READ_HOTSPOT`, `READ_ANOMALY`, `READ_AREA_RISK`, `READ_NETWORK`, `ACKNOWLEDGE_ALERT`, and `CLOSE_ALERT`.
- `DEMO_PRESENTER`, `PLATFORM_ADMIN`, and `AUDITOR`: no direct action in these twelve APIs.

The complete read-action set is `READ_BRIEF`, `READ_PATTERN`, `READ_HOTSPOT`, `READ_ANOMALY`, `READ_AREA_RISK`, `READ_NETWORK`, and `READ_DISTRICT_CONTEXT`; pattern list and detail share `READ_PATTERN`. The policy also records `personaAllowlist` containing the five policing roles only.

- [ ] **Step 3: Implement fail-closed security modules**

`resolveAccess()` returns immutable actual/effective identity and never reads identity from query/body. `buildAuthorizedUnitSet()` walks children from `ParentUnit`, rejects duplicate IDs, cycles, and missing parents, and includes the scope root. `projectPattern()` follows the exact full/aggregate/redacted policy and omits every prohibited out-of-scope field.

Errors use stable internal codes from the specification. No module imports Catalyst SDK or Express.

- [ ] **Step 4: Run security and full tests**

Run: `node --test tests/backend/security.test.mjs` then `npm.cmd test`.  
Expected: all pass.

- [ ] **Step 5: Commit**

```powershell
git add config/access-policy.json src/backend/security tests/backend/security.test.mjs
git commit -m "feat: enforce role and evidence scope"
```

## Task 4: Implement the repository contract and deterministic memory repository

**Files:**
- Create: `src/backend/repository/contract.mjs`
- Create: `src/backend/repository/memory-repository.mjs`
- Create: `src/backend/repository/build-demo-state.mjs`
- Test: `tests/backend/repository.test.mjs`

- [ ] **Step 1: Write failing repository-contract tests**

Require methods for current run group, brief, patterns/detail, hotspots, anomalies, area risk, network, district context, access profile, unit hierarchy, alert lookup, command lookup/create/update, domain-artifact insert, compare-and-swap alert, audit append/find, and command reconciliation.

The demo-state builder must derive state by calling the accepted-source adapter and intelligence pipeline; it may not import hidden truth except in evaluation tests.

- [ ] **Step 2: Implement immutable reads and controlled writes**

The memory repository stores plain arrays privately and returns clones. `compareAndSwapAlert({ alertId, expectedState, expectedVersion, targetState, commandId })` returns `{ matched: 1, alert }` only for an exact state/version match and `{ matched: 0 }` otherwise. Unique business IDs, `RunTypeKey`, `IdempotencyKeyHash`, and one domain artifact per `CommandID` are enforced.

Provide failure injection points named `afterCommandCreate`, `afterDomainInsert`, `afterAlertCas`, `afterAuditInsert`, and `beforeCommandComplete`.

- [ ] **Step 3: Verify repository invariants**

Tests require clone isolation, opaque pagination, complete-group selection, partial-group exclusion, unique-key conflict behavior, compare-and-swap concurrency, and every failure hook.

Run: `node --test tests/backend/repository.test.mjs`  
Expected: PASS.

- [ ] **Step 4: Commit**

```powershell
git add src/backend/repository tests/backend/repository.test.mjs
git commit -m "feat: add deterministic backend repository"
```

## Task 5: Implement all eight read services and disclosure envelopes

**Files:**
- Create: `src/backend/services/errors.mjs`
- Create: `src/backend/services/envelope.mjs`
- Create: `src/backend/services/read-services.mjs`
- Test: `tests/backend/read-services.test.mjs`

- [ ] **Step 1: Write failing service tests**

Test all eight GET operations with `STATE_LEADERSHIP`, `DISTRICT_LEADERSHIP`, `CRIME_ANALYST`, and `STATION_OPERATIONS`. Assert bounded `limit`, opaque `nextToken`, complete metadata, significant-finding evidence/method/version/period/limitation, district partial redaction, analyst explicit evidence grant, unauthorized direct pattern `404`, and unauthorized node `404`.

- [ ] **Step 2: Implement a single service factory**

Expose:

```js
createReadServices({ repository, policy, clock, idFactory });
```

It returns `getBrief`, `listPatterns`, `getPattern`, `listHotspots`, `listAnomalies`, `getAreaRisk`, `getNetwork`, and `getDistrictContext`. Each method receives `{ access, params, query }`, authorizes before repository access, projects fields after retrieval, and wraps results with `data` and `meta` exactly as specified.

Generated brief text is a deterministic template over stored evidence; it cannot invent entities, causes, or recommendations.

- [ ] **Step 3: Verify reads**

Run: `node --test tests/backend/read-services.test.mjs` and `npm.cmd test`.  
Expected: PASS.

- [ ] **Step 4: Commit**

```powershell
git add src/backend/services tests/backend/read-services.test.mjs
git commit -m "feat: serve scoped crime intelligence"
```

## Task 6: Implement recoverable commands, compare-and-swap, and HMAC audit

**Files:**
- Create: `src/backend/workflow/state-machine.mjs`
- Create: `src/backend/workflow/canonical-json.mjs`
- Create: `src/backend/workflow/audit.mjs`
- Create: `src/backend/workflow/command-service.mjs`
- Create: `src/backend/repository/zcql-cas.mjs`
- Test: `tests/backend/workflow.test.mjs`

- [ ] **Step 1: Write failing workflow tests**

Cover initial assignment, reassignment, acknowledgement, conclusion, close, wrong role, wrong assignment, wrong state/version, same-key replay, same-key/different-request conflict, same raw key by two users, concurrent expected-version commands, arbitrary ZCQL-like payload text, and injected failure at every repository hook.

After each retry, assert exactly one command, one applicable domain artifact, one alert version increment, and one audit event.

- [ ] **Step 2: Implement deterministic canonicalization and state machine**

`canonicalStringify()` sorts object keys recursively, preserves array order, and rejects `undefined`, functions, symbols, non-finite numbers, and cyclic objects. State transitions are an explicit frozen map; no caller-provided target state is trusted.

Implement `buildAlertCompareAndSwap({ tableName, rowId, expectedState, expectedVersion, targetState, targetVersion, commandRowId })` in `zcql-cas.mjs`. `tableName` is fixed internally as `WF_Alert`; states must be members of the frozen transition enum; IDs must contain digits only; versions must be non-negative integers. Return one ZCQL v2 `UPDATE` string and reject every invalid value before construction.

- [ ] **Step 3: Implement HMAC audit**

Expose:

```js
createAuditEvent({ event, previousHash, key, keyVersion });
verifyAuditStream({ events, keysByVersion });
```

Use `createHmac('sha256', key)` over canonical content plus previous hash. Persist only algorithm/key version/hash, never key material. Workflow stream sequence equals resulting alert version; standalone events use request ID and sequence one.

- [ ] **Step 4: Implement command execution and recovery**

Expose `createCommandService({ repository, policy, clock, idFactory, hmacKeys })`. Follow the eight-step protocol in the approved specification. Hash idempotency scope from actual Catalyst user ID, route, and raw key; never persist the raw key. `FAILED_FINAL` replays its stored 409; retryable states inspect artifacts and finish missing steps.

- [ ] **Step 5: Verify failure convergence**

Run: `node --test tests/backend/workflow.test.mjs` and `npm.cmd test`.  
Expected: PASS with every injected partial failure converging on retry.

- [ ] **Step 6: Commit**

```powershell
git add src/backend/workflow src/backend/repository/zcql-cas.mjs tests/backend/workflow.test.mjs
git commit -m "feat: add recoverable alert commands"
```

## Task 7: Implement coherent refresh publication and reconciliation

**Files:**
- Create: `src/backend/refresh/run-groups.mjs`
- Create: `src/backend/refresh/refresh-service.mjs`
- Test: `tests/backend/refresh.test.mjs`

- [ ] **Step 1: Write failing refresh tests**

Require exactly seven analysis types, unique `RunTypeKey`, one shared input hash/period/version, staged findings, complete-group publication, old-group continuity during partial publication, supersession only after new completeness, deterministic bootstrap replay, command reconciliation, and audit verification reporting without historical mutation.

- [ ] **Step 2: Implement run-group predicates**

Export frozen `REQUIRED_ANALYSIS_TYPES` and:

```js
isCompletePublishedGroup(runs);
selectCurrentRunGroup(runs);
```

Selection rejects duplicate/missing types or mismatched input hash, period, engine version, status, and publish status.

- [ ] **Step 3: Implement refresh service**

`createRefreshService({ repository, sourceGenerator, sourceValidator, adapter, pipeline, clock, idFactory })` supports `BOOTSTRAP_SYNTHETIC`, `REFRESH_INTELLIGENCE`, and `RECONCILE_GOVERNANCE`. It writes no `PUBLISHED` status until all seven run/output sets are complete and verified. A repeat completed batch returns the stored reconciliation.

- [ ] **Step 4: Verify refresh and complete regression**

Run:

```powershell
node --test tests/backend/refresh.test.mjs
npm.cmd run compat:node18
npm.cmd test
npm.cmd run schema:validate
npm.cmd run intelligence-schema:validate
npm.cmd run intelligence:demo
```

Expected: all pass.

- [ ] **Step 5: Commit**

```powershell
git add src/backend/refresh tests/backend/refresh.test.mjs
git commit -m "feat: publish coherent intelligence runs"
```

## Task 8: Lock the twelve framework-independent API operations

**Files:**
- Create: `src/backend/http/api-contract.mjs`
- Create: `src/backend/http/dispatch.mjs`
- Test: `tests/backend/api-contract.test.mjs`

- [ ] **Step 1: Write a failing twelve-operation contract test**

Define the exact method/path inventory from `mvp-build-contract.md`. The dispatcher receives a normalized request plus an injected authenticated `currentUser`; it does not parse or trust identity headers. Require 401/403/404/409/503/500 safe error shapes and no stack/SDK/table/ROWID leakage.

- [ ] **Step 2: Implement the dispatcher**

Expose:

```js
createDispatcher({ readServices, commandService, accessResolver, profileRepository });
```

Route matching supports only the twelve declared operations. It validates IDs, query limits/tokens, workflow body schemas, `Idempotency-Key`, expected state/version, and optional Development `X-Demo-Persona`. Undeclared methods/paths return `404`.

- [ ] **Step 3: Verify all operations**

Run: `node --test tests/backend/api-contract.test.mjs` and `npm.cmd test`.  
Expected: all twelve operations pass allowed/denied/error cases.

- [ ] **Step 4: Commit**

```powershell
git add src/backend/http tests/backend/api-contract.test.mjs
git commit -m "feat: lock backend API operations"
```

## Task 9: Final local security and challenge-alignment gate

**Files:**
- Create: `docs/reviews/2026-07-20-catalyst-backend-local-core.md`
- Modify: `docs/PROJECT_MEMORY.md`

- [ ] **Step 1: Run fresh verification**

```powershell
npm.cmd run compat:node18
npm.cmd run compat:node24
npm.cmd test
npm.cmd run schema:validate
npm.cmd run intelligence-schema:validate
npm.cmd run intelligence:demo
npm.cmd run intelligence-schema:runbook
powershell.exe -NoProfile -ExecutionPolicy Bypass -File skills/reviewing-challenge-alignment/scripts/check-required-files.ps1
git diff --check
```

- [ ] **Step 2: Inspect security evidence manually**

Confirm no raw idempotency key, audit HMAC secret, Catalyst token, real-person content, caller-selected identity, person-level area-risk field, unauthorized cross-unit evidence, incomplete run group, or unversioned workflow update exists.

- [ ] **Step 3: Write the exact challenge review template**

The review must distinguish local backend completion from Catalyst deployment. A WARN or FAIL blocks the deployment plan. Record observed test counts and commands, not intended results.

- [ ] **Step 4: Update memory and commit**

```powershell
git add docs/reviews/2026-07-20-catalyst-backend-local-core.md docs/PROJECT_MEMORY.md
git commit -m "docs: verify Catalyst backend local core"
```

## Plan self-review

- The plan implements every local requirement in the approved production-hardened specification.
- The 21-table boundary, runtime split, identity trust boundary, disclosure policy, coherent publication predicate, command recovery, compare-and-swap, HMAC audit, and all twelve operations each have explicit tests.
- Remote Catalyst mutation is excluded until this plan receives PASS.
- No placeholder, implicit implementation choice, or `use best judgment` instruction remains.
- The next plan will cover CLI initialization, Catalyst SDK/Express adapters, Job Function packaging, API Gateway rules, remote table creation, Authentication profile, synthetic bootstrap, Development deployment, and remote acceptance evidence.

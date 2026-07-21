# Operational Intelligence Control Plane Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an authorized platform administrator submit, inspect and retry real Catalyst intelligence jobs while every role can see the lineage and safe failure state of published intelligence.

**Architecture:** A new run-request record is the durable idempotency and failure boundary before Catalyst accepts a job. The API submits `intelligence_refresh` through Catalyst Job Scheduling SDK 3.x; the existing Job Function validates accepted source, executes the shared analytics package and atomically publishes seven coherent analysis runs. UI reads persisted requests and analysis runs rather than synthesizing job progress.

**Tech Stack:** Catalyst Node SDK 3.4.0, Catalyst Job Scheduling, Serverless Functions, Data Store, Node.js 24 API runtime, Node.js 18 Job Function, React 19, Vitest and Node test runner.

---

### Task 1: Upgrade the Catalyst SDK with compatibility proof

**Files:**
- Modify: `functions/crime_intelligence_api/package.json`
- Modify: `functions/crime_intelligence_api/package-lock.json`
- Modify: `functions/intelligence_refresh/package.json`
- Modify: `functions/intelligence_refresh/package-lock.json`
- Modify: `tests/catalyst/bundle.test.mjs`

- [ ] **Step 1: Write a failing deployment-contract assertion**

Require both Function manifests to use exact `zcatalyst-sdk-node` version `3.4.0` and require the API installed SDK to expose Job Scheduling support after installation.

- [ ] **Step 2: Verify RED**

Run: `node --test tests/catalyst/bundle.test.mjs`

Expected: FAIL because both packages currently resolve SDK 2.5.1.

- [ ] **Step 3: Upgrade only Function dependencies**

Run in each Function directory: `npm.cmd install --save-exact zcatalyst-sdk-node@3.4.0`

Do not modify the root application dependencies.

- [ ] **Step 4: Verify API and Job Function compatibility**

Run: `npm.cmd run catalyst:build`

Run: `npm.cmd run catalyst:inspect`

Run: `npm.cmd test`

Expected: deterministic bundles and all tests pass.

### Task 2: Add the durable run-request schema

**Files:**
- Modify: `schema/catalyst/intelligence-schema.json`
- Modify: `tests/schema/intelligence-schema.test.mjs`
- Modify: `src/backend/repository/contract.mjs`
- Modify: `src/backend/repository/memory-repository.mjs`
- Modify: `tests/backend/repository.test.mjs`

- [ ] **Step 1: Write failing schema and repository tests**

Require an `OPS_IntelligenceRunRequest` table with unique `RunRequestID` and `IdempotencyKeyHash`; indexed `BatchKey`, `Status`, `RequestedBy`, `RequestedAt`; nullable `CatalystJobID`, `StartedAt`, `CompletedAt`, `FailedPhase`, `FailureCode`, `CurrentRunGroupID`; and mandatory `SyntheticData`. Repository tests must prove create-if-absent by idempotency hash, status transitions and clone-safe reads.

- [ ] **Step 2: Verify RED**

Run: `node --test tests/schema/intelligence-schema.test.mjs tests/backend/repository.test.mjs`

Expected: FAIL because the table and repository methods do not exist.

- [ ] **Step 3: Implement the minimal schema and repository contract**

Add methods:

```js
createRunRequest(request)
getRunRequest(runRequestId)
getRunRequestByIdempotencyHash(hash)
listRunRequests()
updateRunRequest(runRequestId, changes)
```

Only allow state transitions `QUEUED -> SUBMITTED -> RUNNING -> PUBLISHED`, `QUEUED|SUBMITTED|RUNNING -> FAILED_RETRYABLE|FAILED_FINAL`, and `FAILED_RETRYABLE -> SUBMITTED`.

- [ ] **Step 4: Verify GREEN and schema generation**

Run: `node --test tests/schema/intelligence-schema.test.mjs tests/backend/repository.test.mjs`

Run: `npm.cmd run intelligence-schema:validate`

Expected: PASS.

### Task 3: Implement the run-control domain service

**Files:**
- Create: `src/backend/operations/intelligence-run-service.mjs`
- Create: `tests/backend/intelligence-run-service.test.mjs`

- [ ] **Step 1: Write failing authorization, idempotency and failure tests**

Test that `PLATFORM_ADMIN` with `MANAGE_INTELLIGENCE_RUNS` can submit a validated batch, other roles receive `FORBIDDEN_ACTION`, an idempotency replay returns the original request, a changed payload with the same key returns `IDEMPOTENCY_CONFLICT`, scheduler failure persists `FAILED_RETRYABLE`, and retry reuses the same request without duplicate submission records.

- [ ] **Step 2: Verify RED**

Run: `node --test tests/backend/intelligence-run-service.test.mjs`

Expected: FAIL because the service does not exist.

- [ ] **Step 3: Implement the minimal service**

Expose:

```js
createIntelligenceRunService({ repository, scheduler, clock, idFactory }).list({ access })
createIntelligenceRunService(...).submit({ access, batchKey, idempotencyKey })
createIntelligenceRunService(...).retry({ access, runRequestId, idempotencyKey })
```

Hash the canonical request; persist `QUEUED` before calling the scheduler; persist the returned Catalyst Job ID and `SUBMITTED`; reduce SDK failures to stable `JOB_SUBMISSION_FAILED` without storing raw messages or stacks.

- [ ] **Step 4: Verify GREEN**

Run: `node --test tests/backend/intelligence-run-service.test.mjs`

Expected: PASS.

### Task 4: Add the Catalyst Job Scheduling adapter and repository mapping

**Files:**
- Create: `src/backend/catalyst/job-scheduling-adapter.mjs`
- Modify: `src/backend/repository/catalyst/catalyst-repository.mjs`
- Modify: `src/backend/repository/catalyst/row-mapper.mjs`
- Modify: `src/backend/catalyst/api-bootstrap.mjs`
- Create: `tests/catalyst/job-scheduling-adapter.test.mjs`
- Modify: `tests/catalyst/repository-writes.test.mjs`

- [ ] **Step 1: Write failing adapter and persistence tests**

Assert the adapter calls:

```js
app.jobScheduling().jobpool({ name: configuredPool }).submitJob({
  job_name: `intelligence-${runRequestId}`,
  target_type: 'Function',
  target_name: 'intelligence_refresh',
  params: { operation: 'REFRESH_INTELLIGENCE', batchKey, runRequestId },
  job_config: { number_of_retries: 2, retry_interval: 900 },
});
```

Assert only the returned job ID is persisted and raw SDK errors are sanitized.

- [ ] **Step 2: Verify RED**

Run: `node --test tests/catalyst/job-scheduling-adapter.test.mjs tests/catalyst/repository-writes.test.mjs`

Expected: FAIL because the adapter and table mapping are absent.

- [ ] **Step 3: Implement against SDK 3.4.0**

Read the job-pool name from validated Function configuration `KSP_INTELLIGENCE_JOB_POOL`; keep target name fixed. Add run-request table to the repository allowlist, date mappings and business-ID mapping.

- [ ] **Step 4: Verify GREEN and bundle inclusion**

Run: `node --test tests/catalyst/job-scheduling-adapter.test.mjs tests/catalyst/repository-writes.test.mjs`

Run: `npm.cmd run catalyst:build`

Run: `npm.cmd run catalyst:inspect`

Expected: PASS and the adapter is present in the API bundle.

### Task 5: Publish authenticated run APIs

**Files:**
- Modify: `config/access-policy.json`
- Modify: `src/backend/http/api-contract.mjs`
- Modify: `src/backend/http/dispatch.mjs`
- Modify: `src/backend/reporting/workspace-services.mjs`
- Modify: `tests/backend/api-contract.test.mjs`
- Modify: `tests/catalyst/api-bootstrap.test.mjs`

- [ ] **Step 1: Write failing route and authorization tests**

Add exact routes `GET /v1/intelligence-runs`, `POST /v1/intelligence-runs`, and `POST /v1/intelligence-runs/{runRequestId}/retry`. Require an `Idempotency-Key` for both writes. Verify only `PLATFORM_ADMIN` with `MANAGE_INTELLIGENCE_RUNS` submits/retries, while leadership and analysts receive redacted read-only current-run lineage.

- [ ] **Step 2: Verify RED**

Run: `node --test tests/backend/api-contract.test.mjs tests/catalyst/api-bootstrap.test.mjs`

Expected: FAIL because the routes and composed service do not exist.

- [ ] **Step 3: Implement the declared routes**

Pass request headers to resource services, return HTTP 202 for successful submit/retry operations, and emit existing redacted structured request logs. Add `MANAGE_INTELLIGENCE_RUNS` only to `PLATFORM_ADMIN`; add a read permission to roles that already consume intelligence.

- [ ] **Step 4: Verify GREEN**

Run: `node --test tests/backend/api-contract.test.mjs tests/catalyst/api-bootstrap.test.mjs`

Expected: PASS.

### Task 6: Build the `ADMIN_2` run monitor

**Files:**
- Create: `web/src/features/admin/IntelligenceRunMonitor.jsx`
- Create: `web/src/features/admin/IntelligenceRunMonitor.test.jsx`
- Modify: `web/src/app/router.jsx`
- Modify: `web/src/app/workspace-navigation.js`
- Modify: `web/src/styles/app.css`

- [ ] **Step 1: Write failing UI state tests**

Cover `QUEUED`, `RUNNING`, `PUBLISHED`, `FAILED_RETRYABLE`, `FAILED_FINAL`, empty and API-failure states. Assert no synthetic success rows appear when the API fails. Assert Start and Retry are present only for the platform administrator and include a generated idempotency key.

- [ ] **Step 2: Verify RED**

Run: `npm.cmd run test --workspace web -- IntelligenceRunMonitor.test.jsx`

Expected: FAIL because the monitor does not exist.

- [ ] **Step 3: Implement the functional monitor**

Use the accepted Catalyst-white `ADMIN_2` shell and one compact table/detail split. Show request ID, job ID, batch, status, phase, input hash, observation period, engine versions, finding counts, retained-current-run and stable failure code. Poll only while a non-terminal request exists; stop on unmount or terminal state.

- [ ] **Step 4: Verify frontend**

Run: `npm.cmd run web:test`

Run: `npm.cmd run web:build`

Expected: PASS.

### Task 7: Full verification, schema runbook and deployment boundary

**Files:**
- Modify: `docs/PROJECT_MEMORY.md`
- Modify: `docs/deployment/catalyst-development-ledger.md`
- Create: `docs/reviews/2026-07-22-operational-intelligence-control-plane.md`

- [ ] **Step 1: Run complete local verification**

Run: `npm.cmd run verify`

Expected: backend, frontend, build, bundle and schema checks all pass.

- [ ] **Step 2: Generate the Catalyst table instructions**

Run: `npm.cmd run intelligence-schema:runbook`

Confirm the runbook adds exactly `OPS_IntelligenceRunRequest` and does not alter the 26 PDF-aligned `SRC_*` entities.

- [ ] **Step 3: Run challenge alignment and record truth**

Record exact commands and observed results. Do not claim Catalyst functionality until SDK 3.4.0, the new table, job-pool configuration, Function variables, Function deployment and a real Development smoke run succeed.

- [ ] **Step 4: Request bounded Catalyst authorization**

Before remote mutation, present the exact table delta, SDK Function bundles, job-pool name, environment variable and smoke sequence. Deploy only after explicit approval.

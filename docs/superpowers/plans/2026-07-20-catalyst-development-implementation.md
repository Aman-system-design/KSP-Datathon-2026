# Catalyst Development Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy the verified KSP Crime Decision Intelligence backend as a synthetic-only, authenticated, remotely tested vertical slice in the existing Catalyst Development project.

**Architecture:** Keep the framework-independent services unchanged and add Catalyst-specific adapters around them. A Node.js 24 Advanced I/O Function serves the exact twelve APIs; a Node.js 18 Job Function performs bootstrap/refresh; a manifest-driven Catalyst repository persists source, intelligence, workflow, command and audit rows. Browser-only Catalyst schema/authentication/API Gateway operations are controlled by committed manifests/runbooks and verified through exports and smoke tests.

**Tech Stack:** Node.js 24 Advanced I/O Function, Node.js 18 Job Function, Express, `zcatalyst-sdk-node` 2.5+, Catalyst Data Store/ZCQL v2, Catalyst Authentication, API Gateway, Job Scheduling, Catalyst CLI 1.27+, Node test runner, PowerShell, browser-controlled Catalyst console.

---

## Global execution rules

- Work only on `codex/catalyst-development`.
- Target project ID `43492000000013049`, organization/environment ID `60077844198`, environment `Development`.
- Never target Production.
- Never print or commit audit keys, Catalyst tokens, authentication cookies, invitation addresses, or future Entra secrets.
- The user enters the audit HMAC key and invited demo-user email directly in the Catalyst console when those attended checkpoints are reached. Execution pauses for that secure input; no value is copied into chat or Git.
- Every remote mutation requires a clean committed tree, a passing preflight, a challenge-alignment PASS, and a pre-mutation ledger entry.
- After every mutation, record resource names/IDs, commands, verification result and rollback in `docs/deployment/catalyst-development-ledger.md`, then commit the evidence.
- Table creation is browser-controlled because Catalyst documentation states that Data Store table/schema creation is console-only.
- GitHub/Catalyst Pipelines integration is excluded until manual Development deployment passes.

## Target file structure

```text
catalyst.json
config/
  catalyst-development.json
docs/deployment/
  catalyst-development-ledger.md
functions/
  crime_intelligence_api/
    catalyst-config.json
    index.cjs
    package.json
    app/                         # generated self-contained ESM bundle
  intelligence_refresh/
    catalyst-config.json
    index.cjs
    package.json
    app/                         # generated self-contained ESM bundle
scripts/catalyst/
  preflight.mjs
  build-functions.mjs
  inspect-bundle.mjs
  source-row-projector.mjs
  compare-development-export.mjs
src/backend/catalyst/
  api-bootstrap.mjs
  refresh-bootstrap.mjs
  runtime-config.mjs
src/backend/repository/catalyst/
  sdk-context.mjs
  sdk-errors.mjs
  paged-table.mjs
  row-mapper.mjs
  source-writer.mjs
  catalyst-repository.mjs
tests/catalyst/
  preflight.test.mjs
  bundle.test.mjs
  sdk-context.test.mjs
  paged-table.test.mjs
  source-writer.test.mjs
  repository-reads.test.mjs
  repository-writes.test.mjs
  api-bootstrap.test.mjs
  refresh-bootstrap.test.mjs
  development-export.test.mjs
artifacts/catalyst-development/   # ignored remote exports/evidence
```

## Task 1: Add deployment ledger and fail-closed preflight

**Files:**
- Create: `config/catalyst-development.json`
- Create: `docs/deployment/catalyst-development-ledger.md`
- Create: `scripts/catalyst/preflight.mjs`
- Create: `tests/catalyst/preflight.test.mjs`
- Modify: `package.json`
- Modify: `.gitignore`

- [ ] **Step 1: Write failing preflight tests**

Test these exact invariants:

```js
assert.equal(result.projectId, '43492000000013049');
assert.equal(result.environment, 'Development');
assert.equal(result.sourceTableCount, 29);
assert.equal(result.intelligenceTableCount, 21);
assert.equal(result.apiOperationCount, 12);
assert.equal(result.syntheticOnly, true);
assert.equal(result.git.clean, true);
assert.throws(() => preflight({ ...fixture, projectId: 'wrong' }), /project/i);
assert.throws(() => preflight({ ...fixture, environment: 'Production' }), /Production/i);
assert.throws(() => preflight({ ...fixture, syntheticOnly: false }), /synthetic/i);
```

- [ ] **Step 2: Run the focused test and observe RED**

Run: `node --test tests/catalyst/preflight.test.mjs`  
Expected: FAIL because `scripts/catalyst/preflight.mjs` does not exist.

- [ ] **Step 3: Implement deterministic configuration and preflight**

`config/catalyst-development.json` contains only non-secret values:

```json
{
  "projectId": "43492000000013049",
  "projectName": "KSPDatathon2026",
  "organizationId": "60077844198",
  "environmentId": "60077844198",
  "environment": "Development",
  "cliMinimumVersion": "1.27.0",
  "syntheticOnly": true,
  "permissionVersion": "1.0.0",
  "apiFunction": "crime_intelligence_api",
  "refreshFunction": "intelligence_refresh"
}
```

`preflight.mjs` reads `.catalystrc`, both schema manifests, `src/backend/http/api-contract.mjs`, Git status and `catalyst --version`; it emits JSON only after every invariant passes. It rejects a dirty tree for remote mode and rejects any environment other than Development.

- [ ] **Step 4: Create the ledger header**

Use fixed columns:

```markdown
| IST time | Commit | Checkpoint | Remote mutation | Resources/IDs | Verification | Rollback | Verdict |
|---|---|---|---|---|---|---|---|
```

Add the approved project/environment and the rule that secrets and personal invitation addresses are never recorded.

- [ ] **Step 5: Add commands and ignore remote artifacts**

Add scripts:

```json
"catalyst:preflight": "node scripts/catalyst/preflight.mjs",
"catalyst:preflight:remote": "node scripts/catalyst/preflight.mjs --remote"
```

Ignore `artifacts/catalyst-development/`, Function-local `node_modules/`, temporary bundles, login/session material and local secret files.

- [ ] **Step 6: Verify, align and commit**

Run:

```powershell
node --test tests/catalyst/preflight.test.mjs
npm.cmd test
npm.cmd run catalyst:preflight
powershell.exe -NoProfile -ExecutionPolicy Bypass -File skills/reviewing-challenge-alignment/scripts/check-required-files.ps1
git diff --check
```

Commit: `chore: add Catalyst Development preflight`

## Task 2: Initialize reproducible Catalyst Function scaffolding

**Files:**
- Create/modify through Catalyst CLI: `catalyst.json`
- Create: `functions/crime_intelligence_api/catalyst-config.json`
- Create: `functions/crime_intelligence_api/index.cjs`
- Create: `functions/crime_intelligence_api/package.json`
- Create: `functions/intelligence_refresh/catalyst-config.json`
- Create: `functions/intelligence_refresh/index.cjs`
- Create: `functions/intelligence_refresh/package.json`
- Test: `tests/catalyst/bundle.test.mjs`

- [ ] **Step 1: Record the exact pre-scaffold state**

Run `npm.cmd run catalyst:preflight:remote` and append a non-mutation ledger row for CLI `1.27.0`, project ID and branch commit.

- [ ] **Step 2: Initialize Functions with the CLI**

Run `catalyst init` and select the existing linked project and Functions component. Create:

- Advanced I/O, Node.js 24, name/package `crime_intelligence_api`, entry `index.cjs`;
- Job Function, Node.js 18, name/package `intelligence_refresh`, entry `index.cjs`.

Use author `KSP Datathon` and non-routable metadata email `ksp-datathon@example.invalid`. Do not enter a personal address. If the second Function is not offered during init, run `catalyst functions:add`.

- [ ] **Step 3: Normalize generated manifests**

Set API dependencies to:

```json
{
  "express": "5.1.0",
  "zcatalyst-sdk-node": "^2.5.0"
}
```

Set Job dependencies to:

```json
{
  "zcatalyst-sdk-node": "^2.5.0"
}
```

Keep Catalyst-generated function type/runtime keys unchanged. Remove generated sample behavior and replace entries with fail-closed stubs returning `DATA_NOT_READY`/job failure until composition is implemented.

- [ ] **Step 4: Write and run scaffold tests**

Assert that `catalyst.json` declares exactly the two expected Functions, entries exist, API runtime is Node 24, Job runtime is Node 18, no personal email/domain is present, and no `node_modules` path is tracked.

Run: `node --test tests/catalyst/bundle.test.mjs`  
Expected: PASS.

- [ ] **Step 5: Verify and commit**

Run full tests, both runtime compatibility scripts, preflight and `git diff --check`.

Commit: `chore: scaffold Catalyst Functions`

## Task 3: Build self-contained deterministic Function bundles

**Files:**
- Create: `scripts/catalyst/build-functions.mjs`
- Create: `scripts/catalyst/inspect-bundle.mjs`
- Modify: `tests/catalyst/bundle.test.mjs`
- Modify: `package.json`

- [ ] **Step 1: Add failing bundle tests**

Require that a build:

- copies only runtime-required `src/backend`, `src/ingestion`, `src/synthetic`, access policy and the shared core;
- contains no fixtures, hidden truth, docs, Git metadata, tests, tokens or local artifacts;
- uses deterministic file ordering and hashes;
- produces a Node 24 API bundle and Node 18 Job bundle;
- resolves every relative and package import inside each Function root.

- [ ] **Step 2: Observe RED**

Run: `node --test tests/catalyst/bundle.test.mjs`  
Expected: FAIL because the builder is absent.

- [ ] **Step 3: Implement bundling**

Expose:

```js
buildFunctionBundle({ target: 'api' | 'refresh', repositoryRoot, functionRoot });
inspectBundle({ functionRoot, forbiddenPatterns });
```

Copy `packages/intelligence-core` to `app/vendor/intelligence-core`, rewrite its local package dependency in the Job bundle, and copy only modules reachable from `api-bootstrap.mjs` or `refresh-bootstrap.mjs`. Write `app/bundle-manifest.json` with relative path, SHA-256 and byte size. Do not write timestamps into tracked/generated content.

- [ ] **Step 4: Verify Node runtimes**

Run bundle inspection under Node 24 and the refresh imports/tests under `npx --yes node@18.20.8`.

- [ ] **Step 5: Commit**

Commit: `build: package deterministic Catalyst Functions`

## Task 4: Implement Catalyst SDK trust boundary and paginated primitives

**Files:**
- Create: `src/backend/repository/catalyst/sdk-context.mjs`
- Create: `src/backend/repository/catalyst/sdk-errors.mjs`
- Create: `src/backend/repository/catalyst/paged-table.mjs`
- Create: `src/backend/repository/catalyst/row-mapper.mjs`
- Create: `tests/catalyst/sdk-context.test.mjs`
- Create: `tests/catalyst/paged-table.test.mjs`

- [ ] **Step 1: Write failing trust-boundary tests**

Prove:

```js
await context.getCurrentUser();                 // user-scoped initialization first
assert.equal(adminInitializeCalls, 0);          // before authorization
await context.authorize(profile);
assert.equal(adminInitializeCalls, 1);          // repository scope only afterwards
```

Reject null/inactive Catalyst users, caller-provided identity fields, wrong profile user ID and wrong permission version. Verify SDK errors are reduced to stable internal codes without SDK message, token, table ID, `ROWID` or stack leakage.

- [ ] **Step 2: Write failing pagination tests**

Mock `getPagedRows({ nextToken, maxRows })` across three pages. Assert bounded `maxRows <= 200`, opaque token handling, deterministic accumulation and no `getAllRows()` call.

- [ ] **Step 3: Implement primitives**

`createCatalystSdkContext({ request, sdk, policyVersion })` initializes user scope, calls `userManagement().getCurrentUser()`, and exposes an admin repository application only after `authorize()` succeeds.

`readPagedRows({ table, maxRows, maxPages, nextToken })` uses SDK v2 pagination and rejects page/token anomalies.

`mapCatalystRow()` strips Catalyst metadata unless a repository operation explicitly requires `ROWID` for internal reference resolution.

- [ ] **Step 4: Verify and commit**

Run focused tests, full suite, credential scan and challenge gate.

Commit: `feat: add Catalyst SDK trust boundary`

## Task 5: Persist fragmented synthetic source rows safely

**Files:**
- Create: `scripts/catalyst/source-row-projector.mjs`
- Create: `src/backend/repository/catalyst/source-writer.mjs`
- Create: `tests/catalyst/source-writer.test.mjs`
- Modify: `src/backend/repository/contract.mjs`
- Modify: `src/backend/repository/memory-repository.mjs`
- Modify: `src/backend/refresh/refresh-service.mjs`

- [ ] **Step 1: Extend the contract test-first**

Add:

```js
persistValidatedSource({ batchKey, source, accepted, rejected, reconciliation });
getValidatedSource(batchKey);
```

The memory implementation remains deterministic and idempotent.

- [ ] **Step 2: Test manifest-driven row projection**

For all 26 entities, assert exact PDF columns, `SyntheticData=true`, `SourceBatchID`, business IDs and no fabricated `ROWID`. Test that relationship `*Ref` values are added only after parent rows return real Catalyst `ROWID`s. Reject an unresolved mandatory parent and never match people by name.

- [ ] **Step 3: Implement ordered bounded writes**

Drive load order and relationships from `schema/catalyst/source-schema.json`. Insert parents in batches of at most 200 using `insertRows()`, record business-key/ROWID mappings in `TRN_SourceKeyMap`, then populate child Foreign Keys. Write rejected metadata only to `TRN_IngestionReject`; never persist rejected raw rows.

Repeat `batchKey` returns stored reconciliation and inserts zero duplicate rows.

- [ ] **Step 4: Connect refresh bootstrap**

`BOOTSTRAP_SYNTHETIC` calls `persistValidatedSource()` before analytics publication. `REFRESH_INTELLIGENCE` loads the accepted batch through `getValidatedSource()` and does not silently regenerate different source data.

- [ ] **Step 5: Verify and commit**

Commit: `feat: persist validated synthetic FIR sources`

## Task 6: Implement Catalyst repository reads

**Files:**
- Create: `src/backend/repository/catalyst/catalyst-repository.mjs`
- Create: `tests/catalyst/repository-reads.test.mjs`

- [ ] **Step 1: Write failing contract/read tests**

Use a fake Catalyst SDK and verify every read method in `repositoryMethods`. Cover:

- complete seven-type current-group selection;
- partial/newer group rejection;
- bounded pattern/hotspot/anomaly pagination;
- pattern/evidence/alert joins by business ID and internal `ROWID` references;
- person-network and repeat-appearance reconstruction;
- aggregate district context;
- access profile, unit hierarchy and effective assignment lookup;
- no `SELECT *` for sensitive evidence;
- sanitized ZCQL errors.

- [ ] **Step 2: Implement allowlisted queries and row assembly**

Use a frozen table-name map and fixed query templates. Only validated business IDs, integer versions, repository-resolved `ROWID`s and opaque pagination tokens enter queries. Keep disclosure projection outside the repository.

- [ ] **Step 3: Prove parity with memory repository**

Feed equivalent mock rows to both repositories and assert the eight read-service envelopes are semantically equal after removing request timestamp/ID.

- [ ] **Step 4: Verify and commit**

Commit: `feat: read intelligence from Catalyst Data Store`

## Task 7: Implement Catalyst workflow and refresh writes

**Files:**
- Modify: `src/backend/repository/catalyst/catalyst-repository.mjs`
- Create: `tests/catalyst/repository-writes.test.mjs`

- [ ] **Step 1: Write failing write/recovery tests**

Cover every write method, unique-key collision, command replay, domain-artifact uniqueness, `ROWID` FK resolution, HMAC audit insert, seven-run staging/publication and reconciliation.

Inject failures after command create, artifact insert, alert CAS, audit insert, command completion, source batch write and refresh publication. Retrying must converge without duplicate effective assignments or audit forks.

- [ ] **Step 2: Implement bounded inserts/updates**

Use `insertRow()`/bounded `insertRows()` and `updateRow()` only with repository-resolved `ROWID`. Preserve raw business identifiers in application columns and Catalyst references in `*Ref` columns.

- [ ] **Step 3: Implement ZCQL compare-and-swap**

Reuse `buildAlertCompareAndSwap()`. Execute through ZCQL v2, then re-read the alert and require target state, `expectedVersion+1` and this command reference when affected-row count is unavailable.

- [ ] **Step 4: Implement coherent publication**

Stage all findings/runs with non-current status. After validation, publish all seven runs and update the refresh batch. API current-group selection remains predicate-based rather than relying on a mutable global pointer.

- [ ] **Step 5: Verify and commit**

Commit: `feat: write recoverable Catalyst workflows`

## Task 8: Compose the Node.js 24 Advanced I/O Function

**Files:**
- Create: `src/backend/catalyst/runtime-config.mjs`
- Create: `src/backend/catalyst/api-bootstrap.mjs`
- Create: `tests/catalyst/api-bootstrap.test.mjs`
- Modify: `functions/crime_intelligence_api/index.cjs`
- Modify: `scripts/catalyst/build-functions.mjs`

- [ ] **Step 1: Write failing composition tests**

Mock Catalyst SDK initialization and Express request/response. Verify exact method/path normalization, request ID, query/header/body mapping, current-user lookup, safe response status/body, JSON content type, no identity-header trust and startup failure when configuration is missing.

- [ ] **Step 2: Implement fail-closed runtime configuration**

Require environment values `KSP_ENVIRONMENT=Development`, `KSP_PROJECT_ID=43492000000013049`, `KSP_AUDIT_KEY`, `KSP_AUDIT_KEY_VERSION`, and `KSP_PERMISSION_VERSION=1.0.0`. Reject Production, absent keys and project mismatch. Never log values.

- [ ] **Step 3: Compose existing services**

`createApiApplication({ sdk, request, config, clock, idFactory })` builds the Catalyst context/repository, access resolver, read services, command service, access-audit service and dispatcher. `index.cjs` dynamically imports the bundled ESM bootstrap and exports the Advanced I/O handler.

- [ ] **Step 4: Serve locally**

Run:

```powershell
npm.cmd run catalyst:build
catalyst.cmd serve --only functions:crime_intelligence_api
```

Verify an unauthenticated approved route returns the safe `401` contract and undeclared routes return `404`; no stack or config value appears.

- [ ] **Step 5: Verify and commit**

Commit: `feat: package Catalyst intelligence API`

## Task 9: Compose the Node.js 18 refresh Job Function

**Files:**
- Create: `src/backend/catalyst/refresh-bootstrap.mjs`
- Create: `tests/catalyst/refresh-bootstrap.test.mjs`
- Modify: `functions/intelligence_refresh/index.cjs`
- Modify: `scripts/catalyst/build-functions.mjs`

- [ ] **Step 1: Write failing job tests**

Mock `jobDetails.getJobParam()` and permit only the three approved operations. Require batch key/seed for bootstrap/refresh, reject non-synthetic flags, map success/failure to Job context, and never return source/person rows.

- [ ] **Step 2: Implement composition**

Initialize Catalyst server context, runtime config, Catalyst repository and existing refresh service. The handler calls `context.closeWithSuccess()` only after persisted reconciliation/publication; all failures call `context.closeWithFailure()` with a stable code and request/job ID, never a stack or SDK message.

- [ ] **Step 3: Verify under Node 18**

Run:

```powershell
npx.cmd --yes node@18.20.8 --test tests/catalyst/refresh-bootstrap.test.mjs tests/backend/refresh.test.mjs tests/compat/node18-core.test.mjs
npm.cmd run catalyst:build
npm.cmd run catalyst:inspect
```

- [ ] **Step 4: Commit**

Commit: `feat: package Catalyst intelligence refresh job`

## Task 10: Create and verify the 21 Development tables

**Files:**
- Modify: `docs/deployment/catalyst-development-ledger.md`
- Create ignored evidence under: `artifacts/catalyst-development/schema/`

- [ ] **Step 1: Create the pre-mutation checkpoint**

Run full tests, both schema validators, preflight remote, bundle inspection, credential scan and challenge alignment. Append a ledger row stating the exact commit and intended 21-table console mutation. Commit the ledger before opening the console.

Commit: `docs: authorize Catalyst intelligence schema checkpoint`

- [ ] **Step 2: Create tables through the in-app browser**

Open Catalyst Development Data Store and follow `docs/runbooks/catalyst-intelligence-tables.md` strictly in `loadOrder`. For each table:

1. Create the exact name.
2. Add every manifest column with exact type/length/default/index/mandatory/unique/PII setting.
3. Add Foreign Keys only after parent tables exist, with `On Delete = Null`.
4. Deny direct app-user table permissions; Functions access through the controlled repository.
5. Record table ID in ignored evidence, not in source manifests.

Do not seed rows and do not delete or modify the existing 29 tables.

- [ ] **Step 3: Export and compare**

Trigger Catalyst IaC export from the console, download it to the ignored schema evidence folder, and run the backend export comparer. Expected: exactly 21 backend tables match their manifest while the existing source comparer remains green.

- [ ] **Step 4: Record and commit evidence**

Append created resource IDs, export job ID/hash, comparison result and additive rollback rule to the ledger.

Commit: `docs: verify Catalyst intelligence schema`

## Task 11: Configure secret input and deploy both Functions

**Files:**
- Modify: `docs/deployment/catalyst-development-ledger.md`
- Ignored evidence: `artifacts/catalyst-development/functions/`

- [ ] **Step 1: Secure attended configuration**

Pause for the user to enter a newly generated high-entropy HMAC key directly in Catalyst Function environment configuration. Configure the same active key/version for API and Job Functions without displaying the value. Set the non-secret values from `config/catalyst-development.json`.

The user confirms only that configuration is saved; the value is never read back into chat, terminal output or evidence.

- [ ] **Step 2: Pre-deploy gate**

Commit a ledger authorization row for the exact bundle-manifest hashes.

Commit: `docs: authorize Catalyst Function deployment`

- [ ] **Step 3: Deploy targeted Functions**

Run the targeted Catalyst deploy command for `crime_intelligence_api` and `intelligence_refresh`. Never use a broad Production deploy flag. Capture only non-secret deployment output/resource IDs in ignored evidence.

- [ ] **Step 4: Remote negative smoke**

Before Authentication/API Gateway, call only an approved API Function route. It must fail closed (`401` or `DATA_NOT_READY` according to Catalyst invocation identity) and must not expose a stack. Verify Job Function exists but do not bootstrap yet.

- [ ] **Step 5: Record and commit**

Commit: `docs: verify Catalyst Function deployment`

## Task 12: Bootstrap synthetic source and coherent intelligence

**Files:**
- Modify: `docs/deployment/catalyst-development-ledger.md`
- Ignored evidence: `artifacts/catalyst-development/bootstrap/`

- [ ] **Step 1: Create Function Job Pool**

In Catalyst Development, create `intelligence_refresh_pool` targeting the deployed Job Function with memory greater than the Function allocation. Do not create a recurring Production schedule.

- [ ] **Step 2: Authorize bootstrap**

Run all local validators/evaluation gates and commit a ledger row containing seed `20260720`, expected 50 `CaseMaster` rows, 26 entities, source/reconciliation hashes and the exact deployed commit.

Commit: `docs: authorize synthetic Catalyst bootstrap`

- [ ] **Step 3: Execute one Development bootstrap job**

Submit operation `BOOTSTRAP_SYNTHETIC`, batch key `KSP-DEMO-20260720-V1`, seed `20260720`, and `syntheticOnly=true` through the Function Job Pool.

- [ ] **Step 4: Verify persisted results**

Export/query counts and prove:

- 50 unique source cases across all 26 entities;
- reconciliation balances with redacted rejects;
- no non-synthetic row;
- exactly seven complete published analysis runs in one group;
- one planted hotspot, anomaly and cross-district pattern;
- repeat-person and co-accused network evidence;
- aggregate district correlation and area-risk explanation;
- no workflow/audit history created before user actions.

- [ ] **Step 5: Record and commit**

Commit: `docs: verify synthetic Catalyst bootstrap`

## Task 13: Configure Catalyst Native Authentication and access profile

**Files:**
- Modify: `docs/deployment/catalyst-development-ledger.md`
- Ignored evidence: `artifacts/catalyst-development/auth/`

- [ ] **Step 1: Configure closed Development authentication**

In the browser console, enable Catalyst Native Authentication without uncontrolled public signup. Create/retain the minimum App User role required for API Gateway authentication. Direct Data Store permissions remain denied.

- [ ] **Step 2: Secure attended demo-user invitation**

Pause for the user to enter one personal Development demo address directly into Catalyst Authentication. Never record the address. The user accepts/confirms the invitation outside Codex.

- [ ] **Step 3: Insert the access profile**

After obtaining the Catalyst application `user_id`, insert one synthetic `CFG_UserAccess` profile as `DEMO_PRESENTER`, state scope, permission version `1.0.0`, `DemoPersonaAllowed=true`, `SyntheticData=true`. Store the Catalyst user ID as PII and never expose it in API responses/ledger.

- [ ] **Step 4: Verify identity boundaries**

Prove unauthenticated access fails; authenticated presenter without persona has no policing actions; allowlisted Development persona works; Production persona assumption fails in local tests; spoofed identity headers are ignored; persona assumption creates HMAC audit evidence.

- [ ] **Step 5: Record and commit**

Commit: `docs: verify Catalyst Development authentication`

## Task 14: Configure the exact twelve API Gateway routes

**Files:**
- Create: `config/catalyst-api-gateway.json`
- Create: `tests/catalyst/api-gateway-contract.test.mjs`
- Modify: `docs/deployment/catalyst-development-ledger.md`

- [ ] **Step 1: Generate/test route configuration**

Generate from `API_OPERATIONS`, not a duplicate hand-maintained list. Assert exact method/path/function target, Catalyst Users Authentication, read/write throttle groups and no wildcard/direct route.

- [ ] **Step 2: Commit pre-mutation configuration**

Commit: `feat: declare Catalyst API Gateway routes`

- [ ] **Step 3: Enable/configure API Gateway in browser**

Create the exact twelve routes targeting `crime_intelligence_api`, enable Catalyst Users Authentication, and apply the approved throttle values. Do not expose `/internal`, wildcard or raw Function paths.

- [ ] **Step 4: Verify boundary**

Export/inspect Gateway rules and run unauthenticated, authenticated, undeclared-path, wrong-method and direct-Function-URL smoke tests. Only declared authenticated paths may reach business dispatch.

- [ ] **Step 5: Record and commit**

Commit: `docs: verify Catalyst API Gateway boundary`

## Task 15: Run remote read and workflow acceptance

**Files:**
- Create: `scripts/catalyst/remote-smoke.mjs`
- Create: `tests/catalyst/remote-smoke-contract.test.mjs`
- Modify: `docs/deployment/catalyst-development-ledger.md`
- Create: `docs/reviews/2026-07-20-catalyst-development-acceptance.md`

- [ ] **Step 1: Implement a non-secret smoke runner**

The runner receives session/auth material only through the process environment, never command arguments/files/logs. It redacts headers and records request ID, route, status, response schema/hash and synthetic label. It refuses Production hosts.

- [ ] **Step 2: Verify eight read operations**

As the authenticated demo presenter with allowlisted personas, prove:

- executive brief;
- pattern list/detail with cross-district redaction;
- hotspots;
- anomalies;
- area risk;
- case and person network/repeat appearances;
- district context correlation;
- denied sibling/out-of-scope request.

- [ ] **Step 3: Verify complete workflow**

Execute assignment, acknowledgement, analyst conclusion and outcome using the required persona at each step. Verify version increments, immutable original finding, one domain artifact per successful command, idempotent replay, different-request key conflict, persisted audit chain and rejection of a premature/concurrent command.

- [ ] **Step 4: Export and reconcile final state**

Verify table counts, seven-run coherence, command/artifact/audit counts, HMAC verification, no incomplete retryable command, no raw idempotency key, no secrets and no real-person row.

- [ ] **Step 5: Run final local and challenge gates**

Run:

```powershell
npm.cmd run compat:node18
npm.cmd run compat:node24
npm.cmd test
npm.cmd run schema:validate
npm.cmd run intelligence-schema:validate
npm.cmd run intelligence:demo
npm.cmd run catalyst:preflight:remote
npm.cmd run catalyst:inspect
powershell.exe -NoProfile -ExecutionPolicy Bypass -File skills/reviewing-challenge-alignment/scripts/check-required-files.ps1
git diff --check
```

- [ ] **Step 6: Write exact challenge-alignment acceptance review**

Use `skills/reviewing-challenge-alignment/references/output-template.md`. Distinguish Development deployment from Production readiness. A WARN or FAIL blocks completion and any Production discussion.

- [ ] **Step 7: Record and commit**

Commit: `docs: accept Catalyst Development vertical slice`

## Task 16: Push reviewed branch without enabling CI/CD

**Files:**
- Modify: `docs/deployment/catalyst-development-ledger.md` only if the push result is recorded

- [ ] **Step 1: Confirm clean accepted state**

Require final PASS, clean tree, no secret patterns, all ledger rows committed and remote Development acceptance evidence complete.

- [ ] **Step 2: Push branch**

Push `codex/catalyst-development` to GitHub. Do not connect Catalyst Pipelines and do not enable automatic deployment.

- [ ] **Step 3: Record next gate**

Document that GitHub/Catalyst Pipelines requires a separate CI/CD design with branch protection, secret storage, manual Development approval and no Production target.

Commit any resulting ledger note before the final push.

## Plan self-review

- Every remote mutation has a committed pre-mutation checkpoint and post-mutation evidence commit.
- Browser-only schema/authentication/API Gateway steps are explicit and followed by export/smoke verification.
- Catalyst Native Authentication is implemented for Development; Entra remains a confirmed-production-option gate rather than a claim.
- The API remains exactly twelve operations; no temporary health/admin endpoint is introduced.
- Source bootstrap uses real Catalyst `ROWID` values and manifest relationships, never fabricated identifiers.
- No Function depends on files outside its deployable root.
- Node.js 18 and Node.js 24 requirements are independently verified.
- Secrets and invitation addresses require attended user entry and never enter Codex-visible artifacts.
- GitHub integration is deferred until manual Development deployment passes.
- Production, real KSP data, UI, QuickML and on-premises integration remain excluded.

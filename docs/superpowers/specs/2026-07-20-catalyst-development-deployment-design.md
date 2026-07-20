# Catalyst Development Deployment Design

**Project:** KSP Crime Decision Intelligence Platform  
**Catalyst project:** `KSPDatathon2026` (`43492000000013049`)  
**Organization/environment:** `60077844198` / Development  
**Branch:** `codex/catalyst-development`  
**Status:** Approved design for controlled Catalyst Development implementation

## 1. Purpose

This phase converts the verified framework-independent backend into a working Catalyst Development application. It must prove that the platform reads and writes Catalyst Data Store records, authenticates through Catalyst, serves the exact twelve Challenge 02 APIs, runs analytics outside HTTP requests, preserves geographic disclosure controls, and records accountable workflow/audit evidence.

This phase is production-shaped, not a Production deployment. It uses synthetic data only and does not connect to KSP systems, Microsoft Entra, real-person records, CCTV, social feeds, or on-premises databases.

## 2. Delivery approach

Use an incremental vertical-slice deployment. Every checkpoint is implemented locally, tested, challenge-reviewed, committed, recorded in the Development deployment ledger, deployed, and remotely verified before the next checkpoint begins.

Rejected approaches:

- A single large deployment delays integration evidence and makes rollback unclear.
- Console-only implementation would leave remote configuration unreproducible.
- Returning bundled JSON would bypass Catalyst Data Store and would not prove the platform architecture.
- Creating Production resources before Development acceptance would weaken environment isolation.

## 3. Target architecture

### 3.1 Data Store

The existing 29 Development tables remain the source foundation: 26 PDF-aligned `SRC_*` tables and three ingestion-control `TRN_*` tables.

Create the approved 21 intelligence/workflow tables from `schema/catalyst/intelligence-schema.json`. The repository manifest remains authoritative. Remote schema exports must be compared with the manifest before seeding or deploying dependent code.

The physical boundary remains one Catalyst Data Store with logical zones:

- `SRC_*`: unchanged PDF-defined source entities plus Catalyst relationship references;
- `TRN_*`: ingestion controls, reusable features, person resolution and district context;
- `INT_*`: versioned runs, hotspots, anomalies, patterns, area risk, network and evidence;
- `WF_*`: alerts, commands, assignments, conclusions, outcomes and append-only audit events.

No complete duplicate of the source FIR database is created in transformed form.

### 3.2 API Function

Create one Node.js 24 Advanced I/O Function named `crime_intelligence_api`. It wraps the existing framework-independent dispatcher and exposes exactly the twelve operations in `src/backend/http/api-contract.mjs`.

The function performs only:

- request-scoped Catalyst SDK initialization;
- Catalyst current-user resolution;
- access-profile, role, unit and assignment authorization;
- request validation and safe error translation;
- prepared intelligence reads;
- short workflow writes and audit appends.

Analytics never execute inside an HTTP request. Catalyst documents a 30-second maximum for Advanced I/O Functions, so the API remains bounded and query-oriented. Express may be used only as the transport adapter; business behavior remains in the tested modules.

### 3.3 Refresh Job Function

Create one Node.js 18 Job Function named `intelligence_refresh`. Current Catalyst Job Function documentation lists Node.js 18 for this function type. The shared analytics core and refresh service must therefore continue passing Node.js 18 tests even though the API Function uses Node.js 24.

The Job Function supports:

- `BOOTSTRAP_SYNTHETIC`;
- `REFRESH_INTELLIGENCE`;
- `RECONCILE_GOVERNANCE`.

It validates fragmented synthetic input, writes accepted/rejected reconciliation evidence, runs the analytics pipeline, stages seven analysis types, publishes only a coherent group, and reports incomplete commands or audit-chain defects without rewriting history.

### 3.4 Catalyst repository

Add `CatalystIntelligenceRepository` behind the existing repository contract. It uses `zcatalyst-sdk-node` version 2.5.0 or later, paginated Data Store/ZCQL access, bounded writes, safe fixed-table query construction, and explicit row/reference mapping.

Trust boundary:

1. Initialize a request-scoped user application and resolve the actual Catalyst user.
2. Reject null/inactive identity or inactive/mismatched `CFG_UserAccess` before protected data queries.
3. Initialize administrative repository scope only after the authorization decision.
4. Project every response through field-level disclosure rules.

The default administrative SDK scope must never be treated as user authorization.

### 3.5 API Gateway

Enable/configure API Gateway only after the API Function and Authentication are ready. Declare the exact twelve method/path pairs. Undeclared and direct paths must fail remote acceptance testing.

Apply Catalyst Users Authentication to every route. Configure initial throttling targets:

- reads: 120 requests/minute/user and 300 requests/minute/IP;
- workflow writes: 30 requests/minute/user and 60 requests/minute/IP.

Rate limits may be lowered after load testing but may not be disabled without a new review.

## 4. Authentication and future KSP federation

### 4.1 Development authentication

Use Catalyst Native Authentication for invited synthetic demo users. Public, uncontrolled user access is not part of the MVP. Catalyst supplies the authenticated user ID; `CFG_UserAccess` maps that ID to the synthetic employee, effective platform role, unit scope, permission version and demo-persona eligibility.

The API never accepts email, user ID, rank, designation, role, unit, or assignment from request headers/body as identity evidence.

### 4.2 Production identity boundary

KSP's actual identity provider is not confirmed. Microsoft Entra ID is recorded as the recommended production federation option, not as an implemented or claimed KSP dependency.

If KSP confirms Entra, prefer OpenID Connect for a new application. SAML 2.0 remains an alternative when required by KSP enterprise policy. Catalyst third-party authentication can exchange a successfully validated external identity for Catalyst authentication, with custom-user validation and an explicit allowlist.

Production federation requirements:

- tenant/issuer and audience allowlisting;
- authorization-code flow with PKCE for browser clients;
- state, nonce, signature, expiry and replay validation;
- KSP-controlled MFA and Conditional Access at the identity provider;
- disabled public self-enrolment without custom allowlisting;
- verified employee mapping before platform access;
- role/unit/assignment authorization inside the platform rather than trusting client or group claims alone;
- audited provisioning, de-provisioning and access changes;
- no Entra client secret, certificate or token in Git, chat, Data Store rows or browser code.

The stable platform identity interface prevents Catalyst Native Authentication and future Entra federation from changing policing authorization logic.

## 5. Data flow

```text
26 fragmented synthetic FIR extracts
  -> validation and reconciliation
  -> existing 29 SRC/TRN tables
  -> Node.js 18 intelligence_refresh Job Function
  -> seven coherent analysis runs and findings
  -> 21 TRN/INT/WF tables
  -> Node.js 24 crime_intelligence_api Function
  -> Catalyst Authentication + API Gateway
  -> role/unit/case-scoped response or accountable workflow action
```

The UI will consume prepared APIs. It will not calculate intelligence or bypass the API to read Data Store directly.

## 6. Failure and recovery rules

- A partial or inconsistent refresh never becomes current.
- The last complete published run remains readable after refresh failure.
- Bootstrap, refresh and workflow commands are idempotent.
- Workflow writes require expected alert state and integer version.
- A later alert command is blocked until the preceding command and audit event are complete.
- Assignment, conclusion, outcome, original finding and audit rows are append-only from the application perspective.
- Cross-district case/person identifiers are removed from all hidden nested fields, not merely UI elements.
- SDK/ZCQL failures become stable public errors without stack traces, tokens, table IDs or `ROWID`s.
- Schema mismatch blocks seed/deploy operations that depend on the schema.
- Audit-secret absence blocks startup or protected writes; no fallback key exists.
- Historical evidence tables are never automatically dropped during rollback.

## 7. Secrets and configuration

Server-only configuration contains the HMAC audit key and future identity-provider secrets. Secrets are supplied through Catalyst Function environment/configuration facilities and excluded from Git, deployment logs, API responses and Data Store.

Configuration validates:

- expected project ID `43492000000013049`;
- expected environment `Development`;
- permission-policy version;
- active audit-key version;
- synthetic-only bootstrap flag;
- declared table and API inventory.

Any project/environment mismatch stops deployment before mutation.

## 8. Deployment and commit governance

Create `docs/deployment/catalyst-development-ledger.md`. Each remote checkpoint records:

- timestamp in IST;
- branch and commit hash;
- intended change and affected Challenge 02 requirements;
- local verification commands/results;
- Catalyst CLI version and exact deploy/mutation commands;
- project/environment confirmation;
- created/updated resource names and IDs;
- remote smoke-test evidence;
- schema/export comparison evidence where applicable;
- failure details and corrective commit when applicable;
- rollback instructions;
- reviewer/alignment verdict.

Each commit has one purpose and remains independently reviewable. A remote mutation must correspond to a committed repository state. Failed deployments are recorded; history is never rewritten to hide them.

## 9. Checkpoint order

1. Repository/CLI scaffolding and environment guards.
2. Development ledger and deterministic deployment preflight.
3. Create/verify the 21 Data Store tables.
4. Implement/test Catalyst SDK repository adapters.
5. Package/serve the Node.js 24 Advanced I/O Function locally.
6. Deploy the API Function and verify controlled pre-auth behavior.
7. Package/test/deploy the Node.js 18 refresh Job Function.
8. Bootstrap only synthetic data and reconcile row counts.
9. Configure Catalyst Native Authentication synthetic users and access profiles.
10. Configure the twelve authenticated API Gateway routes and throttles.
11. Verify eight allowed/denied/scoped read operations.
12. Verify complete workflow, retry, idempotency and persisted HMAC audit evidence.
13. Export/compare final Development state and issue the Development acceptance review.

No later checkpoint proceeds after a failing local, alignment, schema or remote acceptance gate.

## 10. Verification requirements

Local evidence:

- full Node.js test suite;
- Node.js 18 refresh/core compatibility;
- Node.js 24 API/core compatibility;
- source and intelligence schema validators;
- Catalyst SDK boundary tests with paginated reads, bounded writes and sanitized errors;
- local Function serve tests;
- challenge-alignment review and clean credential scan.

Remote Development evidence:

- linked project/environment IDs match the approved target;
- 21-table manifest/export comparison passes;
- only synthetic rows exist;
- API Gateway rejects undeclared/direct routes;
- unauthenticated, inactive, wrong-role and cross-unit requests fail safely;
- one permitted and one denied geographic request behave correctly;
- cross-district patterns redact hidden case identifiers;
- current intelligence comes from one complete seven-type group;
- one alert completes assignment, acknowledgement, conclusion and outcome;
- idempotent replay returns the recorded response;
- command and HMAC audit records persist and verify;
- Function/Job logs contain no tokens, secrets, personal email or raw rejected records.

## 11. Rollback strategy

- Function rollback redeploys the last verified commit bundle.
- API Gateway rollback disables or restores the previous checked configuration without exposing direct Function URLs.
- Authentication rollback disables affected synthetic users/access profiles; it does not delete audit evidence.
- Seed rollback marks the synthetic batch inactive or superseded; it does not destructively erase historical workflow/audit rows.
- Schema rollback is additive by default. A created table is dropped only after explicit review confirms it contains no required evidence and no dependent resource.
- The ledger links every rollback to its triggering deployment and verification result.

## 12. Explicit exclusions

This phase does not implement the React SPA, map rendering, Production resources, QuickML deployment, real KSP/Entra federation, on-premises ingestion, real-person data, CCTV/social feeds, performance certification, disaster-recovery certification, or operational policing accuracy claims.

Those capabilities require separate designs and acceptance gates. Their absence must remain visible in status and pitch material.

## 13. Primary references

- [Catalyst Advanced I/O Functions](https://docs.catalyst.zoho.com/en/serverless/help/functions/advanced-io/)
- [Catalyst Job Functions](https://docs.catalyst.zoho.com/en/serverless/help/functions/job-functions/)
- [Catalyst Node.js SDK v2 overview](https://docs.catalyst.zoho.com/en/sdk/nodejs/v2/overview/)
- [Catalyst ZCQL v2 execution](https://docs.catalyst.zoho.com/en/sdk/nodejs/v2/cloud-scale/zcql/execute-zcql-query/)
- [Catalyst API Gateway concepts](https://docs.catalyst.zoho.com/en/cloud-scale/help/api-gateway/key-concepts/)
- [Catalyst Authentication](https://docs.catalyst.zoho.com/en/cloud-scale/help/authentication/introduction/)
- [Catalyst third-party authentication](https://docs.catalyst.zoho.com/en/cloud-scale/help/authentication/third-party-authentication/implementation/)
- [Microsoft Entra application/user authentication protocols](https://learn.microsoft.com/en-us/entra/architecture/authenticate-applications-and-users)

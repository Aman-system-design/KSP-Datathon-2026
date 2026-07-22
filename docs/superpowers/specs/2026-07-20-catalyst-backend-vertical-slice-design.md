# Catalyst Backend Vertical Slice Design

**Product:** KSP Crime Decision Intelligence Platform  
**Environment:** Catalyst Development, India data centre  
**Project ID:** `43492000000013049`  
**Status:** Production-shaped revision after implementation-readiness review
**Runtimes:** Advanced I/O API on Node.js 24; Job Function on Node.js 18

## 1. Purpose

This phase turns the verified local data bridge and intelligence engine into a real Catalyst backend. It must prove one complete operational path:

**authenticated user → authorized API → one coherently published intelligence run → scope-safe evidence drilldown → recoverable workflow command → audit event**

The backend must support all twelve APIs already locked in `docs/architecture/mvp-build-contract.md`. It remains Development-only and synthetic-only. UI, QuickML, Production deployment, and real KSP integration remain separate gates.

## 2. Chosen approach

Use one Catalyst Advanced I/O Node.js function named `crime_intelligence_api` with Express routing. Catalyst explicitly supports multiple APIs and Express inside an Advanced I/O function. This avoids deploying one function per route while retaining clean internal modules.

Use a separate Catalyst Job Function named `intelligence_refresh`, invoked through a Function Job Pool and later schedulable by Cron, for ingestion, feature generation, analytics, and persistence. Current Catalyst documentation lists Node.js 18 for Job Functions, so the shared analytics package must remain Node.js 18-compatible even though the API uses Node.js 24. No analytics model runs inside a dashboard request. Advanced I/O functions have a 30-second maximum timeout, so HTTP requests only authorize, query prepared data, perform short workflow writes, and append audit events.

Rejected alternatives:

- Multiple endpoint-specific functions create unnecessary routing, packaging, and deployment overhead for the deadline.
- AppSail is unnecessary because the API does not need a continuously running container or custom runtime.
- Returning bundled JSON from the deployed API would bypass Catalyst Data Store and would not prove the approved platform architecture.

## 3. Component boundaries

### 3.1 API function

`crime_intelligence_api` owns:

- Express route registration;
- Catalyst Authentication identity extraction;
- access-profile resolution;
- role, unit, and case-scope authorization;
- request validation;
- calls to a repository interface;
- response envelopes;
- workflow state transitions;
- append-only audit events;
- safe error translation.

Every public route is reached through an explicit API Gateway rule with Catalyst Users Authentication. The function first initializes the Catalyst SDK from the incoming request and calls `userManagement().getCurrentUser()`. A null user, non-active Catalyst user, missing access profile, or inactive access profile is rejected before any data query. The API never accepts a caller-supplied user ID, email, rank, role, or unit as identity evidence.

After identity and platform authorization pass, the repository may use an explicitly initialized server/admin-scoped SDK instance for cross-unit reads and controlled writes. This privilege is confined to repository code; all Data Store tables deny direct app-user access, and every returned field is projected through the authorization policy. The default SDK admin scope must never be used before the authorization decision.

It does not own ingestion, analytical calculations, synthetic generation, table creation, or UI rendering.

### 3.2 Refresh function

`intelligence_refresh` owns two explicit modes:

1. `BOOTSTRAP_SYNTHETIC` — Development-only, idempotently loads seed `20260720` into the 26 `SRC_*` tables, resolving Catalyst `ROWID` foreign keys after each parent insert.
2. `REFRESH_INTELLIGENCE` — reads accepted source records, builds the canonical intelligence input, runs the transparent engine, and writes versioned `TRN_*` and `INT_*` results.

The function inserts `TRN_IngestionBatch` first, records every source-business-key to Catalyst-`ROWID` mapping in `TRN_SourceKeyMap`, loads parent/master entities before dependent entities, and stores rejected rows in `TRN_RejectedRecord`. A failed batch is never marked completed.

The mode and batch identifier are required input fields. Repeating a completed batch returns its existing reconciliation record and does not duplicate data.

### 3.3 Repository boundary

The application code depends on an `IntelligenceRepository` contract, not directly on the Catalyst SDK.

- `MemoryIntelligenceRepository` supports fast local API and authorization tests using the verified fixture.
- `CatalystIntelligenceRepository` uses `zcatalyst-sdk-node`, table names, pagination, bounded inserts, conditional ZCQL v2 updates, and explicit reconciliation. It never assumes a multi-table transaction; incomplete refresh runs remain non-current and are excluded from API reads.

The Catalyst adapter uses paginated row retrieval. The deprecated `getAllRows()` method is prohibited. Insert operations use `insertRow()` or bounded `insertRows()` calls after the target tables and columns exist.

### 3.4 Shared runtime package

The reusable analytical and contract code is packaged once under `packages/intelligence-core/` with `engines.node` set to `>=18 <25`. The package contains no Catalyst entry point and no dependency on Express. Both functions vendor the same package during their build step; they never maintain copied analytical source files.

The Advanced I/O CommonJS entry point and Node.js 18 Job Function entry point load the ESM core through dynamic `import()`. The core receives repository and clock dependencies explicitly. A pinned Node.js 18 compatibility test runs the same source-to-intelligence pipeline used by the refresh function; passing only under the developer's Node.js 24 runtime is insufficient.

### 3.5 Permission policy

The route/action permission matrix is a versioned JSON file in source control. User-specific scope is stored in Catalyst Data Store. This separates stable product permissions from mutable account assignments.

Effective access is:

**authenticated Catalyst user + active access profile + allowed platform role/action + authorized unit hierarchy + case assignment when required**

Rank alone never grants access.

## 4. Data Store change

The previously approved 19 intelligence/workflow tables increase to 21 by adding `CFG_UserAccess` and `WF_Command`. Existing run, alert, assignment, conclusion, outcome, and audit entities also receive the fields below. These changes are required for authentication mapping, coherent publication, idempotency, optimistic concurrency, and recovery from partial multi-table writes.

### `CFG_UserAccess`

| Column | Type | Rule |
|---|---|---|
| `AccessProfileID` | Var Char(64) | Mandatory, unique, indexed application ID |
| `CatalystUserID` | Var Char(128) | Mandatory, unique, indexed, PII/ePHI enabled |
| `EmployeeID` | BigInt | Optional for a demo presenter; otherwise maps to original `EmployeeID` |
| `DefaultRole` | Var Char(48) | Mandatory, indexed; must exist in the permission policy |
| `ScopeUnitID` | BigInt | Mandatory, indexed; original `UnitID` business identifier |
| `DemoPersonaAllowed` | Boolean | Mandatory, default false |
| `PermissionVersion` | Var Char(32) | Mandatory, indexed |
| `Active` | Boolean | Mandatory, default true, indexed |
| `SyntheticData` | Boolean | Mandatory, default true |

No password, token, session, email body, or OAuth secret is stored in this table.

### `WF_Command`

`WF_Command` is the operation journal for every workflow mutation.

| Column | Type | Rule |
|---|---|---|
| `CommandID` | Var Char(64) | Mandatory, unique, indexed application ID |
| `IdempotencyKeyHash` | Var Char(64) | Mandatory, unique, indexed; SHA-256 of actual Catalyst user ID, route, and caller key |
| `RequestHash` | Var Char(64) | Mandatory; SHA-256 of canonical validated request and actor context |
| `AlertRef` | Foreign Key | Mandatory; parent `WF_Alert.ROWID`, On Delete Null |
| `ActorCatalystUserID` | Var Char(128) | Mandatory, indexed, PII/ePHI enabled |
| `EffectiveRole` | Var Char(48) | Mandatory, indexed |
| `CommandType` | Var Char(32) | Mandatory; `ASSIGN`, `ACKNOWLEDGE`, `CONCLUDE`, or `CLOSE` |
| `ExpectedAlertState` | Var Char(24) | Mandatory |
| `ExpectedAlertVersion` | Int | Mandatory |
| `TargetAlertState` | Var Char(24) | Mandatory |
| `Status` | Var Char(24) | Mandatory, indexed; `RECEIVED`, `EXECUTING`, `COMPLETED`, `FAILED_RETRYABLE`, or `FAILED_FINAL` |
| `ResponseJSON` | Text | Optional until completion; contains the safe prior response for retries |
| `ErrorCode` | Var Char(64) | Optional stable internal recovery code; never a stack trace |
| `CreatedAt` | DateTime | Mandatory |
| `CompletedAt` | DateTime | Optional |
| `SyntheticData` | Boolean | Mandatory, default true |

A reused key from the same actual Catalyst user and route with the same request hash returns the stored completed response or final conflict. The same scoped key with a different request hash returns `IDEMPOTENCY_CONFLICT`. Raw caller keys are never persisted. A retry of `RECEIVED`, `EXECUTING`, or `FAILED_RETRYABLE` resumes the recorded command by inspecting artifacts linked through `CommandRef`; it does not create a second command. A deterministic state/version conflict becomes `FAILED_FINAL` and replays the same `409` response.

### Coherent analysis publication

`INT_AnalysisRun` adds:

- `RunGroupID` — mandatory indexed identifier shared by one refresh;
- `AnalysisType` — mandatory indexed enum: `FEATURE_BUILD`, `HOTSPOT`, `ANOMALY`, `PATTERN`, `AREA_RISK`, `NETWORK`, or `IDENTITY_RESOLUTION`;
- `RunTypeKey` — mandatory unique indexed value computed as `RunGroupID:AnalysisType`;
- `PublishStatus` — mandatory indexed enum: `STAGED`, `PUBLISHED`, `SUPERSEDED`, or `FAILED`;
- `PublishedAt` — optional until publication;
- uniqueness of `(RunGroupID, AnalysisType)` enforced by the database through `RunTypeKey` and independently checked by the validator.

Every output row references its specific `INT_AnalysisRun`. A run group is publishable only when all seven required analysis types exist, have `Status=COMPLETED`, have `PublishStatus=PUBLISHED`, and share the same `InputManifestHash`, observation period, engine version, and run-group identifier. `INT_PublicationState` is the single durable read pointer: it stores the current seven run references, a monotonic `PublicationGeneration`, and a compare-and-swap `PointerVersion`. Readers capture that pointer once and use its explicit run references for every finding and evidence query. Publication advances the pointer only after the complete group is durable; partial groups remain invisible. Completion timestamps are descriptive and never decide ordering. The pointer also carries the latest refresh-attempt status so freshness polling is an indexed singleton read rather than a history scan.

The pointer is queried only through the unique indexed `PublicationStateID=CURRENT`. Batch recovery uses indexed `INT_AnalysisRun.BatchKey` with an eight-row hard guard (seven expected); finding/evidence reads use the `AnalysisRunRef` lookup with bounded 200-row pages and a 5,000-row fail-closed ceiling. After pointer commit, the generation is persisted onto all seven run rows, making retries safe across a crash on either side of the compare-and-swap.

### Workflow consistency fields

- `WF_Alert` adds mandatory integer `AlertVersion` (initial value `0`) and optional `LastCommandRef` to `WF_Command`.
- `WF_Assignment`, `WF_AnalystConclusion`, and `WF_Outcome` add mandatory `CommandRef` to `WF_Command`. `WF_AuditEvent.CommandRef` is mandatory for workflow events and null for authentication/read/governance events.
- `WF_Assignment` adds `AuthorizedUnitIDsJSON`, `AuthorizedCaseIDsJSON`, and `EvidenceAccessLevel`; these fields define explicit cross-unit evidence grants for an assigned analyst.
- `WF_AuditEvent` adds mandatory `StreamID`, `StreamSequence`, `HashAlgorithm`, and `HashKeyVersion`. For alert workflow events, `StreamID` is the alert business ID and `StreamSequence` equals the resulting alert version. Authentication, read, and governance events use the request ID as a standalone stream with sequence `1` and no previous hash, avoiding unsafe concurrent user-level chains.

### Demonstration persona rule

Because one builder must demonstrate several user journeys, an authenticated Development user whose active profile has `DefaultRole=DEMO_PRESENTER`, `DemoPersonaAllowed=true`, and `SyntheticData=true` may send `X-Demo-Persona` with one allowlisted synthetic role. The API records the actual Catalyst user, assumed persona, route, scope, and outcome in `WF_AuditEvent`.

Persona assumption is rejected unless all three profile conditions are true. It is always rejected outside Development. Production code defaults the feature off, even if a malformed profile sets the flag.

### Catalyst authentication and gateway boundary

- Define twelve explicit method-and-path entries in `catalyst-user-rules.json`; do not use an `ANY` catch-all route.
- Enable Catalyst Users Authentication on every entry. API key alone and unauthenticated access are prohibited.
- Before API Gateway is enabled, the generated Security Rules require authentication for every enabled Advanced I/O method.
- After API Gateway is enabled, only the twelve declared request paths are created. Catalyst makes undeclared function URLs inaccessible; remote smoke tests must confirm direct and undeclared paths fail.
- Resolve the actual caller only through `app.userManagement().getCurrentUser()` from the request-scoped SDK instance. A null result is `UNAUTHENTICATED`; it is never interpreted as a collaborator, administrator, system user, or demo presenter.
- Use `currentUser.user_id` as the `CFG_UserAccess.CatalystUserID` key. Email, request headers, query parameters, and OAuth collaborator headers never select the platform profile.
- The HTTP API does not accept the collaborator-only `ZC-OAUTH-USER: ADMIN` path. Administrative SDK scope is an internal repository capability after custom authorization, not a client authentication method.
- Configure general and IP throttling per route group: read routes 120 requests/minute/user and 300 requests/minute/IP; workflow routes 30 requests/minute/user and 60 requests/minute/IP. A later load test may lower these limits but cannot disable them without review.

## 5. API contract

### 5.1 Common response envelope

Successful reads return:

```json
{
  "data": {},
  "meta": {
    "requestId": "REQ-...",
    "scopeUnitId": 101,
    "observationPeriod": { "from": "2026-05-01", "to": "2026-07-01" },
    "analysisRunId": "RUN-...",
    "methodVersion": "1.0.0",
    "dataQualityStatus": "ACCEPTED",
    "syntheticData": true
  }
}
```

Significant findings additionally include evidence references, confidence or severity, recommendation, limitation, and method name. A generated brief may summarize only evidence returned by the repository.

### 5.2 Read routes

| Route | Required behavior |
|---|---|
| `GET /v1/intelligence/brief` | Role-scoped counts, leading findings, observation period, data quality, and evidence-linked executive summary. |
| `GET /v1/patterns` | Paginated pattern list filtered by authorized descendant units and time period. |
| `GET /v1/patterns/{patternId}` | One pattern with component scores, cases, districts, evidence, recommendation, and limitations. |
| `GET /v1/hotspots` | GeoJSON-compatible hotspots with method, radius, case count, severity, and evidence case IDs. |
| `GET /v1/anomalies` | Observed/baseline measures, expected range, severity, evidence, and seasonal-control status. |
| `GET /v1/area-risk` | Area/time-only score, exact components, completeness, method, evidence, and limitation. |
| `GET /v1/networks/{nodeId}` | Authorized evidence-labelled nodes and edges; similarity and inferred edges are visibly distinguished. |
| `GET /v1/district-context` | Aggregate context indicators with source label, period, comparison, and non-causality limitation. |

Every collection route accepts bounded `limit` and opaque `nextToken`. `limit` defaults to 50 and cannot exceed 200. Unit filters outside the caller's scope return `403`, not an empty successful result.

### 5.3 Cross-district disclosure policy

A user may discover that an authorized-unit case participates in a wider pattern without automatically receiving the other unit's case or person evidence.

- If no participating unit intersects the caller's geographic or assigned-case scope, the pattern is not listed and direct lookup returns `404`.
- If at least one participating unit is authorized, leadership and operational users receive full evidence only for authorized units. Other units are represented by district-level name/identifier, aggregate case count, broad observation period, and `accessLevel=AGGREGATE`.
- Out-of-scope evidence never returns case numbers, case IDs, person/node IDs, names, free text, legal details tied to a case, exact coordinates, station identifiers, or evidence object paths.
- Every partially disclosed response includes `redactedEvidenceCount`, `redactedUnitCount`, and `redactionReason=CROSS_UNIT_SCOPE`.
- A Crime Analyst receives cross-unit full evidence only when an active `WF_Assignment` for the alert explicitly lists the unit and case business identifiers and sets `EvidenceAccessLevel=CASE_EVIDENCE`. Geographic scope alone does not grant that exception.
- `GET /v1/networks/{nodeId}` returns `404` for an unauthorized node so the endpoint cannot be used to enumerate person or case identifiers.
- State Leadership may see statewide aggregates but receives person/case evidence only through an explicit alert assignment or separate permission; leadership rank does not bypass case-evidence controls.

### 5.4 Workflow routes and state rules

| Route | Allowed role | Valid transition |
|---|---|---|
| `POST /v1/alerts/{alertId}/assign` | District/Division Leadership or authorized Regional scope | Initial `GENERATED → ASSIGNED`; explicit reassignment is `ASSIGNED → ASSIGNED`, increments the alert version, and creates a new assignment/audit event without deleting history. |
| `POST /v1/alerts/{alertId}/acknowledge` | Assigned Analyst, Station, or Investigator | `ASSIGNED → ACKNOWLEDGED`; repeated identical request with the same idempotency key returns the prior result. |
| `POST /v1/alerts/{alertId}/analyst-conclusion` | Assigned Crime Analyst | `ACKNOWLEDGED → CONCLUDED`; conclusion is separate from immutable original finding. |
| `POST /v1/alerts/{alertId}/outcome` | Assigned operational officer or authorized District leader | `CONCLUDED → CLOSED`; outcome never rewrites the conclusion or model output. |

Each write requires `Idempotency-Key`, expected current state, expected integer alert version, structured reason or conclusion/outcome payload, and authenticated actor. Invalid state or version returns `409`. Missing idempotency key returns `400`.

### 5.5 Recoverable command protocol

Every workflow write executes the same protocol:

1. Canonicalize the validated payload plus actual actor, effective persona, route, alert ID, expected state, and expected version; compute `RequestHash`.
2. Insert or retrieve the unique `WF_Command`. Resolve idempotent completion/conflict before any domain write.
3. Require the preceding alert version's command and audit event to be complete; otherwise resume that command first or return `DATA_NOT_READY`.
4. Mark the command `EXECUTING`.
5. Insert the immutable assignment, conclusion, or outcome row with `CommandRef` when that command type requires one. Acknowledgement has no separate domain row.
6. Perform a ZCQL v2 compare-and-swap update: update `WF_Alert` to the target state, increment `AlertVersion`, and set `LastCommandRef` only where `AlertID`, current state, and current version equal the command's expected values. Exactly one matched row is success; zero rows is `INVALID_STATE` unless recovery proves this command already performed the update. If the Catalyst response does not expose an affected-row count, immediately re-read the alert and require the resulting version and `LastCommandRef` to match this command. The query builder accepts only repository-resolved `ROWID`s, integers, and allowlisted state values; arbitrary request text is never interpolated into ZCQL.
7. Append the `WF_AuditEvent` with the command reference, resulting version as `StreamSequence`, previous event hash, and current event hash.
8. Store the safe response in the command and mark it `COMPLETED`.

If steps 5-8 fail, the command becomes `FAILED_RETRYABLE`. A retry or the refresh/reconciliation job discovers existing artifacts by `CommandRef` and completes only missing steps. No later command for that alert is accepted until the prior version has a completed command and audit event. This serializes the alert stream, prevents audit-chain forks, and makes partial failure observable without pretending Catalyst supplies a multi-table transaction.

## 6. Authorization matrix

| Role | Read scope | Workflow actions |
|---|---|---|
| `STATE_LEADERSHIP` | State and all descendant units; aggregated or authorized evidence | None in this slice |
| `REGIONAL_LEADERSHIP` | Assigned region/commissionerate and descendants | Assign within scope |
| `DISTRICT_LEADERSHIP` | Assigned district/division and descendants | Assign and record authorized outcome |
| `CRIME_ANALYST` | Assigned analytical unit plus explicitly assigned alerts/cases | Acknowledge and submit analyst conclusion |
| `STATION_OPERATIONS` | Assigned station and explicitly assigned alerts/cases | Acknowledge and record operational outcome |
| `DEMO_PRESENTER` | No direct policing access; must assume an allowlisted synthetic persona under the Development rule | Actions of assumed persona, fully audited |
| `PLATFORM_ADMIN` | Technical health/configuration only; no case evidence by default | No policing workflow action |
| `AUDITOR` | Read-only audit, version, and access evidence | None |

Unit scope is resolved using `SRC_Unit.UnitID` and `ParentUnit`. The resolver rejects cycles and missing parents. Station/Investigator access requires both geographic scope and active assignment when case-level evidence is requested.

## 7. Error and audit contract

Errors return:

```json
{
  "error": {
    "code": "FORBIDDEN_SCOPE",
    "message": "The requested unit is outside the authorized scope.",
    "requestId": "REQ-..."
  }
}
```

Allowed public codes are `UNAUTHENTICATED` (401), `INACTIVE_ACCESS_PROFILE` (403), `FORBIDDEN_ACTION` (403), `FORBIDDEN_SCOPE` (403), `NOT_FOUND` (404), `INVALID_REQUEST` (400), `INVALID_STATE` (409), `IDEMPOTENCY_CONFLICT` (409), `COMMAND_IN_PROGRESS` (409), `DATA_NOT_READY` (503), and `INTERNAL_ERROR` (500).

Responses never expose stack traces, Catalyst tokens, internal table IDs, raw SDK errors, or unredacted rejected records. Server logs use request ID and stable error code.

Every authentication failure after identity resolution, sensitive read, persona assumption, workflow action, state conflict, and export-worthy evidence access creates an append-only `WF_AuditEvent`. Events contain the immutable command reference when applicable, stream sequence, previous event hash, and current event hash. `EventHash` is an HMAC-SHA-256 over canonical event content plus `PreviousEventHash`, using a versioned server-only Catalyst configuration secret that is never stored in Data Store, Git, logs, or responses. Corrections append a new event. A verification job detects missing sequence numbers, duplicate sequence numbers, HMAC mismatches, forks, and commands that lack their required audit event; it reports them as governance failures and never silently repairs historical content.

## 8. Local-first implementation sequence

1. Extend the manifest, validator, generated runbook, and tests from 19 to 21 tables; add coherent-run and workflow-consistency fields.
2. Extract `packages/intelligence-core/`, prove the pipeline under pinned Node.js 18, and consume the same package from Node.js 24.
3. Add the versioned permission policy, field-projection/redaction policy, and pure authorization/scope/state-transition modules.
4. Implement the repository contract, memory repository, command journal, compare-and-swap contract, and failure-recovery tests.
5. Implement the read services first and prove complete/partial/denied cross-district disclosure.
6. Implement the four workflow services and one complete command lifecycle with injected failures after each persistence step.
7. Initialize Catalyst Functions with the CLI: Node.js 24 Advanced I/O for the API and Node.js 18 Job Function for refresh; then wrap the tested services in their Catalyst entry points.
8. Implement and test the Catalyst repository using mocked SDK boundaries and ZCQL v2 compare-and-swap results.
9. Implement deterministic bootstrap, seven-type coherent publication, command reconciliation, and audit-chain verification in the refresh function.
10. Define twelve explicit authenticated API Gateway rules and run the challenge-alignment gate.
11. Create the 21 tables in Catalyst Development, configure Authentication, deploy functions, enable/configure API Gateway, seed only synthetic data, and run remote smoke tests.

Remote mutation begins only after the local suite, schema validators, security tests, and alignment review pass.

## 9. Verification requirements

Automated tests must prove:

- all twelve APIs match their request/response contract;
- all twelve API Gateway rules require Catalyst Users Authentication and no undeclared/`ANY` route exists;
- `getCurrentUser()` null, inactive Catalyst users, collaborator/admin headers, and caller-supplied identity fields fail closed;
- unauthenticated, inactive, wrong-role, outside-unit, and unassigned-case requests are denied;
- parent/descendant unit scope works and cyclic hierarchy fails closed;
- demo persona assumption is Development-only and audited;
- cross-district pattern responses expose full, aggregate/redacted, or no evidence exactly as the disclosure policy requires;
- pagination is bounded and stable;
- every significant finding exposes method, version, evidence, confidence/severity, recommendation, limitation, period, quality, and synthetic label;
- only a complete seven-analysis-type run group is readable and a failed refresh leaves the previous group current;
- the four workflow transitions, version compare-and-swap, idempotency conflict, retry, and command-response replay behavior;
- identical raw idempotency keys from different authenticated users do not collide, while the raw keys are never stored;
- ZCQL compare-and-swap construction rejects arbitrary identifiers, states, versions, and injection payloads;
- injected failure after every workflow persistence step converges to one domain record, one alert transition, one completed command, and one audit event;
- immutable original finding and append-only conclusion/outcome/audit behavior;
- audit-chain sequence, hash, missing-event, and fork detection;
- audit HMAC key material never appears in persisted events, logs, fixtures, Git, or API responses, and key-version verification supports rotation;
- Catalyst SDK errors are translated without leaking internals;
- bootstrap is deterministic and idempotent;
- clean seed reconciliation balances and corrupted rows remain rejected;
- the adapted pipeline still passes all positive and negative intelligence controls.
- the vendored analytical core passes under Node.js 18 and produces the same evaluation report under Node.js 24.

Remote acceptance requires successful `catalyst serve`, function deployment to Development, Authentication-protected calls, rejection of direct/undeclared paths, one allowed and one denied geographic-scope request, one partially redacted cross-district pattern, one complete alert lifecycle, idempotent replay, persisted command/audit evidence, one coherent published run group, and an exported Data Store comparison.

## 10. Explicit exclusions

This phase does not build the React SPA, maps, QuickML, Zia AutoML, live CCTV/social/event feeds, native tablet application, Production resources, real-person records, on-premises KSP connectivity, or operational accuracy claims.

## 11. Official Catalyst references

- [Advanced I/O Functions](https://docs.catalyst.zoho.com/en/serverless/help/functions/advanced-io/)
- [Functions Stack](https://docs.catalyst.zoho.com/en/serverless/help/functions/stack/)
- [Node.js SDK: Get Rows](https://docs.catalyst.zoho.com/en/sdk/nodejs/v2/cloud-scale/data-store/get-rows/)
- [Node.js SDK: Insert Rows](https://docs.catalyst.zoho.com/en/sdk/nodejs/v2/cloud-scale/data-store/insert-rows/)
- [Node.js SDK overview and explicit user/admin scopes](https://docs.catalyst.zoho.com/en/sdk/nodejs/v2/overview/)
- [Catalyst Authentication: Get Current User](https://docs.catalyst.zoho.com/en/sdk/nodejs/v2/cloud-scale/authentication/get-user-details/)
- [ZCQL v2 execution](https://docs.catalyst.zoho.com/en/sdk/nodejs/v2/cloud-scale/zcql/execute-zcql-query/)
- [API Gateway concepts and authentication](https://docs.catalyst.zoho.com/en/cloud-scale/help/api-gateway/key-concepts/)
- [Catalyst CLI command reference](https://docs.catalyst.zoho.com/en/cli/v1/cli-command-reference/)
- [Catalyst Job Functions](https://docs.catalyst.zoho.com/en/serverless/help/functions/job-functions/)
- [Catalyst Job Scheduling](https://docs.catalyst.zoho.com/en/job-scheduling/)

# Catalyst Backend Vertical Slice Design

**Product:** KSP Crime Decision Intelligence Platform  
**Environment:** Catalyst Development, India data centre  
**Project ID:** `43492000000013049`  
**Status:** Approved design for implementation planning  
**Runtimes:** Advanced I/O API on Node.js 24; Job Function on Node.js 18

## 1. Purpose

This phase turns the verified local data bridge and intelligence engine into a real Catalyst backend. It must prove one complete operational path:

**authenticated user → authorized API → persisted intelligence → evidence drilldown → accountable workflow action → audit event**

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
- `CatalystIntelligenceRepository` uses `zcatalyst-sdk-node`, table names, pagination, bounded inserts, and explicit reconciliation. It never assumes a multi-table transaction; incomplete refresh runs remain non-current and are excluded from API reads.

The Catalyst adapter uses paginated row retrieval. The deprecated `getAllRows()` method is prohibited. Insert operations use `insertRow()` or bounded `insertRows()` calls after the target tables and columns exist.

### 3.4 Permission policy

The route/action permission matrix is a versioned JSON file in source control. User-specific scope is stored in Catalyst Data Store. This separates stable product permissions from mutable account assignments.

Effective access is:

**authenticated Catalyst user + active access profile + allowed platform role/action + authorized unit hierarchy + case assignment when required**

Rank alone never grants access.

## 4. Data Store change

The previously approved 19 intelligence/workflow tables increase to 20 by adding `CFG_UserAccess`. This is necessary to map a Catalyst Authentication user to policing identity and scope.

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

### Demonstration persona rule

Because one builder must demonstrate several user journeys, an authenticated Development user whose active profile has `DefaultRole=DEMO_PRESENTER`, `DemoPersonaAllowed=true`, and `SyntheticData=true` may send `X-Demo-Persona` with one allowlisted synthetic role. The API records the actual Catalyst user, assumed persona, route, scope, and outcome in `WF_AuditEvent`.

Persona assumption is rejected unless all three profile conditions are true. It is always rejected outside Development. Production code defaults the feature off, even if a malformed profile sets the flag.

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

### 5.3 Workflow routes and state rules

| Route | Allowed role | Valid transition |
|---|---|---|
| `POST /v1/alerts/{alertId}/assign` | District/Division Leadership or authorized Regional scope | `GENERATED → ASSIGNED`; reassignment creates a new assignment and audit event without deleting history. |
| `POST /v1/alerts/{alertId}/acknowledge` | Assigned Analyst, Station, or Investigator | `ASSIGNED → ACKNOWLEDGED`; repeated identical request with the same idempotency key returns the prior result. |
| `POST /v1/alerts/{alertId}/analyst-conclusion` | Assigned Crime Analyst | `ACKNOWLEDGED → CONCLUDED`; conclusion is separate from immutable original finding. |
| `POST /v1/alerts/{alertId}/outcome` | Assigned operational officer or authorized District leader | `CONCLUDED → CLOSED`; outcome never rewrites the conclusion or model output. |

Each write requires `Idempotency-Key`, expected current state, structured reason or conclusion/outcome payload, and authenticated actor. Invalid state returns `409`. Missing idempotency key returns `400`.

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

Allowed public codes are `UNAUTHENTICATED` (401), `INACTIVE_ACCESS_PROFILE` (403), `FORBIDDEN_ACTION` (403), `FORBIDDEN_SCOPE` (403), `NOT_FOUND` (404), `INVALID_REQUEST` (400), `INVALID_STATE` (409), `IDEMPOTENCY_CONFLICT` (409), `DATA_NOT_READY` (503), and `INTERNAL_ERROR` (500).

Responses never expose stack traces, Catalyst tokens, internal table IDs, raw SDK errors, or unredacted rejected records. Server logs use request ID and stable error code.

Every authentication failure after identity resolution, sensitive read, persona assumption, workflow action, state conflict, and export-worthy evidence access creates an append-only `WF_AuditEvent`. Events contain a hash of the previous event within the same entity stream. Corrections append a new event.

## 8. Local-first implementation sequence

1. Extend the manifest, validator, generated runbook, and tests from 19 to 20 tables.
2. Add the versioned permission policy and pure authorization/scope/state-transition modules.
3. Implement the repository contract and memory repository.
4. Implement all twelve route handlers as framework-independent services and test them locally.
5. Initialize Catalyst Functions with the CLI: Node.js 24 Advanced I/O for the API and Node.js 18 Job Function for refresh; then wrap the tested services in their Catalyst entry points.
6. Implement and test the Catalyst repository using mocked SDK boundaries.
7. Implement the idempotent refresh/bootstrap function and reconciliation output.
8. Run the challenge-alignment gate.
9. Create the 20 tables in Catalyst Development, configure Authentication, deploy functions, enable/configure API Gateway, seed only synthetic data, and run remote smoke tests.

Remote mutation begins only after the local suite, schema validators, security tests, and alignment review pass.

## 9. Verification requirements

Automated tests must prove:

- all twelve APIs match their request/response contract;
- unauthenticated, inactive, wrong-role, outside-unit, and unassigned-case requests are denied;
- parent/descendant unit scope works and cyclic hierarchy fails closed;
- demo persona assumption is Development-only and audited;
- pagination is bounded and stable;
- every significant finding exposes method, version, evidence, confidence/severity, recommendation, limitation, period, quality, and synthetic label;
- the four workflow state transitions and idempotency behavior;
- immutable original finding and append-only conclusion/outcome/audit behavior;
- Catalyst SDK errors are translated without leaking internals;
- bootstrap is deterministic and idempotent;
- clean seed reconciliation balances and corrupted rows remain rejected;
- the adapted pipeline still passes all positive and negative intelligence controls.

Remote acceptance requires successful `catalyst serve`, function deployment to Development, Authentication-protected calls, one allowed and one denied geographic-scope request, one complete alert lifecycle, persisted audit evidence, and an exported Data Store comparison.

## 10. Explicit exclusions

This phase does not build the React SPA, maps, QuickML, Zia AutoML, live CCTV/social/event feeds, native tablet application, Production resources, real-person records, on-premises KSP connectivity, or operational accuracy claims.

## 11. Official Catalyst references

- [Advanced I/O Functions](https://docs.catalyst.zoho.com/en/serverless/help/functions/advanced-io/)
- [Functions Stack](https://docs.catalyst.zoho.com/en/serverless/help/functions/stack/)
- [Node.js SDK: Get Rows](https://docs.catalyst.zoho.com/en/sdk/nodejs/v2/cloud-scale/data-store/get-rows/)
- [Node.js SDK: Insert Rows](https://docs.catalyst.zoho.com/en/sdk/nodejs/v2/cloud-scale/data-store/insert-rows/)
- [Catalyst CLI command reference](https://docs.catalyst.zoho.com/en/cli/v1/cli-command-reference/)
- [Catalyst Job Functions](https://docs.catalyst.zoho.com/en/serverless/help/functions/job-functions/)
- [Catalyst Job Scheduling](https://docs.catalyst.zoho.com/en/job-scheduling/)

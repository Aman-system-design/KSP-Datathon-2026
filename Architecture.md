# Architecture

## Architectural Goal

Build a production-shaped, Catalyst-native decision-intelligence platform whose analytical outputs are computed from accepted records, evidence-linked, reproducible, role-scoped, and actionable.

## End-to-End Flow

```text
26 PDF-aligned synthetic source extracts
        ↓
SRC_* immutable source tables + Catalyst *Ref relationships
        ↓
semantic validation → accepted batch / redacted rejects / reconciliation
        ↓
TRN_* compact versioned features and governed identity resolution
        ↓
hotspot | anomaly | repeat identity | network | district context | area risk | pattern fusion
        ↓
INT_* completed analysis runs, findings, evidence, versions and limitations
        ↓
12 authenticated and unit-scoped APIs
        ↓
React role experiences: leadership | district | analyst | operations
        ↓
WF_* acknowledgement | assignment | analyst conclusion | outcome | audit
```

A UI card, chart, or alert never invents intelligence. It renders persisted outputs produced from the accepted batch.

## Data Boundaries

| Layer | Responsibility | Examples |
|---|---|---|
| `SRC_*` | PDF-faithful operational source projection | `SRC_CaseMaster`, `SRC_Accused`, `SRC_Unit` |
| Control | Batch, reject, reconciliation, quality, and provenance | accepted/rejected counts, checksum, synthetic marker |
| `TRN_*` | Reusable privacy-controlled features | case, location, person resolution, district context |
| `INT_*` | Immutable versioned analytical results | runs, hotspots, anomalies, patterns, area risk, network, repeat signals |
| `WF_*` | Human action and accountability | alerts, evidence, assignments, conclusions, outcomes, audit events |

`CaseMaster` remains the central source entity. Original PDF business identifiers remain intact; `*Ref` values contain Catalyst ROWIDs for physical relationships. Analytics join governed identifiers, never names.

## Runtime Components

### Ingestion and validation

- Project all 26 source entities with exact PDF columns and synthetic batch provenance.
- Write parents before children, map returned Catalyst ROWIDs, and replay idempotently.
- Validate business identifiers, chronology, relationships, semantics, coordinates, enums, and provenance.
- Persist redacted reject metadata and block analysis when the accepted batch is unsafe.

### Feature and analytics core

- Deterministic core logic lives outside Catalyst SDK adapters.
- Versioned features cover time, location, crime classification, quality, legal attributes, and controlled text signals.
- Seven coherently published run types form one current group: feature build, hotspot, anomaly, pattern, area risk, network, and identity resolution. Repeat-offender signals and district context are persisted under those governed outputs.
- Candidate generation or QuickML can narrow comparisons; transparent component scores and evidence determine published findings.
- Partial publication remains invisible. The prior complete group stays current until all required results verify.

### API and workflow

- `crime_intelligence_api` serves eight governed reads and four workflow writes.
- Authentication resolves the server-side profile before any admin SDK scope is unlocked.
- Authorization enforces permissions, unit descendants, evidence classification, and explicit analyst assignment.
- Workflow uses expected versions, idempotency keys, compare-and-swap, immutable artifacts, and HMAC-chained audit events.
- Errors expose stable codes and safe shapes only.

### Frontend

- React SPA with feature modules for leadership, district, analyst, and operations.
- Shared API contracts, session/access context, design tokens, maps, evidence drawers, and analytical components.
- Route loaders request governed data; components do not contain demo findings or scores.
- Details and personal evidence load only after scope checks, not as part of unrestricted aggregate payloads.

## Catalyst Service Map

| Capability | Catalyst service | MVP use |
|---|---|---|
| Relational source, feature, intelligence, workflow data | Data Store | Required and implemented in Development |
| Backend APIs and calculations | Serverless Functions | `crime_intelligence_api`, `intelligence_refresh` |
| API routing, throttling, protection | API Gateway | Required for public API boundary |
| Identity and sessions | Authentication | Required; Development persona is synthetic and allowlisted |
| SPA hosting | Slate or Web Client Hosting | Required when frontend is ready |
| Raw extracts/evidence objects | Stratus | Approved storage boundary |
| Refresh scheduling | Job Scheduling or Cron | Runs bounded bootstrap/refresh operations |
| Event reaction | Signals/Event Functions | Add only after stable ingestion needs event-driven refresh |
| Candidate ML and grounded generation | QuickML | Enhancement gate; never a substitute for transparent analytics |
| Deployment automation | Catalyst CLI/Pipelines | CLI-driven Development deployment; pipeline after stable build |

Zia AutoML is not committed for the India project. Availability and governance must be revalidated before use.

## Module Boundaries

```text
src/
  synthetic/          deterministic 50-FIR source generation
  ingestion/          PDF projection, validation, reconciliation
  backend/
    catalyst/         Catalyst composition and initialization
    repository/       repository contracts and Catalyst adapters
    security/         identity, permission and unit scope
    services/         governed read services
    refresh/          coherent analysis publication
    workflow/         state machine, commands and audit
    http/             route, body and response adapters

packages/
  intelligence-core/  deterministic analytical engines and evaluation

functions/
  crime_intelligence_api/
  intelligence_refresh/

schema/               PDF and Catalyst manifests/validators
fixtures/             synthetic records and separated hidden truth
scripts/              builds, Catalyst diagnostics and deployment controls
tests/                schema, analytics, API, security and Catalyst tests
docs/                 detailed architecture, specifications and runbooks
```

The frontend should be added as a separate feature-oriented application, not inside a Function bundle. No single module owns ingestion, analytics, authorization, workflow, and presentation.

## API Boundary

Reads:

- `GET /v1/intelligence/brief`
- `GET /v1/patterns`
- `GET /v1/patterns/{patternId}`
- `GET /v1/hotspots`
- `GET /v1/anomalies`
- `GET /v1/area-risk`
- `GET /v1/networks/{nodeId}`
- `GET /v1/district-context`

Writes:

- `POST /v1/alerts/{alertId}/acknowledge`
- `POST /v1/alerts/{alertId}/assign`
- `POST /v1/alerts/{alertId}/analyst-conclusion`
- `POST /v1/alerts/{alertId}/outcome`

The exact response, authorization, and workflow contract is maintained in [`docs/architecture/mvp-build-contract.md`](docs/architecture/mvp-build-contract.md).

## Current Delivery Truth — July 21, 2026

Functional and tested:

- PDF-aligned manifests for 26 source entities and Catalyst relationships.
- Deterministic 50-FIR fragmented synthetic dataset with planted positive and negative controls.
- Accepted source batch in Catalyst Development: 411 accepted rows, zero rejects.
- Persisted coherent analytical outputs and alert evidence.
- Two modular Catalyst Functions, governed read/workflow services, authorization, retry/idempotency, and audit logic.
- 171 automated tests passing locally.

Not yet complete:

- React frontend and Catalyst web hosting.
- Final API Gateway and Authentication user configuration for the role experiences.
- Jury-visible end-to-end browser journey and responsive design verification.
- QuickML enhancement, performance report, deployment rehearsal, video, and pitch evidence.
- Production identity federation, KSP on-premises integration, controlled pilot, and Production deployment are deferred.

## Failure and Recovery

- Failed ingestion blocks downstream analysis.
- Failed feature/analysis jobs leave the last complete version active.
- Invalid or incomplete run groups never become current.
- Retries use batch keys, checksums, expected versions, and idempotency keys.
- Invalid model/LLM output is rejected and recorded as unavailable.
- Insufficient baseline or location quality withholds the claim instead of manufacturing certainty.

## Detailed References

- [`docs/architecture/business-architecture-blueprint.md`](docs/architecture/business-architecture-blueprint.md)
- [`docs/architecture/ai-ml-intelligence-strategy.md`](docs/architecture/ai-ml-intelligence-strategy.md)
- [`docs/architecture/role-access-and-experience-design.md`](docs/architecture/role-access-and-experience-design.md)
- [`docs/architecture/challenge-traceability.md`](docs/architecture/challenge-traceability.md)
- [`docs/superpowers/specs/2026-07-21-pdf-semantic-data-integrity-design.md`](docs/superpowers/specs/2026-07-21-pdf-semantic-data-integrity-design.md)
- [`docs/deployment/catalyst-development-ledger.md`](docs/deployment/catalyst-development-ledger.md)

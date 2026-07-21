# Project Memory

This document is the shared memory for Datathon 2026 Challenge 02. Keep it updated as decisions, assumptions, data sources, and platform ideas evolve.

## Challenge

**Challenge 02: AI-Driven Crime Analytics & Visualization Platform**

Build a modern AI-powered platform that transforms fragmented police records into actionable intelligence. The product is positioned as **Decision Intelligence for District Policing**, not a generic dashboard or black-box predictive-policing system.

## Product Interpretation

The platform has four layers:

1. **Data:** ingest and link FIR, person, arrest, legal, organizational, and geographic records.
2. **Analytics:** identify hotspots, trends, anomalies, repeat offenders, networks, and explainable area risk.
3. **Visualization:** provide command dashboards, maps, drilldowns, graphs, profiles, and alerts.
4. **Workflow:** turn insights into watchlists, investigation leads, patrol-planning suggestions, and recorded actions.

Every intelligence output should answer:

1. Where should attention go?
2. What changed recently?
3. Who or what connects cases?

## Data Foundation

Reference: `Police_FIR_ER_Diagram.pdf`

The nine-page artifact describes the Police FIR operational schema; it does not contain case records. `CaseMaster` is the central entity. Important linked entities include:

- `ComplainantDetails`
- `Victim`
- `Accused`
- `ArrestSurrender`
- `ActSectionAssociation`
- `ChargesheetDetails`
- `CrimeHead` and `CrimeSubHead`
- `Unit`, `District`, and `State`
- `Employee`, `Rank`, and `Designation`
- caste, religion, occupation, case-status, gravity-offence, and other lookup tables

Because no raw KSP records are currently available, the prototype will require privacy-safe synthetic data aligned with the supplied schema.

Production-schema gaps, MVP assumptions, and questions for KSP are maintained in `docs/KSP DEVELOPMENT TEAM FYI.md`. Update that file whenever an implementation decision fills an undocumented gap in the supplied artifact.

Firm decision: generate synthetic records directly against the supplied production FIR schema, preserving its entity relationships, key formats, organizational hierarchy, and realistic temporal/geospatial patterns. Synthetic records must be clearly labelled and must not imitate identifiable real people.

## Core MVP

- Crime command dashboard
- Geospatial hotspot map
- District and police-station drilldowns
- Trend and anomaly alerts
- Repeat-offender and co-accused network analysis
- Explainable area risk scoring

The MVP should be a thin, real vertical slice: seed FIR data, serve dashboard analytics, visualize hotspot/risk/alert intelligence, and support drilldown to evidence.

## ML Strategy

### Priority 1

- Hotspot detection using location, crime type, time, gravity, district, and station
- Temporal anomaly detection by crime category and organizational/geographic level
- Repeat-offender and co-accused link analysis
- Area risk scoring based on recent frequency, severity, recency, trend, and hotspot membership

### Priority 2

- `BriefFacts` summaries, keywords, and modus-operandi hints
- Aggregate district-level socio-economic correlation

### Excluded from MVP

- Facial recognition or biometric matching
- Predictions that a specific person will commit a future crime
- Sensitive-demographic targeting
- Unexplained black-box crime predictions

Every alert or score must expose the detected signal, supporting evidence, confidence/severity, suggested next action, and limitations.

## Catalyst Constraint

Deployment through **Catalyst by Zoho** is mandatory. Prefer Catalyst-native services whenever Catalyst provides the required capability.

### Proposed Service Mapping

- React SPA: Catalyst Slate or Web Client Hosting
- Backend/API logic: Catalyst Serverless Functions, preferably Node.js
- API boundary: Catalyst API Gateway
- Relational operational and analytics data: Catalyst Data Store and ZCQL
- Files and generated artifacts: Catalyst Stratus
- Authentication and roles: Catalyst Authentication
- ML pipelines and model endpoints: Catalyst QuickML; Zia AutoML is excluded from the committed India-project MVP because Catalyst currently documents it as unavailable in the India data centre
- Text assistance/RAG: Catalyst QuickML, limited to grounded summaries and explanations
- Scheduled refresh and alert generation: Catalyst Cron or Job Scheduling
- Ingestion-triggered refresh: Catalyst Signals and Event Functions
- Multi-step workflows: Catalyst Circuits only if needed
- CI/CD: Catalyst Pipelines
- AppSail: defer unless custom runtimes or heavier, long-running ML services become necessary

### Production-Shaped Flow

1. Ingest schema-aligned FIR records into Data Store.
2. Transform operational records into case, person, location, and time features.
3. Analyze hotspots, anomalies, networks, repeat offenders, and area risk.
4. Serve insights through Functions and API Gateway.
5. Visualize them in the hosted web client.
6. Persist explainable alerts and refresh them using scheduled/event-driven jobs.

## Development Direction

- Use a personal laptop and personal credentials for Catalyst development.
- Do not use company credentials, data, APIs, or secrets.
- Keep all secrets out of Git and chat.
- Use Catalyst CLI and SDKs as the primary path.
- Start with Serverless Functions, Web Client Hosting/Slate, and Data Store.
- Use REST APIs only for appropriate external integrations and automation.
- Use a console-first, documented fallback if CLI installation is unavailable.

Expected setup:

```bash
npm install -g zcatalyst-cli
catalyst login
catalyst init
```

Use `catalyst serve` for local testing and `catalyst deploy` for supported resources. Production deployment is an explicit step beyond the development environment.

### Catalyst Project Created

- Data center: India (`console.catalyst.zoho.in`)
- Organization ID: `60077844198`
- Project ID: `43492000000013049`
- Current environment: Development
- Console entry provided: Slate

The project was initially created without application resources; the approved data-foundation resources are recorded below. Production deployment remains separately gated.

### Verified Catalyst Data Foundation

On 2026-07-19, schema version `1.0.0` was created in the Catalyst Development environment:

- 29 application tables: 26 PDF-aligned `SRC_` tables and 3 ingestion-control `TRN_` tables
- 391 manifest-defined columns, in addition to Catalyst's four default columns per table
- original PDF business identifiers and column spellings preserved
- Catalyst `*Ref` Foreign Keys linked to parent `ROWID` values with `On Delete = Null`
- mandatory synthetic-data provenance, rejected-record visibility, key mapping, and PII/ePHI classifications

Catalyst IaC export job `43492000000049001` produced `project-template-1.0.0.json`. The automated export comparer returned: `PASS: Catalyst Development schema matches source-schema.json.`

No FIR records, synthetic records, Production resources, API Gateway changes, or real-person data were created in this phase.

### Verified Local Crime Intelligence Engine

On 2026-07-20, local intelligence engine and fixture version `1.0.0` completed the first analytical delivery track:

- deterministic 50-case canonical synthetic analytical fixture with hidden truth;
- Haversine DBSCAN hotspot detection;
- baseline-aware median/MAD anomaly detection with a seasonal negative control;
- authoritative repeat-identity resolution and same-name false-match rejection;
- evidence-labelled case/person and co-accused graph;
- transparent TF-IDF text-similarity baseline;
- area/time-only explainable risk score with completeness withholding;
- spatial, temporal, crime, legal, text and network Pattern Fusion;
- versioned analysis runs, evidence references, limitations and synthetic labels;
- reproducible CLI and machine-verifiable positive/negative gates.

Observed controlled-fixture result: one planted hotspot, one planted four-case/two-district pattern, 1.00 pattern precision, 1.00 pattern recall, seasonal negative control rejected, false-name confirmation rejected, four co-accused edges, and all evaluation gates passing. These results are synthetic-fixture verification only and are not operational KSP accuracy claims.

Runbook: `docs/runbooks/local-intelligence-demo.md`. The next delivery track is PDF-aligned synthetic generation plus Catalyst ingestion, analytical/workflow tables, Functions, jobs and APIs.

### Verified MVP Data Bridge

On 2026-07-20, the PDF-aligned local data bridge completed with challenge-alignment PASS:

- authoritative MVP contract locking all 11 Challenge 02 capabilities, full/light user experiences, four routes, twelve APIs, Catalyst service ownership, safety limits, deferred expansion, and implementation order;
- exactly 19 lean `TRN_*`, `INT_*`, and `WF_*` table definitions for reusable features, versioned findings, evidence, alerts, assignments, conclusions, outcomes, and hash-linked audit events;
- deterministic seed `20260720` producing 50 synthetic FIRs across all 26 PDF-defined entities as 26 JSON and 26 CSV extracts with hashes;
- exact PDF column names and business identifiers, with no fabricated Catalyst `ROWID` or `*Ref` values;
- validation/reconciliation for duplicate IDs, orphan case links, invalid coordinates, invalid incident ranges, missing business IDs, and non-synthetic provenance;
- redacted rejects containing only entity, source key, reason, and row hash;
- business-ID adapter from accepted PDF records into the verified intelligence engine, with no person-name matching or hidden-truth import;
- preserved hotspot, anomaly, cross-district pattern, repeat-identity, co-accused-network, seasonal-negative, and same-name-negative gates;
- generated Catalyst Development runbook for all 19 new tables.

Observed verification: 57 tests passed; source schema validation passed for 29 existing tables and 26 PDF mappings; intelligence/workflow schema validation passed for 19 tables; intelligence demo passed. Review: `docs/reviews/2026-07-20-mvp-data-bridge.md`.

No new Catalyst tables, source records, Functions, APIs, Authentication resources, UI resources, QuickML models, or Production resources were created in this delivery. The next gated phase is the Catalyst Development backend vertical slice.

### Verified Catalyst Backend Local Core

On 2026-07-20, the framework-independent backend core completed with challenge-alignment PASS:

- 21-table production-shaped intelligence/workflow schema, including access profiles and recoverable command journal;
- shared analytics package verified under Node.js 18 and Node.js 24;
- authenticated-profile, action, unit-tree, assignment, and field-level disclosure controls;
- eight scoped intelligence reads and four versioned workflow commands forming the exact twelve-operation API boundary;
- evidence-safe cross-district pattern and person-network projections, repeat-appearance tracking, and aggregate non-causal district correlation;
- idempotency, optimistic alert compare-and-swap, prior-version serialization, deterministic retry recovery, and safe fixed-table ZCQL construction;
- HMAC-SHA-256 audit evidence for sensitive reads, demo-persona assumptions, authorization denials, and workflow actions, with key-version verification;
- deterministic synthetic refresh with seven-type coherent publication, old-group continuity on failure, visible finding replacement, and governance reconciliation.

Observed verification: 98 tests passed; Node.js 18 and Node.js 24 compatibility passed; the 29-table source/PDF schema and 21-table backend schema validators passed; intelligence demo `1.0.0` passed; deterministic runbook generation and challenge-alignment checks passed. Review: `docs/reviews/2026-07-20-catalyst-backend-local-core.md`.

This is local-core completion only. No new Catalyst tables, records, Functions, API Gateway rules, Authentication users, secrets, UI resources, or Production resources were created or deployed. The next separately gated plan must package the Catalyst SDK repositories and Functions, configure the twelve authenticated API Gateway routes, create the 21 Development tables, seed synthetic data, and collect remote acceptance evidence before claiming a deployed backend.

### Verified PDF Semantic Integrity Correction (Local)

On 2026-07-21, the source-data boundary was corrected after manual review found that structural schema alignment had been overstated as full PDF alignment. The local correction now includes:

- a machine-readable semantic contract covering all 26 PDF entities;
- 18-digit station-scoped `CrimeNo` generation and derived nine-digit `CaseNo` values;
- consistent Karnataka (`+05:30`) civil-time generation and Catalyst projection with chronology preservation;
- PDF-compatible accused ordering, victim-police indicators, case categories, unit classifications, and charge-sheet types;
- pre-write semantic rejection for identifier, chronology, hierarchy, relationship, enum, indicator, assignment, and lookup defects;
- a separate versioned synthetic identity authority, so `Accused.PersonID` is never misrepresented as a cross-case person identifier;
- a zero-reject synthetic-bootstrap gate before repository persistence;
- a non-executing, exact-project, exact-batch Development reset runbook generator.

Observed local verification: 171 tests passed; both schema validators, intelligence demo, Function builds, and bundle inspections passed. On 2026-07-21, an exact read-only Catalyst Development audit reconciled 411 source rows, 411 source-key mappings, one ingestion-batch row, zero rejects, and zero analysis runs for quarantined batch `KSP-DEMO-20260720-V1`. After explicit user approval, exactly those 823 synthetic rows were deleted in reverse dependency order. A separate zero-row sweep passed for all 26 source tables and the scoped control/analysis tables. The corrected Function has not yet been deployed and the batch has not yet been reloaded.

Later on 2026-07-21, the corrected `intelligence_refresh` bundle was deployed to Catalyst Development and its five required configuration key names were restored without exposing the audit-key value. Zero-retry Job `43492000000064695` reloaded the same approved batch key successfully. Remote acceptance proved 411/411 accepted rows, zero rejects, 50 PDF-semantic FIRs, 411 source-key mappings, seven analysis runs, valid identifiers/timelines, and persisted hotspot, anomaly, pattern, repeat-offender, area-risk, network and workflow-alert outputs. The accepted batch ROWID is `43492000000068005`.

## Decisions

- Treat the FIR schema as the first source of truth.
- Build an operational platform, not a single dashboard page.
- Use Catalyst-native services wherever a matching capability exists.
- Keep the MVP production-shaped with clean service boundaries and a deployable vertical slice.
- Focus ML on explainable hotspot, anomaly, repeat-offender, network, and area-risk workflows.
- Avoid individual-level crime prediction and sensitive-demographic targeting.
- Use the phrase **Decision Intelligence** or **Crime Intelligence** rather than leading with **Predictive Policing**.
- Continue development on a personal laptop to reduce company-device compliance risk.
- Design for multiple policing levels rather than one primary persona. State Leadership, District/Division Leadership, and Crime Analyst are full MVP experiences; Station/Investigator Operations is light but working; regional scope is adaptive; Administrator/Auditor controls are demonstrated. Effective access combines rank, designation, assigned unit hierarchy, explicit permission, and case assignment where required.
- Do not begin implementation from the database schema alone. Complete and approve the product, workflow, intelligence, role, architecture, and demonstration design first.
- The developer will be an AI coding model. The final implementation package must therefore contain explicit requirement IDs, file boundaries, data dictionaries, schemas, API contracts, state transitions, security rules, algorithms, seed scenarios, acceptance criteria, test cases, deployment commands, verification evidence, and a requirement-to-test traceability matrix. No critical decision may be left implicit or described only as "use best judgment."
- Use a plain, explanatory "architect speaking to business" tone for business design documents: explain purpose first, use concrete policing questions and examples, and introduce technical terms only after the business meaning is clear.
- Authorization foundation approved: determine effective access from `Rank` hierarchy, `Designation` responsibilities, the employee's assigned `Unit` and its `ParentUnit` hierarchy, plus explicit platform permissions. Rank alone must never grant access. This model must support both district-police and commissionerate structures without hard-coded organizational depth.
- Keep the Regional/Commissionerate Leadership experience lean. It provides subordinate-unit comparison, cross-unit pattern review, assignment, escalation, monitoring, and status tracking. Coordination fields remain inside the alert record; the MVP will not include a separate coordination-room module.
- District/Division Leadership experience approved: District Intelligence Pulse, contextual station comparison, explainable Attention Queue, alert assignment and review, drilldown to authorized evidence, and human-controlled resource-priority guidance. Do not create unexplained station rankings or autonomous patrol assignments.
- Crime Analyst experience approved: prioritized Analyst Workbench, synchronized map/timeline/network/evidence investigation, visible data-quality effects, immutable original model output, separate working hypotheses, structured conclusions, and a traceable evidence pack for leadership review.
- Shared Station Command and Investigating Officer experience approved: one Operational Intelligence View with designation- and assignment-specific permissions, local alert response, case/link verification, strict geographic and case scope, and labels separating system signals from analyst findings, officer reports, confirmed records, and data-quality warnings.
- Governance Console approved: Platform Administrator manages technical configuration and health without automatic case access; Auditor receives read-only, append-only traceability across access, alerts, decisions, evidence references, analytical versions, changes, and exports. The MVP proves governance boundaries without building a full enterprise administration suite.
- Challenge cross-check approved three corrections: visibly unify separate synthetic source extracts rather than starting from one clean database; add an aggregate, non-causal District Context Lens for socio-economic correlation; and strictly limit full MVP implementation to State Leadership, District/Division Leadership, and Crime Analyst, with lighter operational and governance demonstrations for other roles.
- Physical data architecture approved: use one Catalyst Data Store with logical `SRC_`, `TRN_`, `INT_`, and `WF_` zones plus Stratus raw landing. `SRC_` tables preserve every PDF-defined column and original business identifier. Catalyst-native relationships use additional `*Ref` Foreign Key columns that point to parent `ROWID`s. Do not create a complete transformed copy of the FIR database; persist only key mappings, reusable features, versioned intelligence and accountable workflow records. The authoritative design is `docs/superpowers/specs/2026-07-19-catalyst-physical-data-architecture-design.md`.
- Deferred expansion approved: retain authorized CCTV-derived alerts, verified public/social signals, major-event priorities, a shared Command Centre presentation mode, leadership and station operational indicators, and a responsive investigator tablet experience in the architecture. These remain supporting inputs and delivery surfaces around the Crime Analytics Engine. They must not displace or be presented as proof of any Challenge 02 capability. The boundary and entry criteria are defined in `docs/architecture/deferred-signal-and-operational-expansion.md`.
- AI/ML strategy approved: compete on an explainable Cross-District Crime Pattern Fusion Engine that combines spatial hotspots, temporal anomalies, governed identity resolution, evidence graphs, text-derived modus-operandi features, area risk, and aggregate district context. Every method is labelled accurately, evaluated on hidden positive and negative synthetic fixtures, versioned, evidence-linked, human-reviewable, and Catalyst-native where available. The authoritative design is `docs/architecture/ai-ml-intelligence-strategy.md`.

## Resolved Build Decisions

1. Product name: **KSP Crime Decision Intelligence Platform**.
2. Delivery priority: a production-shaped working MVP with tested analytics and an evidence-to-action user journey; the pitch demonstrates that product rather than substituting for it.
3. Demo anchor: **Explainable Cross-District Pattern Fusion**, supported by hotspots, anomaly, network, repeat identity, area risk, and district context.
4. Authoritative implementation boundary: `docs/architecture/mvp-build-contract.md`.

## AI Builder Control System — July 21, 2026

Five concise root documents now control future human and AI development:

1. `Rules.md` — non-negotiable engineering, security, data, AI, and quality rules.
2. `PRD.md` — product users, outcomes, MVP scope, exclusions, and acceptance criteria.
3. `Architecture.md` — end-to-end flow, Catalyst mapping, module boundaries, APIs, and delivery truth.
4. `Design.md` — approved **Command Navy** visual system and role-specific UX standards.
5. `Phases.md` — dated delivery and scope-control plan through the July 26 submission.

This file remains the sole project memory and progress ledger. Do not create a root `Memory.md` or another competing memory file. Root documents state current decisions; detailed files under `docs/` retain supporting evidence and depth.

**Execution preference:** Codex must execute plans inline in the active task by default. Do not use subagents, delegated agents, or parallel agent implementation unless the founder explicitly requests it for that task.

When implementation changes behavior, update the smallest authoritative root document and this memory entry when progress, deployment state, a decision, or a blocker changes.

### Intelligence Workspaces and Reporting Slice — July 21, 2026

The approved platform extension is implemented locally on `codex/intelligence-workspaces`:

- backend boundary expanded from 21 to 28 tables with five reporting/dashboard configuration tables and two note/escalation workflow tables;
- seven fixed semantic sources expose governed intelligence without raw-table or caller-supplied ZCQL access;
- report ownership, optimistic versions, sharing, global publication, viewer-scoped execution, dashboard widgets, role defaults, and personal landing preferences are functional;
- alert discovery, geographic redaction, immutable original findings, versioned notes, authorized ancestor escalation, idempotency, and HMAC audit sequencing are functional;
- the Serverless API declares 33 exact operations and the Catalyst repository persists platform objects using business IDs plus Catalyst `ROWID` references;
- the React/Vite workspace provides Command Navy navigation, command intelligence, report building, viewer-scoped dashboard execution, Alert Centre, explainability, evidence, a coordinate-driven Leaflet hotspot map with a table alternative, and working evidence-network search;
- the reporting engine maps real governed payloads into its published semantic fields before filtering, grouping, aggregation, sorting, and limiting; report definitions cannot submit table names or ZCQL.

Observed verification: 197 backend tests and 11 frontend tests passed; Vite production build succeeded; both Function bundles built and inspected with zero manifest, forbidden-file, or unresolved-import errors; both schema validators passed; npm reported zero vulnerabilities. The Catalyst Node SDK `deleteRow(ROWID)` signature was checked against official Zoho documentation. The local in-app browser could not connect to the sandboxed Vite port, so no screenshot-level browser claim is made.

No Catalyst resource was created, changed, or deployed by this slice. Remote table migration, Function deployment, API Gateway routes, Authentication personas, web hosting, and fresh-browser smoke tests require separate explicit approval.

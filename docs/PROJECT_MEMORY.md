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
- ML pipelines and model endpoints: Catalyst QuickML and Zia AutoML where practical
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

## Decisions

- Treat the FIR schema as the first source of truth.
- Build an operational platform, not a single dashboard page.
- Use Catalyst-native services wherever a matching capability exists.
- Keep the MVP production-shaped with clean service boundaries and a deployable vertical slice.
- Focus ML on explainable hotspot, anomaly, repeat-offender, network, and area-risk workflows.
- Avoid individual-level crime prediction and sensitive-demographic targeting.
- Use the phrase **Decision Intelligence** or **Crime Intelligence** rather than leading with **Predictive Policing**.
- Continue development on a personal laptop to reduce company-device compliance risk.
- Design for multiple policing levels rather than one primary persona. Level 1 is the Police Leadership Team (for example, the State Commissioner), receiving statewide pattern discovery, executive intelligence briefs, strategic alerts, and high-level drilldowns. Lower operational levels and their permissions remain to be defined during design.
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

## Open Questions

1. Which user levels sit below the Police Leadership Team, and what decisions, views, and data scope does each receive?
2. Should the deliverable prioritize a working MVP, a pitch-first prototype, or an analytics-heavy demonstration?
3. Which capability anchors the demo story: map, network, anomaly, risk score, or correlation?
4. What product name best communicates explainable district-policing intelligence?

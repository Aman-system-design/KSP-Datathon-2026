# Product Requirements Document

## Product

**KSP Crime Decision Intelligence Platform**

**Challenge:** Datathon 2026, Challenge 02

**Positioning:** Decision Intelligence for District Policing

The platform transforms fragmented FIR records into explainable, role-scoped intelligence and accountable action. It is not a generic dashboard and not black-box predictive policing.

## Problem

Police information is distributed across case, person, arrest, legal, organization, and geography records. Manual reporting makes cross-record patterns, emerging hotspots, repeat identities, anomalies, and cross-district relationships difficult to discover and slow to act upon.

## Product Outcome

An authorized officer should move through one traceable journey:

> fragmented records → validated and linked data → analytical signal → evidence and limitations → human decision → assignment → recorded outcome

The platform must answer:

1. Where should attention go?
2. What changed from the expected baseline?
3. Which cases, people, places, or methods connect the signal?
4. Why did the system raise it?
5. Who reviewed it, what action followed, and what was the outcome?

## Users and Decisions

| User | Default experience | Decisions supported |
|---|---|---|
| Command Centre | Large-screen operational brief | Which verified alerts need immediate coordination or escalation? |
| State Police Leadership | State Intelligence Brief | What changed statewide, which patterns cross boundaries, and where is leadership intervention required? |
| City/District/Division Leadership | District Intelligence Pulse | Which stations, hotspots, trends, ageing alerts, and assignments need attention? |
| Station Leadership/SHO | Station Operations | What is active locally, what changed, and which alert or case action is overdue? |
| Crime Analyst | Analyst Workbench | Which hypothesis is supported, what connects cases, and what conclusion should be submitted? |
| Investigator/Station Officer | Responsive Operations View | Which evidence or link must be verified, acknowledged, or updated in the field? |
| Administrator/Auditor | Configuration and audit evidence | Are access, runs, actions, and changes governed and traceable? |

Access is determined by rank, designation, assigned unit hierarchy, explicit permission, and case assignment where required. It is never determined by rank alone.

## MVP Scope

### Data unification

- Load separate synthetic extracts for all 26 PDF-defined entities.
- Preserve source business identifiers and add Catalyst-native relationships.
- Validate relationships and semantics, quarantine rejects, and reconcile every input row.
- Show ingestion quality and synthetic provenance.

### Crime analytics

- Geospatial hotspot detection with method, parameters, period, contributing cases, and limitations.
- District and station trend comparison with recent and baseline windows.
- Anomaly detection with observed value, expected range, severity, and negative control.
- Evidence-labelled case, person, co-accused, legal, location, and time network analysis.
- Repeat-offender signals based on governed identity evidence; name-only matching cannot confirm identity.
- Aggregate district socio-economic correlation with source/period/missingness and an explicit correlation-not-causation warning.
- Explainable area and time-window risk scoring with visible component contributions and withheld-score rules.
- Multi-signal cross-district pattern fusion across spatial, temporal, crime, legal, text, and network evidence.

### Visualization and drilldown

- Role-aware interactive dashboards.
- Karnataka, district, station, hotspot, and evidence maps.
- State → district/commissionerate → station → alert/pattern → case/evidence drilldown.
- Timeline, network, contributing-case, method, confidence, quality, and limitation views.

### Workflow

- Acknowledge, assign, conclude, and record outcomes for alerts.
- Preserve original findings while recording human conclusions separately.
- Enforce state transitions, optimistic concurrency, idempotency, authorization, and audit history.

### MVP routes

- `/leadership`
- `/district/:unitId`
- `/analyst/alerts/:alertId`
- `/operations`

The original 12 intelligence/workflow operations remain stable. The platform layer adds 21 governed workspace, reporting, dashboard, alert-discovery, note, and escalation operations, for 33 declared operations in total. The approved extension is defined in [`docs/superpowers/specs/2026-07-21-intelligence-workspaces-and-reporting-design.md`](docs/superpowers/specs/2026-07-21-intelligence-workspaces-and-reporting-design.md).

## Flagship Jury Journey

**Explainable Cross-District Pattern Fusion** is the principal differentiator.

1. Open the State Intelligence Brief after a completed analysis run.
2. Select an emerging cross-district pattern discovered from accepted synthetic FIRs.
3. Inspect component contributions, confidence, missing evidence, and method version.
4. Drill into districts, stations, hotspot, timeline, linked cases, repeat identity, and co-accused graph.
5. Compare the anomaly against its baseline and show that the seasonal negative control was not alerted.
6. Open the explainable area-risk change and all contributing factors.
7. Submit an analyst conclusion, assign the alert, record an outcome, and show the audit trail.

## Challenge 02 Acceptance

| Requirement | MVP proof |
|---|---|
| Interactive dashboards and maps | Role routes render governed API data and support evidence drilldown. |
| Crime hotspots | A planted spatial cluster is detected; noise is excluded; evidence cases and parameters are visible. |
| District drilldowns | Authorized state-to-case navigation works and unauthorized sibling evidence is redacted or hidden. |
| Trend alerts and anomalies | A planted anomaly is raised against a baseline; the seasonal negative control remains unpromoted. |
| Network/link analysis | Evidence-labelled paths connect synthetic cases and persons without implying guilt. |
| Repeat offender tracking | Authoritative identity confirms a repeated appearance; same-name conflicting identities remain unconfirmed. |
| Socio-economic correlation | Aggregate Spearman result shows coefficient, period, sample size, missingness, source, and caveat. |
| Predictive risk scoring | Area/time score changes with evidence and shows every component; low-quality scores are withheld. |
| AI/ML pattern detection | The cross-district pattern is computed, versioned, persisted, evidence-linked, and human-reviewed. |

## Quality and Non-Functional Requirements

- All displayed data is visibly synthetic.
- Every significant finding links to a completed analysis run and evidence.
- Every workflow action produces a verifiable audit event.
- Authentication, permission, unit scope, evidence scope, and input validation fail closed.
- A partial or failed run never becomes current.
- Precomputed intelligence endpoints target p95 response below two seconds in the demo environment.
- The interface is responsive and keyboard-accessible with WCAG AA contrast.
- The accepted 50-FIR profile remains deterministic; optional larger profiles are used only after the vertical slice passes.
- Automated tests cover positive controls, negative controls, schema fidelity, authorization, retry/idempotency, safe errors, and API contracts.

## Explicitly Out of MVP

- Person-level future-crime prediction or autonomous policing decisions.
- Caste, religion, or individual socio-economic scoring.
- Live CCTV/video analytics, social-media collection, and trending-news ingestion.
- Major-event feeds, native/offline tablet application, and a complete enterprise admin console.
- Production KSP/on-premises integration, Entra federation, real-data accuracy claims, or Production deployment.

These may become governed roadmap items only after the core Challenge 02 flow is complete. See [`docs/architecture/deferred-signal-and-operational-expansion.md`](docs/architecture/deferred-signal-and-operational-expansion.md).

## Success Definition

The MVP succeeds when a jury member can see a non-hard-coded signal originate in fragmented synthetic records, inspect its evidence and limitations across multiple analytical views, complete a governed human action, and verify the outcome and audit trail on Catalyst.

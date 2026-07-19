# Challenge 02 Traceability

## Purpose

This document ensures that every part of the official Challenge 02 statement has a visible response in the product architecture and, later, a verifiable implementation and demo step.

## Challenge-to-solution mapping

| Challenge ask | Product response | Primary users | MVP proof |
|---|---|---|---|
| Transform fragmented records | Import separate case, people, arrest, legal, unit, and district-context extracts; validate and link them into one intelligence layer | Administrator, Analyst | Show source files, validation results, rejected rows, and linked records |
| Actionable intelligence | Explainable alerts with assignment, verification, status, outcome, and audit history | Leadership, Analyst, Station | Complete one alert from detection through recorded outcome |
| Interactive dashboards | Role-aware State Intelligence Brief, District Intelligence Pulse, and Analyst Workbench | State, District, Analyst | Use all three during the flagship journey |
| Geospatial maps | State, district, station, hotspot, and evidence maps | Leadership, Analyst | Drill from statewide pattern to local incident evidence |
| Crime hotspot detection | Baseline-aware spatial clustering using recency, category, severity, and local history | District, Analyst | Explain one emerging or expanding hotspot |
| District-level drilldowns | State → District/Commissionerate → Station → Alert → Case → Supporting entity | Leadership, Analyst | Navigate the complete evidence chain |
| Trend alerts | Time-window comparison and explainable Attention Queue | District, Analyst | Show a significant category increase with its baseline |
| Anomaly detection | Detect deviations from the expected station/district/category baseline | District, Analyst | Show an alert with observed value, expected range, and evidence |
| Criminal network and link analysis | Connect cases, accused, co-accused, arrests, acts, sections, locations, and time | Analyst, Investigator | Inspect one evidence-linked network |
| Repeat-offender tracking | Track repeated accused appearances, associated cases, co-accused persons, and arrest history | Analyst, Investigator | Open a synthetic offender history and connected cases |
| Socio-economic crime correlation | Aggregate District Context Lens with safeguards against causal or individual-targeting claims | State, District, Analyst | Compare one crime measure with one district context variable and show caveat |
| Predictive risk scoring | Explainable area-risk signal based on frequency, severity, recency, trend, anomaly, and hotspot factors | District, Analyst | Show score change, contributors, period, version, and limitation |
| AI/ML-based pattern detection | Cross-district pattern fusion, anomaly detection, hotspot analysis, link analysis, and grounded text similarity | State, District, Analyst | Demonstrate the cross-district flagship alert |

## Approved gap corrections

### Visible fragmented-source unification

The MVP must not begin from one already-clean combined database. Synthetic data will be delivered as separate source extracts aligned to the supplied FIR schema. The platform validates, rejects, links, and records ingestion quality before analytics run.

The MVP does not require a large drag-and-drop data-management product. A narrow ingestion status and validation experience is sufficient.

### District Context Lens

The MVP will include aggregate contextual variables such as population density, urbanization, literacy, employment/livelihood proxy, or economic-activity proxy.

Rules:

- analysis remains at aggregate district level;
- no caste, religion, or individual socio-economic targeting;
- correlation is never presented as causation;
- source, time period, missingness, and limitations are visible;
- synthetic contextual values are clearly labelled if official public values are not used.

### Strict role implementation boundary

Fully implemented core experiences:

1. State Leadership
2. District/Division Leadership
3. Crime Analyst

Light implementation:

- Station Command and Investigating Officer shared operational view

Demonstrated through configuration, status, and audit evidence:

- Platform Administrator
- Auditor

Represented through adaptive organizational scope rather than a separate large interface:

- Regional/Commissionerate Leadership

## Traceability rule for implementation

The final implementation plan must assign every row above:

- a requirement ID;
- owning component;
- data dependency;
- API contract;
- acceptance criterion;
- automated or manual test;
- demo step;
- implementation status.

No challenge requirement may be considered complete solely because a screen or label exists.

## Scope guard for future operational signals

CCTV alerts, public/social signals, major-event priorities, Command Centre presentation mode, case-ageing summaries, and expanded field-device experiences are permitted future extensions. They are not substitutes for any CH02 requirement and cannot be used as proof that hotspot, anomaly, network, repeat-offender, correlation, area-risk, or pattern-detection behavior works.

The deferred direction is maintained in [`deferred-signal-and-operational-expansion.md`](deferred-signal-and-operational-expansion.md). If an extension competes with unfinished Challenge 02 behavior, the extension is deferred.

# Operational Intelligence Control Plane and Role Home Design

**Date:** 2026-07-22
**Status:** Approved product direction; implementation plan required
**Shortlist customer:** Karnataka State Police
**Deployment boundary:** Catalyst Development project `43492000000013049`

## 1. Decision

The next build milestone is not another dashboard. It is a production-shaped operational path that proves the existing intelligence methods execute against accepted FIR records, publish evidence atomically, expose failures honestly, and can be inspected by an authorized operator.

The accepted Catalyst-white screen remains a reusable platform-administration reference called `ADMIN_2`. It is not the State Leadership default. Leadership receives a simpler decision workspace with fewer containers and a direct path from an intelligence development to its evidence, current owner, and action.

## 2. Non-negotiable outcome

The application must demonstrate this real sequence:

```text
PDF-aligned source rows
  -> validation and reconciliation
  -> immutable accepted input manifest
  -> seven governed analytics executions
  -> atomic publication of one coherent run group
  -> persisted findings and evidence
  -> authorized role view
  -> analyst verification, assignment, escalation and outcome
  -> append-only audit history
```

Changing the accepted input must change the analytical output. A UI card, static JSON fixture, hard-coded alert, LLM-written claim, or manually inserted score does not count as implementation.

## 3. Screen decisions

### 3.1 Preserve `ADMIN_2`

The approved Catalyst-white Platform Home is retained as the second administrator workspace. It supports platform configuration, service navigation, intelligence-run monitoring, dashboards, report administration, access governance and health inspection.

Its secondary navigation panel is independently collapsible. The primary module rail remains visible. Collapse state is a user preference and never changes authorization.

### 3.2 Remove weak chrome

The following visual treatments are prohibited across the application:

- decorative active-navigation strips;
- a permanently visible `Ctrl K` keycap in the global header;
- a Development environment label in leadership-facing chrome;
- loose notification numbers detached from an icon or label;
- repeated scope, period and run chips that do not perform a filtering action;
- judge-facing disclaimers that visually dominate the operational experience.

The command shortcut remains functional and is disclosed inside the command palette and keyboard-help surface. Environment and deployment metadata move to administrator diagnostics and the account panel. Alert counts are attached to the Alert Centre control with an accessible label. Analysis context is expressed once as a compact, interactive “Data as of” control.

### 3.3 State Leadership default

The State Leadership home answers three questions without requiring the user to interpret a grid of service cards:

1. What materially changed in the authorized jurisdiction?
2. Why does the system believe it changed?
3. Who is reviewing or acting on it?

The default composition is:

- one statewide intelligence posture header with data-as-of time and freshness status;
- one prioritized developments list ordered by governed severity and confidence;
- one geographic context panel showing the selected development;
- one evidence summary showing baseline, observed value, method and limitations;
- one ownership/action panel showing status, assignment, escalation and notes;
- direct links to the full Alert Centre, Hotspots, Pattern Analysis and Network Analysis modules.

Service launchers remain available through navigation and command search, not as six equal boxes above the decision content.

### 3.4 Development persona switch

For the shortlist demonstration, the extreme-right profile control contains the persona switcher. The menu shows the authenticated identity, employee identifier when available, actual role, effective demonstration persona, authorized scope and sign-out action.

Persona switching is available only when the server confirms all of the following:

- Catalyst environment is Development;
- the authenticated access profile's actual role is `DEMO_PRESENTER`;
- `DemoPersonaAllowed` is enabled;
- the profile is restricted to synthetic data;
- the requested persona is in the server-side allowlist.

Selecting a persona updates the Development `persona` query parameter and reloads the workspace through `/v1/workspace`. The API independently revalidates the persona on every request. The browser cannot grant a role, scope, permission or evidence access. Normal police, analyst, leadership, administrator and auditor profiles never receive a persona selector.

## 4. Functional intelligence control plane

### 4.1 Purpose

Authorized platform operators need to prove and operate the analytics pipeline. The control plane exposes persisted execution facts; it does not simulate model activity in the browser.

### 4.2 Run-group contract

One published intelligence snapshot contains exactly seven analysis types:

- `HOTSPOT`;
- `ANOMALY`;
- `PATTERN`;
- `IDENTITY_RESOLUTION`;
- `NETWORK`;
- `AREA_RISK`;
- `FEATURE_BUILD`.

A run group becomes current only when all seven runs share the same input-manifest hash, observation window, run-group identifier and publication boundary. A partially completed or partially persisted group is never served as current intelligence.

### 4.3 Run inspection

`ADMIN_2` exposes a run-monitoring workspace backed by API responses from Catalyst Data Store. It shows:

- run-group and per-engine identifiers;
- source batch and immutable input-manifest hash;
- accepted and rejected row counts;
- observation start/end and publication time;
- engine and method versions;
- current phase and terminal status;
- finding counts by analysis type;
- safe failure code and failed persistence boundary;
- whether the previous published run remains active;
- retry eligibility and idempotency key.

The interface must distinguish `QUEUED`, `VALIDATING`, `EXECUTING`, `STAGING`, `PUBLISHED`, `FAILED_RETRYABLE` and `FAILED_FINAL`. A failure is rendered as a diagnosable state with a stable request/run identifier. It is never replaced with sample success data.

### 4.4 Starting and retrying runs

Run execution remains server-side through the Catalyst `intelligence_refresh` Job Function and Job Scheduling boundary. The browser cannot execute analytics code, write findings directly, or choose an arbitrary Catalyst project.

An authorized request creates or reuses one idempotent run command. The function validates the source batch, calculates the input-manifest hash, executes the shared intelligence package, stages all findings, verifies the complete seven-run group, and publishes it atomically. A retry uses the same batch key and converges without duplicate source rows, findings, alerts or audit events.

The initial shortlist path supports:

- `REFRESH_INTELLIGENCE` for a previously validated source batch;
- retry of a `FAILED_RETRYABLE` run;
- read-only inspection for leadership and analysts;
- start/retry permission only for the platform-administration role.

Synthetic bootstrap remains a Development-only engineering operation and is not exposed as a leadership action.

## 5. Real analytics boundary

The existing transparent methods remain the shortlist authority:

| Capability | Executed method | Required evidence |
|---|---|---|
| Hotspot detection | Haversine DBSCAN | parameters, centroid, magnitude, contributing cases, observation window |
| Trend anomaly | median/MAD baseline | observed value, expected value, deviation, baseline periods, limitation |
| Pattern detection | explainable multi-signal fusion | component contributions, compatible cases, evidence families, version |
| Repeat identity | authoritative/candidate identity resolution | compared appearances, match method, confidence and review state |
| Link analysis | evidence-labelled graph construction | nodes, edges, source records and path evidence |
| Area risk | six-component area/time score | every component, completeness, period and withholding reason |
| Text similarity | TF-IDF term similarity | normalized terms, similarity value and source-case references |

These methods are functional ML/statistical/graph capabilities even though they are not all trained neural models. They must be labelled by their actual method class. QuickML or Zia models may be added only when their endpoint, version, input schema, output schema, latency, failure behavior and stored evidence are implemented and tested. No screen may claim a QuickML result before that integration exists.

## 6. Evidence and failure contract

Every published finding carries:

- analysis-run reference;
- method and version;
- observation period;
- evidence references;
- confidence or severity definition;
- input completeness;
- limitations;
- synthetic/public/authorized-source provenance;
- human-verification status.

Every failed run carries:

- safe error code;
- failed phase;
- correlation identifier;
- retryability classification;
- creation and update time;
- retained-current-run identifier;
- server-side structured log event.

Raw FIR narratives, personal details, secrets, Catalyst SDK errors and stack traces are excluded from browser-visible failure payloads. Full diagnostics remain in controlled server logs.

## 7. Authorization and Catalyst services

- Catalyst Authentication establishes the user identity.
- Data Store access profiles, roles, permissions and unit hierarchy establish authorization.
- API Gateway is the public API boundary when configured.
- Serverless Functions host read, workflow and run-command logic.
- Job Scheduling and the `intelligence_refresh` Job Function execute analytics.
- Data Store persists source mirrors, run groups, findings, evidence, alerts, workflow records and audit events.
- QuickML and Zia are used only through server-side adapters for explicitly implemented model capabilities.

State Leadership can read statewide governed intelligence and workflow posture. Analysts can inspect evidence and record conclusions within scope. Platform administrators can monitor and retry runs but cannot gain case evidence merely because they administer the platform. Authorization is enforced by the API; navigation visibility is not a security boundary.

## 8. Verification gates

Implementation is accepted only when all of the following are observed:

1. Existing repository tests remain green.
2. A test changes source evidence and observes a changed or removed finding.
3. A test injects failure at each persistence boundary and proves the prior published run remains current.
4. A retry test proves convergence without duplicated findings or alerts.
5. API tests prove only platform administrators can start or retry a run.
6. Scope tests prove leadership and analysts see only authorized finding evidence.
7. UI tests render loading, empty, partial, failed, stale and published states from API contracts.
8. The browser never falls back to fixture success data after an API or job failure.
9. Catalyst bundle inspection confirms the shared intelligence implementation is deployed with the Job Function.
10. A Development deployment shows a real run identifier, real stored findings, evidence drilldown and a recoverable injected failure.

## 9. Deferred scope

The following are not part of this milestone:

- individual future-offender or dangerousness scoring;
- live CCTV inference without an authorized feed and implemented vision-model adapter;
- production claims based on synthetic thresholds;
- general multi-tenant billing and licensing;
- arbitrary user-authored executable ML code;
- replacing KSP systems of record;
- hiding synthetic provenance from evidence or audit records.

The application may present synthetic provenance discreetly in data details, run metadata and evidence views. It must not use a dominant disclaimer as the product identity, and it must never misrepresent synthetic findings as live KSP intelligence.

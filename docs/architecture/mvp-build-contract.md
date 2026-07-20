# Authoritative MVP Build Contract

**Product:** KSP Crime Decision Intelligence Platform  
**Challenge:** Datathon 2026 — Challenge 02  
**Status:** Approved single source of truth for implementation  
**Deployment:** Catalyst by Zoho, India data centre  
**Flagship:** Explainable Cross-District Pattern Fusion

## Why this contract exists

This file turns the approved architecture into decisions an AI builder can implement and test without inventing product scope. If another planning document conflicts with this contract, this contract controls the MVP until an explicit architecture review changes it.

The product is a crime-analytics platform, not a collection of unrelated dashboards. Its core flow is:

**fragmented FIR records → validation and linking → explainable analytics → role-scoped intelligence → accountable human action and outcome**

## Challenge acceptance contract

| ID | MVP behavior and proof |
|---|---|
| CH02-01 | Load visibly separate PDF-aligned source extracts, validate relationships, expose rejects, and reconcile accepted records. |
| CH02-02 | Convert accepted records into evidence-linked patterns, alerts, recommended review actions, assignments, and outcomes. |
| CH02-03 | Provide interactive leadership, district, analyst, and operations experiences with maps and evidence drilldowns. |
| CH02-04 | Detect geospatial hotspots with a named method, parameters, observation window, contributing cases, and limitations. |
| CH02-05 | Scope every leadership metric and finding through the authorized Karnataka unit hierarchy and support district drilldown. |
| CH02-06 | Compare recent and baseline periods, detect anomalies, retain seasonal negative controls, and expose severity and evidence. |
| CH02-07 | Show evidence-labelled case, person, and co-accused links; similarity is never presented as guilt. |
| CH02-08 | Resolve repeat identities using governed identifiers and evidence while rejecting name-only matches. |
| CH02-09 | Compare aggregate district context with crime measures, label source/period, and state that correlation is not causation. |
| CH02-10 | Score areas and time windows only, show components and missing-data effects, and never predict individual offending. |
| CH02-11 | Detect multi-signal cross-district patterns with versioned methods, confidence, evidence, limitations, and human review. |

A screen, badge, or hard-coded number does not prove any requirement. Proof means working behavior, a planted positive fixture, a negative control where relevant, automated tests, and evidence traceable to accepted source records.

## Users and MVP depth

Fully implemented experiences:

1. **State Leadership** — statewide executive brief, emerging patterns, district comparison, strategic drilldown, and status visibility.
2. **District/Division Leadership** — district pulse, contextual station comparison, attention queue, evidence review, assignment, and outcome monitoring.
3. **Crime Analyst** — prioritized workbench, synchronized map/timeline/network/evidence investigation, hypothesis notes, structured conclusion, and evidence pack.

Light but working experience:

4. **Station/Investigator Operations** — locally scoped alert response, case/link verification, acknowledgement, and outcome update. It is responsive for a tablet but is not a separate native tablet application.

Regional/Commissionerate users receive the leadership experience with adaptive unit scope. Platform Administrator and Auditor prove configuration/access separation and append-only traceability; they do not receive a full enterprise console in this MVP.

Effective authorization is the intersection of rank hierarchy, designation responsibility, assigned unit hierarchy, explicit platform permission, and case assignment where required. Rank alone never grants access.

## Frontend route contract

| Route | Primary experience | Required acceptance evidence |
|---|---|---|
| `/leadership` | State or adaptively scoped regional leadership | Brief, pattern and district comparison values come from APIs; scope is visible; every finding opens evidence. |
| `/district/:unitId` | District/Division Leadership | Authorized unit validation, hotspot map, station comparison, alert assignment, and status tracking work end to end. |
| `/analyst/alerts/:alertId` | Crime Analyst | Original finding remains immutable; map, timeline, network, cases and evidence agree; conclusion is stored separately. |
| `/operations` | Station/Investigator Operations | Unit/case scope is enforced; officer evidence is labelled; acknowledgement and outcome transitions are audited. |

## API contract inventory

All APIs sit behind Catalyst API Gateway and Catalyst Authentication and run through Catalyst Serverless Functions. Response envelopes must include observation period, synthetic-data label in the MVP, analytical run/method version, data-quality status, and evidence references where a finding is returned.

- `GET /v1/intelligence/brief`
- `GET /v1/patterns`
- `GET /v1/patterns/{patternId}`
- `GET /v1/hotspots`
- `GET /v1/anomalies`
- `GET /v1/area-risk`
- `GET /v1/networks/{nodeId}`
- `GET /v1/district-context`
- `POST /v1/alerts/{alertId}/acknowledge`
- `POST /v1/alerts/{alertId}/assign`
- `POST /v1/alerts/{alertId}/analyst-conclusion`
- `POST /v1/alerts/{alertId}/outcome`

The four write APIs require authenticated actor, allowed role, authorized unit/case scope, expected current state, reason or structured payload, idempotency key, and an append-only audit event.

## Catalyst service contract

| Need | Required service |
|---|---|
| Relational source, features, intelligence, workflow | Catalyst Data Store |
| Backend calculations and APIs | Catalyst Serverless Functions |
| Login and identity | Catalyst Authentication |
| Routing, throttling and API authorization boundary | Catalyst API Gateway |
| Raw synthetic extracts and generated evidence packs | Catalyst Stratus |
| React SPA | Catalyst Slate or Web Client Hosting |
| Recalculation and ingestion jobs | Catalyst Cron or Job Scheduling, with Signals/Event Functions only where event reaction adds value |
| Candidate model serving after the transparent vertical slice passes | Catalyst QuickML |

QuickML is an enhancement gate, not a substitute for the transparent and already tested baseline. A QuickML model may narrow candidate cases; it may not independently create an operational alert.

## Data and intelligence rules

- Preserve the 26 PDF-defined source tables, columns, spellings, and business identifiers in `SRC_*`.
- Add Catalyst `*Ref` relationships without replacing original business identifiers.
- Keep reusable features in `TRN_*`, versioned findings in `INT_*`, and accountable action/outcome records in `WF_*`.
- Never overwrite source records or original analytical findings.
- Every significant finding stores signal, evidence, confidence/severity, recommendation, limitation, method/model version, and observation period.
- Synthetic records and aggregate synthetic district context are visibly labelled. No real-person data is permitted in the MVP.
- No person-level future-crime prediction, caste/religion targeting, socio-economic person scoring, unsupported generated briefs, or autonomous deployment decision is allowed.

## Deliberately deferred expansion

The following are **deferred** until the core Challenge 02 flow works and passes its alignment gate:

- live CCTV alerts, video analytics, and command-centre integrations;
- social media collection, trending-news monitoring, and public-signal ingestion;
- major-event/visit planning feeds and a full large-screen Command Centre mode;
- a native/offline investigator tablet application;
- Production deployment, real KSP integration, and operational accuracy claims.

These may later enter as governed inputs or presentation surfaces. They do not count as proof of crime analytics.

## Implementation and release order

1. **Data bridge:** authoritative contract, PDF-aligned synthetic extracts, validation/reconciliation, intelligence/workflow schema, and adapter into the verified engine.
2. **Catalyst backend:** Development tables, ingestion, scheduled analysis, Functions, Authentication, API Gateway, permissions, state transitions, and audit.
3. **UI and workflow:** the four routes, real API data, maps/drilldowns, analyst evidence flow, leadership decisions, and operational response.
4. **QuickML and pitch:** add only a measured model improvement, complete deployment verification, and demonstrate the evidence-to-action story.

Remote Catalyst mutations require a passing challenge-alignment review. Production requires separate approval and verification.


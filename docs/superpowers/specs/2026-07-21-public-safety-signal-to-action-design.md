# Public-Safety Signal-to-Action Platform Design

**Date:** 2026-07-21
**Status:** Approved product direction; detailed review required before implementation
**Shortlist customer:** Karnataka State Police
**Long-term product boundary:** Configurable police and public-safety intelligence platform

## 1. Product Decision

Karnataka State Police is the first jurisdiction configured on the platform; it is not the product boundary. The product follows the enterprise-platform model used by systems such as ServiceNow:

- a licensed organization receives a governed instance;
- the organization configures its identity provider, brand, hierarchy, roles and policies;
- existing operational systems remain systems of record and connect through controlled adapters;
- shared platform services turn connected records into workflows, reports, intelligence and audited action;
- administrators configure the experience without requiring a product rewrite.

The first market is police and public safety. Expansion into unrelated government departments is deliberately deferred so the product remains coherent and credible.

For the Datathon, the application is a single KSP Development instance with explicit jurisdiction seams. It must not claim that global multi-tenancy, live CCTNS access, Entra ID federation or CCTV ingestion has already been implemented.

## 2. Shortlist Outcome

The July 26 build must prove one memorable and useful journey:

```text
KSP-shaped FIR records
  -> validated source mirror
  -> governed intelligence features
  -> explainable multi-signal detection
  -> persisted intelligence alert
  -> map, cases, people and relationship evidence
  -> officer note, assignment or escalation
  -> immutable audit history
```

The flagship scenario is an emerging vehicle-theft pattern spanning multiple police stations or districts. The detector must derive the signal from records and method parameters. Changing the qualifying records must change or remove the signal. A hard-coded alert card, static count or scripted explanation does not satisfy this design.

## 3. Platform Model

### 3.1 Organization and jurisdiction configuration

The platform shell separates the product from the active customer configuration.

The KSP configuration supplies:

- organization name, emblem and approved visual identity;
- state, district, sub-division, circle, station and unit hierarchy;
- ranks, designations, responsibilities and unit assignments;
- legal, case-category and workflow reference data;
- default dashboards and navigation visibility by role;
- locale, timezone and future language preferences;
- authentication and source-connector settings when those integrations are authorized.

The MVP may read this configuration from the existing workspace/access projection and a small frontend organization descriptor. It does not require a general-purpose tenant-administration product before the shortlist.

### 3.2 Identity and authorization

Catalyst Authentication remains the Development identity boundary. The architecture keeps an identity-provider seam for later Microsoft Entra ID, Google Workspace or another approved SSO provider.

Authorization is resolved server-side from effective role, designation, unit hierarchy, explicit permission and case assignment where required. Branding, hidden navigation and dashboard sharing never grant data access.

### 3.3 Operational source mirror

The 26 entities and business identifiers from `Police_FIR_ER_Diagram.pdf` remain represented in `SRC_*` tables. Catalyst references may be additive, but they do not replace identifiers such as `CaseMasterID`, `CrimeNo` or `CaseNo`.

For the prototype, realistic synthetic records populate the source mirror. In production, a controlled adapter would read authorized on-premises records incrementally, reconcile accepted and rejected rows, and preserve source lineage. The intelligence engine must consume the same accepted-record contract in both cases.

### 3.4 Public-safety intelligence graph

The public-safety equivalent of a CMDB is a governed intelligence fabric connecting:

- cases and legal classifications;
- accused, victims and complainants;
- repeat identities and co-accused relationships;
- locations, stations, districts and jurisdictions;
- vehicles and property when available;
- future cameras, sensors, dispatch events and authorized external signals.

The MVP does not require a new graph database. Existing relational source, transformation and intelligence tables plus evidence-labelled relationship projections are sufficient.

### 3.5 Detection and alerting

The existing transparent intelligence engine remains authoritative for the shortlist. Pattern Fusion combines bounded spatial, temporal, crime-category, legal-section, text-similarity and network evidence. It records method version, component contributions, confidence, evidence cases and limitations.

A detected finding becomes a persisted alert only through the existing refresh/projection boundary. Alerts are governed work records, not notifications or decorative dashboard widgets. Each alert exposes:

- what was detected and over which observation period;
- why it was unusual or connected;
- contributing evidence and affected jurisdiction;
- confidence, component contributions and method version;
- known data-quality limitations;
- status, ownership, notes, escalation and outcome;
- immutable finding identity and append-only audit events.

Future QuickML or video models may propose candidate signals. They must enter the same evidence, review, workflow and audit boundary rather than bypassing it.

### 3.6 Provisioned Catalyst AI

The live Datathon project provides two current QuickML foundation models:

- `GLM-4.7-Flash`: 30B-total/3B-active mixture-of-experts language model with an input limit up to 200K tokens;
- `VL-Qwen3.6-35B-A3B`: 35B-total/3B-active vision-language model supporting up to three images, multilingual visual OCR, document/chart question answering, structured JSON and bounding-box output.

The project also contains three Hack2Skill-specific trained Zia NLP services:

- `hack2skill-asr`: English, Hindi and Kannada audio transcription;
- `hack2skill-translation`: translation across English and ten Indian languages including Kannada;
- `hack2skill-tts`: English, Hindi and Kannada speech synthesis with configured speakers, speed, pitch and emotion.

All five services expose authenticated India-region endpoints with the `QuickML.deployment.READ` OAuth scope. They are provisioned capabilities, not yet integrated product features. The older Qwen 2.5 LLMs are deprecated in the live console and must not be selected for new work.

The shortlist uses these services only through a server-side Evidence Copilot boundary:

```text
authorized Kannada/English question
  -> ASR when audio is provided
  -> translation when required
  -> GLM receives a bounded stored-evidence payload
  -> response is schema-validated and evidence-referenced
  -> optional translation and TTS
```

The Copilot never creates an analytical finding, changes evidence, changes workflow state or answers from records outside the caller's authorization. Qwen Vision, RAG and Knowledge Base remain deferred until a real image/document journey is implemented and evaluated.

## 4. User Experience

### 4.1 Catalyst-inspired enterprise shell

The frontend uses Catalyst as a layout and interaction reference, not as copied branding.

The desktop shell contains:

1. a narrow global product rail for platform-level applications;
2. a contextual module sidebar for the selected application;
3. a light top bar containing the KSP organization identity, search, scope and user context;
4. a dense but calm working canvas with compact controls, restrained borders and minimal decorative effects;
5. a persistent synthetic-data notice in Development.

The configured customer emblem and `Karnataka State Police` identity appear prominently. The platform name may remain descriptive until a company/product brand is selected. Zoho logos, Catalyst artwork and proprietary assets are not copied.

### 4.2 Application structure

The product rail exposes stable public-safety domains:

- Home
- Crime Intelligence
- Investigations
- Operations
- Analytics
- Data & AI
- Administration

Only Crime Intelligence and the supporting Home/Analytics paths need shortlist depth. Other domains may appear only when they lead to an existing working capability; disabled theatre is excluded.

Within Crime Intelligence, the contextual navigation provides:

- Active Signals
- Hotspots
- Patterns
- Offender Networks
- Area Risk
- Reports and Dashboards

### 4.3 Home and configurable dashboards

There is no universal scripted homepage. The effective landing dashboard is resolved from administrator role defaults and user preference. Users may consume governed reports, while authorized owners can create, share and place reports on dashboards. Report execution always reapplies the viewer's scope.

The shortlist video should open directly on the configured KSP intelligence workspace rather than spending time demonstrating a general dashboard builder.

### 4.4 Signal workspace

The flagship screen is a two-pane Active Signals workspace:

- the left pane lists authorized signals with severity, status, affected units, age and confidence;
- the right pane opens the selected signal without losing list context;
- the header states the finding in operational language and clearly labels it as requiring human verification;
- evidence tabs show Overview, Map, Timeline, Cases, Network and Activity;
- the Overview explains component contributions, baseline/observation context, recommendation and limitations;
- workflow actions support a real note and at least one valid assignment, acknowledgement or escalation transition;
- Activity shows persisted workflow/audit history where the current API exposes it.

Map, case and network views must be linked to the same alert evidence identifiers. They must not present unrelated demo datasets as if they support the finding.

### 4.5 Visual direction

Use the measured Catalyst-like design language already agreed during visual exploration:

- Inter or the closest already available system sans-serif; no novelty display font;
- white and `#F8FAFC` surfaces;
- dark slate text, restrained grey borders and `#2A65F0` primary actions;
- compact 36px controls, 6px control radius and approximately 10px panel radius;
- 14px default body text and approximately 22px page titles;
- information density suitable for enterprise investigation;
- no gradients, oversized KPI typography, glass effects, theatrical greetings or decorative AI prose;
- color is never the only indicator of severity or state.

The responsive version may collapse navigation for tablets, but the shortlist target is a polished desktop investigation workspace.

## 5. Functional Integrity

The UI must call the existing Catalyst API contracts. It must never embed the flagship alert, evidence, confidence, case identifiers or workflow result in frontend constants.

The demo dataset is synthetic but structurally real:

- it follows the PDF source semantics;
- it contains a planted positive vehicle-theft pattern;
- it includes a negative control that should not join the pattern;
- the refresh function calculates and persists outputs;
- the API scopes and returns persisted outputs;
- frontend views render those responses;
- workflow writes use expected state/version and idempotency protection;
- audit entries remain append-only.

When data or a service is unavailable, the interface shows a precise unavailable, partial or empty state. It does not silently replace missing API data with convincing sample values.

## 6. Build Scope

### 6.1 Build for shortlist

1. Rework the current SPA into the Catalyst-inspired global rail, contextual sidebar and KSP organization header.
2. Make Active Signals the primary Crime Intelligence journey.
3. Upgrade alert list and detail into the linked two-pane workspace.
4. Present the existing Pattern Fusion explanation and evidence clearly.
5. Connect existing hotspot and offender-network views to the selected signal where identifiers permit it.
6. Complete a real audited note plus one valid lifecycle action from the browser.
7. Preserve existing configurable report/dashboard capabilities behind the platform navigation.
8. Verify the positive fixture, negative control, backend APIs, frontend tests and production build.
9. Deploy only to Catalyst Development after local verification and explicit deployment authorization.

### 6.2 Explicitly defer

- live CCTV, social-media or dispatch ingestion;
- production on-premises synchronization;
- real Entra ID/Google SSO federation;
- global tenant provisioning and billing;
- arbitrary no-code table/application creation;
- a conversational assistant or generated executive narrative;
- additional ML models added only for marketing breadth;
- full investigation case management unrelated to the signal journey.

The UI may describe these as the platform's extension model only in architecture/pitch material, not as completed product functionality.

## 7. Challenge Capability Continuity

The flagship Pattern Fusion journey provides the narrative, while the platform preserves visible, working entry points for every Challenge 02 capability. These are supporting analytical views, not separate decorative dashboards.

| ID | Capability | Shortlist proof |
|---|---|---|
| CH02-01 | Fragmented-record unification | PDF-aligned `SRC_*` entities, accepted/rejected reconciliation and source-to-evidence lineage feed the selected alert. |
| CH02-02 | Actionable intelligence | The selected finding becomes a persisted alert with note, ownership/lifecycle action and audit evidence. |
| CH02-03 | Interactive dashboards and maps | Configurable reports/dashboards remain available; the selected alert opens evidence-linked map and analytical views. |
| CH02-04 | Hotspot detection | The Hotspots view renders persisted, versioned spatial output and contributing cases. |
| CH02-05 | District drilldown | The selected cross-jurisdiction signal moves from affected districts/stations to authorized cases. |
| CH02-06 | Trend and anomaly alerts | The supporting Anomalies view shows observed/baseline comparison, method, period and evidence. |
| CH02-07 | Criminal network/link analysis | The selected signal opens an evidence-labelled case/person/co-accused network. |
| CH02-08 | Repeat-offender tracking | The network view distinguishes governed repeat identity from same-name similarity and exposes linked cases. |
| CH02-09 | Socio-economic crime correlation | The District Context view remains aggregate, synthetic/source-labelled and explicitly non-causal. |
| CH02-10 | Predictive risk scoring | The Area Risk view scores only areas/time windows and explains components, period, missingness and version. |
| CH02-11 | AI/ML pattern detection | Pattern Fusion derives the flagship signal from spatial, temporal, crime, legal, text and network evidence with positive and negative controls. |

The recording does not need equal screen time for all eleven items. It must show the flagship journey deeply and then briefly demonstrate that the supporting analytical capabilities are working, evidence-linked platform services.

## 8. Scale Readiness

Correctness on 50 synthetic FIRs is not a production-capacity claim. KSP-scale operation may involve millions of historical and continuously changing records. The platform therefore separates correctness proof, scale architecture and measured capacity.

### 8.1 Existing scale-safe boundaries

- analytics run in the `intelligence_refresh` Job Function, never inside dashboard requests;
- source, transformation, intelligence and workflow records are separated;
- analytical results are precomputed, versioned and persisted;
- job commands are idempotent and findings retain evidence lineage;
- APIs read bounded prepared projections rather than calculating intelligence on demand.

### 8.2 Required hardening

- replace all-pairs hotspot neighbourhood discovery with a spatial-cell candidate index;
- replace global Pattern Fusion pair comparison with bounded candidate generation by observation window, crime classification and spatial/legal/network blocks;
- index identity appearances by authoritative person ID and normalized candidate keys rather than comparing every appearance pair;
- process only affected jurisdiction/time partitions after new or changed FIRs;
- preserve deterministic output equivalence on the controlled 50-case fixture;
- add local 1K, 10K and 50K feature-level benchmarks with elapsed time, candidate count and bounded-memory observations;
- retain only the approved small demonstration batch in Catalyst Development unless a separate billed load test is authorized.

The 50K local benchmark demonstrates removal of obvious quadratic behavior; it does not certify production throughput or nationwide capacity. Production certification requires KSP volumes, workload patterns, infrastructure limits and service-level objectives.

## 9. Shortlist Demonstration

The 2-5 minute recording follows one uninterrupted story:

1. Open the KSP-configured platform and identify the authorized jurisdiction.
2. Show a newly generated vehicle-theft signal in Active Signals.
3. Open it and explain the recent pattern, affected stations and confidence components.
4. Use the map and case/network evidence to prove why the cases were connected.
5. Show the method version, limitations and human-verification safeguard.
6. Add a note and perform one authorized action; show the persisted status/audit result.
7. Briefly reveal configurable reports/dashboards and the platform application model.
8. Close with the deployment model: KSP first, additional police organizations through branding, identity, hierarchy, policy and connector configuration.

## 10. Acceptance Contract

The design is accepted only when all of the following are true:

- the flagship signal is produced by the intelligence pipeline from accepted source records;
- removing or changing qualifying records changes the detected result;
- a negative-control case is excluded for an explainable reason;
- the alert, evidence, map/network linkage and workflow use consistent identifiers;
- all returned data is server-scoped to the acting persona;
- a browser workflow mutation persists and produces an audit artifact;
- the UI contains no hard-coded intelligence result or fake success response;
- synthetic status and model limitations remain visible;
- the full backend suite, frontend suite, production build and Catalyst bundle checks pass;
- the experience clearly reads as a configurable public-safety platform, not a generic dashboard.
- each CH02 capability in the continuity table has a working route/API or an already verified analytical output; none is claimed from a label alone.
- hotspot, identity and Pattern Fusion candidate generation avoids an unbounded all-record pair scan;
- the 50K local benchmark completes with recorded candidate counts and without loading 50K FIRs into Catalyst Development;
- Copilot output is grounded in authorized stored evidence and fails closed when any model or language service is unavailable.

## 11. Authority and Compatibility

This design narrows the shortlist experience described by `2026-07-21-intelligence-workspaces-and-reporting-design.md`; it does not discard the working reporting platform. It also preserves the constraints in `docs/architecture/mvp-build-contract.md` and the PDF semantic-integrity design.

If presentation breadth conflicts with the signal-to-action journey before July 26, this document controls: finish the functional flagship journey first.

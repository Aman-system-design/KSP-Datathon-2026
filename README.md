<p align="center">
  <img src="web/public/brand/karnataka-state-police.webp" alt="Karnataka State Police emblem" width="92" />
</p>

<h1 align="center">KSP ACE Intelligence Platform</h1>

<p align="center">
  <strong>Explainable, role-aware decision intelligence for accountable policing.</strong>
</p>

<p align="center">
  KSP ACE connects fragmented FIR records to governed analytics, evidence-linked visualizations and human-owned action.
</p>

<p align="center">
  <a href="https://ace.onslate.in"><img alt="Open the Catalyst Development demo" src="https://img.shields.io/badge/LIVE_DEMO-CATALYST_DEVELOPMENT-0A8F83?style=for-the-badge" /></a>
  <a href="Architecture.md"><img alt="Read the architecture" src="https://img.shields.io/badge/ARCHITECTURE-VIEW_BLUEPRINT-1769AA?style=for-the-badge" /></a>
  <a href="PRD.md"><img alt="Read the product requirements" src="https://img.shields.io/badge/PRODUCT-READ_PRD-4F46E5?style=for-the-badge" /></a>
</p>

<p align="center">
  <img alt="Status: functional development prototype" src="https://img.shields.io/badge/status-functional_development-0F766E" />
  <img alt="KSP Datathon 2026 Challenge 02" src="https://img.shields.io/badge/KSP_Datathon_2026-Challenge_02-1D4ED8" />
  <img alt="Data: deterministic synthetic only" src="https://img.shields.io/badge/data-deterministic_synthetic_only-C2410C" />
  <img alt="Human decisions remain authoritative" src="https://img.shields.io/badge/decisions-human_authoritative-7C3AED" />
</p>

> [!IMPORTANT]
> The live site is a functional Zoho Catalyst **Development** deployment containing deterministic synthetic data only. It is not certified for operational policing, contains no real KSP records and must not be used to make decisions about real people.

## The problem

Police information is distributed across cases, people, arrests, legal events, organizations, time and geography. Conventional reporting makes it difficult to detect patterns across those records, explain why a signal matters, deliver it within the correct jurisdiction and record what happened after review.

KSP ACE implements one governed path from fragmented data to accountable action:

```text
Fragmented FIR-aligned records
        -> validation, rejection and deterministic linking
        -> versioned analytical runs
        -> explainable findings with evidence and limitations
        -> role- and geography-scoped workspaces
        -> human verification, assignment, action and outcome
        -> append-only audit history
```

The platform is deliberately not a black-box predictive-policing system. Similarity is treated as an investigative lead, aggregate correlation is not presented as causation, and no model is permitted to autonomously determine guilt, predict individual future crime or initiate police action.

## What the prototype proves

| Platform capability | Working evidence in this repository |
|---|---|
| **Governed ingestion** | Separate FIR-aligned source entities, semantic validation, redacted rejection records and deterministic relationship linking |
| **Explainable analytics** | Hotspots, temporal anomalies, repeat identity, relationship networks, area risk and cross-district Pattern Fusion |
| **Intelligence utilities** | Versioned utility catalogue, bounded rule configuration, manual evaluation and deterministic alert qualification |
| **Report builder** | Governed semantic sources with typed filters, aggregation, sorting, tabular and visual report projections |
| **Dashboard studio** | Private and shared dashboards, bounded layouts, role defaults, ownership checks and optimistic concurrency |
| **Geospatial intelligence** | MapLibre/deck.gl rendering, governed layers, viewport filtering, evidence lineage and visible-feature tables |
| **Alert-to-outcome workflow** | Acknowledge, assign, annotate, escalate, conclude and record outcomes without overwriting the original finding |
| **Operational control** | Versioned refresh requests, idempotent retries, coherent publication groups, health checks and safe failure states |
| **Auditability** | Correlated resource access events, append-only workflow records and verifiable HMAC audit chains |

## Challenge 02 alignment

The implementation maps each challenge requirement to executable behavior and automated evidence rather than relying on screen labels or mock values.

| ID | Challenge requirement | Implemented response |
|---|---|---|
| **CH02-01** | Unify fragmented records | Validates and links the supplied 26-entity FIR model while retaining ingestion quality and rejection evidence |
| **CH02-02** | Produce actionable intelligence | Connects persisted findings to acknowledgement, assignment, analyst review, escalation and outcome |
| **CH02-03** | Interactive dashboards and maps | Provides composable dashboards, governed reports, MapLibre maps and authorized evidence drill-down |
| **CH02-04** | Crime hotspot detection | Uses bounded spatial candidate generation, active observation windows and positive/negative controls |
| **CH02-05** | District-level drill-down | Applies the Unit hierarchy from State to district/station scope and preserves not-found semantics outside authority |
| **CH02-06** | Trend alerts and anomaly detection | Compares observations with deterministic baselines and retains expected range, period, version and limitations |
| **CH02-07** | Criminal network analysis | Builds evidence-labelled case-person, co-accused, legal, location and time relationships |
| **CH02-08** | Repeat-offender tracking | Resolves repeated appearances through authoritative identifiers without treating name similarity as proof |
| **CH02-09** | Socio-economic correlation | Restricts contextual analysis to aggregate district indicators with source, period and non-causation safeguards |
| **CH02-10** | Predictive risk scoring | Produces explainable area-level attention scores from observable contributors, never person-level predictions |
| **CH02-11** | AI/ML pattern detection | Runs bounded cross-district Pattern Fusion and grounded text similarity over accepted, versioned inputs |

Detailed traceability is maintained in [docs/architecture/challenge-traceability.md](docs/architecture/challenge-traceability.md).

## Role-aware experience

The same analytical result is projected differently according to role, unit hierarchy, explicit permission and case assignment.

| Persona | Default experience and authority boundary |
|---|---|
| **State Police Leadership** | Statewide trends, cross-boundary patterns and monitored outcomes with evidence summaries |
| **District Leadership** | Authorized stations, local comparisons, attention queues, assignments and escalation |
| **Command Centre** | Intended as a Development-only aggregate, read-only presentation; one rule-mutation authorization mismatch is documented below |
| **Crime Analyst** | Maps, timelines, networks, evidence quality and structured conclusions while preserving original findings |
| **Station Operations** | Station-scoped cases, local signals, pending actions and bounded operational reports |
| **Investigator** | Assigned evidence, related cases and verification tasks only where explicitly authorized |
| **Platform Administrator** | Technical configuration, job health and governed operations without automatic evidence access |
| **Auditor** | Read-only activity, version, access and decision traceability |

## Architecture and code organization

<p align="center">
  <img src="KSP_ACE_Architecture_Jury_Simplified.png" alt="KSP ACE architecture showing governed data flowing through explainable analytics into role-scoped views and accountable action" width="100%" />
</p>

The code separates five responsibilities so that a visual component cannot invent intelligence or expand authority:

1. **Ingestion and validation** accept schema-aligned source data and record quality outcomes.
2. **Analytical cores** remain deterministic, renderer-neutral and independently testable.
3. **Repositories and Catalyst adapters** isolate storage, pagination, concurrency and SDK behavior.
4. **Security and service layers** derive identity and effective scope on the server.
5. **React workspaces** render governed API results, explicit asynchronous states and evidence links.

```text
web/                         React workspaces, reports, dashboards and maps
src/backend/                 HTTP, security, services, workflows and repositories
packages/intelligence-core/  Deterministic explainable analytical engines
packages/geospatial-core/    Renderer-neutral geospatial contracts
functions/                   Built Catalyst API and scheduled refresh Functions
schema/                      FIR/PDF-aligned and Catalyst schema contracts
fixtures/                    Deterministic synthetic inputs and hidden truth
tests/                       Architecture, analytics, API, security and UI verification
docs/                        Decisions, traceability, runbooks and release evidence
```

Canonical source lives under `src/` and `packages/`. Function bundles are produced through the governed build script and inspected for manifest drift, unresolved imports and forbidden files.

For the complete design, see [Architecture.md](Architecture.md).

## Security, privacy and responsible use

Security is enforced at the backend boundary, not inferred from hidden UI controls.

- Catalyst Authentication supplies the current user; client-provided identity, role and scope are ignored.
- Effective access combines role, explicit actions, assigned unit hierarchy and case assignment where required.
- Cross-unit evidence is redacted or hidden unless a specific permission or assignment allows it.
- Report, map and dashboard sharing is reauthorized for the current viewer at read and execution time.
- Inputs, limits, pagination, workflow versions and idempotency keys are validated and bounded.
- Public errors and structured logs exclude evidence payloads, personal details, tokens, SDK internals and stack traces.
- Sensitive reads and workflow mutations create correlated audit records; audit-key material is not persisted.
- Original analytical findings remain immutable while analyst and officer interpretations are recorded separately.
- Included records, names, locations and outcomes are deterministic synthetic fixtures.

> [!CAUTION]
> Development demo access is shared for evaluation convenience and must never be reused for operational data. A production deployment requires individual identity federation, credential rotation, reviewed API Gateway policy, retention controls, incident response and an independent security assessment.

## Inclusive and accessible interaction

The interface is designed around semantic navigation and progressive disclosure rather than color or pointer interaction alone.

- Semantic headings, landmarks, tables, forms and native controls are preferred.
- Interactive icons receive accessible names and decorative icons are hidden from assistive technology.
- Loading, empty, partial, forbidden and error states use appropriate status or alert announcements.
- Keyboard users receive visible focus treatment on primary navigation and workspace controls.
- Map evidence is also available through a visible-feature table rather than only through marks on a canvas.
- Resizable geospatial panels expose keyboard-adjustable controls and value metadata.
- Touch-oriented primary controls target at least 44px where the compact operational layout permits.
- Locally packaged fonts avoid a third-party font request during authenticated use.

This prototype has extensive component-level accessibility assertions, but it has not completed an independent WCAG conformance audit or comprehensive screen-reader matrix. Automated Axe/Pa11y checks, contrast verification and browser-level keyboard journeys remain production-readiness work.
.

### Deterministic scale benchmark

The benchmark runs locally over generated analytical feature records. It does not load 50,000 FIRs into Catalyst Development.

| Feature records | Theoretical pairs | Pattern candidates | Candidate reduction | Elapsed time | Node.js heap |
|---:|---:|---:|---:|---:|---:|
| 1,000 | 499,500 | 15 | 99.9970% | 0.09 s | 9.4 MB |
| 10,000 | 49,995,000 | 23,735 | 99.9525% | 1.39 s | 49.2 MB |
| 50,000 | 1,249,975,000 | 669,412 | 99.9464% | 39.56 s | 246.2 MB |

The planted hotspot, repeat-identity signal and cross-district pattern remained detectable at every scale. These results demonstrate bounded candidate generation and guard against obvious quadratic behavior; they are not a statewide-capacity certification or latency guarantee.

## Technology stack

| Layer | Technology |
|---|---|
| Cloud platform | Zoho Catalyst Slate, Authentication, Data Store, Functions and Job Scheduling |
| Web application | React 19, React Router and Vite 8 |
| Geospatial rendering | MapLibre GL, deck.gl, PMTiles, Supercluster and H3 |
| Backend runtimes | Node.js 24 API Function and isolated Node.js 18 refresh Function |
| Analytics | First-party deterministic JavaScript modules with versioned contracts |
| Verification | Node test runner, Vitest, Testing Library, bundle/schema validators and CircleCI |

### Catalyst service boundaries

| Catalyst service | Current responsibility | Readiness boundary |
|---|---|---|
| **Slate** | Hosts the React client | Functional Development deployment |
| **Authentication** | Resolves the current user and session | Implemented; production federation remains pending |
| **Data Store** | Persists source, intelligence, workflow, configuration and audit records | Implemented Development boundary |
| **Functions** | Serves authenticated APIs and scheduled intelligence refresh | Built and bundle-inspected |
| **Job Scheduling** | Submits bounded, versioned refresh requests | Implemented workflow |
| **API Gateway** | Intended production routing, authentication and throttling boundary | Required before operational exposure |
| **Stratus** | Approved future boundary for large evidence/geospatial objects | Not required by the current prototype |
| **QuickML** | Governed future custom AI/ML and multilingual assistance | Not an alert or police-action authority |

## Run locally

### Requirements

- Node.js 24 and npm
- The separately installed Node.js 18 compatibility runtime for the deployed refresh Function path

```bash
git clone https://github.com/Aman-system-design/KSP-Datathon-2026.git
cd KSP-Datathon-2026
npm install
npm run verify
npm run intelligence:benchmark
```

`npm run verify` executes backend tests, frontend tests, the production web build, bundle-budget checks, both Catalyst Function builds and inspections, and both schema validators.

Copy `.env.example` for local configuration. Runtime secrets belong in environment-managed configuration; never commit OAuth tokens, audit keys, private credentials or identifiable operational data.

## Known boundaries and production roadmap

This repository demonstrates a production-shaped architecture, not operational production certification. Before connecting real or identifiable data, the project requires:

- KSP-approved SSO and individual identity lifecycle management;
- removal of shared demo access and formal credential rotation;
- reviewed API Gateway, network and external-integration policies;
- representative-volume capacity tests and monitored service objectives;
- backup, recovery, retention, deletion and incident-response procedures;
- independent security, privacy, accessibility and legal assessment;
- formal analytical governance, drift monitoring and model-change approval;
- approved integration with FIR, court, forensic and GIS systems;
- user acceptance testing with leadership, analysts and station personnel.

Potential extensions include governed Kannada-English transcription, translation and evidence assistance, plus secure responsive and offline-capable field workflows. These extensions cannot replace unfinished Challenge 02 evidence or bypass human review.

## Documentation

| Document | Purpose |
|---|---|
| [Product Requirements](PRD.md) | Users, outcomes, scope and acceptance criteria |
| [Architecture](Architecture.md) | Runtime flow, module boundaries and Catalyst mapping |
| [Engineering Rules](Rules.md) | Security, data, AI, testing and delivery constraints |
| [Delivery Phases](Phases.md) | Sequenced implementation and objective exit criteria |
| [Visual Design](Design.md) | Experience, responsive behavior and accessibility standards |
| [Challenge Traceability](docs/architecture/challenge-traceability.md) | Challenge requirements mapped to implementation evidence |
| [Business Architecture](docs/architecture/business-architecture-blueprint.md) | Problem, roles, decisions and intelligence-to-action flow |
| [Role and Access Design](docs/architecture/role-access-and-experience-design.md) | Persona experiences, permitted actions and safeguards |
| [Project Memory](docs/PROJECT_MEMORY.md) | Dated decisions, deployment state and verification evidence |

## Data and evaluation notice

All included records and identities are deterministic synthetic fixtures created for KSP Datathon 2026. Do not add real police records, personal credentials, confidential company data or identifiable real-person information to this repository.

---

<p align="center">
  <strong>KSP ACE - Analyse anything. Visualize everything. Keep every decision explainable.</strong>
</p>

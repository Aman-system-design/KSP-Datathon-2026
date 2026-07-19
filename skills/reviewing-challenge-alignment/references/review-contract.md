# Challenge Alignment Review Contract

## Required sources

Read these project files before judging a change:

1. `docs/architecture/challenge-traceability.md`
2. `docs/architecture/business-architecture-blueprint.md`
3. `docs/architecture/role-access-and-experience-design.md`
4. `docs/PROJECT_MEMORY.md`
5. `Police_FIR_ER_Diagram.pdf` only when a change affects the FIR schema or entity relationships

## Gate A: Official challenge coverage

Confirm the change preserves or improves these capabilities:

| ID | Required capability |
|---|---|
| CH02-01 | Unified treatment of fragmented records |
| CH02-02 | Actionable intelligence rather than passive reporting |
| CH02-03 | Interactive dashboards and geospatial maps |
| CH02-04 | Crime hotspot detection |
| CH02-05 | District-level drilldowns |
| CH02-06 | Trend alerts and anomaly detection |
| CH02-07 | Criminal network and link analysis |
| CH02-08 | Repeat-offender tracking |
| CH02-09 | Aggregate socio-economic crime correlation |
| CH02-10 | Explainable area-risk scoring |
| CH02-11 | AI/ML-based pattern detection |

For each affected ID, require behavior, data, user value, and proof. A label or mock value is insufficient.

## Gate B: Product architecture

Confirm the change supports the approved flow:

**Fragmented sources → validation/linking → analytics → explainable intelligence → role-aware decision → accountable action/outcome**

Reject changes that bypass evidence, collapse roles into unrestricted access, overwrite original model output, or turn the platform into an ungoverned dashboard.

Respect the MVP boundary:

- Fully implement State Leadership, District/Division Leadership, and Crime Analyst.
- Keep the shared Station/Investigator view light.
- Prove Administrator/Auditor controls without building an enterprise suite.
- Express Regional/Commissionerate behavior through adaptive unit scope.

## Gate C: Catalyst by Zoho

Confirm matching capabilities use Catalyst-native services unless an exception is documented and approved:

- Hosting/SPA: Slate or Web Client Hosting
- Backend: Serverless Functions; AppSail only when justified
- API boundary: API Gateway
- Relational data: Data Store
- Objects: Stratus
- Authentication: Catalyst Authentication
- ML: QuickML/Zia AutoML where suitable
- Schedules/events: Cron, Job Scheduling, Signals, Event Functions
- CI/CD: Catalyst Pipelines when enabled

FAIL an unapproved substitution such as Supabase/Firebase for a matching Catalyst data or authentication capability. Do not reject third-party libraries when Catalyst has no equivalent and the library runs within an approved Catalyst deployment.

## Gate D: Data and schema

Verify:

- synthetic records remain aligned to the supplied FIR schema;
- source extracts remain visibly fragmented before validation/linking;
- identifiers and relationships are consistent;
- invalid or rejected records are observable;
- synthetic content is prominently labelled;
- no identifiable real-person data is introduced;
- district context remains aggregate and sourced or labelled synthetic.

## Gate E: AI, explainability, and policing safety

Every significant alert or score must expose signal, evidence, confidence/severity, recommendation, limitation, method/model version, and observation period.

FAIL changes that:

- predict that a specific person will commit a future crime;
- target individuals using caste, religion, or socio-economic attributes;
- present correlation as causation;
- present similarity as proof of guilt or criminal association;
- generate briefs unsupported by stored evidence;
- allow AI output to bypass analyst/officer confirmation where confirmation is required.

## Gate F: Authorization and audit

Effective access must follow rank hierarchy, designation, assigned unit hierarchy, and explicit platform permission. Rank alone never grants access.

Verify geographic and case scope, sensitive-evidence access, immutable original findings, append-only audit behavior, and distinct system/analyst/officer evidence labels.

## Gate G: Verification

Require proportionate evidence:

- automated tests for calculations, APIs, permissions, and state transitions;
- fixtures for planted synthetic patterns and negative controls;
- observed commands and results, not planned tests;
- acceptance evidence linked to affected CH02 IDs;
- no regression in unaffected required behavior.

UI existence alone never proves hotspot, anomaly, network, repeat-offender, correlation, risk, or pattern-detection behavior.

## Change classification

| Classification | Meaning | Treatment |
|---|---|---|
| Direct | Implements or changes a CH02 capability | Require requirement and acceptance mapping |
| Enabling | Infrastructure needed by approved architecture | Require architecture and verification mapping |
| Neutral | Refactor, tests, reliability, documentation | Allow when contracts remain intact |
| Drift | Unapproved feature or architecture divergence | WARN or FAIL based on impact |

## Severity

| Severity | Meaning |
|---|---|
| FAIL | Must not push/deploy until resolved or explicitly re-designed and approved |
| WARN | May proceed only with documented justification, owner, and follow-up |
| PASS | No unresolved alignment issue; evidence is sufficient for the change scope |

The most severe unresolved issue controls the overall verdict.

## Rationalization counters

| Rationalization | Required response |
|---|---|
| "The deadline is tomorrow." | Reduce scope; do not weaken safety or claim unverified completion. |
| "Judges only see the demo." | Demo claims must remain traceable to working behavior. |
| "Catalyst setup is slower." | Use the mandated service or document and approve a genuine capability gap. |
| "The model is accurate enough." | Provide validation, version, evidence, limitations, and human review. |
| "It is only synthetic data." | Synthetic data still requires integrity, labels, and negative controls. |
| "This is internal, so permissions can wait." | Role and geographic boundaries are core architecture, not polish. |


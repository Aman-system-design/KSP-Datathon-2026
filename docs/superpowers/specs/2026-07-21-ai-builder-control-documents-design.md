# AI Builder Control Documents — Design

**Date:** 2026-07-21  
**Status:** Approved for implementation  
**Visual direction:** Command Navy

## Purpose

Give Codex, Antigravity, and future AI builders a small, stable entry point into the project without duplicating the detailed architecture already under `docs/`.

## Document Authority

The following files will live at the repository root and be read in this order:

1. `Rules.md` — non-negotiable engineering and safety constraints.
2. `PRD.md` — product outcomes, users, scope, and acceptance criteria.
3. `Architecture.md` — system boundaries, data flow, Catalyst services, and repository map.
4. `Design.md` — visual language and role-specific UX standards.
5. `Phases.md` — delivery sequence through the July 26 submission.
6. `docs/PROJECT_MEMORY.md` — the only project memory and progress ledger.

No root `Memory.md` will be created. Existing detailed documents remain authoritative evidence and are linked instead of copied.

## Content Design

### `PRD.md`

- Position the product as decision intelligence for district policing.
- Define state leadership, city/district leadership, station leadership, analysts, investigators, and command-centre users.
- Describe the primary journey: signal → intelligence → evidence → decision → recorded action.
- Cover every Challenge 02 requirement: dashboards, maps, hotspots, drilldowns, anomalies, networks, repeat offenders, socio-economic correlation, explainable risk, and AI/ML pattern detection.
- Separate MVP, post-MVP, and explicitly excluded claims.
- Use measurable acceptance criteria and prohibit black-box person-level prediction.

### `Architecture.md`

- Show the production-shaped flow from PDF-faithful source tables through validation, feature computation, analytics, evidence, APIs, React UI, and action workflow.
- Map components to Catalyst-native services.
- Preserve modular boundaries: ingestion, validation, analytics engines, API adapters, and frontend features must not become a monolith.
- Include the current repository structure and links to detailed architecture documents.
- State what is functional today and what is not yet built.

### `Rules.md`

- Require Catalyst-native services where applicable and source-schema fidelity.
- Ban hard-coded analytical results, fabricated AI claims, secrets, real police data, and hidden fallback behavior.
- Require evidence-bearing outputs, deterministic fixtures, input validation, least privilege, audit logging, and safe errors.
- Define testing and review gates proportionate to the six-day schedule.
- Prefer native capabilities and existing dependencies; add abstractions only for a present requirement.

### `Phases.md`

- Record completed foundation work rather than pretending the project starts from zero.
- Prioritize the jury-visible vertical slice: leadership overview, geospatial hotspots, district drilldown, anomaly evidence, repeat-offender/network analysis, and explainable area risk.
- Use dated milestones from July 21 through July 26, each with exit criteria.
- Keep July 26 as deployment, rehearsal, evidence, and submission buffer—not feature-development day.

### `Design.md`

- Use the approved Command Navy direction: deep navy navigation/frame, light analytical work surfaces, blue data emphasis, saffron attention, and red only for urgent states.
- Use Inter with `Noto Sans Kannada` fallback and accessible type/contrast scales.
- Define role-adaptive shells for command centre, leadership desktop, analyst workstation, station desktop, and investigator tablet.
- Prioritize evidence and action over decorative metrics.
- Specify map semantics, charts, states, responsive behavior, accessibility, and reusable design tokens.

## Maintenance Rules

- Root documents state current decisions; detailed documents hold supporting depth.
- `docs/PROJECT_MEMORY.md` records dated progress, decisions, deployments, and blockers.
- When implementation changes behavior, update the smallest authoritative document in the same commit.
- Conflicts resolve in this order: `Rules.md`, `PRD.md`, `Architecture.md`, `Design.md`, `Phases.md`, then memory/history.

## Acceptance

- Five root documents exist and contain no unresolved placeholders.
- They cross-link to detailed evidence instead of reproducing it.
- Challenge 02 traceability is explicit.
- Catalyst is the deployment target throughout.
- The current implementation state is described honestly.
- An AI builder can identify the next approved task without rereading the whole repository.

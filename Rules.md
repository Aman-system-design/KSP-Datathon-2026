# Engineering Rules

These rules govern every human and AI contribution to the KSP Crime Decision Intelligence Platform. Read this file before changing code, schema, data, infrastructure, or product behavior.

## Authority

When documents conflict, apply this order:

1. `Rules.md`
2. `PRD.md`
3. `Architecture.md`
4. `Design.md`
5. `Phases.md`
6. `docs/PROJECT_MEMORY.md` for dated progress and history

Detailed evidence remains under `docs/`. The approved MVP contract is [`docs/architecture/mvp-build-contract.md`](docs/architecture/mvp-build-contract.md), and official challenge coverage is tracked in [`docs/architecture/challenge-traceability.md`](docs/architecture/challenge-traceability.md).

## Non-Negotiable Product Rules

- Build crime analytics that support accountable human decisions, not a generic visualization dashboard.
- Every finding must answer what changed, where, when, why it was raised, which evidence supports it, its limitations, and what review is recommended.
- Never predict individual offending, infer guilt, target a community, or present correlation as causation.
- Area risk applies only to geographic areas and time windows. It is not an individual risk score.
- Similar people, cases, text, or networks are investigative signals requiring verification, never proof.
- The MVP uses visibly synthetic data only. Do not add real police, company, personal, or confidential data.
- Do not claim operational accuracy or production readiness from synthetic evaluation.

## Data Rules

- Preserve all 26 PDF entities, original columns, spellings, business identifiers, and semantics in `SRC_*` tables.
- `CaseMaster` is the central case entity. `CrimeNo` is the PDF-defined 18-digit identifier; `CaseNo` is its last nine digits.
- Catalyst `*Ref` columns add physical relationships but never replace the PDF business identifiers.
- Store reusable features in `TRN_*`, immutable versioned findings in `INT_*`, and human actions/outcomes in `WF_*`.
- Validate keys, chronology, coordinates, enums, relationships, and synthetic provenance before analytics.
- Reconcile accepted plus rejected rows to the input count. Never silently drop or repair invalid evidence.
- Rejected payloads and sensitive details must not enter logs.
- Source records and published findings are immutable. Corrections create new versions or workflow records.

## AI and Analytics Rules

- Hard-coded scores, patterns, alerts, summaries, and demo-only API answers are forbidden.
- A capability counts only when it executes on accepted records, persists a versioned output, links evidence, states limitations, and passes positive and negative controls.
- Every run records method/model version, feature version, parameters, observation window, input batch/checksum, status, metrics, and output count.
- A failed or partial analytical run cannot become current and cannot create an alert.
- QuickML or LLM output may generate candidates or grounded explanations; it cannot independently create operational conclusions.
- Invalid model output is rejected. Do not replace unavailable ML with fabricated results.
- Analyst conclusions remain separate from original analytical findings.

## Catalyst and Architecture Rules

- Catalyst by Zoho is the mandatory deployment platform. Prefer a Catalyst-native service whenever it covers the requirement.
- Use Serverless Functions for backend logic, Data Store for relational data, Stratus for objects, Authentication for identity, API Gateway for protected routes, Job Scheduling/Cron for refresh, and Slate or Web Client Hosting for the React SPA.
- Keep ingestion, validation, analytics, repositories, API adapters, security, workflow, and frontend features as clear modules.
- Do not create one monolithic Function, service, React component, or global state container.
- Reuse existing modules and dependencies. Add a library only when the platform or standard library cannot meet a present requirement.
- Keep network, database, and Catalyst SDK calls behind adapters so core analytics remain deterministic and testable.
- All writes must be idempotent where retries are possible.

## Security and Privacy Rules

- Authentication and authorization fail closed.
- Effective access is rank plus designation plus assigned unit hierarchy plus explicit permission plus case assignment where required. Rank alone is never sufficient.
- Never trust client-supplied role, unit, identity, scope, or analytical values.
- Apply least privilege and row/evidence scoping on the server, not only in the UI.
- Personal evidence must be redacted or hidden when the caller has only aggregate access.
- Never commit credentials, keys, tokens, personal emails, `.env` files, Catalyst exports containing secrets, or audit HMAC keys.
- Log stable event and error codes, not stack traces, SDK payloads, personal details, or secrets.
- Every evidence access and workflow change must be auditable.

## API and Error Rules

- Public behavior is limited to the 12 routes in the MVP contract unless architecture approval changes it.
- Validate paths, methods, bodies, limits, pagination, expected state/version, unit scope, and idempotency keys.
- Return stable safe error shapes. Internal errors must not leak Catalyst, table, query, or stack details.
- Read responses include observation period, synthetic label, analysis/method version, quality status, and evidence references where relevant.
- Workflow commands require an authenticated actor, permission, scope, expected version, structured reason/payload, idempotency key, and audit event.

## Development and Quality Rules

- Work on a feature branch; never implement directly on `main` without explicit approval.
- Default to inline execution by Codex. Do not spawn subagents unless the founder explicitly requests them.
- Use small commits with one explainable purpose. Never include unrelated user files.
- Before committing: run focused tests, `npm.cmd test`, `git diff --check`, challenge-alignment review, and schema checks when schema changes.
- A feature is not complete because a screen renders. Test its data path, authorization, failure behavior, evidence, and persisted result.
- Preserve deterministic synthetic fixtures and hidden truth separation.
- Do not weaken or delete a failing test to make a build pass.
- No unresolved placeholders, silent fallbacks, dead code, copied sample handlers, or ignored failures.

## Frontend Rules

- The React SPA consumes real governed APIs; UI constants may only represent labels, layout, or explicit empty/demo states.
- Every analytical view supports loading, empty, stale, partial, forbidden, and error states.
- Every alert, score, map mark, chart point, and graph link must open its evidence or explanation when authorized.
- Follow [`Design.md`](Design.md) for Command Navy tokens, role shells, responsive behavior, and accessibility.
- Keyboard access, visible focus, WCAG AA contrast, semantic HTML, and 44px touch targets are required.

## Documentation Rule

When behavior changes, update the smallest authoritative document in the same commit. Record completed deployments, decisions, blockers, and handoffs in [`docs/PROJECT_MEMORY.md`](docs/PROJECT_MEMORY.md). Do not create another memory file.

# AI Builder Control Documents Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create five concise root documents that let any AI builder understand, extend, and verify the KSP Datathon platform without rereading the entire repository.

**Architecture:** Root documents are navigation and decision authorities, while detailed material remains under `docs/`. `docs/PROJECT_MEMORY.md` stays the sole progress ledger; no duplicate `Memory.md` is created.

**Tech Stack:** Markdown, Catalyst by Zoho, React, Node.js, ZCQL/Data Store, existing repository documentation.

---

## File Structure

- Create `Rules.md`: binding engineering, security, data, AI, testing, and documentation rules.
- Create `PRD.md`: product users, outcomes, MVP scope, exclusions, and acceptance criteria.
- Create `Architecture.md`: runtime flow, Catalyst service map, module boundaries, repository map, and current-state truth.
- Create `Design.md`: Command Navy tokens, responsive shells, maps, charts, interaction, and accessibility rules.
- Create `Phases.md`: dated execution sequence and objective exit criteria through July 26.
- Modify `docs/PROJECT_MEMORY.md`: add one dated entry registering the root authority and selected visual direction.

### Task 1: Product and Rule Authorities

**Files:**
- Create: `Rules.md`
- Create: `PRD.md`

- [ ] **Step 1: Write `Rules.md`**

State the authority order, Catalyst-native requirement, PDF schema fidelity, synthetic-data-only boundary, modular architecture rule, safe authentication/authorization defaults, evidence-bearing analytics requirement, ban on hard-coded intelligence, error/logging rules, minimum test gates, dependency discipline, and same-commit documentation rule. Link to `docs/architecture/challenge-traceability.md`, `docs/architecture/mvp-build-contract.md`, and `docs/PROJECT_MEMORY.md`.

- [ ] **Step 2: Write `PRD.md`**

Define the platform as decision intelligence for district policing; enumerate command-centre, state, city/district, station, analyst, and investigator users; specify the signal-to-action journey; trace all Challenge 02 capabilities; separate MVP, later expansion, and prohibited claims; include measurable demo acceptance criteria.

- [ ] **Step 3: Verify scope and challenge traceability**

Run:

```powershell
rg -n "hotspot|district|anomal|network|repeat offender|socio-economic|risk scor|pattern" PRD.md Rules.md
rg -n "hard-coded|synthetic|Catalyst|evidence|authorization" Rules.md
```

Expected: every Challenge 02 capability appears in `PRD.md`; every critical implementation boundary appears in `Rules.md`.

### Task 2: Architecture Authority

**Files:**
- Create: `Architecture.md`

- [ ] **Step 1: Write the end-to-end flow**

Document: PDF-faithful `SRC_*` tables → validation/reject handling → `TRN_*` features → seven analytics engines → evidence/provenance → API contracts → React role experience → recorded action. Explain that results are computed from persisted synthetic FIR records, not UI constants.

- [ ] **Step 2: Define Catalyst and module boundaries**

Map React hosting, Functions, API Gateway, Data Store, Stratus, Authentication, jobs/events, QuickML/Zia, logging, and deployment. Identify ingestion, validation, analytics, API, frontend, and shared-contract boundaries and explicitly reject a single monolithic function or frontend component.

- [ ] **Step 3: Record repository and delivery truth**

Show the actual root folders and mark the backend/data/analytics vertical slice as working while the React frontend, production identity federation, and live KSP integration remain unbuilt or deferred. Link detailed architecture, schema, deployment, and review documents.

- [ ] **Step 4: Verify paths and truth statements**

Run:

```powershell
rg -n "SRC_|TRN_|Catalyst|React|not yet|deferred|monolith" Architecture.md
rg -o "docs/[A-Za-z0-9_./-]+\.md" Architecture.md | ForEach-Object { if (-not (Test-Path $_)) { Write-Error "Missing link target: $_" } }
```

Expected: architectural layers, honest gaps, and Catalyst mapping are present; no missing linked Markdown files.

### Task 3: Command Navy Design Authority

**Files:**
- Create: `Design.md`

- [ ] **Step 1: Define foundations and tokens**

Specify navy frame, light analytical surface, blue information, saffron attention, red urgent-only, neutral/semantic tokens, Inter plus `Noto Sans Kannada`, spacing, radius, shadow, density, focus, and minimum contrast/touch-target requirements.

- [ ] **Step 2: Define role shells and analytical components**

Describe command-centre wallboard, leadership desktop, analyst workstation, station desktop, and investigator tablet. Define KPI cards, evidence drawers, map layers/legends, charts, network graph, alerts, tables, loading/empty/error/stale states, keyboard behavior, and responsive breakpoints.

- [ ] **Step 3: Verify design completeness**

Run:

```powershell
rg -n "Command Navy|command centre|leadership|analyst|station|tablet|map|network|loading|empty|error|accessib|contrast" Design.md
```

Expected: the approved visual direction, all role surfaces, analytical visuals, interaction states, and accessibility rules are present.

### Task 4: Dated Delivery Authority

**Files:**
- Create: `Phases.md`

- [ ] **Step 1: Record completed foundation**

List completed schema, Catalyst source/transform tables, 50-FIR synthetic fixture, validation, seven persisted analytical outputs, and automated tests as verified foundation—not future promises.

- [ ] **Step 2: Define July 21–26 phases**

Prioritize the jury-visible path: frontend foundation; leadership and hotspot map; analyst evidence/network; station/investigator workflow; integration/deployment/rehearsal; submission buffer. Give every phase a concrete output, exit criteria, and explicit deferrals.

- [ ] **Step 3: Verify deadline discipline**

Run:

```powershell
rg -n "July 21|July 22|July 23|July 24|July 25|July 26|Exit criteria|Deferred" Phases.md
```

Expected: each date has an owned result and exit gate; July 26 contains no net-new feature commitment.

### Task 5: Memory Registration and Final Verification

**Files:**
- Modify: `docs/PROJECT_MEMORY.md`

- [ ] **Step 1: Register the approved control system**

Append a dated July 21 entry recording the five root authorities, sole-memory decision, Command Navy selection, and update rule. Do not rewrite existing history.

- [ ] **Step 2: Scan for placeholders and duplicate memory**

Run:

```powershell
rg -n "TBD|TODO|FIXME|placeholder|lorem ipsum" Rules.md PRD.md Architecture.md Design.md Phases.md
Test-Path Memory.md
```

Expected: the first command returns no matches; the second returns `False`.

- [ ] **Step 3: Run repository documentation checks**

Run:

```powershell
git diff --check
git status --short
```

Expected: no whitespace errors; only the five root documents, the memory update, and the tracked plan are part of this change. Existing `.agents/` and `skills-lock.json` remain untouched.

- [ ] **Step 4: Commit the control documents**

```powershell
git add -- Rules.md PRD.md Architecture.md Design.md Phases.md docs/PROJECT_MEMORY.md docs/superpowers/plans/2026-07-21-ai-builder-control-documents.md
git commit -m "docs: add AI builder controls"
```

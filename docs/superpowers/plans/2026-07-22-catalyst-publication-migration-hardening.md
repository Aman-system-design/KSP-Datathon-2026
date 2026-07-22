# Catalyst Publication Migration Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the 32-table publication-pointer design safely deployable over the existing 31-table Catalyst Development project while preserving atomic intelligence visibility, strict replay identity, and monotonic refresh status.

**Architecture:** A versioned migration manifest drives dry-run, apply, verify, and rollback planning without deleting intelligence data. The runtime reserves an attempt sequence at refresh start, stages and annotates all seven run rows before the publication-pointer compare-and-swap, and builds freshness from one captured pointer row. Legacy requests whose original input identity cannot be proven are marked explicitly and rejected on replay.

**Tech Stack:** Node.js ESM, Catalyst Data Store and ZCQL, JSON schema manifests, Node test runner, Vitest.

---

### Task 1: Canonical preflight inventory

**Files:**
- Modify: `scripts/catalyst/preflight.mjs`
- Modify: `tests/catalyst/preflight.test.mjs`

- [ ] Add a failing test that loads `schema/catalyst/intelligence-schema.json` and expects preflight to report its actual 32-table inventory.
- [ ] Run `node --test tests/catalyst/preflight.test.mjs` and confirm the hard-coded 28-table assertion fails.
- [ ] Replace the stale count with an expected count derived from the canonical manifest contract and reject mismatched manifests.
- [ ] Re-run the focused test and confirm it passes.

### Task 2: Staged legacy migration contract

**Files:**
- Create: `schema/catalyst/migrations/2026-07-22-publication-pointer.json`
- Create: `scripts/catalyst/publication-pointer-migration.mjs`
- Create: `tests/catalyst/publication-pointer-migration.test.mjs`
- Create: `docs/runbooks/catalyst-publication-pointer-migration.md`

- [ ] Add failing tests for dry-run inventory, idempotent apply planning, exact seven-run legacy validation, proven/unknown request identity classification, verify readiness, and non-destructive rollback.
- [ ] Run the migration test and confirm the module/manifest are missing.
- [ ] Implement a pure migration planner that accepts a Catalyst inventory snapshot and emits bounded ZCQL/data-store actions for `DRY_RUN`, `APPLY`, `VERIFY`, and `ROLLBACK`.
- [ ] Require the existing 31 tables, create `INT_PublicationState`, add nullable `RequestHash`, `PublicationGeneration`, `AttemptSequence`, and pointer attempt fields first, and backfill only a coherent seven-run group.
- [ ] Mark unprovable legacy identities with `LEGACY_IDENTITY_UNKNOWN`; require runtime replay conflict instead of accepting a caller-supplied identity.
- [ ] Make rollback ignore/remove the pointer selector and restore legacy reads without deleting run/finding data.
- [ ] Re-run migration tests and generate the operator runbook from the migration manifest.

### Task 3: Pointer-final publication commit

**Files:**
- Modify: `src/backend/repository/catalyst/catalyst-repository.mjs`
- Modify: `tests/catalyst/repository-writes.test.mjs`

- [ ] Add failing tests that inject failure before each of seven run-generation annotations and assert the pointer remains on the prior group.
- [ ] Add a retry test proving all annotations converge before one pointer CAS.
- [ ] Run the focused repository test and confirm the current post-CAS annotation order fails.
- [ ] Move all run `PublicationGeneration` annotations before the pointer CAS, with a reserved generation and idempotent reconciliation.
- [ ] Re-run the focused test and confirm pointer visibility is atomic.

### Task 4: Single-read freshness and monotonic attempts

**Files:**
- Modify: `schema/catalyst/intelligence-schema.json`
- Modify: `src/backend/repository/memory-repository.mjs`
- Modify: `src/backend/repository/catalyst/catalyst-repository.mjs`
- Modify: `src/backend/refresh/refresh-service.mjs`
- Modify: `src/backend/geospatial/layer-service.mjs`
- Modify: `tests/backend/geospatial-layer-service.test.mjs`
- Modify: `tests/backend/refresh.test.mjs`
- Modify: `tests/catalyst/repository-reads.test.mjs`

- [ ] Add a failing interleaving test proving freshness currently performs two pointer reads.
- [ ] Add a failing slow-A/fast-B test proving a stale failure can currently overwrite a newer completed attempt.
- [ ] Reserve `AttemptSequence` at refresh start and attach it to staged batches and pointer attempt updates.
- [ ] Apply attempt status only when its sequence is not older than the stored pointer sequence.
- [ ] Build current group, generation, and latest status from one captured pointer row.
- [ ] Re-run focused tests and confirm B remains `CURRENT` after A fails late.

### Task 5: Schema, migration, documentation, and full verification

**Files:**
- Modify: `scripts/schema/validate-intelligence-schema.mjs`
- Modify: `tests/schema/intelligence-schema.test.mjs`
- Modify: `docs/runbooks/catalyst-intelligence-tables.md`
- Modify: `docs/architecture/ai-ml-intelligence-strategy.md`
- Modify: `docs/superpowers/specs/2026-07-20-catalyst-backend-vertical-slice-design.md`

- [ ] Validate all new sequence, legacy-identity, and pointer fields in the canonical 32-table manifest.
- [ ] Regenerate the deterministic Catalyst intelligence runbook.
- [ ] Document staged deployment, verification gates, replay rejection, pointer-final commit, and rollback.
- [ ] Run focused migration/concurrency tests, then `npm run verify`.
- [ ] Stage only canonical source, migration, schema, docs, and tests; exclude all generated `functions/**` output.
- [ ] Commit the verified correction.

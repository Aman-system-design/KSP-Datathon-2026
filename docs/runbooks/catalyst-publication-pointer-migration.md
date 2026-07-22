# Catalyst Publication Pointer Migration Runbook

This migration upgrades the existing 31-table Catalyst Development project to the 32-table publication-pointer contract without deleting intelligence records.

1. Run `DRY_RUN` against a read-only inventory. It must report exactly the supported 31 legacy tables and one coherent seven-run published group.
2. Review the dry-run inventory digest and action plan. `APPLY` is rejected unless the operator passes explicit confirmation (`confirmed: true`); no live credentials are needed for planning or verification tests.
3. In `APPLY`, create `INT_PublicationState` and add nullable `RequestHash`, `PublicationGeneration`, and `AttemptSequence` columns to `INT_AnalysisRun` before any backfill.
4. Backfill the verified group. Use a 64-character request hash only when the historical request identity is provable. Otherwise persist `LEGACY_IDENTITY_UNKNOWN`; runtime replay must reject that batch with `LEGACY_IDENTITY_CONFLICT`.
5. Insert the singleton `PublicationStateID=CURRENT` pointer only after all seven rows are backfilled.
6. Run `VERIFY`. Deploy the publication-pointer bundle only when all target fields are non-null and the pointer fully reconciles to exactly seven stored runs.

The migration planner is idempotent: a verified migrated inventory produces no apply actions. Preserve the generated migration state JSON and inventory digest with the deployment evidence.

## Rollback

Rollback is a code deployment, not an in-database selector:

1. Stop new refresh submissions and record the current pointer generation and inventory digest.
2. Redeploy the exact previously verified Catalyst Function bundle and Slate build from its immutable commit/build evidence.
3. Run its health, authentication, read-scope, and current-intelligence smoke checks.
4. Confirm the prior bundle serves its previously verified complete group and no source, intelligence, workflow, or pointer row count decreased.
5. Leave `INT_PublicationState`, the added run columns, all analysis runs, and all findings intact for diagnosis and a later forward fix.

The rollback plan emits only `REDEPLOY_PREVIOUS_VERIFIED_BUNDLE`; it never drops tables, removes columns, deletes rows, or claims a runtime selector that does not exist.

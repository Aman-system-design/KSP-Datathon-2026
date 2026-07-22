# Catalyst Publication Pointer Migration Runbook

This migration upgrades the existing 31-table Catalyst Development project to the 32-table publication-pointer contract without deleting intelligence records.

1. Run `DRY_RUN` against a read-only inventory. It must report exactly the supported 31 legacy tables and one coherent seven-run published group.
2. Review the dry-run inventory digest and action plan. `APPLY` is rejected unless the operator passes explicit confirmation (`confirmed: true`); no live credentials are needed for planning or verification tests.
3. In `APPLY`, create `INT_PublicationState` and add nullable `RequestHash`, `PublicationGeneration`, and `AttemptSequence` columns to `INT_AnalysisRun` before any backfill.
4. Backfill the verified group. Use a 64-character request hash only when the historical request identity is provable. Otherwise persist `LEGACY_IDENTITY_UNKNOWN`; runtime replay must reject that batch with `LEGACY_IDENTITY_CONFLICT`.
5. Insert the singleton `PublicationStateID=CURRENT` pointer only after all seven rows are backfilled.
6. Run `VERIFY`. Enable mandatory-field enforcement and the publication-pointer selector only when all target fields are non-null and the pointer references the verified group.

The migration planner is idempotent: a verified migrated inventory produces no apply actions. Preserve the generated migration state JSON and inventory digest with the deployment evidence.

## Rollback

Rollback changes the runtime selector to `LEGACY_COMPLETE_GROUP` and ignores `INT_PublicationState`. It does not drop the pointer table, remove columns, delete runs, or delete findings. The previous complete-group selector may be restored temporarily while the migration is corrected, preserving all data.

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { planPublicationPointerMigration } from '../../scripts/catalyst/publication-pointer-migration.mjs';
import { buildDemoState } from '../../src/backend/repository/build-demo-state.mjs';

const targetSchema = JSON.parse(await readFile(
  new URL('../../schema/catalyst/intelligence-schema.json', import.meta.url), 'utf8',
));
const migration = JSON.parse(await readFile(
  new URL('../../schema/catalyst/migrations/2026-07-22-publication-pointer.json', import.meta.url), 'utf8',
));

function legacyInventory({ proven = false, partial = false, migrated = false } = {}) {
  const runGroup = structuredClone(buildDemoState().runGroups[0]);
  if (partial) runGroup.runs.pop();
  const tables = targetSchema.tables
    .filter(table => migrated || table.name !== 'INT_PublicationState')
    .map(table => ({
      name: table.name,
      columns: table.columns
        .filter(column => migrated || !['RequestHash', 'PublicationGeneration', 'AttemptSequence'].includes(column.name))
        .map(column => column.name),
    }));
  const analysisRuns = runGroup.runs.map((run, index) => ({
    ...run, ROWID: String(1000 + index), BatchKey: 'LEGACY-BATCH-1', Operation: 'BOOTSTRAP_SYNTHETIC',
    ...(migrated ? {
      RequestHash: proven ? 'b'.repeat(64) : 'LEGACY_IDENTITY_UNKNOWN',
      PublicationGeneration: 1, AttemptSequence: 1,
    } : {}),
  }));
  return {
    environment: 'Development', projectId: '43492000000013049', tables, analysisRuns,
    provenRequestIdentities: proven ? { 'LEGACY-BATCH-1': 'b'.repeat(64) } : {},
    publicationState: migrated ? {
      PublicationStateID: 'CURRENT', PublicationGeneration: 1,
      CurrentRunGroupID: runGroup.RunGroupID, CurrentRunsJSON: JSON.stringify(analysisRuns),
      PointerVersion: 1, LastReservedAttemptSequence: 1, LatestAttemptSequence: 1,
    } : null,
  };
}

test('dry-run inventories the exact existing 31-table Development boundary without mutation', () => {
  const result = planPublicationPointerMigration({ manifest: migration, inventory: legacyInventory(), mode: 'DRY_RUN' });
  assert.equal(result.readyToApply, true);
  assert.equal(result.inventory.existingTableCount, 31);
  assert.equal(result.inventory.targetTableCount, 32);
  assert.equal(result.actions.length, 0);
  assert.deepEqual(result.legacy.completeRunGroupIds, ['RUN-GROUP-DEMO-1']);
});

test('apply is idempotent and backfills only a coherent complete seven-run group', () => {
  assert.throws(() => planPublicationPointerMigration({ manifest: migration, inventory: legacyInventory(), mode: 'APPLY' }), /confirmation/i);
  const first = planPublicationPointerMigration({ manifest: migration, inventory: legacyInventory(), mode: 'APPLY', confirmed: true });
  assert.ok(first.actions.some(action => action.kind === 'CREATE_TABLE' && action.table === 'INT_PublicationState'));
  assert.equal(first.actions.filter(action => action.kind === 'ADD_NULLABLE_COLUMN').length, 3);
  assert.equal(first.actions.filter(action => action.kind === 'BACKFILL_RUN').length, 7);
  assert.ok(first.actions.some(action => action.kind === 'UPSERT_PUBLICATION_POINTER'));
  assert.equal(first.state.runtimeSelector, 'LEGACY_COMPLETE_GROUP');
  const pointer = first.actions.find(action => action.kind === 'UPSERT_PUBLICATION_POINTER').values;
  assert.equal(pointer.SyntheticData, true);
  assert.ok(JSON.parse(pointer.CurrentRunsJSON).every(run => run.AttemptSequence === 1));
  assert.throws(() => planPublicationPointerMigration({
    manifest: migration, inventory: legacyInventory({ partial: true }), mode: 'APPLY', confirmed: true,
  }), /complete seven-run/i);

  const replay = planPublicationPointerMigration({
    manifest: migration, inventory: legacyInventory({ migrated: true }), mode: 'APPLY', confirmed: true,
  });
  assert.deepEqual(replay.actions, []);
});

test('legacy identity is backfilled only when proven and otherwise receives an explicit replay-blocking marker', () => {
  const proven = planPublicationPointerMigration({
    manifest: migration, inventory: legacyInventory({ proven: true }), mode: 'APPLY', confirmed: true,
  });
  assert.ok(proven.actions.filter(action => action.kind === 'BACKFILL_RUN')
    .every(action => action.values.RequestHash === 'b'.repeat(64)));

  const unknown = planPublicationPointerMigration({ manifest: migration, inventory: legacyInventory(), mode: 'APPLY', confirmed: true });
  assert.ok(unknown.actions.filter(action => action.kind === 'BACKFILL_RUN')
    .every(action => action.values.RequestHash === 'LEGACY_IDENTITY_UNKNOWN'));
  assert.equal(unknown.state.unknownLegacyIdentityCount, 7);
});

test('verify requires all target fields and rollback changes only selector state without deleting intelligence', () => {
  const verified = planPublicationPointerMigration({
    manifest: migration, inventory: legacyInventory({ migrated: true }), mode: 'VERIFY',
  });
  assert.equal(verified.validation.enforcementReady, true);
  assert.equal(verified.state.status, 'VERIFIED');
  assert.equal(verified.state.runtimeSelector, 'PUBLICATION_POINTER');
  assert.equal(verified.validation.nullBackfillCount, 0);

  const rollback = planPublicationPointerMigration({
    manifest: migration, inventory: legacyInventory({ migrated: true }), mode: 'ROLLBACK',
  });
  assert.deepEqual(rollback.actions, [
    { kind: 'SET_RUNTIME_SELECTOR', value: 'LEGACY_COMPLETE_GROUP' },
    { kind: 'IGNORE_TABLE', table: 'INT_PublicationState' },
  ]);
  assert.equal(rollback.actions.some(action => /DELETE|DROP/u.test(action.kind)), false);
});

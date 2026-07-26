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
    MethodVersion: run.EngineVersion, CompletedAt: run.PublishedAt,
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
      LatestAttemptStatus: 'COMPLETED', LatestAttemptRunGroupID: runGroup.RunGroupID,
      PublishedAt: runGroup.PublishedAt,
    } : null,
  };
}

test('dry-run inventories the exact existing 32-table Development boundary without mutation', () => {
  const result = planPublicationPointerMigration({ manifest: migration, inventory: legacyInventory(), mode: 'DRY_RUN' });
  assert.equal(result.readyToApply, true);
  assert.equal(result.inventory.existingTableCount, 32);
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
  assert.equal(first.state.activation, 'PENDING_VERIFICATION');
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

test('verify requires all target fields and rollback redeploys the previous bundle without deleting intelligence', () => {
  const verified = planPublicationPointerMigration({
    manifest: migration, inventory: legacyInventory({ migrated: true }), mode: 'VERIFY',
  });
  assert.equal(verified.validation.enforcementReady, true);
  assert.equal(verified.state.status, 'VERIFIED');
  assert.equal(verified.state.deploymentBundle, 'PUBLICATION_POINTER');
  assert.equal(verified.validation.nullBackfillCount, 0);

  const rollback = planPublicationPointerMigration({
    manifest: migration, inventory: legacyInventory({ migrated: true }), mode: 'ROLLBACK',
  });
  assert.deepEqual(rollback.actions, [
    { kind: 'REDEPLOY_PREVIOUS_VERIFIED_BUNDLE', retainTables: true, retainRows: true },
  ]);
  assert.equal(rollback.actions.some(action => /DELETE|DROP/u.test(action.kind)), false);
});

test('verify rejects malformed or incoherent publication pointers', () => {
  const mutations = [
    inventory => { inventory.publicationState.CurrentRunsJSON = '[]'; },
    inventory => { inventory.publicationState.PublicationGeneration = 99; },
    inventory => {
      const runs = JSON.parse(inventory.publicationState.CurrentRunsJSON);
      runs[1] = { ...runs[0] };
      inventory.publicationState.CurrentRunsJSON = JSON.stringify(runs);
    },
    inventory => {
      const runs = JSON.parse(inventory.publicationState.CurrentRunsJSON);
      runs.pop(); inventory.publicationState.CurrentRunsJSON = JSON.stringify(runs);
    },
    inventory => {
      const runs = JSON.parse(inventory.publicationState.CurrentRunsJSON);
      runs[0].RunGroupID = 'WRONG'; inventory.publicationState.CurrentRunsJSON = JSON.stringify(runs);
    },
    inventory => {
      const runs = JSON.parse(inventory.publicationState.CurrentRunsJSON);
      runs[0].RequestHash = 'f'.repeat(64); inventory.publicationState.CurrentRunsJSON = JSON.stringify(runs);
    },
    inventory => { inventory.publicationState.CurrentRunsJSON = '{broken'; },
    inventory => { inventory.publicationState.LatestAttemptSequence = 2; },
    inventory => { inventory.analysisRuns.pop(); },
    inventory => { inventory.analysisRuns[0].Status = 'FAILED_RETRYABLE'; },
    inventory => { inventory.analysisRuns[0].PublicationGeneration = 99; },
    inventory => { inventory.analysisRuns[0].AttemptSequence = 2; },
  ];
  for (const mutate of mutations) {
    const inventory = legacyInventory({ migrated: true, proven: true });
    mutate(inventory);
    const result = planPublicationPointerMigration({ manifest: migration, inventory, mode: 'VERIFY' });
    assert.equal(result.validation.enforcementReady, false);
    assert.notEqual(result.state.status, 'VERIFIED');
  }
});

test('verify rejects every runtime-trusted pointer run mismatch', () => {
  const mutations = [
    run => { run.ROWID = '9999'; },
    run => { run.AnalysisRunRef = '9999'; delete run.ROWID; },
    run => { run.EngineVersion = 'CORRUPT'; },
    run => { run.MethodVersion = 'CORRUPT'; },
    run => { run.ObservationStart = '2026-01-01T00:00:00Z'; },
    run => { run.ObservationEnd = '2026-12-31T00:00:00Z'; },
    run => { run.PublishedAt = '2026-07-02T01:00:00Z'; },
    run => { run.Status = 'FAILED_RETRYABLE'; },
    run => { run.PublishStatus = 'STAGED'; },
    run => { run.SyntheticData = false; },
    run => { run.RunTypeKey = 'WRONG:TYPE'; },
    run => { run.InputManifestHash = 'f'.repeat(64); },
  ];
  for (const mutate of mutations) {
    const inventory = legacyInventory({ migrated: true, proven: true });
    const pointerRuns = JSON.parse(inventory.publicationState.CurrentRunsJSON);
    mutate(pointerRuns[0]);
    inventory.publicationState.CurrentRunsJSON = JSON.stringify(pointerRuns);
    const result = planPublicationPointerMigration({ manifest: migration, inventory, mode: 'VERIFY' });
    assert.equal(result.validation.enforcementReady, false);
    assert.notEqual(result.state.status, 'VERIFIED');
  }

  for (const publishedAt of ['2026-07-02T01:00:00Z', null]) {
    const inventory = legacyInventory({ migrated: true, proven: true });
    inventory.publicationState.PublishedAt = publishedAt;
    const result = planPublicationPointerMigration({ manifest: migration, inventory, mode: 'VERIFY' });
    assert.equal(result.validation.enforcementReady, false);
  }
});

test('verify normalizes only documented Catalyst DateTime storage formatting', () => {
  const inventory = legacyInventory({ migrated: true, proven: true });
  const pointerRuns = JSON.parse(inventory.publicationState.CurrentRunsJSON);
  for (const run of pointerRuns) for (const field of ['ObservationStart', 'ObservationEnd', 'CompletedAt', 'PublishedAt']) {
    run[field] = run[field].replace('T', ' ').replace(/Z$/u, '');
  }
  inventory.publicationState.CurrentRunsJSON = JSON.stringify(pointerRuns);
  inventory.publicationState.PublishedAt = inventory.publicationState.PublishedAt.replace('T', ' ').replace(/Z$/u, '');
  const result = planPublicationPointerMigration({ manifest: migration, inventory, mode: 'VERIFY' });
  assert.equal(result.validation.enforcementReady, true);
  assert.equal(result.state.status, 'VERIFIED');
});

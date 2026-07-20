import assert from 'node:assert/strict';
import test from 'node:test';

import { runIntelligencePipeline } from '@ksp/intelligence-core';

import { createRefreshService } from '../../src/backend/refresh/refresh-service.mjs';
import { REQUIRED_ANALYSIS_TYPES, isCompletePublishedGroup, selectCurrentRunGroup } from '../../src/backend/refresh/run-groups.mjs';
import { buildDemoState } from '../../src/backend/repository/build-demo-state.mjs';
import { MemoryIntelligenceRepository } from '../../src/backend/repository/memory-repository.mjs';
import { toIntelligenceInput } from '../../src/ingestion/to-intelligence-input.mjs';
import { validateSourceSeed } from '../../src/ingestion/validate-source-seed.mjs';
import { generateSourceSeed } from '../../src/synthetic/source-seed.mjs';

const clock = () => '2026-07-20T14:00:00.000Z';

function service(repository) {
  let id = 0;
  return createRefreshService({
    repository, sourceGenerator: generateSourceSeed, sourceValidator: validateSourceSeed,
    adapter: toIntelligenceInput, pipeline: runIntelligencePipeline,
    clock, idFactory: prefix => `${prefix}-${++id}`,
    auditKeys: { v1: 'governance-test-key' },
  });
}

test('run groups require exactly seven coherent, uniquely keyed published runs', () => {
  assert.equal(REQUIRED_ANALYSIS_TYPES.length, 7);
  const runs = buildDemoState().runGroups[0].runs;
  assert.equal(isCompletePublishedGroup(runs), true);
  for (const mutate of [
    rows => rows.slice(0, 6),
    rows => rows.map((row, index) => index === 1 ? { ...row, AnalysisType: rows[0].AnalysisType } : row),
    rows => rows.map((row, index) => index === 1 ? { ...row, InputManifestHash: 'b'.repeat(64) } : row),
    rows => rows.map((row, index) => index === 1 ? { ...row, ObservationEnd: '2026-08-01T00:00:00Z' } : row),
    rows => rows.map((row, index) => index === 1 ? { ...row, EngineVersion: 'other' } : row),
    rows => rows.map((row, index) => index === 1 ? { ...row, Status: 'FAILED' } : row),
    rows => rows.map((row, index) => index === 1 ? { ...row, PublishStatus: 'STAGED' } : row),
    rows => rows.map((row, index) => index === 1 ? { ...row, RunTypeKey: rows[0].RunTypeKey } : row),
  ]) assert.equal(isCompletePublishedGroup(mutate(structuredClone(runs))), false);
});

test('selection exposes only the newest complete coherent group', () => {
  const oldRuns = buildDemoState().runGroups[0].runs;
  const newerPartial = oldRuns.slice(0, 6).map(row => ({ ...row, RunGroupID: 'PARTIAL', PublishedAt: '2026-07-21T00:00:00Z' }));
  assert.equal(selectCurrentRunGroup([...oldRuns, ...newerPartial]).RunGroupID, 'RUN-GROUP-DEMO-1');
});

test('refresh stages, verifies and atomically publishes one seven-type group', async () => {
  const state = buildDemoState();
  state.patterns = [];
  state.hotspots = [];
  const repository = new MemoryIntelligenceRepository(state);
  const refresh = service(repository);
  const result = await refresh.execute({ operation: 'REFRESH_INTELLIGENCE', batchKey: 'REFRESH-2026-07-20', seed: 20260720 });
  assert.equal(result.status, 'COMPLETED');
  assert.equal(result.reconciliation.balanced, true);
  assert.equal(result.runGroup.runs.length, 7);
  assert.equal(result.runGroup.runs.every(row => row.PublishStatus === 'PUBLISHED'), true);
  assert.equal((await repository.getCurrentRunGroup()).RunGroupID, result.runGroup.RunGroupID);
  assert.ok(await repository.getPattern('PATTERN-1'), 'published findings replace the previously visible set');
  assert.equal((await repository.listHotspots()).data.length, 1);
  assert.deepEqual(await refresh.execute({ operation: 'REFRESH_INTELLIGENCE', batchKey: 'REFRESH-2026-07-20', seed: 20260720 }), result);
});

test('partial publication failure preserves the prior current group and retry converges', async () => {
  let failOnce = true;
  const repository = new MemoryIntelligenceRepository(buildDemoState(), { failureInjector(point) {
    if (point === 'beforeRefreshPublish' && failOnce) { failOnce = false; const error = new Error(point); error.code = 'INJECTED_FAILURE'; throw error; }
  } });
  const refresh = service(repository);
  await assert.rejects(refresh.execute({ operation: 'BOOTSTRAP_SYNTHETIC', batchKey: 'BOOT-1', seed: 20260720 }), { code: 'INJECTED_FAILURE' });
  assert.equal((await repository.getCurrentRunGroup()).RunGroupID, 'RUN-GROUP-DEMO-1');
  const completed = await refresh.execute({ operation: 'BOOTSTRAP_SYNTHETIC', batchKey: 'BOOT-1', seed: 20260720 });
  assert.equal(completed.status, 'COMPLETED');
  assert.notEqual((await repository.getCurrentRunGroup()).RunGroupID, 'RUN-GROUP-DEMO-1');
});

test('governance reconciliation reports incomplete commands and audit defects without mutation', async () => {
  const repository = new MemoryIntelligenceRepository(buildDemoState());
  await repository.createCommand({ CommandID: 'CMD-INCOMPLETE', IdempotencyKeyHash: '1'.repeat(64), RequestHash: '2'.repeat(64), AlertID: 'ALT-PATTERN-1', Status: 'RECEIVED' });
  await repository.appendAuditEvent({ AuditEventID: 'BAD-AUDIT', CommandID: 'CMD-X', AlertID: 'ALT-PATTERN-1', StreamID: 'ALT-PATTERN-1', StreamSequence: 2, PreviousEventHash: null, EventHash: '3'.repeat(64), HashKeyVersion: 'v1', EventPayloadJSON: '{}', HashAlgorithm: 'HMAC-SHA-256', ActorType: 'CATALYST_USER', EventType: 'BAD', EntityType: 'WF_Alert', EntityBusinessID: 'ALT-PATTERN-1', OccurredAt: clock(), SyntheticData: true });
  const before = await repository.getAuditStream('ALT-PATTERN-1');
  const report = await service(repository).execute({ operation: 'RECONCILE_GOVERNANCE' });
  assert.deepEqual(report.incompleteCommandIds, ['CMD-INCOMPLETE']);
  assert.equal(report.audit.valid, false);
  assert.deepEqual(await repository.getAuditStream('ALT-PATTERN-1'), before);
});

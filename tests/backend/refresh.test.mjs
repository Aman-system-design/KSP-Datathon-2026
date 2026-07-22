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
  const source = generateSourceSeed(20260720);
  const validated = validateSourceSeed(source);
  await repository.persistValidatedSource({ batchKey: 'REFRESH-2026-07-20', source, ...validated });
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

test('publication generation is monotonic even when completed timestamps are identical', async () => {
  const repository = new MemoryIntelligenceRepository(buildDemoState());
  const first = await service(repository).execute({ operation: 'BOOTSTRAP_SYNTHETIC', batchKey: 'GEN-1', seed: 20260720 });
  const afterFirst = await repository.getCurrentRunGroup();
  const second = await service(repository).execute({ operation: 'BOOTSTRAP_SYNTHETIC', batchKey: 'GEN-2', seed: 20260721 });
  const afterSecond = await repository.getCurrentRunGroup();
  assert.equal(first.runGroup.PublishedAt, second.runGroup.PublishedAt);
  assert.equal(afterSecond.PublicationGeneration, afterFirst.PublicationGeneration + 1);
  assert.equal(afterSecond.RunGroupID, second.runGroup.RunGroupID);
  assert.deepEqual(await service(repository).execute({ operation: 'BOOTSTRAP_SYNTHETIC', batchKey: 'GEN-1', seed: 20260720 }), first);
  assert.equal((await repository.getCurrentRunGroup()).RunGroupID, second.runGroup.RunGroupID);
});

test('a refresh idempotency key replays only the exact same operation and input', async () => {
  const repository = new MemoryIntelligenceRepository(buildDemoState());
  const refresh = service(repository);
  const first = await refresh.execute({ operation: 'BOOTSTRAP_SYNTHETIC', batchKey: 'IDEMPOTENT-1', seed: 20260720 });
  assert.deepEqual(await refresh.execute({ operation: 'BOOTSTRAP_SYNTHETIC', batchKey: 'IDEMPOTENT-1', seed: 20260720 }), first);
  await assert.rejects(
    refresh.execute({ operation: 'BOOTSTRAP_SYNTHETIC', batchKey: 'IDEMPOTENT-1', seed: 20260721 }),
    { code: 'IDEMPOTENCY_CONFLICT' },
  );
  await assert.rejects(
    refresh.execute({ operation: 'REFRESH_INTELLIGENCE', batchKey: 'IDEMPOTENT-1' }),
    { code: 'IDEMPOTENCY_CONFLICT' },
  );
});

test('a changed persisted source snapshot conflicts with an already completed batch key', async () => {
  const repository = new MemoryIntelligenceRepository(buildDemoState());
  const source = generateSourceSeed(20260720);
  await repository.persistValidatedSource({ batchKey: 'SOURCE-HASH-1', source, ...validateSourceSeed(source) });
  let changed = false;
  const guardedRepository = new Proxy(repository, { get(target, property) {
    if (property === 'getValidatedSource') return async batchKey => {
      const value = await target.getValidatedSource(batchKey);
      if (changed && value) value.accepted.CaseMaster[0].BriefFacts = 'Changed after the accepted snapshot was processed.';
      return value;
    };
    const value = target[property];
    return typeof value === 'function' ? value.bind(target) : value;
  } });
  const refresh = service(guardedRepository);
  await refresh.execute({ operation: 'REFRESH_INTELLIGENCE', batchKey: 'SOURCE-HASH-1' });
  changed = true;
  await assert.rejects(
    refresh.execute({ operation: 'REFRESH_INTELLIGENCE', batchKey: 'SOURCE-HASH-1' }),
    { code: 'IDEMPOTENCY_CONFLICT' },
  );
});

test('a legacy batch without a provable request identity is never replayed', async () => {
  const state = buildDemoState();
  state.refreshBatches.push({
    BatchKey: 'LEGACY-UNKNOWN', Operation: 'BOOTSTRAP_SYNTHETIC',
    RequestHash: 'LEGACY_IDENTITY_UNKNOWN', AttemptSequence: 0, Status: 'COMPLETED',
    RunGroup: state.runGroups[0], Reconciliation: { balanced: true }, SyntheticData: true,
  });
  await assert.rejects(
    service(new MemoryIntelligenceRepository(state)).execute({
      operation: 'BOOTSTRAP_SYNTHETIC', batchKey: 'LEGACY-UNKNOWN', seed: 20260720,
    }),
    { code: 'LEGACY_IDENTITY_CONFLICT' },
  );
});

test('refresh uses the persisted accepted batch and never silently regenerates source', async () => {
  const repository = new MemoryIntelligenceRepository(buildDemoState());
  const source = generateSourceSeed(20260720);
  const validated = validateSourceSeed(source);
  await repository.persistValidatedSource({ batchKey: 'PERSISTED-1', source, ...validated });
  let generatorCalls = 0;
  let id = 0;
  const refresh = createRefreshService({
    repository,
    sourceGenerator: () => { generatorCalls += 1; throw new Error('must not regenerate'); },
    sourceValidator: validateSourceSeed, adapter: toIntelligenceInput,
    pipeline: runIntelligencePipeline, clock, idFactory: prefix => `${prefix}-${++id}`,
  });
  const result = await refresh.execute({ operation: 'REFRESH_INTELLIGENCE', batchKey: 'PERSISTED-1' });
  assert.equal(result.status, 'COMPLETED');
  assert.equal(generatorCalls, 0);
  await assert.rejects(
    refresh.execute({ operation: 'REFRESH_INTELLIGENCE', batchKey: 'MISSING-1' }),
    { code: 'DATA_NOT_READY' },
  );
  assert.equal(generatorCalls, 0);
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

test('a committed publication response is reconciled as success before recording retryable failure', async () => {
  const repository = new MemoryIntelligenceRepository(buildDemoState());
  let throwAfterCommit = true;
  const uncertain = new Proxy(repository, { get(target, property) {
    if (property === 'publishRefreshBatch') return async (...args) => {
      const value = await target.publishRefreshBatch(...args);
      if (throwAfterCommit) { throwAfterCommit = false; throw new Error('uncertain transport response'); }
      return value;
    };
    const value = target[property];
    return typeof value === 'function' ? value.bind(target) : value;
  } });
  const result = await service(uncertain).execute({
    operation: 'BOOTSTRAP_SYNTHETIC', batchKey: 'UNCERTAIN-COMMIT', seed: 20260720,
  });
  assert.equal(result.status, 'COMPLETED');
  assert.equal((await repository.getRefreshStatus()).latestAttempt.status, 'COMPLETED');
});

test('terminal attempt status cannot be downgraded by an equal-sequence retry', async () => {
  const repository = new MemoryIntelligenceRepository(buildDemoState());
  await service(repository).execute({ operation: 'BOOTSTRAP_SYNTHETIC', batchKey: 'TERMINAL-1', seed: 20260720 });
  await repository.updateRefreshBatch('TERMINAL-1', { Status: 'FAILED_RETRYABLE', CompletedAt: clock() });
  const status = await repository.getRefreshStatus();
  assert.equal(status.latestAttempt.status, 'COMPLETED');
});

test('a late failure from an older attempt cannot replace a newer completed attempt', async () => {
  const repository = new MemoryIntelligenceRepository(buildDemoState());
  const attemptA = await repository.reserveRefreshAttempt();
  const attemptB = await repository.reserveRefreshAttempt();
  const baseRuns = buildDemoState().runGroups[0].runs;
  const batch = (key, group, sequence) => ({
    BatchKey: key, Operation: 'BOOTSTRAP_SYNTHETIC', RequestHash: key.padEnd(64, 'a'),
    AttemptSequence: sequence, Status: 'STAGED', Reconciliation: { balanced: true },
    PublishedFindings: buildDemoState().findingsByRunGroup['RUN-GROUP-DEMO-1'],
    RunGroup: { RunGroupID: group, runs: baseRuns.map(run => ({
      ...run, AnalysisRunID: `${group}-${run.AnalysisType}`, RunGroupID: group,
      RunTypeKey: `${group}:${run.AnalysisType}`, AttemptSequence: sequence,
      PublishStatus: 'STAGED', PublishedAt: null,
    })) }, CreatedAt: clock(), SyntheticData: true,
  });
  await repository.createRefreshBatch(batch('ATTEMPT-A', 'GROUP-A', attemptA));
  await repository.createRefreshBatch(batch('ATTEMPT-B', 'GROUP-B', attemptB));
  await repository.publishRefreshBatch('ATTEMPT-B', clock());
  await repository.updateRefreshBatch('ATTEMPT-A', { Status: 'FAILED_RETRYABLE', CompletedAt: clock() });
  const status = await repository.getRefreshStatus();
  assert.equal(status.currentRunGroup.RunGroupID, 'GROUP-B');
  assert.equal(status.latestAttempt.sequence, attemptB);
  assert.equal(status.latestAttempt.status, 'COMPLETED');
});

test('synthetic bootstrap rejects any source batch containing rejected rows before persistence', async () => {
  const repository = new MemoryIntelligenceRepository(buildDemoState());
  let id = 0;
  const refresh = createRefreshService({
    repository, sourceGenerator: generateSourceSeed,
    sourceValidator: source => {
      const valid = validateSourceSeed(source);
      return {
        ...valid,
        accepted: { ...valid.accepted, CaseMaster: valid.accepted.CaseMaster.slice(1) },
        rejected: [{ table: 'CaseMaster', sourceKey: '200000001', reasonCode: 'PDF-CASE-CRIME-NO', rowHash: 'a'.repeat(64) }],
        reconciliation: { sourceRows: 411, acceptedRows: 410, rejectedRows: 1, balanced: true },
      };
    },
    adapter: toIntelligenceInput, pipeline: runIntelligencePipeline,
    clock, idFactory: prefix => `${prefix}-REJECT-${++id}`,
  });
  await assert.rejects(
    refresh.execute({ operation: 'BOOTSTRAP_SYNTHETIC', batchKey: 'REJECTED-BOOT', seed: 20260720 }),
    { code: 'DATA_NOT_READY' },
  );
  assert.equal(await repository.getValidatedSource('REJECTED-BOOT'), undefined);
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

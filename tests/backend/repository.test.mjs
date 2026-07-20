import assert from 'node:assert/strict';
import test from 'node:test';

import { buildDemoState } from '../../src/backend/repository/build-demo-state.mjs';
import { repositoryMethods } from '../../src/backend/repository/contract.mjs';
import { MemoryIntelligenceRepository } from '../../src/backend/repository/memory-repository.mjs';

test('memory repository implements the complete asynchronous contract', () => {
  const repository = new MemoryIntelligenceRepository(buildDemoState());
  for (const method of repositoryMethods) {
    assert.equal(typeof repository[method], 'function', `missing ${method}`);
  }
});

test('demo state is derived from the accepted PDF pipeline', async () => {
  const state = buildDemoState();
  assert.equal(state.features.length, 50);
  assert.equal(state.patterns.length, 1);
  assert.equal(state.hotspots.length, 1);
  assert.equal(state.syntheticData, true);

  const repository = new MemoryIntelligenceRepository(state);
  const current = await repository.getCurrentRunGroup();
  assert.equal(current.runs.length, 7);
  assert.equal(new Set(current.runs.map(({ AnalysisType }) => AnalysisType)).size, 7);
});

test('reads return clones and stable opaque pagination', async () => {
  const state = buildDemoState();
  state.patterns.push({ ...structuredClone(state.patterns[0]), id: 'PATTERN-2' });
  const repository = new MemoryIntelligenceRepository(state);

  const first = await repository.listPatterns({ limit: 1 });
  assert.equal(first.data.length, 1);
  assert.ok(first.nextToken);
  assert.doesNotMatch(first.nextToken, /^1$/);
  first.data[0].title = 'mutated outside repository';

  const repeated = await repository.listPatterns({ limit: 1 });
  assert.notEqual(repeated.data[0].title, 'mutated outside repository');
  const second = await repository.listPatterns({ limit: 1, nextToken: first.nextToken });
  assert.equal(second.data[0].id, 'PATTERN-2');
});

test('partial or inconsistent run groups never become current', async () => {
  const state = buildDemoState();
  const complete = structuredClone(state.runGroups[0]);
  complete.RunGroupID = 'GROUP-OLD';
  complete.PublishedAt = '2026-06-30T00:00:00Z';
  complete.runs.forEach((run) => { run.RunGroupID = complete.RunGroupID; });
  const partial = structuredClone(state.runGroups[0]);
  partial.RunGroupID = 'GROUP-NEW-PARTIAL';
  partial.PublishedAt = '2026-07-02T00:00:00Z';
  partial.runs = partial.runs.slice(0, 6);
  partial.runs.forEach((run) => { run.RunGroupID = partial.RunGroupID; });
  state.runGroups = [complete, partial];

  const current = await new MemoryIntelligenceRepository(state).getCurrentRunGroup();
  assert.equal(current.RunGroupID, 'GROUP-OLD');
});

test('command uniqueness and alert compare-and-swap prevent duplicate transitions', async () => {
  const repository = new MemoryIntelligenceRepository(buildDemoState());
  const command = {
    CommandID: 'CMD-1', IdempotencyKeyHash: 'a'.repeat(64), RequestHash: 'b'.repeat(64),
    AlertID: 'ALT-PATTERN-1', Status: 'RECEIVED', SyntheticData: true,
  };
  await repository.createCommand(command);
  await assert.rejects(repository.createCommand({ ...command, CommandID: 'CMD-2' }), { code: 'UNIQUE_CONFLICT' });
  assert.equal((await repository.getCommandByIdempotencyHash('a'.repeat(64))).CommandID, 'CMD-1');

  const first = await repository.compareAndSwapAlert({
    alertId: 'ALT-PATTERN-1', expectedState: 'GENERATED', expectedVersion: 0,
    targetState: 'ASSIGNED', commandId: 'CMD-1',
  });
  const second = await repository.compareAndSwapAlert({
    alertId: 'ALT-PATTERN-1', expectedState: 'GENERATED', expectedVersion: 0,
    targetState: 'ASSIGNED', commandId: 'CMD-2',
  });
  assert.equal(first.matched, 1);
  assert.equal(first.alert.AlertVersion, 1);
  assert.deepEqual(second, { matched: 0 });
});

test('one domain artifact is allowed per command and audit records are cloned', async () => {
  const repository = new MemoryIntelligenceRepository(buildDemoState());
  await repository.insertDomainArtifact('assignment', { AssignmentID: 'ASN-1', CommandID: 'CMD-1' });
  await assert.rejects(
    repository.insertDomainArtifact('assignment', { AssignmentID: 'ASN-2', CommandID: 'CMD-1' }),
    { code: 'UNIQUE_CONFLICT' },
  );
  assert.equal((await repository.findDomainArtifactByCommand('assignment', 'CMD-1')).AssignmentID, 'ASN-1');

  await repository.appendAuditEvent({ AuditEventID: 'AUD-1', CommandID: 'CMD-1', EventHash: 'c'.repeat(64) });
  const audit = await repository.findAuditByCommand('CMD-1');
  audit.EventHash = 'changed';
  assert.equal((await repository.findAuditByCommand('CMD-1')).EventHash, 'c'.repeat(64));
});

test('failure injection identifies the exact interrupted persistence point', async () => {
  const repository = new MemoryIntelligenceRepository(buildDemoState(), {
    failureInjector(point) {
      if (point === 'afterCommandCreate') {
        const error = new Error(point);
        error.code = 'INJECTED_FAILURE';
        throw error;
      }
    },
  });
  await assert.rejects(repository.createCommand({
    CommandID: 'CMD-FAIL', IdempotencyKeyHash: 'd'.repeat(64), RequestHash: 'e'.repeat(64),
    AlertID: 'ALT-PATTERN-1', Status: 'RECEIVED', SyntheticData: true,
  }), { code: 'INJECTED_FAILURE' });
  assert.equal((await repository.getCommandByIdempotencyHash('d'.repeat(64))).CommandID, 'CMD-FAIL');
});

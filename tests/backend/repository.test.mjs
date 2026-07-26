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

test('utility rules support filtered cloned CRUD and optimistic versions', async () => {
  const repository = new MemoryIntelligenceRepository(buildDemoState());
  const rule = {
    RuleID: 'RULE-1', UtilityKey: 'patterns', UtilityVersion: '1.0.0', Enabled: true,
    ScopeUnitID: 101, ThresholdsJSON: '{"threshold":0.8}', EvaluationWindowDays: 30,
    Severity: 'HIGH', RecipientRolesJSON: '["CRIME_ANALYST"]', Version: 1,
    CreatedByUserID: 'USER-1', CreatedAt: '2026-07-26T00:00:00Z',
    UpdatedAt: '2026-07-26T00:00:00Z', SyntheticData: true,
  };
  const created = await repository.createUtilityRule(rule);
  created.Enabled = false;
  assert.equal((await repository.getUtilityRule('RULE-1')).Enabled, true);
  await assert.rejects(repository.createUtilityRule(rule), { code: 'UNIQUE_CONFLICT' });

  assert.equal((await repository.listUtilityRules({ utilityKey: 'patterns' })).length, 1);
  assert.equal((await repository.listUtilityRules({ utilityKey: 'hotspots' })).length, 0);
  assert.equal((await repository.listUtilityRules({ createdByUserId: 'USER-1' })).length, 1);

  assert.deepEqual(await repository.updateUtilityRule('RULE-1', 2, { Enabled: false }), { conflict: true });
  for (const changes of [
    { RuleID: 'RULE-2' },
    { Version: 99 },
    { CreatedByUserID: 'ATTACKER' },
    { CreatedAt: '2099-01-01T00:00:00Z' },
    { Unknown: true },
  ]) await assert.rejects(
    repository.updateUtilityRule('RULE-1', 1, changes),
    { code: 'INVALID_REQUEST' },
  );
  const pollutedChanges = Object.create(null);
  pollutedChanges.__proto__ = { polluted: true };
  await assert.rejects(
    repository.updateUtilityRule('RULE-1', 1, pollutedChanges),
    { code: 'INVALID_REQUEST' },
  );
  for (const UpdatedAt of [null, undefined, 'not-a-date', '2026-02-31T00:00:00Z']) await assert.rejects(
    repository.updateUtilityRule('RULE-1', 1, { Enabled: false, UpdatedAt }),
    { code: 'INVALID_REQUEST' },
  );
  assert.equal({}.polluted, undefined);
  assert.equal((await repository.getUtilityRule('RULE-1')).RuleID, 'RULE-1');
  assert.equal(await repository.getUtilityRule('RULE-2'), undefined);
  const updated = await repository.updateUtilityRule('RULE-1', 1, {
    Enabled: false, UpdatedAt: '2026-07-26T01:00:00Z',
  });
  assert.equal(updated.Version, 2);
  assert.equal(updated.Enabled, false);
  assert.equal(await repository.updateUtilityRule('MISSING', 1, {}), undefined);
});

test('run requests are idempotent, transition explicitly and return clones', async () => {
  const repository = new MemoryIntelligenceRepository(buildDemoState());
  const request = {
    RunRequestID: 'RUNREQ-1', IdempotencyKeyHash: 'a'.repeat(64), RequestHash: 'b'.repeat(64),
    BatchKey: 'BATCH-1', Operation: 'REFRESH_INTELLIGENCE', RequestedBy: 'CAT-ADMIN',
    Status: 'QUEUED', RequestedAt: '2026-07-22T00:00:00Z', SyntheticData: true,
  };

  await repository.createRunRequest(request);
  await assert.rejects(repository.createRunRequest({ ...request, RunRequestID: 'RUNREQ-2' }), { code: 'UNIQUE_CONFLICT' });
  assert.equal((await repository.getRunRequestByIdempotencyHash('a'.repeat(64))).RunRequestID, 'RUNREQ-1');

  const submitted = await repository.updateRunRequest('RUNREQ-1', { Status: 'SUBMITTED', CatalystJobID: 'JOB-1' });
  assert.equal(submitted.Status, 'SUBMITTED');
  const failed = await repository.updateRunRequest('RUNREQ-1', { Status: 'FAILED_RETRYABLE', FailedPhase: 'JOB_SUBMISSION', FailureCode: 'JOB_SUBMISSION_FAILED' });
  assert.equal(failed.Status, 'FAILED_RETRYABLE');
  const replay = await repository.updateRunRequest('RUNREQ-1', { Status: 'SUBMITTED', CatalystJobID: 'JOB-2' });
  assert.equal(replay.CatalystJobID, 'JOB-2');

  replay.Status = 'MUTATED';
  assert.equal((await repository.getRunRequest('RUNREQ-1')).Status, 'SUBMITTED');
  assert.equal((await repository.listRunRequests()).length, 1);
  await assert.rejects(
    repository.updateRunRequest('RUNREQ-1', { Status: 'QUEUED' }),
    { code: 'INVALID_STATE' },
  );
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
  complete.runs.forEach((run) => {
    run.RunGroupID = complete.RunGroupID;
    run.RunTypeKey = `${complete.RunGroupID}:${run.AnalysisType}`;
    run.PublishedAt = complete.PublishedAt;
  });
  const partial = structuredClone(state.runGroups[0]);
  partial.RunGroupID = 'GROUP-NEW-PARTIAL';
  partial.PublishedAt = '2026-07-02T00:00:00Z';
  partial.runs = partial.runs.slice(0, 6);
  partial.runs.forEach((run) => {
    run.RunGroupID = partial.RunGroupID;
    run.RunTypeKey = `${partial.RunGroupID}:${run.AnalysisType}`;
    run.PublishedAt = partial.PublishedAt;
  });
  state.runGroups = [complete, partial];
  state.publicationState = {
    PublicationGeneration: 4, PointerVersion: 4, CurrentRunGroupID: complete.RunGroupID,
    CurrentRunGroup: complete, PublishedAt: complete.PublishedAt,
    LatestAttemptStatus: 'STAGED', LatestAttemptRunGroupID: partial.RunGroupID,
    LatestAttemptAt: partial.PublishedAt,
  };

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

test('validated source persistence is cloned and idempotent by batch key', async () => {
  const repository = new MemoryIntelligenceRepository(buildDemoState());
  const value = {
    batchKey: 'SOURCE-1', source: { syntheticData: true },
    accepted: { CaseMaster: [{ CaseMasterID: 1 }] }, rejected: [],
    reconciliation: { sourceRows: 1, acceptedRows: 1, rejectedRows: 0, balanced: true },
  };
  const first = await repository.persistValidatedSource(value);
  value.accepted.CaseMaster[0].CaseMasterID = 999;
  const second = await repository.persistValidatedSource({ ...value, accepted: {} });
  assert.deepEqual(second, first);
  assert.equal((await repository.getValidatedSource('SOURCE-1')).accepted.CaseMaster[0].CaseMasterID, 1);
});

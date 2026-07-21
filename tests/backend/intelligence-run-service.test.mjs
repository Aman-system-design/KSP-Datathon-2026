import assert from 'node:assert/strict';
import test from 'node:test';

import { createIntelligenceRunService } from '../../src/backend/operations/intelligence-run-service.mjs';
import { buildDemoState } from '../../src/backend/repository/build-demo-state.mjs';
import { MemoryIntelligenceRepository } from '../../src/backend/repository/memory-repository.mjs';

const admin = {
  actualUserId: 'CAT-ADMIN', role: 'PLATFORM_ADMIN',
  actions: ['MANAGE_INTELLIGENCE_RUNS'], syntheticData: true,
};

function createHarness({ failScheduling = false } = {}) {
  const repository = new MemoryIntelligenceRepository(buildDemoState());
  const submissions = [];
  const scheduler = {
    async submit(input) {
      submissions.push(structuredClone(input));
      if (failScheduling) throw new Error('private Catalyst SDK detail');
      return { jobId: '43492000000070001' };
    },
  };
  let id = 0;
  const service = createIntelligenceRunService({
    repository, scheduler, clock: () => '2026-07-22T01:00:00Z',
    idFactory: () => `RUNREQ-${++id}`,
  });
  return { repository, submissions, service };
}

test('platform administrator submits one idempotent Catalyst intelligence job', async () => {
  const { submissions, service } = createHarness();
  const input = { access: admin, batchKey: 'SOURCE-BATCH-20260722', idempotencyKey: 'submit-20260722-01' };

  const first = await service.submit(input);
  const replay = await service.submit(input);

  assert.equal(first.Status, 'SUBMITTED');
  assert.equal(first.CatalystJobID, '43492000000070001');
  assert.equal(replay.RunRequestID, first.RunRequestID);
  assert.equal(submissions.length, 1);
  assert.deepEqual(submissions[0], {
    runRequestId: first.RunRequestID,
    batchKey: 'SOURCE-BATCH-20260722',
    operation: 'REFRESH_INTELLIGENCE',
  });
});

test('run submission rejects unauthorized roles and idempotency conflicts', async () => {
  const { service } = createHarness();
  await assert.rejects(service.submit({
    access: { ...admin, role: 'CRIME_ANALYST', actions: [] },
    batchKey: 'SOURCE-BATCH-1', idempotencyKey: 'submit-key-1',
  }), { code: 'FORBIDDEN_ACTION' });

  await service.submit({ access: admin, batchKey: 'SOURCE-BATCH-1', idempotencyKey: 'submit-key-1' });
  await assert.rejects(service.submit({
    access: admin, batchKey: 'SOURCE-BATCH-2', idempotencyKey: 'submit-key-1',
  }), { code: 'IDEMPOTENCY_CONFLICT' });
});

test('scheduler failure persists a safe retryable state without SDK details', async () => {
  const { repository, service } = createHarness({ failScheduling: true });

  const result = await service.submit({
    access: admin, batchKey: 'SOURCE-BATCH-FAIL', idempotencyKey: 'submit-failure-1',
  });

  assert.equal(result.Status, 'FAILED_RETRYABLE');
  assert.equal(result.FailedPhase, 'JOB_SUBMISSION');
  assert.equal(result.FailureCode, 'JOB_SUBMISSION_FAILED');
  assert.doesNotMatch(JSON.stringify(result), /private Catalyst SDK detail/);
  assert.deepEqual(await service.list({ access: admin }), await repository.listRunRequests());
});

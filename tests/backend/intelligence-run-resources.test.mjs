import assert from 'node:assert/strict';
import test from 'node:test';

import { createIntelligenceRunResources } from '../../src/backend/operations/intelligence-run-resources.mjs';

test('run resources forward authenticated access and case-insensitive idempotency key', async () => {
  const calls = [];
  const resources = createIntelligenceRunResources({
    runService: {
      async list(input) { calls.push(['list', input]); return [{ RunRequestID: 'RUNREQ-1' }]; },
      async submit(input) { calls.push(['submit', input]); return { RunRequestID: 'RUNREQ-2', Status: 'SUBMITTED' }; },
    },
  });
  const access = { actualUserId: 'CAT-ADMIN', actions: ['MANAGE_INTELLIGENCE_RUNS'] };

  assert.deepEqual(await resources.listIntelligenceRuns({ access }), {
    data: [{ RunRequestID: 'RUNREQ-1' }], syntheticData: false,
  });
  assert.deepEqual(await resources.submitIntelligenceRun({
    access, headers: { 'idempotency-key': 'submit-1' }, body: { batchKey: 'SOURCE-BATCH-1' },
  }), { data: { RunRequestID: 'RUNREQ-2', Status: 'SUBMITTED' }, syntheticData: false });
  assert.deepEqual(calls[1][1], { access, batchKey: 'SOURCE-BATCH-1', idempotencyKey: 'submit-1' });
});

test('run resources reject missing idempotency key before scheduling', async () => {
  const resources = createIntelligenceRunResources({
    runService: { list: async () => [], submit: async () => assert.fail('must not submit') },
  });
  await assert.rejects(resources.submitIntelligenceRun({
    access: {}, headers: {}, body: { batchKey: 'SOURCE-BATCH-1' },
  }), { code: 'INVALID_REQUEST' });
});

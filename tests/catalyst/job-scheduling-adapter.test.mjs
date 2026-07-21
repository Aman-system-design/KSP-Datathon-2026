import assert from 'node:assert/strict';
import test from 'node:test';

import { createCatalystJobScheduler } from '../../src/backend/catalyst/job-scheduling-adapter.mjs';

test('submits intelligence refresh through the configured Catalyst job pool', async () => {
  const calls = [];
  const app = {
    jobScheduling() {
      return {
        jobpool(details) {
          calls.push({ type: 'pool', details });
          return {
            async submitJob(job) {
              calls.push({ type: 'job', job });
              return { job_id: '43492000000070001', job_status: 'Submitted' };
            },
          };
        },
      };
    },
  };
  const scheduler = createCatalystJobScheduler({ app, jobPoolName: 'KSPIntelligencePool' });

  const result = await scheduler.submit({
    runRequestId: 'RUNREQ-1', batchKey: 'SOURCE-BATCH-20260722', operation: 'REFRESH_INTELLIGENCE',
  });

  assert.deepEqual(result, { jobId: '43492000000070001' });
  assert.deepEqual(calls, [
    { type: 'pool', details: { name: 'KSPIntelligencePool' } },
    { type: 'job', job: {
      job_name: 'intelligence-RUNREQ-1',
      target_type: 'Function',
      target_name: 'intelligence_refresh',
      params: {
        operation: 'REFRESH_INTELLIGENCE', batchKey: 'SOURCE-BATCH-20260722', runRequestId: 'RUNREQ-1',
      },
      job_config: { number_of_retries: 2, retry_interval: 900 },
    } },
  ]);
});

test('rejects invalid configuration and malformed Catalyst responses', async () => {
  assert.throws(() => createCatalystJobScheduler({
    app: { jobScheduling: () => ({ jobpool: () => ({ submitJob() {} }) }) },
    jobPoolName: 'bad pool name',
  }), /job pool/i);
  const scheduler = createCatalystJobScheduler({
    app: { jobScheduling: () => ({ jobpool: () => ({ submitJob: async () => ({ job_status: 'Submitted' }) }) }) },
    jobPoolName: 'KSPIntelligencePool',
  });
  await assert.rejects(scheduler.submit({
    runRequestId: 'RUNREQ-1', batchKey: 'SOURCE-BATCH-1', operation: 'REFRESH_INTELLIGENCE',
  }), { code: 'JOB_SUBMISSION_FAILED' });
});

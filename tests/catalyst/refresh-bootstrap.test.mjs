import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { createRefreshApplication } from '../../src/backend/catalyst/refresh-bootstrap.mjs';
import { buildDemoState } from '../../src/backend/repository/build-demo-state.mjs';
import { MemoryIntelligenceRepository } from '../../src/backend/repository/memory-repository.mjs';

const sourceManifest = JSON.parse(readFileSync(new URL('../../schema/catalyst/source-schema.json', import.meta.url), 'utf8'));
const config = Object.freeze({ environment: 'Development', projectId: '43492000000013049', permissionVersion: '1.0.0', auditKey: 'test-only-refresh-key-123456789012', auditKeyVersion: 'v1' });

function job(params) {
  return { getJobParam: name => params[name] };
}

function harness() {
  const calls = [];
  const context = {
    closeWithSuccess() { calls.push('success'); },
    closeWithFailure() { calls.push('failure'); },
  };
  const sdkCalls = [];
  const sdk = { initialize(value, options) { sdkCalls.push({ value, options }); return { datastore: () => ({}) }; } };
  const repository = new MemoryIntelligenceRepository(buildDemoState());
  let id = 0;
  const application = createRefreshApplication({
    sdk, config, sourceManifest, clock: () => '2026-07-20T16:00:00.000Z',
    idFactory: prefix => `${prefix}-${++id}`, repositoryFactory: () => repository,
  });
  return { application, context, calls, sdkCalls, repository };
}

test('bootstrap validates parameters, persists source and returns only a safe reconciliation summary', async () => {
  const fixture = harness();
  const result = await fixture.application(job({
    operation: 'BOOTSTRAP_SYNTHETIC', batchKey: 'KSP-DEMO-20260720-V1', seed: '20260720', syntheticOnly: 'true',
  }), fixture.context);
  assert.equal(result.ok, true);
  assert.equal(result.result.status, 'COMPLETED');
  assert.equal(result.result.reconciliation.balanced, true);
  assert.equal(JSON.stringify(result).includes('CaseMaster'), false);
  assert.equal(JSON.stringify(result).includes('AccusedName'), false);
  assert.deepEqual(fixture.calls, ['success']);
  assert.deepEqual(fixture.sdkCalls[0].options, { scope: 'admin' });
  assert.ok(await fixture.repository.getValidatedSource('KSP-DEMO-20260720-V1'));
});

test('refresh consumes an already persisted batch without regenerating a different source', async () => {
  const fixture = harness();
  await fixture.application(job({ operation: 'BOOTSTRAP_SYNTHETIC', batchKey: 'BATCH-1', seed: '20260720', syntheticOnly: 'true' }), fixture.context);
  const secondContext = { closeWithSuccess() { fixture.calls.push('success-2'); }, closeWithFailure() { fixture.calls.push('failure-2'); } };
  const result = await fixture.application(job({ operation: 'REFRESH_INTELLIGENCE', batchKey: 'BATCH-1', seed: '999', syntheticOnly: 'true' }), secondContext);
  assert.equal(result.ok, true);
  assert.equal(result.result.status, 'COMPLETED');
  assert.ok(fixture.calls.includes('success-2'));
});

test('invalid operation/parameters close with failure and expose only stable codes', async () => {
  for (const params of [
    { operation: 'DELETE_ALL', syntheticOnly: 'true' },
    { operation: 'BOOTSTRAP_SYNTHETIC', batchKey: 'BATCH-1', seed: 'x', syntheticOnly: 'true' },
    { operation: 'BOOTSTRAP_SYNTHETIC', batchKey: 'BATCH-1', seed: '20260720', syntheticOnly: 'false' },
  ]) {
    const fixture = harness();
    const result = await fixture.application(job(params), fixture.context);
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'INVALID_REQUEST');
    assert.deepEqual(fixture.calls, ['failure']);
    assert.equal(JSON.stringify(result).includes('stack'), false);
  }
});

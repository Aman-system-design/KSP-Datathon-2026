import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { createApiApplication } from '../../src/backend/catalyst/api-bootstrap.mjs';
import { loadRuntimeConfig } from '../../src/backend/catalyst/runtime-config.mjs';
import { buildDemoState } from '../../src/backend/repository/build-demo-state.mjs';
import { MemoryIntelligenceRepository } from '../../src/backend/repository/memory-repository.mjs';

const policy = JSON.parse(readFileSync(new URL('../../config/access-policy.json', import.meta.url), 'utf8'));
const config = Object.freeze({
  environment: 'Development', projectId: '43492000000013049', permissionVersion: '1.0.0',
  auditKey: 'test-only-api-bootstrap-key-1234567890', auditKeyVersion: 'v1',
});

function harness({ currentUser = { user_id: 'CAT-DISTRICT', status: 'ACTIVE' } } = {}) {
  const calls = [];
  const repository = new MemoryIntelligenceRepository(buildDemoState());
  const sdk = { initialize(_request, options) {
    calls.push(options);
    if (options.scope === 'user') return { userManagement: () => ({ getCurrentUser: async () => currentUser }) };
    if (options.scope === 'admin') return { datastore: () => ({}) };
    throw new Error('scope must be explicit');
  } };
  let id = 0;
  const application = createApiApplication({
    sdk, config, policy, clock: () => '2026-07-20T15:00:00.000Z',
    idFactory: prefix => `${prefix ?? 'REQ'}-${++id}`,
    repositoryFactory: () => repository,
  });
  return { application, calls, repository };
}

test('runtime config is Development-only, complete and never returns unrelated environment data', () => {
  const loaded = loadRuntimeConfig({
    KSP_ENVIRONMENT: 'Development', KSP_PROJECT_ID: '43492000000013049',
    KSP_PERMISSION_VERSION: '1.0.0', KSP_AUDIT_KEY: 'a'.repeat(32), KSP_AUDIT_KEY_VERSION: 'v1',
    UNRELATED_SECRET: 'must-not-be-copied',
  });
  assert.equal(loaded.environment, 'Development');
  assert.equal(loaded.projectId, '43492000000013049');
  assert.equal(JSON.stringify(loaded).includes('must-not-be-copied'), false);
  for (const mutation of [
    { KSP_ENVIRONMENT: 'Production' }, { KSP_PROJECT_ID: 'wrong' },
    { KSP_AUDIT_KEY: '' }, { KSP_PERMISSION_VERSION: '0.9.0' },
  ]) assert.throws(() => loadRuntimeConfig({ ...{
    KSP_ENVIRONMENT: 'Development', KSP_PROJECT_ID: '43492000000013049',
    KSP_PERMISSION_VERSION: '1.0.0', KSP_AUDIT_KEY: 'a'.repeat(32), KSP_AUDIT_KEY_VERSION: 'v1',
  }, ...mutation }), /config|Development|project|audit|permission/i);
});

test('API composition authenticates user scope, validates profile, then serves an exact route', async () => {
  const { application, calls } = harness();
  const response = await application({
    method: 'GET', url: '/v1/intelligence/brief?ignored=1', headers: { 'X-User-ID': 'SPOOFED' }, body: null,
  });
  assert.equal(response.status, 200);
  assert.equal(response.body.meta.syntheticData, true);
  assert.deepEqual(calls, [{ scope: 'user' }, { scope: 'admin' }]);
});

test('API composition fails closed for missing identity, undeclared route and malformed URL', async () => {
  const unauthenticated = harness({ currentUser: null });
  const denied = await unauthenticated.application({ method: 'GET', url: '/v1/intelligence/brief', headers: {} });
  assert.equal(denied.status, 401);
  assert.equal(unauthenticated.calls.filter(options => options.scope === 'admin').length, 0);

  const hidden = harness({ currentUser: null });
  assert.equal((await hidden.application({ method: 'GET', url: '/internal', headers: {} })).status, 404);
  assert.equal(hidden.calls.length, 0, 'undeclared routes are rejected before SDK initialization');

  const { application } = harness();
  assert.equal((await application({ method: 'GET', url: '/internal', headers: {} })).status, 404);
  assert.equal((await application({ method: 'GET', url: 'not-a-path', headers: {} })).status, 404);
});

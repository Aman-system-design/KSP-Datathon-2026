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
  intelligenceJobPool: 'KSPIntelligencePool',
});

function harness({
  currentUser = { user_id: 'CAT-DISTRICT', status: 'ACTIVE' },
  logger = { info() {}, error() {} },
  repositoryFactory,
} = {}) {
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
    repositoryFactory: repositoryFactory ?? (() => repository),
    schedulerFactory: () => ({ submit: async () => ({ jobId: 'JOB-1' }) }),
    logger,
  });
  return { application, calls, repository };
}

test('runtime config is Development-only, complete and never returns unrelated environment data', () => {
  const loaded = loadRuntimeConfig({
    KSP_ENVIRONMENT: 'Development', KSP_PROJECT_ID: '43492000000013049',
    KSP_PERMISSION_VERSION: '1.0.0', KSP_AUDIT_KEY: 'a'.repeat(32), KSP_AUDIT_KEY_VERSION: 'v1',
    KSP_INTELLIGENCE_JOB_POOL: 'KSPIntelligencePool',
    UNRELATED_SECRET: 'must-not-be-copied',
  });
  assert.equal(loaded.environment, 'Development');
  assert.equal(loaded.projectId, '43492000000013049');
  assert.equal(loaded.intelligenceJobPool, 'KSPIntelligencePool');
  assert.equal(JSON.stringify(loaded).includes('must-not-be-copied'), false);
  for (const mutation of [
    { KSP_ENVIRONMENT: 'Production' }, { KSP_PROJECT_ID: 'wrong' },
    { KSP_AUDIT_KEY: '' }, { KSP_PERMISSION_VERSION: '0.9.0' }, { KSP_INTELLIGENCE_JOB_POOL: 'bad pool' },
  ]) assert.throws(() => loadRuntimeConfig({ ...{
    KSP_ENVIRONMENT: 'Development', KSP_PROJECT_ID: '43492000000013049',
    KSP_PERMISSION_VERSION: '1.0.0', KSP_AUDIT_KEY: 'a'.repeat(32), KSP_AUDIT_KEY_VERSION: 'v1',
    KSP_INTELLIGENCE_JOB_POOL: 'KSPIntelligencePool',
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

test('API composition serves the role workspace and governed report sources', async () => {
  const { application } = harness({ currentUser: { user_id: 'CAT-ANALYST', status: 'ACTIVE' } });
  const workspace = await application({ method: 'GET', url: '/v1/workspace', headers: {}, body: null });
  assert.equal(workspace.status, 200);
  assert.equal(workspace.body.data.role, 'CRIME_ANALYST');
  assert.equal(workspace.body.data.syntheticData, true);
  const sources = await application({ method: 'GET', url: '/v1/report-sources', headers: {}, body: null });
  assert.equal(sources.status, 200);
  assert.equal(sources.body.data.length, 7);
});

test('API composition serves authorized geospatial catalog and layer execution', async () => {
  const { application, repository } = harness();
  const catalog = await application({ method: 'GET', url: '/v1/geospatial/datasets', headers: {}, body: null });
  assert.equal(catalog.status, 200);
  assert.deepEqual(catalog.body.data.items.map(item => item.id), ['hotspots', 'anomalies', 'areaRisk', 'alerts']);
  assert.equal('sourceReference' in catalog.body.data.items[0], false);

  const layer = await application({
    method: 'POST', url: '/v1/geospatial/layers/execute', headers: {},
    body: {
      layer: { id: 'layer-1', datasetId: 'hotspots', renderer: 'POINT' },
      runtime: { limit: 10 },
    },
  });
  assert.equal(layer.status, 200);
  assert.equal(layer.body.data.type, 'FeatureCollection');
  assert.ok(layer.body.data.features.length > 0);
  assert.ok((await repository.listAuditEvents()).every(row => row.EventType === 'SENSITIVE_READ'));
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

test('API emits correlated redacted structured completion and failure logs', async () => {
  const entries = [];
  const logger = {
    info: value => entries.push(['info', JSON.parse(value)]),
    error: value => entries.push(['error', JSON.parse(value)]),
  };
  const successful = harness({ logger }).application;
  const response = await successful({
    method: 'GET', url: '/v1/intelligence/brief', requestId: 'ATTACKER-CONTROLLED',
    headers: { authorization: 'Bearer must-not-log' }, body: { evidence: 'must-not-log' },
  });
  assert.equal(response.status, 200);
  assert.match(response.body.meta.requestId, /^REQ-\d+$/u);
  assert.notEqual(response.body.meta.requestId, 'ATTACKER-CONTROLLED');
  const [completionLevel, completionLog] = entries[0];
  const { durationMs, ...completion } = completionLog;
  assert.equal(completionLevel, 'info');
  assert.deepEqual(completion, {
    event: 'api_request_completed', requestId: response.body.meta.requestId, method: 'GET', status: 200,
  });
  assert.equal(typeof durationMs, 'number');

  const failed = harness({
    logger,
    repositoryFactory: () => { throw new Error('secret database detail'); },
  }).application;
  const failure = await failed({ method: 'GET', url: '/v1/intelligence/brief', headers: {}, body: null });
  assert.equal(failure.status, 500);
  const failureLog = entries.at(-1);
  assert.equal(failureLog[0], 'error');
  assert.equal(failureLog[1].event, 'api_request_failed');
  assert.equal(failureLog[1].requestId, failure.body.error.requestId);
  assert.equal(failureLog[1].code, 'INTERNAL_ERROR');
  assert.equal(JSON.stringify(entries).includes('secret database detail'), false);
  assert.equal(JSON.stringify(entries).includes('must-not-log'), false);
});

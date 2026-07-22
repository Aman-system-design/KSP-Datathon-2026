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
  organizationId: 'ORG-KSP',
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
    KSP_ORGANIZATION_ID: 'ORG-KSP',
    KSP_PERMISSION_VERSION: '1.0.0', KSP_AUDIT_KEY: 'a'.repeat(32), KSP_AUDIT_KEY_VERSION: 'v1',
    KSP_INTELLIGENCE_JOB_POOL: 'KSPIntelligencePool',
    UNRELATED_SECRET: 'must-not-be-copied',
  });
  assert.equal(loaded.environment, 'Development');
  assert.equal(loaded.projectId, '43492000000013049');
  assert.equal(loaded.organizationId, 'ORG-KSP');
  assert.equal(loaded.intelligenceJobPool, 'KSPIntelligencePool');
  assert.equal(JSON.stringify(loaded).includes('must-not-be-copied'), false);
  for (const mutation of [
    { KSP_ENVIRONMENT: 'Production' }, { KSP_PROJECT_ID: 'wrong' }, { KSP_ORGANIZATION_ID: '' },
    { KSP_AUDIT_KEY: '' }, { KSP_PERMISSION_VERSION: '0.9.0' }, { KSP_INTELLIGENCE_JOB_POOL: 'bad pool' },
  ]) assert.throws(() => loadRuntimeConfig({ ...{
    KSP_ENVIRONMENT: 'Development', KSP_PROJECT_ID: '43492000000013049',
    KSP_ORGANIZATION_ID: 'ORG-KSP',
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
  const logs = [];
  const { application, repository } = harness({ logger: {
    info(value) { logs.push(JSON.parse(value)); }, error(value) { logs.push(JSON.parse(value)); },
  } });
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
  assert.match(layer.body.meta.requestId, /^REQ-\d+$/u);
  const freshness = await application({ method: 'GET', url: '/v1/geospatial/freshness', headers: {}, body: null });
  assert.equal(freshness.status, 200);
  assert.deepEqual(freshness.body.data.layers.map(item => item.datasetId), ['hotspots', 'anomalies', 'areaRisk', 'alerts']);
  assert.ok(freshness.body.data.layers.every(item => item.runGroupId === layer.body.meta.runGroupId));
  assert.doesNotMatch(JSON.stringify(freshness.body), /features|evidenceCaseIds|centroid/iu);
  assert.ok((await repository.listAuditEvents()).every(row => row.EventType === 'SENSITIVE_READ'));
  assert.equal(logs.at(-1).requestId, freshness.body.meta.requestId);
});

test('API composition persists and reads an audited organization-scoped map view', async () => {
  const { application, repository } = harness();
  const body = {
    name: 'Verified hotspots', visibility: 'PRIVATE',
    definition: {
      id: 'MAP-1', name: 'Verified hotspots', version: 1, visibility: 'PRIVATE',
      layers: [{ id: 'hotspots-1', datasetId: 'hotspots', renderer: 'POINT' }],
    },
  };
  const created = await application({ method: 'POST', url: '/v1/geospatial/views', headers: {}, body });
  assert.equal(created.status, 200);
  assert.equal(created.body.data.organizationId, 'ORG-KSP');
  const duplicate = await application({ method: 'POST', url: '/v1/geospatial/views', headers: {}, body });
  assert.equal(duplicate.status, 409);
  assert.equal(duplicate.body.error.code, 'INVALID_STATE');
  const updated = await application({ method: 'PATCH', url: '/v1/geospatial/views/MAP-1', headers: {}, body: {
    expectedVersion: 1, name: 'Updated hotspots', visibility: 'SHARED',
    definition: {
      id: 'MAP-1', name: 'Updated hotspots', version: 2, visibility: 'SHARED',
      layers: [{ id: 'hotspots-1', datasetId: 'hotspots', renderer: 'POINT' }],
    },
  } });
  assert.equal(updated.status, 200);
  const loaded = await application({ method: 'GET', url: '/v1/geospatial/views/MAP-1', headers: {}, body: null });
  assert.equal(loaded.status, 200);
  assert.equal('auditDetails' in loaded.body, false);
  assert.equal(loaded.body.data.ownerEmployeeId, 9001);
  assert.equal(loaded.body.data.version, 2);
  const events = await repository.listAuditEvents();
  const changes = events.filter(event => event.EventType === 'CONFIGURATION_CHANGED');
  assert.equal(changes.length, 2);
  assert.equal(events.at(-1).EventType, 'SENSITIVE_READ');
  const readPayload = JSON.parse(events.at(-1).EventPayloadJSON);
  assert.equal(readPayload.requestId, loaded.body.meta.requestId);
  assert.equal(readPayload.resource.MapViewID, 'MAP-1');
  assert.equal(readPayload.resource.Version, 2);
  assert.match(readPayload.resource.DefinitionHash, /^[a-f0-9]{64}$/u);
  assert.doesNotMatch(events.at(-1).EventPayloadJSON, /Updated hotspots|DefinitionJSON|"layers"/u);
  for (const [index, change] of changes.entries()) {
    const payload = JSON.parse(change.EventPayloadJSON);
    assert.equal(payload.requestId, [created, updated][index].body.meta.requestId);
    assert.deepEqual(Object.keys(payload.resource).sort(), ['DefinitionHash', 'MapViewID', 'Version']);
    assert.equal(payload.resource.MapViewID, 'MAP-1');
    assert.equal(payload.resource.Version, index + 1);
    assert.match(payload.resource.DefinitionHash, /^[a-f0-9]{64}$/u);
    assert.doesNotMatch(change.EventPayloadJSON, /Updated hotspots|Verified hotspots|DefinitionJSON|"layers"/u);
  }
});

test('API composes a saved map report into a viewer-safe execution contract', async () => {
  const { application } = harness({ currentUser: { user_id: 'CAT-ANALYST', status: 'ACTIVE' } });
  const map = await application({ method: 'POST', url: '/v1/geospatial/views', headers: {}, body: {
    name: 'Verified hotspots', visibility: 'PRIVATE',
    definition: {
      id: 'MAP-REPORT-1', name: 'Verified hotspots', version: 1, visibility: 'PRIVATE',
      viewport: { center: [77.59, 12.97], zoom: 9 },
      layers: [{ id: 'hotspots-1', datasetId: 'hotspots', renderer: 'POINT', limit: 100 }],
    },
  } });
  assert.equal(map.status, 200);
  const report = await application({ method: 'POST', url: '/v1/reports', headers: {}, body: {
    name: 'Hotspot posture', sourceKey: 'hotspots', dimensions: [], measures: [],
    visualization: { type: 'map', mapViewId: 'MAP-REPORT-1' }, limit: 100,
  } });
  assert.equal(report.status, 200);

  const execution = await application({
    method: 'POST', url: `/v1/reports/${report.body.data.id}/execute`, headers: {}, body: {},
  });

  assert.equal(execution.status, 200);
  assert.equal(execution.body.data.result.data.mapView.id, 'MAP-REPORT-1');
  assert.equal(execution.body.data.result.data.executions[0].layer.datasetId, 'hotspots');
  assert.equal('organizationId' in execution.body.data.result.data.mapView, false);
  assert.equal('ownerEmployeeId' in execution.body.data.result.data.mapView, false);
  assert.equal('ownerUserId' in execution.body.data.definition, false);
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

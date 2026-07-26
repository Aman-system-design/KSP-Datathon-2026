import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { API_OPERATIONS } from '../../src/backend/http/api-contract.mjs';
import { createDispatcher } from '../../src/backend/http/dispatch.mjs';
import { buildDemoState } from '../../src/backend/repository/build-demo-state.mjs';
import { MemoryIntelligenceRepository } from '../../src/backend/repository/memory-repository.mjs';
import { resolveAccess } from '../../src/backend/security/identity.mjs';
import { buildAuthorizedUnitSet } from '../../src/backend/security/scope.mjs';
import { createAccessAuditService } from '../../src/backend/security/access-audit.mjs';
import { createReadServices } from '../../src/backend/services/read-services.mjs';
import { createCommandService } from '../../src/backend/workflow/command-service.mjs';

const policy = JSON.parse(await readFile(new URL('../../config/access-policy.json', import.meta.url), 'utf8'));
const clock = () => '2026-07-20T15:00:00.000Z';

function harness({ environment = 'Development', readServicesOverride, resourceServicesOverride, auditServiceOverride } = {}) {
  let id = 0;
  const repository = new MemoryIntelligenceRepository(buildDemoState());
  const readServices = readServicesOverride ?? createReadServices({ repository, clock: () => new Date(clock()), idFactory: () => `REQ-${++id}` });
  const commandService = createCommandService({ repository, clock, idFactory: prefix => `${prefix}-${++id}`, auditKeys: { v1: 'api-test-key' }, activeAuditKeyVersion: 'v1' });
  const auditService = auditServiceOverride ?? createAccessAuditService({ repository, clock, idFactory: prefix => `${prefix}-${++id}`, auditKeys: { v1: 'api-test-key' }, activeAuditKeyVersion: 'v1' });
  const accessResolver = async ({ currentUser, profile, requestedPersona, units, assignments }) => {
    const base = resolveAccess({ currentUser, profile, requestedPersona, environment, policy });
    return Object.freeze({ ...base, organizationId: 'ORG-KSP', authorizedUnitIds: buildAuthorizedUnitSet({ scopeUnitId: base.scopeUnitId, units }), assignments });
  };
  const dispatch = createDispatcher({
    readServices, resourceServices: resourceServicesOverride ?? {}, commandService,
    accessResolver, profileRepository: repository, auditService, environment,
  });
  Object.defineProperty(dispatch, 'repository', { value: repository });
  return dispatch;
}

const user = id => ({ user_id: id, status: 'ACTIVE' });
const get = (path, query = {}) => ({ method: 'GET', path, query, headers: {}, body: null, requestId: 'REQ-API' });
const post = (path, idempotencyKey, expectedState, expectedVersion, payload) => ({
  method: 'POST', path, query: {}, headers: { 'Idempotency-Key': idempotencyKey },
  body: { expectedState, expectedVersion, payload }, requestId: 'REQ-API',
});

test('the public contract contains exactly the forty-eight platform operations', () => {
  assert.equal(API_OPERATIONS.length, 48);
  assert.deepEqual(API_OPERATIONS.map(({ method, path }) => `${method} ${path}`), [
    'GET /v1/intelligence/brief', 'GET /v1/patterns', 'GET /v1/patterns/{patternId}',
    'GET /v1/hotspots', 'GET /v1/anomalies', 'GET /v1/area-risk',
    'GET /v1/networks/{nodeId}', 'GET /v1/district-context',
    'GET /v1/workspace', 'GET /v1/report-sources',
    'GET /v1/utilities', 'GET /v1/utilities/categories', 'GET /v1/utilities/{utilityKey}',
    'GET /v1/utility-alert-rules', 'POST /v1/utility-alert-rules',
    'PATCH /v1/utility-alert-rules/{ruleId}',
    'GET /v1/geospatial/datasets', 'POST /v1/geospatial/layers/execute',
    'GET /v1/geospatial/freshness',
    'GET /v1/geospatial/views', 'POST /v1/geospatial/views',
    'GET /v1/geospatial/views/{mapViewId}', 'PATCH /v1/geospatial/views/{mapViewId}',
    'GET /v1/intelligence-runs', 'POST /v1/intelligence-runs',
    'GET /v1/reports', 'POST /v1/reports', 'GET /v1/reports/{reportId}',
    'PATCH /v1/reports/{reportId}', 'DELETE /v1/reports/{reportId}', 'POST /v1/reports/{reportId}/execute',
    'GET /v1/dashboards', 'POST /v1/dashboards', 'GET /v1/dashboards/{dashboardId}',
    'PATCH /v1/dashboards/{dashboardId}', 'DELETE /v1/dashboards/{dashboardId}',
    'PUT /v1/dashboards/{dashboardId}/items', 'PUT /v1/dashboards/{dashboardId}/sharing',
    'PUT /v1/dashboards/{dashboardId}/role-default', 'PUT /v1/preferences/landing-dashboard',
    'GET /v1/alerts', 'GET /v1/alerts/{alertId}',
    'POST /v1/alerts/{alertId}/notes', 'POST /v1/alerts/{alertId}/escalate',
    'POST /v1/alerts/{alertId}/acknowledge', 'POST /v1/alerts/{alertId}/assign',
    'POST /v1/alerts/{alertId}/analyst-conclusion', 'POST /v1/alerts/{alertId}/outcome',
  ]);
});

test('geospatial freshness is an authenticated audited resource with no feature payload', async () => {
  const audits = [];
  const dispatch = harness({
    auditServiceOverride: { async record(event) { audits.push(event); } },
    resourceServicesOverride: {
      async getGeospatialFreshness({ access, requestId }) {
        assert.equal(access.actions.includes('READ_HOTSPOT'), true);
        return { data: { layers: [{ datasetId: 'hotspots', runGroupId: 'RUN-1', state: 'CURRENT' }] }, meta: { requestId } };
      },
    },
  });
  const response = await dispatch({ request: get('/v1/geospatial/freshness'), currentUser: user('CAT-DISTRICT') });
  assert.equal(response.status, 200);
  assert.equal(audits.at(-1).eventType, 'SENSITIVE_READ');
  assert.doesNotMatch(JSON.stringify(response), /features|evidenceCaseIds|centroid/iu);
});

test('unchanged freshness polls are coalesced out of the immutable audit stream', async () => {
  const audits = [];
  let changed = true;
  const dispatch = harness({
    auditServiceOverride: { async record(event) { audits.push(event); } },
    resourceServicesOverride: {
      async getGeospatialFreshness({ requestId }) {
        if (changed) return { data: { layers: [] }, meta: { requestId, publicationGeneration: 2, unchanged: false } };
        return { data: { layers: [] }, meta: { requestId, publicationGeneration: 2, unchanged: true }, auditMode: 'COALESCED_UNCHANGED' };
      },
    },
  });
  await dispatch({ request: get('/v1/geospatial/freshness'), currentUser: user('CAT-DISTRICT') });
  changed = false;
  const unchanged = await dispatch({ request: get('/v1/geospatial/freshness', { knownGeneration: '2' }), currentUser: user('CAT-DISTRICT') });
  assert.equal(audits.length, 1);
  assert.equal(unchanged.body.auditMode, undefined);
  assert.equal(unchanged.body.meta.unchanged, true);
  changed = true;
  await dispatch({ request: get('/v1/geospatial/freshness', { knownGeneration: '2' }), currentUser: user('CAT-DISTRICT') });
  assert.equal(audits.length, 2);
});

test('geospatial execution is audited as a sensitive read', async () => {
  const audits = [];
  const dispatch = harness({
    auditServiceOverride: { async record(event) { audits.push(event); } },
    resourceServicesOverride: {
      async executeGeospatialLayer({ requestId }) { return { data: { type: 'FeatureCollection', features: [] }, meta: { requestId } }; },
    },
  });
  const response = await dispatch({ request: {
    method: 'POST', path: '/v1/geospatial/layers/execute', query: {}, headers: {}, body: {}, requestId: 'REQ-API',
  }, currentUser: user('CAT-DISTRICT') });
  assert.equal(response.status, 200);
  assert.equal(audits.at(-1).eventType, 'SENSITIVE_READ');
  assert.equal(response.body.meta.requestId, audits.at(-1).requestId);
});

test('map-view reads and writes use correlated resource audit events', async () => {
  const audits = [];
  const seen = [];
  const dispatch = harness({
    auditServiceOverride: { async record(event) { audits.push(event); } },
    resourceServicesOverride: {
      async listMapViews(input) { seen.push(input); return { data: { items: [] }, meta: { requestId: input.requestId } }; },
      async createMapView(input) { seen.push(input); return { data: { id: 'MAP-1' }, meta: { requestId: input.requestId } }; },
    },
  });
  assert.equal((await dispatch({ request: get('/v1/geospatial/views'), currentUser: user('CAT-DISTRICT') })).status, 200);
  assert.equal(audits.at(-1).eventType, 'SENSITIVE_READ');
  const created = await dispatch({ request: {
    method: 'POST', path: '/v1/geospatial/views', query: {}, headers: {}, body: {}, requestId: 'REQ-API',
  }, currentUser: user('CAT-DISTRICT') });
  assert.equal(created.status, 200);
  assert.equal(audits.at(-1).eventType, 'CONFIGURATION_CHANGED');
  assert.equal(audits.at(-1).requestId, created.body.meta.requestId);
  assert.equal(seen.at(-1).access.organizationId, 'ORG-KSP');
});

test('resource audit details are allowlisted, persisted and removed from the public response', async () => {
  const dispatch = harness({ resourceServicesOverride: {
    async createMapView({ requestId }) {
      return {
        data: { id: 'MAP-1' }, meta: { requestId },
        auditDetails: {
          MapViewID: 'MAP-1', Version: 2, DefinitionHash: 'a'.repeat(64),
          Name: 'must-not-audit', definition: { layers: ['must-not-audit'] },
        },
      };
    },
  } });
  const response = await dispatch({ request: {
    method: 'POST', path: '/v1/geospatial/views', query: {}, headers: {}, body: {}, requestId: 'REQ-API',
  }, currentUser: user('CAT-DISTRICT') });
  assert.equal(response.status, 200);
  assert.equal('auditDetails' in response.body, false);
  const event = (await dispatch.repository.listAuditEvents()).at(-1);
  const payload = JSON.parse(event.EventPayloadJSON);
  assert.equal(event.ActorEmployeeID, 9001);
  assert.equal(payload.requestId, 'REQ-API');
  assert.deepEqual(payload.resource, { DefinitionHash: 'a'.repeat(64), MapViewID: 'MAP-1', Version: 2 });
  assert.doesNotMatch(event.EventPayloadJSON, /must-not-audit|layers/u);
});

test('all eight reads dispatch through authenticated, scoped services', async () => {
  const dispatch = harness();
  const requests = [
    get('/v1/intelligence/brief'), get('/v1/patterns'), get('/v1/patterns/PATTERN-1'),
    get('/v1/hotspots'), get('/v1/anomalies'), get('/v1/area-risk'),
    get('/v1/networks/CASE-001'), get('/v1/district-context', { unitId: 101 }),
  ];
  for (const request of requests) {
    const response = await dispatch({ request, currentUser: user('CAT-DISTRICT') });
    assert.equal(response.status, 200, request.path);
    assert.equal(response.body.meta.syntheticData, true);
  }
  const audit = await dispatch.repository.listAuditEvents();
  assert.equal(audit.filter(row => row.EventType === 'SENSITIVE_READ').length, 8);
});

test('all four workflow operations dispatch through one complete lifecycle', async () => {
  const dispatch = harness();
  const assignment = { assignedUnitId: 101, assignedEmployeeId: 9003, reason: 'Review synthetic links.', authorizedUnitIds: [101], authorizedCaseIds: ['CASE-001'], evidenceAccessLevel: 'ASSIGNED_CASES' };
  const requests = [
    [post('/v1/alerts/ALT-PATTERN-1/assign', 'assign', 'GENERATED', 0, assignment), 'CAT-DISTRICT', 'ASSIGNED'],
    [post('/v1/alerts/ALT-PATTERN-1/acknowledge', 'ack', 'ASSIGNED', 1, { note: 'Accepted.' }), 'CAT-ANALYST', 'ACKNOWLEDGED'],
    [post('/v1/alerts/ALT-PATTERN-1/analyst-conclusion', 'conclusion', 'ACKNOWLEDGED', 2, { conclusionCode: 'SUPPORTED', conclusionText: 'Synthetic evidence supports review.' }), 'CAT-ANALYST', 'CONCLUDED'],
    [post('/v1/alerts/ALT-PATTERN-1/outcome', 'outcome', 'CONCLUDED', 3, { outcomeCode: 'REVIEWED', outcomeText: 'Human review completed.' }), 'CAT-DISTRICT', 'CLOSED'],
  ];
  for (const [request, actor, state] of requests) {
    const response = await dispatch({ request, currentUser: user(actor) });
    assert.equal(response.status, 200);
    assert.equal(response.body.alert.status, state);
  }
});

test('resource operations receive authenticated viewer context and strict route parameters', async () => {
  const observed = [];
  const resourceServices = {
    async listReports(input) { observed.push(input); return { data: [{ id: 'R-1' }] }; },
    async updateReport(input) { observed.push(input); return { data: { id: input.params.reportId, version: 2 } }; },
  };
  const dispatch = harness({ resourceServicesOverride: resourceServices });
  const listed = await dispatch({ request: get('/v1/reports'), currentUser: user('CAT-ANALYST') });
  assert.equal(listed.status, 200);
  assert.equal(observed[0].access.actualUserId, 'CAT-ANALYST');

  const updated = await dispatch({
    request: {
      method: 'PATCH', path: '/v1/reports/R-1', query: {}, headers: {},
      body: { expectedVersion: 1, definition: { name: 'Updated' } }, requestId: 'REQ-API',
    },
    currentUser: user('CAT-ANALYST'),
  });
  assert.equal(updated.status, 200);
  assert.equal(observed[1].params.reportId, 'R-1');
  assert.deepEqual(observed[1].body, { expectedVersion: 1, definition: { name: 'Updated' } });
});

test('run submission forwards the idempotency header and returns accepted', async () => {
  let observed;
  const dispatch = harness({ resourceServicesOverride: {
    async submitIntelligenceRun(input) { observed = input; return { data: { status: 'SUBMITTED' } }; },
  } });
  const response = await dispatch({
    request: {
      method: 'POST', path: '/v1/intelligence-runs', query: {},
      headers: { 'Idempotency-Key': 'run-submit-1' }, body: { batchKey: 'SOURCE-BATCH-1' }, requestId: 'REQ-API',
    },
    currentUser: user('CAT-DISTRICT'),
  });
  assert.equal(response.status, 202);
  assert.equal(observed.headers['Idempotency-Key'], 'run-submit-1');
  assert.deepEqual(observed.body, { batchKey: 'SOURCE-BATCH-1' });
});

test('identity headers, undeclared routes, invalid bodies and forbidden scopes fail closed', async () => {
  const dispatch = harness();
  const spoofed = get('/v1/intelligence/brief'); spoofed.headers['X-User-ID'] = 'CAT-DISTRICT';
  assert.equal((await dispatch({ request: spoofed, currentUser: null })).status, 401);
  assert.equal((await dispatch({ request: get('/v1/internal/admin'), currentUser: user('CAT-DISTRICT') })).status, 404);
  assert.equal((await dispatch({ request: { ...get('/v1/patterns'), method: 'DELETE' }, currentUser: user('CAT-DISTRICT') })).status, 404);
  assert.equal((await dispatch({ request: get('/v1/district-context', { unitId: 102 }), currentUser: user('CAT-DISTRICT') })).status, 403);
  const bad = post('/v1/alerts/ALT-PATTERN-1/assign', '', 'GENERATED', 'zero', {});
  assert.equal((await dispatch({ request: bad, currentUser: user('CAT-DISTRICT') })).status, 400);
  const ambiguous = post('/v1/alerts/ALT-PATTERN-1/assign', 'key', 'GENERATED', 0, {
    assignedUnitId: 101, assignedEmployeeId: 9003, reason: 'Review.',
    authorizedUnitIds: [101], authorizedCaseIds: [], evidenceAccessLevel: 'ASSIGNED_CASES',
  });
  ambiguous.body.actorUserId = 'CAT-DISTRICT';
  assert.equal((await harness()({ request: ambiguous, currentUser: user('CAT-DISTRICT') })).status, 400);
});

test('demo persona is Development-only and internal failures return a non-leaking 500 shape', async () => {
  const demoRequest = get('/v1/intelligence/brief'); demoRequest.headers['X-Demo-Persona'] = 'STATE_LEADERSHIP';
  const demoDispatch = harness();
  assert.equal((await demoDispatch({ request: demoRequest, currentUser: user('CAT-DEMO') })).status, 200);
  assert.ok((await demoDispatch.repository.listAuditEvents()).some(row => row.EventType === 'DEMO_PERSONA_ASSUMED'));
  assert.equal((await harness({ environment: 'Production' })({ request: demoRequest, currentUser: user('CAT-DEMO') })).status, 403);

  const broken = harness({ readServicesOverride: { async getBrief() { throw new Error('SDK ROWID 4349 secret-token stack'); } } });
  const response = await broken({ request: get('/v1/intelligence/brief'), currentUser: user('CAT-DISTRICT') });
  assert.equal(response.status, 500);
  assert.deepEqual(response.body, { error: { code: 'INTERNAL_ERROR', message: 'The request could not be completed.', requestId: 'REQ-API' } });
  assert.deepEqual(response.diagnostic, { phase: 'READ_EXECUTION', operation: 'UNCLASSIFIED' });
  assert.doesNotMatch(JSON.stringify(response), /SDK|ROWID|4349|secret-token|stack/);
});

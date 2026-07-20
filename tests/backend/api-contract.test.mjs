import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { API_OPERATIONS } from '../../src/backend/http/api-contract.mjs';
import { createDispatcher } from '../../src/backend/http/dispatch.mjs';
import { buildDemoState } from '../../src/backend/repository/build-demo-state.mjs';
import { MemoryIntelligenceRepository } from '../../src/backend/repository/memory-repository.mjs';
import { resolveAccess } from '../../src/backend/security/identity.mjs';
import { buildAuthorizedUnitSet } from '../../src/backend/security/scope.mjs';
import { createReadServices } from '../../src/backend/services/read-services.mjs';
import { createCommandService } from '../../src/backend/workflow/command-service.mjs';

const policy = JSON.parse(await readFile(new URL('../../config/access-policy.json', import.meta.url), 'utf8'));
const clock = () => '2026-07-20T15:00:00.000Z';

function harness({ environment = 'Development', readServicesOverride } = {}) {
  let id = 0;
  const repository = new MemoryIntelligenceRepository(buildDemoState());
  const readServices = readServicesOverride ?? createReadServices({ repository, clock: () => new Date(clock()), idFactory: () => `REQ-${++id}` });
  const commandService = createCommandService({ repository, clock, idFactory: prefix => `${prefix}-${++id}`, auditKeys: { v1: 'api-test-key' }, activeAuditKeyVersion: 'v1' });
  const accessResolver = async ({ currentUser, profile, requestedPersona, units, assignments }) => {
    const base = resolveAccess({ currentUser, profile, requestedPersona, environment, policy });
    return Object.freeze({ ...base, authorizedUnitIds: buildAuthorizedUnitSet({ scopeUnitId: base.scopeUnitId, units }), assignments });
  };
  return createDispatcher({ readServices, commandService, accessResolver, profileRepository: repository, environment });
}

const user = id => ({ user_id: id, status: 'ACTIVE' });
const get = (path, query = {}) => ({ method: 'GET', path, query, headers: {}, body: null, requestId: 'REQ-API' });
const post = (path, idempotencyKey, expectedState, expectedVersion, payload) => ({
  method: 'POST', path, query: {}, headers: { 'Idempotency-Key': idempotencyKey },
  body: { expectedState, expectedVersion, payload }, requestId: 'REQ-API',
});

test('the public contract contains exactly the twelve challenge operations', () => {
  assert.equal(API_OPERATIONS.length, 12);
  assert.deepEqual(API_OPERATIONS.map(({ method, path }) => `${method} ${path}`), [
    'GET /v1/intelligence/brief', 'GET /v1/patterns', 'GET /v1/patterns/{patternId}',
    'GET /v1/hotspots', 'GET /v1/anomalies', 'GET /v1/area-risk',
    'GET /v1/networks/{nodeId}', 'GET /v1/district-context',
    'POST /v1/alerts/{alertId}/acknowledge', 'POST /v1/alerts/{alertId}/assign',
    'POST /v1/alerts/{alertId}/analyst-conclusion', 'POST /v1/alerts/{alertId}/outcome',
  ]);
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
  assert.equal((await harness()({ request: demoRequest, currentUser: user('CAT-DEMO') })).status, 200);
  assert.equal((await harness({ environment: 'Production' })({ request: demoRequest, currentUser: user('CAT-DEMO') })).status, 403);

  const broken = harness({ readServicesOverride: { async getBrief() { throw new Error('SDK ROWID 4349 secret-token stack'); } } });
  const response = await broken({ request: get('/v1/intelligence/brief'), currentUser: user('CAT-DISTRICT') });
  assert.equal(response.status, 500);
  assert.deepEqual(response.body, { error: { code: 'INTERNAL_ERROR', message: 'The request could not be completed.', requestId: 'REQ-API' } });
  assert.doesNotMatch(JSON.stringify(response), /SDK|ROWID|4349|secret-token|stack/);
});

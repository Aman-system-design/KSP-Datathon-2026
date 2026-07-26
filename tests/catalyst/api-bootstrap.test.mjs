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
  schedulerFactory = () => ({ submit: async () => ({ jobId: 'JOB-1' }) }),
  state = buildDemoState(), configureRepository,
} = {}) {
  const calls = [];
  const repository = new MemoryIntelligenceRepository(state);
  configureRepository?.(repository);
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
    schedulerFactory,
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
  assert.equal(loaded.organizationId, 'ORG-KSP');
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
  assert.equal(sources.body.data.length, 8);
});

test('API composition serves station-scoped case lists and hides unauthorized case detail', async () => {
  const state = buildDemoState();
  state.profiles.push({
    CatalystUserID: 'CAT-STATION', EmployeeID: 9001, DefaultRole: 'STATION_OPERATIONS', ScopeUnitID: 1001,
    Active: true, DemoPersonaAllowed: false, PermissionVersion: '1.0.0', SyntheticData: true,
  });
  const { application } = harness({ currentUser: { user_id: 'CAT-STATION', status: 'ACTIVE' }, state });

  const listed = await application({ method: 'GET', url: '/v1/cases?openOnly=false', headers: {}, body: null });
  assert.equal(listed.status, 200);
  assert.ok(listed.body.data.items.length > 0);
  assert.ok(listed.body.data.items.every(row => row.unitId === 1001));
  assert.doesNotMatch(JSON.stringify(listed.body), /BriefFacts|Complainant|Accused|latitude|longitude/iu);

  const authorized = await application({ method: 'GET', url: '/v1/cases/200000001', headers: {}, body: null });
  assert.equal(authorized.status, 200);
  assert.equal(authorized.body.data.caseId, '200000001');

  const unauthorized = await application({ method: 'GET', url: '/v1/cases/200000036', headers: {}, body: null });
  assert.equal(unauthorized.status, 404);
  assert.equal(unauthorized.body.error.code, 'NOT_FOUND');
});

test('station reporting API exposes only local sources and hides disallowed global reports', async () => {
  const state = buildDemoState();
  state.profiles.push({
    CatalystUserID: 'CAT-STATION-REPORTS', EmployeeID: 9001, DefaultRole: 'STATION_OPERATIONS', ScopeUnitID: 1001,
    Active: true, DemoPersonaAllowed: false, PermissionVersion: '1.0.0', SyntheticData: true,
  });
  state.reports = [{
    id: 'R-GLOBAL-ANOMALY', ownerUserId: 'CAT-ADMIN', name: 'State anomaly', visibility: 'GLOBAL', version: 1,
    definition: {
      name: 'State anomaly', sourceKey: 'anomalies', dimensions: ['unitId'],
      measures: [{ field: 'observed', aggregate: 'sum' }], filters: [], sort: [],
      visualization: { type: 'bar' }, limit: 100,
    },
  }, {
    id: 'R-STATION-CASE', ownerUserId: 'CAT-ADMIN', name: 'Open cases', visibility: 'GLOBAL', version: 1,
    definition: { name: 'Open cases', sourceKey: 'stationCases', dimensions: [], measures: [], filters: [], sort: [], visualization: { type: 'table' }, limit: 100 },
  }];
  state.dashboards = [
    { id: 'D-STATE', ownerUserId: 'CAT-ADMIN', name: 'State Intelligence', visibility: 'GLOBAL', version: 1 },
    { id: 'D-STATION-SYSTEM', ownerUserId: 'CAT-ADMIN', name: 'Station Operations', visibility: 'GLOBAL', defaultRole: 'STATION_OPERATIONS', version: 1 },
  ];
  state.dashboardItems = [{ id: 'I-STATION', dashboardId: 'D-STATION-SYSTEM', reportId: 'R-STATION-CASE', column: 1, row: 1, width: 4, height: 2, version: 1 }];
  const { application } = harness({ currentUser: { user_id: 'CAT-STATION-REPORTS', status: 'ACTIVE' }, state });

  const sources = await application({ method: 'GET', url: '/v1/report-sources', headers: {}, body: null });
  assert.deepEqual(sources.body.data.map(source => source.key), ['alerts', 'stationCases']);
  const reports = await application({ method: 'GET', url: '/v1/reports', headers: {}, body: null });
  assert.equal(reports.body.data.some(report => report.id === 'R-GLOBAL-ANOMALY'), false);
  const hidden = await application({ method: 'POST', url: '/v1/reports/R-GLOBAL-ANOMALY/execute', headers: {}, body: {} });
  assert.equal(hidden.status, 404);
  assert.equal(hidden.body.error.code, 'NOT_FOUND');
  const rejected = await application({ method: 'POST', url: '/v1/reports', headers: {}, body: state.reports[0].definition });
  assert.equal(rejected.status, 400);
  assert.equal(rejected.body.error.code, 'INVALID_REQUEST');
  const deniedDashboard = await application({ method: 'GET', url: '/v1/dashboards/D-STATE', headers: {}, body: null });
  assert.equal(deniedDashboard.status, 404);
  const deniedLanding = await application({ method: 'PUT', url: '/v1/preferences/landing-dashboard', headers: {}, body: { dashboardId: 'D-STATE' } });
  assert.equal(deniedLanding.status, 404);
  const clone = await application({ method: 'POST', url: '/v1/dashboards/D-STATION-SYSTEM/clone', headers: {}, body: { description: 'Local station copy' } });
  assert.equal(clone.status, 200);
  assert.equal(clone.body.data.ownerUserId, 'CAT-STATION-REPORTS');
  const workspace = await application({ method: 'GET', url: '/v1/workspace', headers: {}, body: null });
  assert.equal(workspace.body.data.landingDashboard.id, clone.body.data.id);
});

test('API case resources deny base presenter and auditor roles but honor an assumed station persona', async () => {
  const auditorState = buildDemoState();
  auditorState.profiles.push({
    CatalystUserID: 'CAT-AUDITOR', EmployeeID: 9001, DefaultRole: 'AUDITOR', ScopeUnitID: 1,
    Active: true, DemoPersonaAllowed: false, PermissionVersion: '1.0.0', SyntheticData: true,
  });
  const auditor = harness({ currentUser: { user_id: 'CAT-AUDITOR', status: 'ACTIVE' }, state: auditorState }).application;
  const deniedAuditor = await auditor({ method: 'GET', url: '/v1/cases', headers: {}, body: null });
  assert.equal(deniedAuditor.status, 403);
  assert.equal(deniedAuditor.body.error.code, 'FORBIDDEN_ACTION');

  const presenter = harness({ currentUser: { user_id: 'CAT-DEMO', status: 'ACTIVE' } }).application;
  const deniedBase = await presenter({ method: 'GET', url: '/v1/cases', headers: {}, body: null });
  assert.equal(deniedBase.status, 403);
  assert.equal(deniedBase.body.error.code, 'FORBIDDEN_ACTION');
  const assumed = await presenter({
    method: 'GET', url: '/v1/cases?openOnly=false', headers: { 'X-Demo-Persona': 'STATION_OPERATIONS' }, body: null,
  });
  assert.equal(assumed.status, 200);
  assert.ok(assumed.body.data.items.length > 0);
  assert.ok(assumed.body.data.items.every(row => row.unitId === 1001));
  const outside = await presenter({
    method: 'GET', url: '/v1/cases/200000036', headers: { 'X-Demo-Persona': 'STATION_OPERATIONS' }, body: null,
  });
  assert.equal(outside.status, 404);
  assert.equal(outside.body.error.code, 'NOT_FOUND');
});

test('assumed station persona is rejected when no active server-governed station is available', async () => {
  const state = buildDemoState();
  state.units = state.units.filter(row => Number(row.TypeID) !== 3);
  const presenter = harness({ currentUser: { user_id: 'CAT-DEMO', status: 'ACTIVE' }, state }).application;

  const response = await presenter({
    method: 'GET', url: '/v1/cases', headers: { 'X-Demo-Persona': 'STATION_OPERATIONS' }, body: null,
  });

  assert.equal(response.status, 403);
  assert.equal(response.body.error.code, 'FORBIDDEN_ACTION');
});

test('API composition serves utility categories and one utility definition', async () => {
  const { application } = harness();

  const categories = await application({ method: 'GET', url: '/v1/utilities/categories', headers: {}, body: null });
  assert.equal(categories.status, 200);
  assert.deepEqual(categories.body.data, [
    'patterns-networks', 'spatial-intelligence', 'trends-anomalies', 'risk-prioritization',
  ]);

  const utility = await application({ method: 'GET', url: '/v1/utilities/area-attention', headers: {}, body: null });
  assert.equal(utility.status, 200);
  assert.equal(utility.body.data.key, 'area-attention');
  assert.equal(utility.body.data.alertPolicy.enabled, false);
});

test('API composition gives Command Center read-only utility and alert access', async () => {
  const { application } = harness({ currentUser: { user_id: 'CAT-DEMO', status: 'ACTIVE' } });
  const headers = { 'X-Demo-Persona': 'COMMAND_CENTER' };

  const workspace = await application({ method: 'GET', url: '/v1/workspace', headers, body: null });
  assert.equal(workspace.status, 200);
  assert.equal(workspace.body.data.role, 'COMMAND_CENTER');
  assert.equal(workspace.body.data.syntheticData, true);

  const utilities = await application({ method: 'GET', url: '/v1/utilities', headers, body: null });
  assert.equal(utilities.status, 200);
  assert.equal(utilities.body.data.length, 4);

  const alerts = await application({ method: 'GET', url: '/v1/alerts', headers, body: null });
  assert.equal(alerts.status, 200);
  assert.equal(alerts.body.data.items.some(item => item.id === 'ALT-PATTERN-1'), true);
  const detail = await application({ method: 'GET', url: '/v1/alerts/ALT-PATTERN-1', headers, body: null });
  assert.equal(detail.status, 200);

  const forbidden = [
    {
      method: 'POST', url: '/v1/utility-alert-rules',
      headers: { ...headers, 'Idempotency-Key': 'command-center-denied' },
      body: {
        utilityKey: 'patterns', enabled: true, scopeUnitId: 101,
        thresholds: { threshold: 0.8 }, evaluationWindowDays: 30,
        severity: 'HIGH', recipientRoles: ['COMMAND_CENTER'],
      },
    },
    {
      method: 'PATCH', url: '/v1/utility-alert-rules/RULE-DENIED', headers,
      body: { expectedVersion: 1, enabled: false },
    },
    {
      method: 'POST', url: '/v1/utility-alert-rules/RULE-DENIED/evaluate', headers,
      body: { expectedVersion: 1 },
    },
  ];
  for (const request of forbidden) {
    const response = await application(request);
    assert.equal(response.status, 403, `${request.method} ${request.url}`);
    assert.equal(response.body.error.code, 'FORBIDDEN_ACTION');
  }
});

test('API composition denies utility catalogue reads to a role without READ_UTILITY', async () => {
  const { application } = harness({ currentUser: { user_id: 'CAT-DEMO', status: 'ACTIVE' } });

  for (const url of ['/v1/utilities', '/v1/utilities/categories', '/v1/utilities/patterns']) {
    const response = await application({ method: 'GET', url, headers: {}, body: null });
    assert.equal(response.status, 403);
    assert.equal(response.body.error.code, 'FORBIDDEN_ACTION');
  }
});

test('API composition permits PLATFORM_ADMIN to read the utility catalogue end to end', async () => {
  const state = buildDemoState();
  state.profiles.push({
    CatalystUserID: 'CAT-ADMIN', DefaultRole: 'PLATFORM_ADMIN', ScopeUnitID: 1,
    Active: true, DemoPersonaAllowed: false, PermissionVersion: '1.0.0', SyntheticData: true,
  });
  const { application } = harness({ currentUser: { user_id: 'CAT-ADMIN', status: 'ACTIVE' }, state });
  const response = await application({ method: 'GET', url: '/v1/utilities', headers: {}, body: null });
  assert.equal(response.status, 200);
  assert.equal(response.body.data.length, 4);
});

test('API composition returns stable NOT_FOUND for an unknown utility', async () => {
  const { application } = harness();

  const response = await application({ method: 'GET', url: '/v1/utilities/unknown', headers: {}, body: null });

  assert.equal(response.status, 404);
  assert.equal(response.body.error.code, 'NOT_FOUND');
  assert.equal(response.body.error.message, 'The requested resource was not found.');
  assert.match(response.body.error.requestId, /^REQ-\d+$/u);
});

test('API composition creates, lists and optimistically updates authorized utility alert rules', async () => {
  const { application } = harness({ currentUser: { user_id: 'CAT-ANALYST', status: 'ACTIVE' } });
  const input = {
    utilityKey: 'patterns', enabled: true, scopeUnitId: 101,
    thresholds: { threshold: 0.8 },
    evaluationWindowDays: 30, severity: 'HIGH', recipientRoles: ['CRIME_ANALYST'],
  };
  const created = await application({ method: 'POST', url: '/v1/utility-alert-rules', headers: { 'Idempotency-Key': 'rule-one' }, body: input });
  assert.equal(created.status, 200);
  assert.match(created.body.data.id, /^URULE-[a-f0-9]{57}$/u);
  assert.equal(created.body.data.createdBy, 'CAT-ANALYST');

  const listed = await application({ method: 'GET', url: '/v1/utility-alert-rules?utilityKey=patterns', headers: {}, body: null });
  assert.equal(listed.status, 200);
  assert.deepEqual(listed.body.data.items.map(rule => rule.id), [created.body.data.id]);

  const updated = await application({
    method: 'PATCH', url: `/v1/utility-alert-rules/${created.body.data.id}`, headers: {},
    body: { expectedVersion: 1, severity: 'CRITICAL' },
  });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.data.version, 2);
  assert.equal(updated.body.data.severity, 'CRITICAL');

  const stale = await application({
    method: 'PATCH', url: `/v1/utility-alert-rules/${created.body.data.id}`, headers: {},
    body: { expectedVersion: 1, enabled: false },
  });
  assert.equal(stale.status, 409);
  assert.equal(stale.body.error.code, 'VERSION_CONFLICT');
});

test('API composition manually evaluates a current utility rule without duplicate alerts', async () => {
  const { application } = harness({ currentUser: { user_id: 'CAT-ANALYST', status: 'ACTIVE' } });
  const created = await application({
    method: 'POST', url: '/v1/utility-alert-rules', headers: { 'Idempotency-Key': 'evaluate-one' },
    body: {
      utilityKey: 'hotspots', enabled: true, scopeUnitId: 101,
      thresholds: { minimumCases: 5 }, evaluationWindowDays: 30,
      severity: 'HIGH', recipientRoles: ['CRIME_ANALYST'],
    },
  });
  assert.equal(created.status, 200);
  const request = {
    method: 'POST', url: `/v1/utility-alert-rules/${created.body.data.id}/evaluate`,
    headers: {}, body: { expectedVersion: 1 },
  };
  const first = await application(request);
  const replay = await application(request);

  assert.equal(first.status, 200);
  assert.equal(first.body.data.created, 1);
  assert.equal(replay.status, 200);
  assert.equal(replay.body.data.created, 0);
  assert.equal(replay.body.data.existing, 1);
  assert.deepEqual(replay.body.data.alertIds, first.body.data.alertIds);
});

test('POST rule retries after audit failure without duplicating durable state', async () => {
  let failConfigurationAudit = true;
  const { application, repository } = harness({
    currentUser: { user_id: 'CAT-ANALYST', status: 'ACTIVE' },
    configureRepository(repo) {
      const append = repo.appendAuditEvent.bind(repo);
      repo.appendAuditEvent = async event => {
        if (failConfigurationAudit && event.EventType === 'CONFIGURATION_CHANGED') {
          failConfigurationAudit = false;
          throw new Error('audit unavailable');
        }
        return append(event);
      };
    },
  });
  const body = {
    utilityKey: 'patterns', enabled: true, scopeUnitId: 101, thresholds: { threshold: 0.8 },
    evaluationWindowDays: 30, severity: 'HIGH', recipientRoles: ['CRIME_ANALYST'],
  };
  const request = payload => ({ method: 'POST', url: '/v1/utility-alert-rules', headers: { 'Idempotency-Key': 'audit-retry' }, body: payload });
  assert.equal((await application(request(body))).status, 500);
  const retry = await application(request(body));
  assert.equal(retry.status, 200);
  assert.equal((await repository.listUtilityRules()).length, 1);
  assert.equal((await repository.listAuditEvents()).filter(row => row.EventType === 'CONFIGURATION_CHANGED').length, 1);
  const changed = await application(request({ ...body, severity: 'CRITICAL' }));
  assert.equal(changed.status, 409);
  assert.equal(changed.body.error.code, 'IDEMPOTENCY_CONFLICT');
});

test('PATCH rule reconciles a durable update after audit failure and audits the retry', async () => {
  let configurationAudits = 0;
  const { application, repository } = harness({
    currentUser: { user_id: 'CAT-ANALYST', status: 'ACTIVE' },
    configureRepository(repo) {
      const append = repo.appendAuditEvent.bind(repo);
      repo.appendAuditEvent = async event => {
        if (event.EventType === 'CONFIGURATION_CHANGED' && ++configurationAudits === 2) {
          throw new Error('audit unavailable');
        }
        return append(event);
      };
    },
  });
  const created = await application({
    method: 'POST', url: '/v1/utility-alert-rules', headers: { 'Idempotency-Key': 'patch-audit-retry' },
    body: {
      utilityKey: 'patterns', enabled: true, scopeUnitId: 101, thresholds: { threshold: 0.8 },
      evaluationWindowDays: 30, severity: 'HIGH', recipientRoles: ['CRIME_ANALYST'],
    },
  });
  assert.equal(created.status, 200);
  const patch = { method: 'PATCH', url: `/v1/utility-alert-rules/${created.body.data.id}`, headers: {}, body: { expectedVersion: 1, enabled: false } };
  assert.equal((await application(patch)).status, 500);
  const retry = await application(patch);
  assert.equal(retry.status, 200);
  assert.equal(retry.body.data.version, 2);
  assert.equal((await repository.getUtilityRule(created.body.data.id)).Version, 2);
  assert.equal((await repository.listAuditEvents()).filter(row => row.EventType === 'CONFIGURATION_CHANGED').length, 2);
});

test('read-only requests do not initialize Catalyst Job Scheduling', async () => {
  const { application } = harness({
    schedulerFactory: () => { throw new Error('Job Scheduling is unavailable'); },
  });
  const workspace = await application({ method: 'GET', url: '/v1/workspace', headers: {}, body: null });
  assert.equal(workspace.status, 200);
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
  assert.equal(failureLog[1].phase, 'REPOSITORY');
  assert.equal(JSON.stringify(entries).includes('secret database detail'), false);
  assert.equal(JSON.stringify(entries).includes('must-not-log'), false);
});

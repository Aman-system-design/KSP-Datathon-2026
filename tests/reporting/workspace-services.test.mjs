import assert from 'node:assert/strict';
import test from 'node:test';

import { buildDemoState } from '../../src/backend/repository/build-demo-state.mjs';
import { MemoryIntelligenceRepository } from '../../src/backend/repository/memory-repository.mjs';
import { createWorkspaceServices } from '../../src/backend/reporting/workspace-services.mjs';

const analyst = {
  actualUserId: 'CAT-ANALYST', employeeId: 9001,
  actualRole: 'CRIME_ANALYST', role: 'CRIME_ANALYST', demoPersona: false,
  personaSwitchAllowed: false, availablePersonas: [], scopeUnitId: 101,
  authorizedUnitIds: new Set([101, 1001]),
  actions: ['READ_ALERT', 'READ_ANOMALY'], syntheticData: true,
};

test('workspace services expose a complete report-to-dashboard-to-alert vertical slice', async () => {
  let id = 0;
  const repository = new MemoryIntelligenceRepository(buildDemoState());
  const services = createWorkspaceServices({
    repository,
    readServices: {
      async listAnomalies({ access }) {
        return { data: { items: [{ unitId: [...access.authorizedUnitIds][0], observed: 4 }] } };
      },
    },
    now: () => '2026-07-21T00:00:00Z', idFactory: (prefix = 'ID') => `${prefix}-${++id}`,
  });

  const sources = await services.listReportSources({ access: analyst });
  assert.equal(sources.data.length, 8);
  const report = await services.createReport({ access: analyst, body: {
    name: 'Anomaly total', sourceKey: 'anomalies', dimensions: ['unitId'],
    measures: [{ field: 'observed', aggregate: 'sum' }], visualization: { type: 'bar' },
  } });
  assert.equal(report.data.version, 1);
  assert.equal((await services.executeReport({ access: analyst, params: { reportId: report.data.id } })).data.result.data.items.length, 1);

  const dashboard = await services.createDashboard({ access: analyst, body: { name: 'Analyst desk' } });
  await services.replaceDashboardItems({ access: analyst, params: { dashboardId: dashboard.data.id }, body: {
    items: [{ reportId: report.data.id, column: 1, row: 1, width: 6, height: 3 }],
  } });
  await services.setLandingDashboard({ access: analyst, body: { dashboardId: dashboard.data.id } });

  const workspace = await services.getWorkspace({ access: analyst });
  assert.equal(workspace.data.landingDashboard.id, dashboard.data.id);
  assert.equal(workspace.data.alertSummary.total, 1);
  assert.equal(workspace.data.syntheticData, true);
  assert.deepEqual(workspace.data.identity, {
    employeeId: 9001, actualRole: 'CRIME_ANALYST',
    effectiveRole: 'CRIME_ANALYST', demoPersona: false,
  });
  assert.deepEqual(workspace.data.personaSwitch, { allowed: false, personas: [] });
});

test('workspace exposes only the server-authorized Development persona choices', async () => {
  const repository = new MemoryIntelligenceRepository(buildDemoState());
  const services = createWorkspaceServices({
    repository, readServices: {}, now: () => '2026-07-21T00:00:00Z',
    idFactory: prefix => `${prefix}-1`,
  });
  const access = {
    ...analyst, actualUserId: 'CAT-PRESENTER', employeeId: 9900,
    actualRole: 'DEMO_PRESENTER', role: 'STATE_LEADERSHIP', demoPersona: true,
    personaSwitchAllowed: true,
    availablePersonas: ['STATE_LEADERSHIP', 'CRIME_ANALYST'],
  };

  const workspace = await services.getWorkspace({ access });

  assert.deepEqual(workspace.data.identity, {
    employeeId: 9900, actualRole: 'DEMO_PRESENTER',
    effectiveRole: 'STATE_LEADERSHIP', demoPersona: true,
  });
  assert.deepEqual(workspace.data.personaSwitch, {
    allowed: true, personas: ['STATE_LEADERSHIP', 'CRIME_ANALYST'],
  });
});

test('presenter can load the persona chooser before assuming an operational role', async () => {
  const repository = new MemoryIntelligenceRepository(buildDemoState());
  const services = createWorkspaceServices({
    repository, readServices: {}, now: () => '2026-07-21T00:00:00Z',
    idFactory: prefix => `${prefix}-1`,
  });
  const access = {
    ...analyst, actualUserId: 'CAT-PRESENTER', employeeId: null,
    actualRole: 'DEMO_PRESENTER', role: 'DEMO_PRESENTER', demoPersona: false,
    personaSwitchAllowed: true, availablePersonas: ['STATE_LEADERSHIP', 'CRIME_ANALYST'],
    actions: [],
  };

  const workspace = await services.getWorkspace({ access });

  assert.equal(workspace.data.role, 'DEMO_PRESENTER');
  assert.equal(workspace.data.alertSummary.total, 0);
  assert.deepEqual(workspace.data.personaSwitch, {
    allowed: true, personas: ['STATE_LEADERSHIP', 'CRIME_ANALYST'],
  });
});

test('workspace bootstrap remains available when optional dashboard, report, or alert reads fail', async () => {
  const repository = new MemoryIntelligenceRepository(buildDemoState());
  repository.listDashboards = async () => { throw new Error('dashboard store unavailable'); };
  repository.listReports = async () => { throw new Error('report store unavailable'); };
  repository.listAlerts = async () => { throw new Error('alert store unavailable'); };
  const services = createWorkspaceServices({
    repository, readServices: {}, now: () => '2026-07-21T00:00:00Z',
    idFactory: prefix => `${prefix}-1`,
  });

  const workspace = await services.getWorkspace({ access: analyst });

  assert.equal(workspace.data.role, 'CRIME_ANALYST');
  assert.equal(workspace.data.landingDashboard, undefined);
  assert.deepEqual(workspace.data.availableDashboards, []);
  assert.deepEqual(workspace.data.availableReports, []);
  assert.deepEqual(workspace.data.alertSummary, { total: 0 });
});

test('workspace projects only safe display metadata for the scoped unit', async () => {
  const repository = new MemoryIntelligenceRepository(buildDemoState());
  const services = createWorkspaceServices({
    repository, readServices: {}, now: () => '2026-07-21T00:00:00Z',
    idFactory: prefix => `${prefix}-1`,
  });
  const workspace = await services.getWorkspace({ access: { ...analyst, scopeUnitId: 1001 } });

  assert.deepEqual(workspace.data.scopeUnit, {
    name: 'Synthetic Central Police Station', type: 'Police station',
  });
  assert.equal(workspace.data.scopeUnit.parentUnit, undefined);
  assert.equal(workspace.data.scopeUnit.id, undefined);
});

test('station workspace prefers a validated owned landing over its role default', async () => {
  let id = 0;
  const repository = new MemoryIntelligenceRepository(buildDemoState());
  const services = createWorkspaceServices({
    repository, readServices: {}, now: () => '2026-07-21T00:00:00Z',
    idFactory: prefix => `${prefix}-${++id}`,
  });
  const station = { ...analyst, actualUserId: 'CAT-STATION', role: 'STATION_OPERATIONS', actualRole: 'STATION_OPERATIONS' };
  const admin = { ...analyst, actualUserId: 'CAT-ADMIN', role: 'PLATFORM_ADMIN', actions: ['MANAGE_GLOBAL_CONTENT'] };
  const personal = await services.createDashboard({ access: station, body: { name: 'State Intelligence' } });
  await services.setLandingDashboard({ access: station, body: { dashboardId: personal.data.id } });
  const stationDefault = await services.createDashboard({ access: admin, body: { name: 'Station Operations' } });
  await services.setRoleDefault({ access: admin, params: { dashboardId: stationDefault.data.id }, body: { role: 'STATION_OPERATIONS' } });

  const workspace = await services.getWorkspace({ access: station });

  assert.equal(workspace.data.landingDashboard.id, personal.data.id);
  assert.notEqual(workspace.data.landingDashboard.id, stationDefault.data.id);
  assert.deepEqual(workspace.data.semanticSources, ['alerts', 'stationCases']);
});

test('workspace case resources delegate access, query, and detail parameters unchanged', async () => {
  const calls = [];
  const caseService = {
    async list(input) { calls.push(['list', input]); return { data: { items: [] }, syntheticData: true }; },
    async get(input) { calls.push(['get', input]); return { data: { caseId: input.caseId }, syntheticData: true }; },
  };
  const services = createWorkspaceServices({
    repository: new MemoryIntelligenceRepository(buildDemoState()), readServices: {}, caseService,
    now: () => '2026-07-21T00:00:00Z', idFactory: prefix => `${prefix}-1`,
  });
  const query = { openOnly: 'false', limit: '10' };

  assert.deepEqual(await services.listStationCases({ access: analyst, query }), { data: { items: [] }, syntheticData: true });
  assert.deepEqual(await services.getStationCase({ access: analyst, params: { caseId: 'CASE-1' } }), {
    data: { caseId: 'CASE-1' }, syntheticData: true,
  });
  assert.strictEqual(calls[0][1].access, analyst);
  assert.strictEqual(calls[0][1].query, query);
  assert.deepEqual(calls[1], ['get', { access: analyst, caseId: 'CASE-1' }]);
});

test('workspace report execution forwards only the ephemeral runtime filter body', async () => {
  const repository = new MemoryIntelligenceRepository(buildDemoState());
  const reports = [];
  repository.getReport = async () => ({
    id: 'REPORT-1', ownerUserId: analyst.actualUserId, visibility: 'PRIVATE', version: 1,
    name: 'Cases', definition: {
      name: 'Cases', sourceKey: 'stationCases', dimensions: [],
      measures: [{ field: 'recordCount', aggregate: 'sum' }], filters: [], sort: [],
      visualization: { type: 'number' }, limit: 100,
    },
  });
  const services = createWorkspaceServices({
    repository,
    readServices: { async listStationCasesForAnalytics(input) { reports.push(input); return { data: { items: [] } }; } },
    now: () => '2026-07-21T00:00:00Z', idFactory: prefix => `${prefix}-1`,
  });
  await services.executeReport({
    access: analyst, params: { reportId: 'REPORT-1' },
    body: { runtimeFilters: [{ field: 'registeredAgeDays', operator: 'lte', value: 7 }] },
  });

  assert.equal(reports.length, 1);
});

test('station report-source catalog exposes only station cases and alerts', async () => {
  const services = createWorkspaceServices({
    repository: new MemoryIntelligenceRepository(buildDemoState()), readServices: {},
    now: () => '2026-07-21T00:00:00Z', idFactory: prefix => `${prefix}-1`,
  });
  const result = await services.listReportSources({ access: { ...analyst, role: 'STATION_OPERATIONS' } });

  assert.deepEqual(result.data.map(source => source.key), ['alerts', 'stationCases']);
});

test('station-owned bootstrap resources stay private and do not replace the station role default', async () => {
  let id = 0;
  const repository = new MemoryIntelligenceRepository(buildDemoState());
  const services = createWorkspaceServices({
    repository, readServices: {}, now: () => '2026-07-21T00:00:00Z',
    idFactory: prefix => `${prefix}-${++id}`,
  });
  const station = {
    ...analyst, actualUserId: 'CAT-STATION', role: 'STATION_OPERATIONS', actualRole: 'STATION_OPERATIONS',
    scopeUnitId: 1001, authorizedUnitIds: new Set([1001]),
  };
  const admin = { ...analyst, actualUserId: 'CAT-ADMIN', role: 'PLATFORM_ADMIN', actions: ['MANAGE_GLOBAL_CONTENT'] };
  const stateViewer = { ...analyst, actualUserId: 'CAT-STATE', role: 'STATE_LEADERSHIP', actualRole: 'STATE_LEADERSHIP' };
  const defaultDashboard = await services.createDashboard({ access: admin, body: { name: 'Station Operations' } });
  await services.setRoleDefault({ access: admin, params: { dashboardId: defaultDashboard.data.id }, body: { role: 'STATION_OPERATIONS' } });

  const report = await services.createReport({ access: station, body: {
    name: 'Open Cases', sourceKey: 'stationCases', dimensions: [],
    measures: [{ field: 'recordCount', aggregate: 'sum' }],
    filters: [{ field: 'isOpen', operator: 'eq', value: true }], sort: [],
    visualization: { type: 'number' }, limit: 1,
  } });
  const personal = await services.createDashboard({ access: station, body: { name: 'Station Operations' } });
  await services.replaceDashboardItems({ access: station, params: { dashboardId: personal.data.id }, body: {
    items: [{ reportId: report.data.id, column: 1, row: 1, width: 3, height: 2 }],
  } });
  await services.setLandingDashboard({ access: station, body: { dashboardId: personal.data.id } });

  const stationWorkspace = await services.getWorkspace({ access: station });
  assert.equal(stationWorkspace.data.landingDashboard.id, personal.data.id);
  assert.equal((await repository.getDashboard(defaultDashboard.data.id)).defaultRole, 'STATION_OPERATIONS');
  assert.equal((await services.listDashboards({ access: stateViewer })).data.some(row => row.id === personal.data.id), false);
  assert.equal((await services.listReports({ access: stateViewer })).data.some(row => row.id === report.data.id), false);
});

test('independent clients coalesce station bootstrap report and dashboard creates by idempotency key', async () => {
  let id = 0;
  const repository = new MemoryIntelligenceRepository(buildDemoState());
  const makeServices = () => createWorkspaceServices({
    repository, readServices: {}, now: () => '2026-07-21T00:00:00Z',
    idFactory: prefix => `${prefix}-${++id}`,
  });
  const first = makeServices();
  const second = makeServices();
  const station = {
    ...analyst, actualUserId: 'CAT-STATION-IDEMPOTENT', role: 'STATION_OPERATIONS', actualRole: 'STATION_OPERATIONS',
    scopeUnitId: 1001, authorizedUnitIds: new Set([1001]),
  };
  const definition = {
    name: 'Open Cases', description: 'Canonical', sourceKey: 'stationCases', dimensions: [],
    measures: [{ field: 'recordCount', aggregate: 'sum' }], filters: [], sort: [],
    visualization: { type: 'number' }, limit: 1,
  };
  const headers = { 'Idempotency-Key': 'station-operations/v1/report/0' };

  const [reportA, reportB] = await Promise.all([
    first.createReport({ access: station, body: definition, headers }),
    second.createReport({ access: station, body: definition, headers }),
  ]);
  const dashboardHeaders = { 'Idempotency-Key': 'station-operations/v1/dashboard' };
  const [dashboardA, dashboardB] = await Promise.all([
    first.createDashboard({ access: station, body: { name: 'Station Operations', description: '[ACE:station-operations:v1:pending]' }, headers: dashboardHeaders }),
    second.createDashboard({ access: station, body: { name: 'Station Operations', description: '[ACE:station-operations:v1:pending]' }, headers: dashboardHeaders }),
  ]);

  assert.equal(reportA.data.id, reportB.data.id);
  assert.equal(dashboardA.data.id, dashboardB.data.id);
  assert.equal((await repository.listReports()).filter(row => row.ownerUserId === station.actualUserId).length, 1);
  assert.equal((await repository.listDashboards()).filter(row => row.ownerUserId === station.actualUserId).length, 1);
  await assert.rejects(first.createReport({
    access: station, body: { ...definition, description: 'Different request' }, headers,
  }), { code: 'IDEMPOTENCY_CONFLICT' });
});

test('independent clients coalesce a full bootstrap placement replacement to exactly nine items', async () => {
  let id = 0;
  const repository = new MemoryIntelligenceRepository(buildDemoState());
  const makeServices = () => createWorkspaceServices({
    repository, readServices: {}, now: () => '2026-07-21T00:00:00Z',
    idFactory: prefix => `${prefix}-${++id}`,
  });
  const first = makeServices();
  const second = makeServices();
  const station = {
    ...analyst, actualUserId: 'CAT-STATION-PLACEMENTS', role: 'STATION_OPERATIONS', actualRole: 'STATION_OPERATIONS',
    scopeUnitId: 1001, authorizedUnitIds: new Set([1001]),
  };
  const reports = [];
  for (let index = 0; index < 9; index += 1) {
    reports.push(await repository.createReport({
      id: `R-BOOT-${index}`, ownerUserId: station.actualUserId, visibility: 'PRIVATE', version: 1,
      name: `Report ${index}`, definition: { sourceKey: 'stationCases' },
    }));
  }
  const dashboard = await first.createDashboard({
    access: station,
    body: { name: 'Station Operations', description: '[ACE:station-operations:v1:pending]' },
    headers: { 'Idempotency-Key': 'station-operations/v1/dashboard' },
  });
  const items = reports.map((report, index) => ({
    reportId: report.id, column: (index % 4) * 3 + 1, row: Math.floor(index / 4) * 3 + 1,
    width: 3, height: 2,
  }));
  const headers = { 'Idempotency-Key': 'station-operations/v1/dashboard-items' };

  const [left, right] = await Promise.all([
    first.replaceDashboardItems({ access: station, params: { dashboardId: dashboard.data.id }, body: { items }, headers }),
    second.replaceDashboardItems({ access: station, params: { dashboardId: dashboard.data.id }, body: { items }, headers }),
  ]);
  const persisted = await repository.listDashboardItems(dashboard.data.id);

  assert.equal(persisted.length, 9);
  assert.deepEqual(left.data.map(item => item.id), right.data.map(item => item.id));
  assert.equal(new Set(persisted.map(item => item.id)).size, 9);
});

test('workspace case resources fail safely when the case service is not composed', async () => {
  const services = createWorkspaceServices({
    repository: new MemoryIntelligenceRepository(buildDemoState()), readServices: {},
    now: () => '2026-07-21T00:00:00Z', idFactory: prefix => `${prefix}-1`,
  });

  await assert.rejects(services.listStationCases({ access: analyst, query: {} }), { code: 'DATA_NOT_READY' });
  await assert.rejects(services.getStationCase({ access: analyst, params: { caseId: 'CASE-1' } }), { code: 'DATA_NOT_READY' });
});

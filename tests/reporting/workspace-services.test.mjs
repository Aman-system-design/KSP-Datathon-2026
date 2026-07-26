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
  assert.equal(sources.data.length, 7);
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

import assert from 'node:assert/strict';
import test from 'node:test';

import { buildDemoState } from '../../src/backend/repository/build-demo-state.mjs';
import { MemoryIntelligenceRepository } from '../../src/backend/repository/memory-repository.mjs';
import { createWorkspaceServices } from '../../src/backend/reporting/workspace-services.mjs';

const analyst = {
  actualUserId: 'CAT-ANALYST', role: 'CRIME_ANALYST', scopeUnitId: 101,
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
});

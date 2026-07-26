import assert from 'node:assert/strict';
import test from 'node:test';

import { CatalystIntelligenceRepository } from '../../src/backend/repository/catalyst/catalyst-repository.mjs';
import { createDashboardService } from '../../src/backend/reporting/dashboard-service.mjs';

function fakeApplication({ afterUpdate } = {}) {
  const tables = new Map();
  let nextRowId = 1000;
  const table = name => ({
    async getPagedRows() { return { data: structuredClone(tables.get(name) ?? []), more_records: false }; },
    async insertRow(input) {
      const stored = { ...structuredClone(input), ROWID: String(++nextRowId) };
      tables.set(name, [...(tables.get(name) ?? []), stored]);
      return structuredClone(stored);
    },
    async updateRow(input) {
      const rows = tables.get(name) ?? [];
      const index = rows.findIndex(row => String(row.ROWID) === String(input.ROWID));
      if (index < 0) throw new Error('missing row');
      rows[index] = structuredClone(input);
      await afterUpdate?.(name, structuredClone(input));
      return structuredClone(input);
    },
    async deleteRow(rowId) {
      const rows = tables.get(name) ?? [];
      tables.set(name, rows.filter(row => String(row.ROWID) !== String(rowId)));
      return true;
    },
  });
  return { application: { datastore: () => ({ table }) }, tables };
}

test('Catalyst repository persists report, dashboard, widget and landing preference using ROWID references', async () => {
  const fake = fakeApplication();
  const repository = new CatalystIntelligenceRepository({ application: fake.application });
  const report = await repository.createReport({
    id: 'R-1', name: 'Anomalies', ownerUserId: 'USER-1', visibility: 'PRIVATE', version: 1,
    definition: { name: 'Anomalies', description: '', sourceKey: 'anomalies' },
    createdAt: '2026-07-21T00:00:00Z', updatedAt: '2026-07-21T00:00:00Z', syntheticData: true,
  });
  assert.equal(report.id, 'R-1');
  assert.equal((await repository.updateReport('R-1', 1, { name: 'Anomaly watch', updatedAt: '2026-07-21T01:00:00Z' })).version, 2);
  assert.deepEqual(await repository.updateReport('R-1', 1, {}), { conflict: true });

  const dashboard = await repository.createDashboard({
    id: 'D-1', name: 'Analyst desk', description: '', ownerUserId: 'USER-1', visibility: 'PRIVATE',
    version: 1, createdAt: '2026-07-21T00:00:00Z', updatedAt: '2026-07-21T00:00:00Z', syntheticData: true,
  });
  await repository.createDashboardItem({
    id: 'I-1', dashboardId: dashboard.id, reportId: report.id,
    column: 1, row: 1, width: 6, height: 3, displayOrder: 1, version: 1,
  });
  const storedItem = fake.tables.get('CFG_DashboardItem')[0];
  assert.match(storedItem.DashboardRef, /^\d+$/);
  assert.match(storedItem.ReportRef, /^\d+$/);
  assert.equal((await repository.listDashboardItems('D-1'))[0].reportId, 'R-1');
  assert.equal(await repository.isReportReferenced('R-1'), true);

  const preference = await repository.upsertUserPreference({
    id: 'P-1', userId: 'USER-1', landingDashboardId: 'D-1', version: 1,
    updatedAt: '2026-07-21T01:00:00Z', syntheticData: true,
  });
  assert.equal(preference.landingDashboardId, 'D-1');
  await repository.deleteDashboard('D-1');
  assert.equal(await repository.getUserPreference('USER-1'), undefined);
});

test('Catalyst clone compensation restores a prior landing after a preference write mutates then throws', async () => {
  let failPreferenceWrite = false;
  const fake = fakeApplication({ afterUpdate(name) {
    if (name === 'CFG_UserPreference' && failPreferenceWrite) {
      failPreferenceWrite = false;
      throw new Error('post-write transport failure');
    }
  } });
  const repository = new CatalystIntelligenceRepository({ application: fake.application });
  const timestamp = '2026-07-21T00:00:00Z';
  await repository.createReport({
    id: 'R-CASE', name: 'Cases', ownerUserId: 'ADMIN', visibility: 'GLOBAL', version: 1,
    definition: { name: 'Cases', sourceKey: 'stationCases' }, createdAt: timestamp, updatedAt: timestamp,
  });
  await repository.createDashboard({ id: 'D-PRIOR', name: 'Prior', ownerUserId: 'STATION', visibility: 'PRIVATE', version: 1, createdAt: timestamp, updatedAt: timestamp });
  await repository.createDashboard({ id: 'D-SYSTEM', name: 'Station Operations', ownerUserId: 'ADMIN', visibility: 'GLOBAL', defaultRole: 'STATION_OPERATIONS', version: 1, createdAt: timestamp, updatedAt: timestamp });
  await repository.createDashboardItem({ id: 'I-CASE', dashboardId: 'D-SYSTEM', reportId: 'R-CASE', column: 1, row: 1, width: 4, height: 2, version: 1 });
  await repository.upsertUserPreference({ id: 'P-STATION', userId: 'STATION', landingDashboardId: 'D-PRIOR', version: 1, updatedAt: timestamp });
  let sequence = 0;
  const service = createDashboardService({ repository, now: () => timestamp, idFactory: () => `CLONE-${++sequence}` });
  failPreferenceWrite = true;

  await assert.rejects(service.cloneForOwner({
    access: { actualUserId: 'STATION', role: 'STATION_OPERATIONS', authorizedUnitIds: new Set(), actions: [] },
    dashboardId: 'D-SYSTEM', input: {},
  }), { code: 'DATA_NOT_READY' });

  assert.equal((await repository.getUserPreference('STATION')).landingDashboardId, 'D-PRIOR');
  assert.deepEqual((await repository.listDashboards()).map(row => row.id).sort(), ['D-PRIOR', 'D-SYSTEM']);
  assert.deepEqual((await repository.listDashboardItems('D-SYSTEM')).map(row => row.id), ['I-CASE']);
});

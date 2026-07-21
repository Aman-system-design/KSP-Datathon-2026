import assert from 'node:assert/strict';
import test from 'node:test';

import { buildDemoState } from '../../src/backend/repository/build-demo-state.mjs';
import { MemoryIntelligenceRepository } from '../../src/backend/repository/memory-repository.mjs';
import { createReportService } from '../../src/backend/reporting/report-service.mjs';

const access = (userId, role = 'CRIME_ANALYST', units = [101], actions = []) => ({
  actualUserId: userId, role, authorizedUnitIds: new Set(units), actions,
});

function harness() {
  let sequence = 0;
  const repository = new MemoryIntelligenceRepository(buildDemoState());
  const calls = [];
  const readServices = {
    async listAnomalies(request) {
      calls.push(request);
      return { data: { items: [{ unitId: [...request.access.authorizedUnitIds][0], observed: 4 }] } };
    },
  };
  return {
    repository, calls,
    service: createReportService({
      repository, readServices, now: () => '2026-07-21T00:00:00Z',
      idFactory: () => `REPORT-${++sequence}`,
    }),
  };
}

const definition = {
  name: 'Anomaly total', sourceKey: 'anomalies', dimensions: ['unitId'],
  measures: [{ field: 'observed', aggregate: 'sum' }], visualization: { type: 'bar' },
};

test('owner creates and version-updates a governed report', async () => {
  const { service } = harness();
  const owner = access('USER-1');
  const created = await service.create({ access: owner, input: definition });
  assert.deepEqual(
    { id: created.id, ownerUserId: created.ownerUserId, version: created.version },
    { id: 'REPORT-1', ownerUserId: 'USER-1', version: 1 },
  );

  const updated = await service.update({
    access: owner, reportId: created.id, expectedVersion: 1,
    input: { ...definition, name: 'Updated anomaly total' },
  });
  assert.equal(updated.version, 2);
  await assert.rejects(
    service.update({ access: owner, reportId: created.id, expectedVersion: 1, input: definition }),
    { code: 'VERSION_CONFLICT' },
  );
});

test('report execution always uses viewer scope, never owner scope', async () => {
  const { service, calls } = harness();
  const created = await service.create({ access: access('OWNER', 'CRIME_ANALYST', [101]), input: definition });
  await service.share({
    access: access('OWNER'), reportId: created.id,
    target: { userId: 'VIEWER' }, permission: 'VIEW',
  });

  const result = await service.execute({ access: access('VIEWER', 'STATION_OFFICER', [1001]), reportId: created.id });
  assert.deepEqual([...calls[0].access.authorizedUnitIds], [1001]);
  assert.equal(result.definition.id, created.id);
});

test('private reports are hidden and global publication requires administrator permission', async () => {
  const { service } = harness();
  const created = await service.create({ access: access('OWNER'), input: definition });
  await assert.rejects(service.get({ access: access('OTHER'), reportId: created.id }), { code: 'NOT_FOUND' });
  await assert.rejects(
    service.publishGlobal({ access: access('OWNER'), reportId: created.id }),
    { code: 'FORBIDDEN_ACTION' },
  );
  const published = await service.publishGlobal({
    access: access('ADMIN', 'SYSTEM_ADMINISTRATOR', [101], ['MANAGE_GLOBAL_CONTENT']),
    reportId: created.id,
  });
  assert.equal(published.visibility, 'GLOBAL');
  assert.equal((await service.get({ access: access('OTHER'), reportId: created.id })).id, created.id);
});

test('a report referenced by a dashboard cannot be deleted', async () => {
  const { service, repository } = harness();
  const owner = access('OWNER');
  const created = await service.create({ access: owner, input: definition });
  await repository.createDashboard({ id: 'D-1', ownerUserId: 'OWNER', name: 'Desk', version: 1 });
  await repository.createDashboardItem({
    id: 'I-1', dashboardId: 'D-1', reportId: created.id,
    column: 1, row: 1, width: 4, height: 2, version: 1,
  });
  await assert.rejects(service.remove({ access: owner, reportId: created.id }), { code: 'RESOURCE_IN_USE' });
});

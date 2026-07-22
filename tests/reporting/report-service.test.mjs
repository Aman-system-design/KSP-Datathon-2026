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

const mapDefinition = {
  name: 'Current hotspot posture', sourceKey: 'hotspots',
  visualization: { type: 'map', mapViewId: 'MAP-1' },
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

test('map report execution reauthorizes its saved view for the current viewer', async () => {
  const repository = new MemoryIntelligenceRepository(buildDemoState());
  const calls = [];
  const mapViewService = {
    async getMapView(input) {
      calls.push(input);
      return { data: {
        id: 'MAP-1', organizationId: 'ORG-KSP', ownerEmployeeId: 9001,
        name: 'Hotspot posture', visibility: 'SHARED', version: 2,
        definition: {
          id: 'MAP-1', name: 'Hotspot posture', visibility: 'SHARED', version: 2,
          viewport: { center: [77.59, 12.97], zoom: 9 },
          layers: [{ id: 'L-1', datasetId: 'hotspots', renderer: 'POINT', visible: true, order: 0, limit: 100 }],
        },
      }, meta: { requestId: 'REQ-MAP' } };
    },
  };
  const service = createReportService({
    repository, readServices: {}, mapViewService,
    now: () => '2026-07-21T00:00:00Z', idFactory: () => 'REPORT-MAP-1',
  });
  const owner = access('OWNER', 'CRIME_ANALYST', [101]);
  const created = await service.create({ access: owner, input: mapDefinition });
  await service.share({ access: owner, reportId: created.id, target: { userId: 'VIEWER' } });
  const viewer = access('VIEWER', 'DISTRICT_LEADERSHIP', [201]);

  const result = await service.execute({ access: viewer, reportId: created.id, requestId: 'REQ-REPORT' });

  assert.equal(calls.length, 2);
  assert.equal(calls[1].access, viewer);
  assert.deepEqual(calls[1].params, { mapViewId: 'MAP-1' });
  assert.equal(result.definition.ownerUserId, undefined);
  assert.deepEqual(Object.keys(result.definition).sort(), ['definition', 'id', 'name', 'version', 'visibility']);
  assert.equal(result.result.data.mapView.organizationId, undefined);
  assert.equal(result.result.data.mapView.ownerEmployeeId, undefined);
  assert.equal(result.result.data.executions[0].layer.datasetId, 'hotspots');
});

test('map report execution fails closed when the saved view is no longer authorized', async () => {
  const repository = new MemoryIntelligenceRepository(buildDemoState());
  let authorized = true;
  const service = createReportService({
    repository, readServices: {},
    mapViewService: { async getMapView({ params }) {
      if (authorized) return { data: { id: params.mapViewId } };
      const error = new Error('Not found'); error.code = 'NOT_FOUND'; throw error;
    } },
    now: () => '2026-07-21T00:00:00Z', idFactory: () => 'REPORT-MAP-2',
  });
  const owner = access('OWNER');
  const created = await service.create({ access: owner, input: mapDefinition });
  authorized = false;

  await assert.rejects(service.execute({ access: owner, reportId: created.id }), { code: 'NOT_FOUND' });
});

test('invalid report source and shape become stable 400 service errors', async () => {
  const { service } = harness();
  for (const input of [
    { name: 'Unknown', sourceKey: 'raw-table' },
    { name: 'Bad', sourceKey: 'anomalies', dimensions: ['privateColumn'] },
  ]) await assert.rejects(service.create({ access: access('OWNER'), input }), { code: 'INVALID_REQUEST', status: 400 });
});

test('map report create and update authorize the referenced view before persistence', async () => {
  const repository = new MemoryIntelligenceRepository(buildDemoState());
  const calls = [];
  const mapViewService = { async getMapView({ params }) {
    calls.push(params.mapViewId);
    if (params.mapViewId === 'MAP-HIDDEN') { const error = new Error(); error.code = 'NOT_FOUND'; throw error; }
    return { data: { id: params.mapViewId } };
  } };
  let sequence = 0;
  const service = createReportService({
    repository, readServices: {}, mapViewService,
    now: () => '2026-07-21T00:00:00Z', idFactory: () => `REPORT-AUTH-${++sequence}`,
  });
  const owner = access('OWNER');
  await assert.rejects(service.create({ access: owner, input: {
    ...mapDefinition, visualization: { type: 'map', mapViewId: 'MAP-HIDDEN' },
  } }), { code: 'NOT_FOUND' });
  assert.equal((await repository.listReports()).length, 0);

  const created = await service.create({ access: owner, input: mapDefinition });
  await assert.rejects(service.update({
    access: owner, reportId: created.id, expectedVersion: 1,
    input: { ...mapDefinition, visualization: { type: 'map', mapViewId: 'MAP-HIDDEN' } },
  }), { code: 'NOT_FOUND' });
  assert.equal((await repository.getReport(created.id)).version, 1);
  assert.deepEqual(calls, ['MAP-HIDDEN', 'MAP-1', 'MAP-HIDDEN']);
});

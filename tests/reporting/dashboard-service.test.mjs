import assert from 'node:assert/strict';
import test from 'node:test';

import { buildDemoState } from '../../src/backend/repository/build-demo-state.mjs';
import { MemoryIntelligenceRepository } from '../../src/backend/repository/memory-repository.mjs';
import { createDashboardService } from '../../src/backend/reporting/dashboard-service.mjs';

const access = (userId, role = 'CRIME_ANALYST', actions = []) => ({
  actualUserId: userId, role, scopeUnitId: 101, authorizedUnitIds: new Set([101]), actions,
});

function harness() {
  let sequence = 0;
  const repository = new MemoryIntelligenceRepository(buildDemoState());
  return {
    repository,
    service: createDashboardService({
      repository, now: () => '2026-07-21T00:00:00Z',
      idFactory: () => `ID-${++sequence}`,
    }),
  };
}

test('dashboard owner adds only bounded 12-column widgets', async () => {
  const { service, repository } = harness();
  const owner = access('OWNER');
  await repository.createReport({ id: 'R-1', ownerUserId: 'OWNER', name: 'Report', version: 1, visibility: 'PRIVATE' });
  const dashboard = await service.create({ access: owner, input: { name: 'Analyst desk' } });
  const item = await service.addItem({
    access: owner, dashboardId: dashboard.id, reportId: 'R-1',
    layout: { column: 9, row: 1, width: 4, height: 2 },
  });
  assert.equal(item.dashboardId, dashboard.id);
  await assert.rejects(service.addItem({
    access: owner, dashboardId: dashboard.id, reportId: 'R-1',
    layout: { column: 10, row: 1, width: 4, height: 2 },
  }), { code: 'INVALID_REQUEST' });
});

test('dashboard owner cannot attach another user private report', async () => {
  const { service, repository } = harness();
  const owner = access('OWNER');
  await repository.createReport({ id: 'R-PRIVATE', ownerUserId: 'OTHER', name: 'Private', version: 1, visibility: 'PRIVATE' });
  const dashboard = await service.create({ access: owner, input: { name: 'Analyst desk' } });
  const item = {
    reportId: 'R-PRIVATE', column: 1, row: 1, width: 4, height: 2,
  };

  await assert.rejects(
    service.addItem({ access: owner, dashboardId: dashboard.id, reportId: item.reportId, layout: item }),
    { code: 'INVALID_REQUEST' },
  );
  await assert.rejects(
    service.replaceItems({ access: owner, dashboardId: dashboard.id, items: [item] }),
    { code: 'INVALID_REQUEST' },
  );
});

test('personal landing overrides a role default without mutating it', async () => {
  const { service } = harness();
  const admin = access('ADMIN', 'SYSTEM_ADMINISTRATOR', ['MANAGE_GLOBAL_CONTENT']);
  const roleDashboard = await service.create({ access: admin, input: { name: 'Analyst default' } });
  await service.setRoleDefault({ access: admin, dashboardId: roleDashboard.id, role: 'CRIME_ANALYST' });

  const analyst = access('ANALYST');
  const personal = await service.create({ access: analyst, input: { name: 'My desk' } });
  assert.equal((await service.resolveLanding({ access: analyst })).id, roleDashboard.id);
  await service.setPersonalLanding({ access: analyst, dashboardId: personal.id });
  assert.equal((await service.resolveLanding({ access: analyst })).id, personal.id);
  assert.equal((await service.resolveLanding({ access: access('ANALYST-2') })).id, roleDashboard.id);
});

test('only administrator permission sets a role default', async () => {
  const { service } = harness();
  const owner = access('OWNER');
  const dashboard = await service.create({ access: owner, input: { name: 'Desk' } });
  await assert.rejects(
    service.setRoleDefault({ access: owner, dashboardId: dashboard.id, role: 'CRIME_ANALYST' }),
    { code: 'FORBIDDEN_ACTION' },
  );
  await assert.rejects(
    service.setRoleDefault({ access: access('ADMIN', 'PLATFORM_ADMIN', ['MANAGE_GLOBAL_CONTENT']), dashboardId: dashboard.id, role: 'MADE_UP_ROLE' }),
    { code: 'INVALID_REQUEST' },
  );
});

test('visible dashboards expose a safe owned shared or system relationship', async () => {
  const { service, repository } = harness();
  const viewer = access('VIEWER');
  const admin = access('ADMIN', 'SYSTEM_ADMINISTRATOR', ['MANAGE_GLOBAL_CONTENT']);
  const owned = await service.create({ access: viewer, input: { name: 'Owned desk' } });
  const shared = await service.create({ access: access('OTHER'), input: { name: 'Shared desk' } });
  await repository.createContentShare({
    id: 'SHARE-1', contentType: 'DASHBOARD', contentId: shared.id,
    targetUserId: 'VIEWER', permission: 'VIEW', sharedByUserId: 'OTHER', version: 1,
  });
  const system = await service.create({ access: admin, input: { name: 'System desk' } });
  await service.setRoleDefault({ access: admin, dashboardId: system.id, role: 'CRIME_ANALYST' });

  const visible = await service.list({ access: viewer });

  assert.deepEqual(
    visible.filter(item => [owned.id, shared.id, system.id].includes(item.id)).map(item => ({ id: item.id, relationship: item.relationship })),
    [
      { id: owned.id, relationship: 'OWNED' },
      { id: shared.id, relationship: 'SHARED' },
      { id: system.id, relationship: 'SYSTEM' },
    ],
  );
  assert.equal(visible.some(item => 'shareTargets' in item), false);
});

test('station dashboards reject and filter reports outside station cases and alerts', async () => {
  const { service, repository } = harness();
  const station = access('STATION-OWNER', 'STATION_OPERATIONS');
  const dashboard = await service.create({ access: station, input: { name: 'Station Operations' } });
  await repository.createReport({
    id: 'R-STATION', ownerUserId: station.actualUserId, name: 'Open cases', version: 1, visibility: 'PRIVATE',
    definition: { sourceKey: 'stationCases' },
  });
  await repository.createReport({
    id: 'R-STATE', ownerUserId: station.actualUserId, name: 'State map', version: 1, visibility: 'PRIVATE',
    definition: { sourceKey: 'hotspots' },
  });
  const layout = { column: 1, row: 1, width: 4, height: 2 };

  await service.addItem({ access: station, dashboardId: dashboard.id, reportId: 'R-STATION', layout });
  await assert.rejects(
    service.addItem({ access: station, dashboardId: dashboard.id, reportId: 'R-STATE', layout }),
    { code: 'INVALID_REQUEST' },
  );
  await repository.createDashboardItem({ id: 'LEGACY-STATE', dashboardId: dashboard.id, reportId: 'R-STATE', ...layout, version: 1 });

  const loaded = await service.get({ access: station, dashboardId: dashboard.id });
  assert.deepEqual(loaded.items.map(item => item.reportId), ['R-STATION']);
});

test('station dashboard policy hides unrelated and unsafe system dashboards everywhere', async () => {
  const { service, repository } = harness();
  const station = access('STATION', 'STATION_OPERATIONS');
  const admin = access('ADMIN', 'SYSTEM_ADMINISTRATOR', ['MANAGE_GLOBAL_CONTENT']);
  const unrelated = await service.create({ access: admin, input: { name: 'State Intelligence' } });
  await repository.updateDashboard(unrelated.id, unrelated.version, { visibility: 'GLOBAL' });
  await assert.rejects(service.get({ access: station, dashboardId: unrelated.id }), { code: 'NOT_FOUND' });
  await assert.rejects(service.setPersonalLanding({ access: station, dashboardId: unrelated.id }), { code: 'NOT_FOUND' });
  assert.equal((await service.list({ access: station })).some(row => row.id === unrelated.id), false);

  await repository.createReport({ id: 'R-BAD', ownerUserId: 'ADMIN', visibility: 'GLOBAL', version: 1, definition: { sourceKey: 'hotspots' } });
  const unsafe = await service.create({ access: admin, input: { name: 'Station Operations' } });
  await service.setRoleDefault({ access: admin, dashboardId: unsafe.id, role: 'STATION_OPERATIONS' });
  await repository.createDashboardItem({ id: 'I-BAD', dashboardId: unsafe.id, reportId: 'R-BAD', column: 1, row: 1, width: 4, height: 2, version: 1 });
  await assert.rejects(service.get({ access: station, dashboardId: unsafe.id }), { code: 'NOT_FOUND' });
});

test('station clone copies validated items, persists landing, and compensates replacement failures', async () => {
  const { service, repository } = harness();
  const station = access('STATION', 'STATION_OPERATIONS');
  const admin = access('ADMIN', 'SYSTEM_ADMINISTRATOR', ['MANAGE_GLOBAL_CONTENT']);
  await repository.createReport({ id: 'R-CASE', ownerUserId: 'ADMIN', visibility: 'GLOBAL', version: 1, definition: { sourceKey: 'stationCases' } });
  const source = await service.create({ access: admin, input: { name: 'Station Operations' } });
  await service.setRoleDefault({ access: admin, dashboardId: source.id, role: 'STATION_OPERATIONS' });
  await repository.createDashboardItem({ id: 'I-CASE', dashboardId: source.id, reportId: 'R-CASE', column: 1, row: 1, width: 4, height: 2, version: 1 });

  const cloned = await service.cloneForOwner({ access: station, dashboardId: source.id, input: { description: 'Local' } });
  assert.equal(cloned.ownerUserId, 'STATION');
  assert.deepEqual(cloned.items.map(item => item.reportId), ['R-CASE']);
  assert.equal((await service.resolveLanding({ access: station })).id, cloned.id);

  const before = (await repository.listDashboards()).length;
  repository.replaceDashboardItems = async () => { throw new Error('storage detail'); };
  await assert.rejects(service.cloneForOwner({ access: access('STATION-2', 'STATION_OPERATIONS'), dashboardId: source.id }), { code: 'DATA_NOT_READY' });
  assert.equal((await repository.listDashboards()).length, before);

  const originalDelete = MemoryIntelligenceRepository.prototype.deleteDashboard.bind(repository);
  let cleanupAttempts = 0;
  repository.deleteDashboard = async id => {
    cleanupAttempts += 1;
    if (cleanupAttempts === 1) throw new Error('cleanup detail');
    return originalDelete(id);
  };
  await assert.rejects(service.cloneForOwner({ access: access('STATION-3', 'STATION_OPERATIONS'), dashboardId: source.id }), { code: 'DATA_NOT_READY' });
  assert.equal(cleanupAttempts, 2);
  assert.equal((await repository.listDashboards()).length, before);
});

test('station role-default validation is preflighted and replacement failure restores the prior default', async () => {
  const { service, repository } = harness();
  const admin = access('ADMIN', 'SYSTEM_ADMINISTRATOR', ['MANAGE_GLOBAL_CONTENT']);
  await repository.createReport({ id: 'R-OK', ownerUserId: 'ADMIN', visibility: 'GLOBAL', version: 1, definition: { sourceKey: 'stationCases' } });
  await repository.createReport({ id: 'R-BAD-DEFAULT', ownerUserId: 'ADMIN', visibility: 'GLOBAL', version: 1, definition: { sourceKey: 'hotspots' } });
  const current = await service.create({ access: admin, input: { name: 'Current station default' } });
  await repository.createDashboardItem({ id: 'I-OK', dashboardId: current.id, reportId: 'R-OK', column: 1, row: 1, width: 4, height: 2, version: 1 });
  await service.setRoleDefault({ access: admin, dashboardId: current.id, role: 'STATION_OPERATIONS' });
  const invalid = await service.create({ access: admin, input: { name: 'Invalid replacement' } });
  await repository.createDashboardItem({ id: 'I-BAD-DEFAULT', dashboardId: invalid.id, reportId: 'R-BAD-DEFAULT', column: 1, row: 1, width: 4, height: 2, version: 1 });

  await assert.rejects(service.setRoleDefault({ access: admin, dashboardId: invalid.id, role: 'STATION_OPERATIONS' }), { code: 'INVALID_REQUEST' });
  assert.equal((await repository.getDashboard(current.id)).defaultRole, 'STATION_OPERATIONS');
  assert.equal((await repository.getDashboard(invalid.id)).defaultRole, undefined);

  const replacement = await service.create({ access: admin, input: { name: 'Valid replacement' } });
  await repository.createDashboardItem({ id: 'I-OK-2', dashboardId: replacement.id, reportId: 'R-OK', column: 1, row: 1, width: 4, height: 2, version: 1 });
  const originalUpdate = repository.updateDashboard.bind(repository);
  repository.updateDashboard = async (id, version, changes) => id === replacement.id
    ? { conflict: true } : originalUpdate(id, version, changes);
  await assert.rejects(service.setRoleDefault({ access: admin, dashboardId: replacement.id, role: 'STATION_OPERATIONS' }), { code: 'VERSION_CONFLICT' });
  assert.equal((await repository.getDashboard(current.id)).defaultRole, 'STATION_OPERATIONS');
  assert.equal((await repository.getDashboard(replacement.id)).defaultRole, undefined);
});

test('role-default replacement reconciles write-then-throw outcomes at both mutation stages', async () => {
  for (const failureStage of ['unset-current', 'publish-candidate']) {
    const { service, repository } = harness();
    const admin = access('ADMIN', 'SYSTEM_ADMINISTRATOR', ['MANAGE_GLOBAL_CONTENT']);
    await repository.createReport({ id: `R-OK-${failureStage}`, ownerUserId: 'ADMIN', visibility: 'GLOBAL', version: 1, definition: { sourceKey: 'stationCases' } });
    const current = await service.create({ access: admin, input: { name: `Current ${failureStage}` } });
    const candidate = await service.create({ access: admin, input: { name: `Candidate ${failureStage}` } });
    await repository.createDashboardItem({ id: `I-CURRENT-${failureStage}`, dashboardId: current.id, reportId: `R-OK-${failureStage}`, column: 1, row: 1, width: 4, height: 2, version: 1 });
    await repository.createDashboardItem({ id: `I-CANDIDATE-${failureStage}`, dashboardId: candidate.id, reportId: `R-OK-${failureStage}`, column: 1, row: 1, width: 4, height: 2, version: 1 });
    await service.setRoleDefault({ access: admin, dashboardId: current.id, role: 'STATION_OPERATIONS' });
    const originalUpdate = repository.updateDashboard.bind(repository);
    let injected = false;
    repository.updateDashboard = async (id, version, changes) => {
      const result = await originalUpdate(id, version, changes);
      const isTargetStage = failureStage === 'unset-current'
        ? id === current.id && Object.hasOwn(changes, 'defaultRole') && changes.defaultRole === undefined
        : id === candidate.id && changes.defaultRole === 'STATION_OPERATIONS';
      if (isTargetStage && !injected) {
        injected = true;
        throw new Error(`uncertain ${failureStage}`);
      }
      return result;
    };

    await assert.rejects(
      service.setRoleDefault({ access: admin, dashboardId: candidate.id, role: 'STATION_OPERATIONS' }),
      new RegExp(`uncertain ${failureStage}`, 'u'),
    );

    const restoredCurrent = await repository.getDashboard(current.id);
    const restoredCandidate = await repository.getDashboard(candidate.id);
    assert.equal(restoredCurrent.defaultRole, 'STATION_OPERATIONS');
    assert.equal(restoredCurrent.visibility, 'GLOBAL');
    assert.equal(restoredCandidate.defaultRole, undefined);
    assert.equal(restoredCandidate.visibility, 'PRIVATE');
    assert.deepEqual((await repository.listDashboards()).filter(row => row.defaultRole === 'STATION_OPERATIONS').map(row => row.id), [current.id]);
  }
});

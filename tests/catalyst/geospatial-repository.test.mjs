import assert from 'node:assert/strict';
import test from 'node:test';

import { CatalystIntelligenceRepository } from '../../functions/crime_intelligence_api/app/src/backend/repository/catalyst/catalyst-repository.mjs';

function fakeApplication() {
  const tables = new Map();
  let nextRowId = 1000;
  const table = name => ({
    async getPagedRows() { return { data: structuredClone(tables.get(name) ?? []), more_records: false }; },
    async insertRow(input) {
      const rows = tables.get(name) ?? [];
      const id = name === 'CFG_MapView' ? 'MapViewID' : 'MapViewVersionKey';
      if (rows.some(row => row[id] === input[id])) {
        const error = new Error('duplicate'); error.code = 'DUPLICATE'; throw error;
      }
      const stored = { ...structuredClone(input), ROWID: String(++nextRowId), CREATORID: 'sdk' };
      tables.set(name, [...rows, stored]);
      return structuredClone(stored);
    },
  });
  const zcql = () => ({
    async executeZCQLQuery(query) {
      const match = query.match(/^UPDATE CFG_MapView SET CurrentVersion = (\d+), UpdatedAt = '([^']+)' WHERE ROWID = (\d+) AND CurrentVersion = (\d+)$/u);
      if (!match) throw new Error(`unexpected ZCQL: ${query}`);
      const [, currentVersion, updatedAt, rowId, expectedVersion] = match;
      const rows = tables.get('CFG_MapView') ?? [];
      const row = rows.find(item => item.ROWID === rowId && item.CurrentVersion === Number(expectedVersion));
      if (row) { row.CurrentVersion = Number(currentVersion); row.UpdatedAt = updatedAt; }
      return [{ affected_rows: row ? 1 : 0 }];
    },
  });
  return { application: { datastore: () => ({ table }), zcql }, tables };
}

const createdAt = '2026-07-22T10:00:00Z';
const mapView = (overrides = {}) => ({
  MapViewID: 'MAP-1', OrganizationID: 'ORG-KSP', Name: 'Hotspots', OwnerEmployeeID: 9001,
  Visibility: 'PRIVATE', CurrentVersion: 1, Status: 'ACTIVE', CreatedAt: createdAt,
  UpdatedAt: createdAt, SyntheticData: true, ...overrides,
});
const version = (number = 1, overrides = {}) => ({
  MapViewVersionKey: `MAP-1:${number}`, MapViewID: 'MAP-1', OrganizationID: 'ORG-KSP', Version: number,
  DefinitionJSON: JSON.stringify({ version: number }), DefinitionHash: String(number).repeat(64),
  PublishedAt: null, CreatedByEmployeeID: 9001, CreatedAt: createdAt, SyntheticData: true, ...overrides,
});

test('creates and reads an organization-scoped map view and immutable version without Catalyst metadata', async () => {
  const fake = fakeApplication();
  const repository = new CatalystIntelligenceRepository({ application: fake.application });

  const created = await repository.createMapView({ mapView: mapView(), version: version() });
  assert.equal(created.CurrentVersion, 1);
  assert.equal('ROWID' in created, false);
  assert.equal('CREATORID' in created, false);
  assert.deepEqual(await repository.getMapView('MAP-1', 'ORG-KSP'), created);
  assert.equal(await repository.getMapView('MAP-1', 'OTHER'), undefined);
  const storedVersion = await repository.getMapViewVersion('MAP-1', 1, 'ORG-KSP');
  assert.equal(storedVersion.DefinitionHash, '1'.repeat(64));
  assert.equal(storedVersion.CreatedAt, '2026-07-22 10:00:00');
  assert.equal('ROWID' in storedVersion || 'MapViewRef' in storedVersion, false);
  assert.equal(fake.tables.get('CFG_MapViewVersion')[0].MapViewRef, fake.tables.get('CFG_MapView')[0].ROWID);
});

test('lists map views with exact organization, visibility and owner predicates using bounded paging', async () => {
  const repository = new CatalystIntelligenceRepository({ application: fakeApplication().application });
  await repository.createMapView({ mapView: mapView(), version: version() });
  await repository.createMapView({
    mapView: mapView({ MapViewID: 'MAP-2', Visibility: 'SHARED', OwnerEmployeeID: 9002 }),
    version: version(1, { MapViewVersionKey: 'MAP-2:1', MapViewID: 'MAP-2', DefinitionHash: 'b'.repeat(64) }),
  });
  await repository.createMapView({
    mapView: mapView({ MapViewID: 'MAP-3', OrganizationID: 'OTHER' }),
    version: version(1, { MapViewVersionKey: 'MAP-3:1', MapViewID: 'MAP-3', OrganizationID: 'OTHER', DefinitionHash: 'c'.repeat(64) }),
  });

  assert.deepEqual((await repository.listMapViews({ organizationId: 'ORG-KSP', visibility: 'PRIVATE', ownerEmployeeId: 9001 })).data.map(row => row.MapViewID), ['MAP-1']);
  const first = await repository.listMapViews({ organizationId: 'ORG-KSP', limit: 1 });
  assert.equal(first.data.length, 1);
  assert.ok(first.nextToken);
  assert.deepEqual((await repository.listMapViews({ organizationId: 'ORG-KSP', limit: 500, nextToken: first.nextToken })).data.map(row => row.MapViewID), ['MAP-2']);
});

test('rejects duplicate map and version keys through Catalyst unique constraints', async () => {
  const repository = new CatalystIntelligenceRepository({ application: fakeApplication().application });
  await repository.createMapView({ mapView: mapView(), version: version() });
  await assert.rejects(repository.createMapView({ mapView: mapView(), version: version() }), { code: 'UNIQUE_CONFLICT' });
});

test('inserts an immutable version before CAS and advances only the current pointer', async () => {
  const fake = fakeApplication();
  const repository = new CatalystIntelligenceRepository({ application: fake.application });
  await repository.createMapView({ mapView: mapView(), version: version() });

  const updated = await repository.updateMapView({
    mapViewId: 'MAP-1', organizationId: 'ORG-KSP', expectedVersion: 1,
    nextVersion: version(2, { DefinitionHash: 'b'.repeat(64), CreatedAt: '2026-07-22T11:00:00Z' }),
  });
  assert.equal(updated.CurrentVersion, 2);
  assert.equal(fake.tables.get('CFG_MapViewVersion')[0].DefinitionHash, '1'.repeat(64));
  assert.equal(fake.tables.get('CFG_MapViewVersion').length, 2);
});

test('reports stale updates and never advances the pointer when CAS loses', async () => {
  const fake = fakeApplication();
  const repository = new CatalystIntelligenceRepository({ application: fake.application });
  await repository.createMapView({ mapView: mapView(), version: version() });
  await assert.rejects(repository.updateMapView({
    mapViewId: 'MAP-1', organizationId: 'ORG-KSP', expectedVersion: 0, nextVersion: version(2),
  }), { code: 'VERSION_CONFLICT' });
  assert.equal(fake.tables.get('CFG_MapViewVersion').length, 1);

  fake.tables.get('CFG_MapView')[0].CurrentVersion = 2;
  await assert.rejects(repository.updateMapView({
    mapViewId: 'MAP-1', organizationId: 'ORG-KSP', expectedVersion: 1,
    nextVersion: version(2, { DefinitionHash: 'd'.repeat(64), CreatedAt: '2026-07-22T11:00:00Z' }),
  }), { code: 'VERSION_CONFLICT' });
  assert.equal(fake.tables.get('CFG_MapView')[0].CurrentVersion, 2);
  assert.equal(fake.tables.get('CFG_MapViewVersion').length, 2);
});

test('rejects unsafe expected versions before constructing a CAS query', async () => {
  const repository = new CatalystIntelligenceRepository({ application: fakeApplication().application });
  await repository.createMapView({ mapView: mapView(), version: version() });
  await assert.rejects(repository.updateMapView({
    mapViewId: 'MAP-1', organizationId: 'ORG-KSP', expectedVersion: Number.MAX_SAFE_INTEGER + 1,
    nextVersion: version(2),
  }), TypeError);
});

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';

import { CatalystIntelligenceRepository } from '../../src/backend/repository/catalyst/catalyst-repository.mjs';

function fakeApplication({
  failBeforeInsert, failAfterInsert, failBeforeCas = false, failAfterCas = false,
  advanceAfterCas = false, advanceBeforeCasFailure = false, ambiguousCas = false,
} = {}) {
  const tables = new Map();
  let nextRowId = 1000;
  const failed = new Set();
  const injected = key => {
    if (!key || failed.has(key)) return false;
    failed.add(key); return true;
  };
  const selected = (value, name) => Array.isArray(value) ? value.includes(name) : value === name;
  const unavailable = () => { const error = new Error('connection lost'); error.code = 'TIMEOUT'; return error; };
  const table = name => ({
    async getPagedRows() { return { data: structuredClone(tables.get(name) ?? []), more_records: false }; },
    async insertRow(input) {
      if (selected(failBeforeInsert, name) && injected(`before:${name}`)) throw unavailable();
      const rows = tables.get(name) ?? [];
      const id = name === 'CFG_MapView' ? 'MapViewID' : 'MapViewVersionKey';
      if (rows.some(row => row[id] === input[id])) {
        const error = new Error('duplicate'); error.code = 'DUPLICATE'; throw error;
      }
      const stored = { ...structuredClone(input), ROWID: String(++nextRowId), CREATORID: 'sdk' };
      tables.set(name, [...rows, stored]);
      if (selected(failAfterInsert, name) && injected(`after:${name}`)) throw unavailable();
      return structuredClone(stored);
    },
    async deleteRow(rowId) {
      tables.set(name, (tables.get(name) ?? []).filter(row => row.ROWID !== String(rowId)));
      return true;
    },
  });
  const zcql = () => ({
    async executeZCQLQuery(query) {
      if (failBeforeCas && injected('before:cas')) throw unavailable();
      const match = query.match(/^UPDATE CFG_MapView SET Name = '((?:''|[^'])*)', Visibility = '([^']+)', CurrentVersion = (\d+), UpdatedAt = '([^']+)' WHERE ROWID = (\d+) AND CurrentVersion = (\d+)$/u);
      if (!match) throw new Error(`unexpected ZCQL: ${query}`);
      const [, escapedName, visibility, currentVersion, updatedAt, rowId, expectedVersion] = match;
      const rows = tables.get('CFG_MapView') ?? [];
      const row = rows.find(item => item.ROWID === rowId && item.CurrentVersion === Number(expectedVersion));
      if (row) {
        row.Name = escapedName.replaceAll("''", "'"); row.Visibility = visibility;
        row.CurrentVersion = Number(currentVersion); row.UpdatedAt = updatedAt;
      }
      if (failAfterCas && injected('after:cas')) {
        if (row && advanceBeforeCasFailure) row.CurrentVersion += 1;
        throw unavailable();
      }
      if (row && advanceAfterCas) row.CurrentVersion += 1;
      return [ambiguousCas ? {} : { affected_rows: row ? 1 : 0 }];
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
const sha256 = value => createHash('sha256').update(value).digest('hex');
const version = (number = 1, overrides = {}) => {
  const definition = overrides.DefinitionJSON ?? JSON.stringify({ version: number });
  return ({
  MapViewVersionKey: `MAP-1:${number}`, MapViewID: 'MAP-1', OrganizationID: 'ORG-KSP', Version: number,
  DefinitionJSON: definition, DefinitionHash: sha256(definition),
  PublishedAt: null, CreatedByEmployeeID: 9001, CreatedAt: createdAt, SyntheticData: true, ...overrides,
  });
};

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
  assert.equal(storedVersion.DefinitionHash, sha256('{"version":1}'));
  assert.equal(storedVersion.CreatedAt, '2026-07-22 10:00:00');
  assert.equal('ROWID' in storedVersion || 'MapViewRef' in storedVersion, false);
  assert.equal(fake.tables.get('CFG_MapViewVersion')[0].MapViewRef, fake.tables.get('CFG_MapView')[0].ROWID);
});

test('lists map views with exact organization, visibility and owner predicates using bounded paging', async () => {
  const repository = new CatalystIntelligenceRepository({ application: fakeApplication().application });
  await repository.createMapView({ mapView: mapView(), version: version() });
  await repository.createMapView({
    mapView: mapView({ MapViewID: 'MAP-2', Visibility: 'SHARED', OwnerEmployeeID: 9002 }),
    version: version(1, { MapViewVersionKey: 'MAP-2:1', MapViewID: 'MAP-2' }),
  });
  await repository.createMapView({
    mapView: mapView({ MapViewID: 'MAP-3', OrganizationID: 'OTHER' }),
    version: version(1, { MapViewVersionKey: 'MAP-3:1', MapViewID: 'MAP-3', OrganizationID: 'OTHER' }),
  });

  assert.deepEqual((await repository.listMapViews({ organizationId: 'ORG-KSP', visibility: 'PRIVATE', ownerEmployeeId: 9001 })).data.map(row => row.MapViewID), ['MAP-1']);
  const first = await repository.listMapViews({ organizationId: 'ORG-KSP', limit: 1 });
  assert.equal(first.data.length, 1);
  assert.ok(first.nextToken);
  assert.deepEqual((await repository.listMapViews({ organizationId: 'ORG-KSP', limit: 500, nextToken: first.nextToken })).data.map(row => row.MapViewID), ['MAP-2']);
});

test('reconciles duplicate map and version keys as an idempotent create retry', async () => {
  const repository = new CatalystIntelligenceRepository({ application: fakeApplication().application });
  await repository.createMapView({ mapView: mapView(), version: version() });
  assert.equal((await repository.createMapView({ mapView: mapView(), version: version() })).MapViewID, 'MAP-1');
});

test('inserts an immutable version before CAS and advances only the current pointer', async () => {
  const fake = fakeApplication();
  const repository = new CatalystIntelligenceRepository({ application: fake.application });
  await repository.createMapView({ mapView: mapView(), version: version() });

  const updated = await repository.updateMapView({
    mapViewId: 'MAP-1', organizationId: 'ORG-KSP', expectedVersion: 1,
    nextVersion: version(2, { CreatedAt: '2026-07-22T11:00:00Z' }),
  });
  assert.equal(updated.CurrentVersion, 2);
  assert.equal(fake.tables.get('CFG_MapViewVersion')[0].DefinitionHash, sha256('{"version":1}'));
  assert.equal(fake.tables.get('CFG_MapViewVersion').length, 2);
});

test('atomically updates root summaries with escaped name and visibility', async () => {
  const fake = fakeApplication();
  const repository = new CatalystIntelligenceRepository({ application: fake.application });
  await repository.createMapView({ mapView: mapView(), version: version() });
  const definition = JSON.stringify({ name: "Leader's view", version: 2, visibility: 'SHARED' });
  const updated = await repository.updateMapView({
    mapViewId: 'MAP-1', organizationId: 'ORG-KSP', expectedVersion: 1,
    nextVersion: version(2, { DefinitionJSON: definition, CreatedAt: '2026-07-22T11:00:00Z' }),
  });
  assert.equal(updated.Name, "Leader's view");
  assert.equal(updated.Visibility, 'SHARED');
  assert.equal(fake.tables.get('CFG_MapView')[0].Name, "Leader's view");
  assert.equal(fake.tables.get('CFG_MapView')[0].Visibility, 'SHARED');
});

test('affected_rows one is definitive even when a next update commits before observation', async () => {
  const fake = fakeApplication({ advanceAfterCas: true });
  const repository = new CatalystIntelligenceRepository({ application: fake.application });
  await repository.createMapView({ mapView: mapView(), version: version() });
  const updated = await repository.updateMapView({
    mapViewId: 'MAP-1', organizationId: 'ORG-KSP', expectedVersion: 1,
    nextVersion: version(2, { CreatedAt: '2026-07-22T11:00:00Z' }),
  });
  assert.equal(updated.CurrentVersion, 2);
  assert.equal(fake.tables.get('CFG_MapView')[0].CurrentVersion, 3);
});

test('ambiguous CAS responses reconcile through scoped root reads', async () => {
  const fake = fakeApplication({ ambiguousCas: true });
  const repository = new CatalystIntelligenceRepository({ application: fake.application });
  await repository.createMapView({ mapView: mapView(), version: version() });
  const updated = await repository.updateMapView({
    mapViewId: 'MAP-1', organizationId: 'ORG-KSP', expectedVersion: 1,
    nextVersion: version(2, { CreatedAt: '2026-07-22T11:00:00Z' }),
  });
  assert.equal(updated.CurrentVersion, 2);
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
    nextVersion: version(2, { CreatedAt: '2026-07-22T11:00:00Z' }),
  }), { code: 'VERSION_CONFLICT' });
  assert.equal(fake.tables.get('CFG_MapView')[0].CurrentVersion, 2);
  assert.equal(fake.tables.get('CFG_MapViewVersion').length, 2);
});

test('rejects invalid expected versions before constructing a CAS query', async () => {
  const repository = new CatalystIntelligenceRepository({ application: fakeApplication().application });
  await repository.createMapView({ mapView: mapView(), version: version() });
  for (const invalid of [-1, 1.5, '1', Number.MAX_SAFE_INTEGER + 1]) {
    await assert.rejects(repository.updateMapView({
      mapViewId: 'MAP-1', organizationId: 'ORG-KSP', expectedVersion: invalid,
      nextVersion: version(2),
    }), TypeError);
  }
});

test('requires exact positive safe integers for initial and next versions', async () => {
  for (const invalid of [-1, 0, 1.5, '1', Number.MAX_SAFE_INTEGER + 1]) {
    const fake = fakeApplication();
    const repository = new CatalystIntelligenceRepository({ application: fake.application });
    await assert.rejects(repository.createMapView({
      mapView: mapView({ CurrentVersion: invalid }), version: version(1, { Version: invalid }),
    }), TypeError);
    assert.equal(fake.tables.get('CFG_MapView')?.length ?? 0, 0);
  }
  await assert.rejects(new CatalystIntelligenceRepository({ application: fakeApplication().application }).createMapView({
    mapView: mapView({ CurrentVersion: 2 }), version: version(2),
  }), TypeError);

  const repository = new CatalystIntelligenceRepository({ application: fakeApplication().application });
  await repository.createMapView({ mapView: mapView(), version: version() });
  for (const invalid of [-1, 0, 1.5, '2', Number.MAX_SAFE_INTEGER + 1]) {
    await assert.rejects(repository.updateMapView({
      mapViewId: 'MAP-1', organizationId: 'ORG-KSP', expectedVersion: 1,
      nextVersion: version(2, { Version: invalid }),
    }), TypeError);
  }
});

test('reconciles a concurrent duplicate version key as VERSION_CONFLICT without overwriting it', async () => {
  const fake = fakeApplication();
  const repository = new CatalystIntelligenceRepository({ application: fake.application });
  await repository.createMapView({ mapView: mapView(), version: version() });
  await repository.getMapView('MAP-1', 'ORG-KSP');
  const current = fake.tables.get('CFG_MapView')[0];
  current.CurrentVersion = 2;
  current.UpdatedAt = '2026-07-22 10:30:00';
  fake.tables.get('CFG_MapViewVersion').push({
    ...version(2, { DefinitionJSON: '{"version":2,"writer":"other"}', CreatedAt: '2026-07-22 10:30:00' }),
    MapViewRef: current.ROWID, ROWID: '2002', CREATORID: 'other-writer',
  });

  await assert.rejects(repository.updateMapView({
    mapViewId: 'MAP-1', organizationId: 'ORG-KSP', expectedVersion: 1,
    nextVersion: version(2, { CreatedAt: '2026-07-22T11:00:00Z' }),
  }), { code: 'VERSION_CONFLICT' });
  assert.equal(fake.tables.get('CFG_MapViewVersion').length, 2);
  assert.equal(fake.tables.get('CFG_MapViewVersion')[1].DefinitionHash, sha256('{"version":2,"writer":"other"}'));
});

test('retries CAS for an identical orphan version without inserting or mutating it', async () => {
  const fake = fakeApplication();
  const repository = new CatalystIntelligenceRepository({ application: fake.application });
  await repository.createMapView({ mapView: mapView(), version: version() });
  const current = fake.tables.get('CFG_MapView')[0];
  const next = version(2, { CreatedAt: '2026-07-22T11:00:00Z' });
  fake.tables.get('CFG_MapViewVersion').push({
    ...next, CreatedByEmployeeID: '9001', CreatedAt: '2026-07-22 11:00:00',
    MapViewRef: current.ROWID, ROWID: '2002', CREATORID: 'retry',
  });

  const updated = await repository.updateMapView({
    mapViewId: 'MAP-1', organizationId: 'ORG-KSP', expectedVersion: 1, nextVersion: next,
  });
  assert.equal(updated.CurrentVersion, 2);
  assert.equal(fake.tables.get('CFG_MapViewVersion').length, 2);
  assert.equal(fake.tables.get('CFG_MapViewVersion')[1].DefinitionHash, sha256('{"version":2}'));
});

test('reconciles uncertain create inserts and converges from a parent-only retry', async () => {
  for (const failAfterInsert of [
    'CFG_MapView', 'CFG_MapViewVersion', ['CFG_MapView', 'CFG_MapViewVersion'],
  ]) {
    const fake = fakeApplication({ failAfterInsert });
    const repository = new CatalystIntelligenceRepository({ application: fake.application });
    const created = await repository.createMapView({ mapView: mapView(), version: version() });
    assert.equal(created.MapViewID, 'MAP-1');
    assert.equal(fake.tables.get('CFG_MapView').length, 1);
    assert.equal(fake.tables.get('CFG_MapViewVersion').length, 1);
  }

  const parentOnly = fakeApplication({ failBeforeInsert: 'CFG_MapViewVersion' });
  const repository = new CatalystIntelligenceRepository({ application: parentOnly.application });
  await assert.rejects(repository.createMapView({ mapView: mapView(), version: version() }), { code: 'CATALYST_UNAVAILABLE' });
  assert.equal(parentOnly.tables.get('CFG_MapView').length, 1);
  assert.equal(parentOnly.tables.get('CFG_MapViewVersion')?.length ?? 0, 0);
  assert.equal((await repository.createMapView({ mapView: mapView(), version: version() })).MapViewID, 'MAP-1');
  assert.equal(parentOnly.tables.get('CFG_MapView').length, 1);
  assert.equal(parentOnly.tables.get('CFG_MapViewVersion').length, 1);
});

test('never deletes a committed parent or immutable version during create reconciliation', async () => {
  const fake = fakeApplication();
  const repository = new CatalystIntelligenceRepository({ application: fake.application });
  await repository.createMapView({ mapView: mapView(), version: version() });
  await assert.rejects(repository.createMapView({
    mapView: mapView({ Name: 'Different' }), version: version(),
  }), { code: 'UNIQUE_CONFLICT' });
  assert.equal(fake.tables.get('CFG_MapView').length, 1);
  assert.equal(fake.tables.get('CFG_MapViewVersion').length, 1);
  assert.equal(fake.tables.get('CFG_MapView')[0].Name, 'Hotspots');
});

test('reconciles CAS commit-then-throw and allows retry after pre-commit failure', async () => {
  const committed = fakeApplication({ failAfterCas: true });
  const committedRepository = new CatalystIntelligenceRepository({ application: committed.application });
  await committedRepository.createMapView({ mapView: mapView(), version: version() });
  const result = await committedRepository.updateMapView({
    mapViewId: 'MAP-1', organizationId: 'ORG-KSP', expectedVersion: 1,
    nextVersion: version(2, { CreatedAt: '2026-07-22T11:00:00Z' }),
  });
  assert.equal(result.CurrentVersion, 2);

  const retryable = fakeApplication({ failBeforeCas: true });
  const retryableRepository = new CatalystIntelligenceRepository({ application: retryable.application });
  await retryableRepository.createMapView({ mapView: mapView(), version: version() });
  const next = version(2, { CreatedAt: '2026-07-22T11:00:00Z' });
  await assert.rejects(retryableRepository.updateMapView({
    mapViewId: 'MAP-1', organizationId: 'ORG-KSP', expectedVersion: 1, nextVersion: next,
  }), { code: 'CATALYST_UNAVAILABLE' });
  assert.equal(retryable.tables.get('CFG_MapView')[0].CurrentVersion, 1);
  assert.equal(retryable.tables.get('CFG_MapViewVersion').length, 2);
  assert.equal((await retryableRepository.updateMapView({
    mapViewId: 'MAP-1', organizationId: 'ORG-KSP', expectedVersion: 1, nextVersion: next,
  })).CurrentVersion, 2);
});

test('commit-then-throw reconciles exact v2 after a concurrent v3 advance', async () => {
  const fake = fakeApplication({ failAfterCas: true, advanceBeforeCasFailure: true });
  const repository = new CatalystIntelligenceRepository({ application: fake.application });
  await repository.createMapView({ mapView: mapView(), version: version() });
  const result = await repository.updateMapView({
    mapViewId: 'MAP-1', organizationId: 'ORG-KSP', expectedVersion: 1,
    nextVersion: version(2, { CreatedAt: '2026-07-22T11:00:00Z' }),
  });
  assert.equal(result.CurrentVersion, 2);
  assert.equal(fake.tables.get('CFG_MapView')[0].CurrentVersion, 3);
});

test('compares canonical employee IDs without precision loss', async () => {
  const repository = new CatalystIntelligenceRepository({ application: fakeApplication().application });
  await repository.createMapView({
    mapView: mapView({ MapViewID: 'MAP-A', OwnerEmployeeID: '9007199254740992' }),
    version: version(1, { MapViewID: 'MAP-A', MapViewVersionKey: 'MAP-A:1', CreatedByEmployeeID: '9007199254740992' }),
  });
  await repository.createMapView({
    mapView: mapView({ MapViewID: 'MAP-B', OwnerEmployeeID: '9007199254740993' }),
    version: version(1, { MapViewID: 'MAP-B', MapViewVersionKey: 'MAP-B:1', CreatedByEmployeeID: '9007199254740993' }),
  });
  assert.deepEqual((await repository.listMapViews({
    organizationId: 'ORG-KSP', ownerEmployeeId: '9007199254740992',
  })).data.map(row => row.MapViewID), ['MAP-A']);
});

test('requires an object definition and its exact SHA-256 hash', async () => {
  for (const invalid of [
    version(1, { DefinitionJSON: 'not-json', DefinitionHash: sha256('not-json') }),
    version(1, { DefinitionJSON: '[]', DefinitionHash: sha256('[]') }),
    version(1, { DefinitionHash: 'a'.repeat(64) }),
  ]) {
    const repository = new CatalystIntelligenceRepository({ application: fakeApplication().application });
    await assert.rejects(repository.createMapView({ mapView: mapView(), version: invalid }), TypeError);
  }
});

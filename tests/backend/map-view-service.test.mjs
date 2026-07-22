import assert from 'node:assert/strict';
import test from 'node:test';

import { createMapViewService } from '../../src/backend/geospatial/map-view-service.mjs';

const now = '2026-07-22T10:00:00.000Z';
const actions = ['CREATE_MAP_VIEW', 'EDIT_OWN_MAP_VIEW', 'READ_HOTSPOT'];
const access = (overrides = {}) => ({
  organizationId: 'ORG-KSP', employeeId: 9001, actions, syntheticData: true, ...overrides,
});
const definition = (overrides = {}) => ({
  id: 'MAP-1', name: 'Verified hotspots', version: 1, visibility: 'PRIVATE',
  layers: [{ id: 'hotspots-1', datasetId: 'hotspots', renderer: 'POINT' }],
  ...overrides,
});

class MapViewRepository {
  views = [];
  versions = [];

  async listMapViews({ organizationId }) {
    return { data: structuredClone(this.views.filter(row => row.OrganizationID === organizationId)), nextToken: null };
  }

  async getMapView(id, organizationId) {
    return structuredClone(this.views.find(row => row.MapViewID === id && row.OrganizationID === organizationId));
  }

  async getMapViewVersion(id, version, organizationId) {
    return structuredClone(this.versions.find(row => row.MapViewID === id
      && row.Version === version && row.OrganizationID === organizationId));
  }

  async createMapView({ mapView, version }) {
    if (this.views.some(row => row.MapViewID === mapView.MapViewID)) {
      const error = new Error('duplicate'); error.code = 'UNIQUE_CONFLICT'; throw error;
    }
    this.views.push(structuredClone(mapView));
    this.versions.push(structuredClone(version));
    return structuredClone(mapView);
  }

  async updateMapView({ mapViewId, organizationId, expectedVersion, nextVersion }) {
    const view = this.views.find(row => row.MapViewID === mapViewId && row.OrganizationID === organizationId);
    if (!view) return undefined;
    if (view.CurrentVersion !== expectedVersion) {
      const error = new Error('stale'); error.code = 'VERSION_CONFLICT'; throw error;
    }
    this.versions.push(structuredClone(nextVersion));
    view.CurrentVersion += 1;
    view.UpdatedAt = nextVersion.CreatedAt;
    return structuredClone(view);
  }
}

function harness() {
  const repository = new MapViewRepository();
  const service = createMapViewService({ repository, clock: () => now });
  return { repository, service };
}

test('creates a private view with organization and actor derived only from access', async () => {
  const { repository, service } = harness();
  const result = await service.createMapView({
    access: access(), body: { name: 'Verified hotspots', visibility: 'PRIVATE', definition: definition() },
    requestId: 'REQ-1',
  });
  assert.equal(result.data.organizationId, 'ORG-KSP');
  assert.equal(result.data.ownerEmployeeId, 9001);
  assert.equal(result.data.version, 1);
  assert.equal(repository.views[0].OrganizationID, 'ORG-KSP');
  assert.equal(repository.versions[0].CreatedByEmployeeID, 9001);
  assert.deepEqual(JSON.parse(repository.versions[0].DefinitionJSON), result.data.definition);
  assert.match(repository.versions[0].DefinitionHash, /^[a-f0-9]{64}$/u);
});

test('rejects supplied authority, unknown keys, mismatched metadata and invalid names', async () => {
  const { service } = harness();
  const base = { name: 'Verified hotspots', visibility: 'PRIVATE', definition: definition() };
  for (const body of [
    { ...base, organizationId: 'OTHER' },
    { ...base, ownerEmployeeId: 9999 },
    { ...base, unexpected: true },
    { ...base, name: 'x'.repeat(129) },
    { ...base, name: 'Different' },
  ]) await assert.rejects(service.createMapView({ access: access(), body }), { code: 'INVALID_REQUEST' });
  await assert.rejects(service.createMapView({ access: access({ organizationId: undefined }), body: base }), { code: 'FORBIDDEN_ACTION' });
  await assert.rejects(service.createMapView({ access: access({ employeeId: null }), body: base }), { code: 'FORBIDDEN_ACTION' });
});

test('updates through immutable version 2 and rejects stale or malformed expected versions', async () => {
  const { service } = harness();
  await service.createMapView({ access: access(), body: {
    name: 'Verified hotspots', visibility: 'PRIVATE', definition: definition(),
  } });
  const updated = await service.updateMapView({
    access: access(), params: { mapViewId: 'MAP-1' },
    body: {
      expectedVersion: 1, name: 'Updated hotspots', visibility: 'SHARED',
      definition: definition({ name: 'Updated hotspots', version: 2, visibility: 'SHARED' }),
    }, requestId: 'REQ-2',
  });
  assert.equal(updated.data.version, 2);
  assert.equal(updated.data.definition.visibility, 'SHARED');
  await assert.rejects(service.updateMapView({
    access: access(), params: { mapViewId: 'MAP-1' }, body: {
      expectedVersion: 1, name: 'Stale', visibility: 'PRIVATE',
      definition: definition({ name: 'Stale', version: 2 }),
    },
  }), { code: 'VERSION_CONFLICT' });
  for (const expectedVersion of [undefined, 0, 1.5, '1']) {
    await assert.rejects(service.updateMapView({
      access: access(), params: { mapViewId: 'MAP-1' }, body: {
        expectedVersion, name: 'Invalid', visibility: 'PRIVATE', definition: definition({ name: 'Invalid', version: 2 }),
      },
    }), { code: 'INVALID_REQUEST' });
  }
});

test('hides private views, scopes lookups by organization and lists only readable views', async () => {
  const { service } = harness();
  await service.createMapView({ access: access(), body: {
    name: 'Verified hotspots', visibility: 'PRIVATE', definition: definition(),
  } });
  const other = access({ employeeId: 9002 });
  assert.deepEqual((await service.listMapViews({ access: other })).data.items, []);
  await assert.rejects(service.getMapView({ access: other, params: { mapViewId: 'MAP-1' } }), { code: 'NOT_FOUND' });
  await assert.rejects(service.getMapView({
    access: access({ employeeId: 9002, actions: [] }), params: { mapViewId: 'MAP-1' },
  }), { code: 'NOT_FOUND' });
  await assert.rejects(service.getMapView({
    access: access({ organizationId: 'OTHER' }), params: { mapViewId: 'MAP-1' },
  }), { code: 'NOT_FOUND' });
});

test('shared views require every current dataset action and become forbidden after access loss', async () => {
  const { service } = harness();
  await service.createMapView({ access: access(), body: {
    name: 'Shared hotspots', visibility: 'SHARED', definition: definition({ name: 'Shared hotspots', visibility: 'SHARED' }),
  } });
  const viewer = access({ employeeId: 9002, actions: ['READ_HOTSPOT'] });
  assert.equal((await service.getMapView({ access: viewer, params: { mapViewId: 'MAP-1' } })).data.id, 'MAP-1');
  await assert.rejects(service.getMapView({
    access: access({ employeeId: 9002, actions: [] }), params: { mapViewId: 'MAP-1' },
  }), { code: 'FORBIDDEN_ACTION' });
  assert.deepEqual((await service.listMapViews({ access: access({ employeeId: 9002, actions: [] }) })).data.items, []);
});

test('publishing or updating role defaults and organization globals requires map-view management', async () => {
  for (const visibility of ['ROLE_DEFAULT', 'ORGANIZATION_GLOBAL']) {
    const { service } = harness();
    const body = {
      name: 'Published hotspots', visibility,
      definition: definition({ name: 'Published hotspots', visibility }),
    };
    await assert.rejects(service.createMapView({ access: access(), body }), { code: 'FORBIDDEN_ACTION' });
    await service.createMapView({ access: access({ actions: [...actions, 'MANAGE_MAP_VIEWS'] }), body });
    await assert.rejects(service.updateMapView({
      access: access(), params: { mapViewId: 'MAP-1' }, body: {
        expectedVersion: 1, name: 'Demoted', visibility: 'SHARED',
        definition: definition({ name: 'Demoted', version: 2, visibility: 'SHARED' }),
      },
    }), { code: 'FORBIDDEN_ACTION' });
  }
});

test('only owners with edit-own or administrators can update private and shared views', async () => {
  const { service } = harness();
  await service.createMapView({ access: access(), body: {
    name: 'Shared hotspots', visibility: 'SHARED', definition: definition({ name: 'Shared hotspots', visibility: 'SHARED' }),
  } });
  const update = {
    expectedVersion: 1, name: 'Managed hotspots', visibility: 'SHARED',
    definition: definition({ name: 'Managed hotspots', version: 2, visibility: 'SHARED' }),
  };
  await assert.rejects(service.updateMapView({
    access: access({ actions: ['READ_HOTSPOT'] }), params: { mapViewId: 'MAP-1' }, body: update,
  }), { code: 'FORBIDDEN_ACTION' });
  await assert.rejects(service.updateMapView({
    access: access({ employeeId: 9002 }), params: { mapViewId: 'MAP-1' }, body: update,
  }), { code: 'FORBIDDEN_ACTION' });
  assert.equal((await service.updateMapView({
    access: access({ employeeId: 9002, actions: ['READ_HOTSPOT', 'MANAGE_MAP_VIEWS'] }),
    params: { mapViewId: 'MAP-1' }, body: update,
  })).data.version, 2);
});

test('private PATCH is indistinguishable from missing for non-managers while managers may update', async () => {
  const { repository, service } = harness();
  await service.createMapView({ access: access(), body: {
    name: 'Verified hotspots', visibility: 'PRIVATE', definition: definition(),
  } });
  const body = {
    expectedVersion: 1, name: 'Managed hotspots', visibility: 'PRIVATE',
    definition: definition({ name: 'Managed hotspots', version: 2 }),
  };
  const nonOwner = access({ employeeId: 9002 });
  const errors = [];
  for (const mapViewId of ['MAP-1', 'MAP-MISSING']) {
    try { await service.updateMapView({ access: nonOwner, params: { mapViewId }, body }); }
    catch (error) { errors.push({ code: error.code, message: error.message }); }
  }
  assert.deepEqual(errors, [
    { code: 'NOT_FOUND', message: 'NOT_FOUND' }, { code: 'NOT_FOUND', message: 'NOT_FOUND' },
  ]);
  const readVersion = repository.getMapViewVersion;
  repository.getMapViewVersion = async () => { throw new Error('private version must remain unread'); };
  await assert.rejects(service.updateMapView({
    access: nonOwner, params: { mapViewId: 'MAP-1' }, body,
  }), { code: 'NOT_FOUND' });
  repository.getMapViewVersion = readVersion;
  const managed = await service.updateMapView({
    access: access({ employeeId: 9002, actions: ['READ_HOTSPOT', 'MANAGE_MAP_VIEWS'] }),
    params: { mapViewId: 'MAP-1' }, body,
  });
  assert.equal(managed.data.version, 2);
});

test('duplicate creates return a stable public conflict', async () => {
  const { service } = harness();
  const body = { name: 'Verified hotspots', visibility: 'PRIVATE', definition: definition() };
  await service.createMapView({ access: access(), body });
  await assert.rejects(service.createMapView({ access: access(), body }), { code: 'INVALID_STATE' });
});

test('stored definition contract corruption returns DATA_NOT_READY', async () => {
  const { repository, service } = harness();
  await service.createMapView({ access: access(), body: {
    name: 'Verified hotspots', visibility: 'PRIVATE', definition: definition(),
  } });
  const corrupt = '{"id":"MAP-1","name":"Verified hotspots","version":1,"visibility":"PRIVATE"}';
  repository.versions[0].DefinitionJSON = corrupt;
  repository.versions[0].DefinitionHash = (await import('node:crypto')).createHash('sha256').update(corrupt).digest('hex');
  await assert.rejects(service.getMapView({ access: access(), params: { mapViewId: 'MAP-1' } }), { code: 'DATA_NOT_READY' });
});

test('canonical normalized definitions produce deterministic exact-byte hashes', async () => {
  const first = harness();
  const second = harness();
  const a = definition({ viewport: { zoom: 8, center: [77.5, 12.9] } });
  const b = { layers: a.layers, visibility: a.visibility, version: a.version, name: a.name,
    id: a.id, viewport: { center: [77.5, 12.9], zoom: 8 } };
  await first.service.createMapView({ access: access(), body: { name: a.name, visibility: a.visibility, definition: a } });
  await second.service.createMapView({ access: access(), body: { name: b.name, visibility: b.visibility, definition: b } });
  assert.equal(first.repository.versions[0].DefinitionJSON, second.repository.versions[0].DefinitionJSON);
  assert.equal(first.repository.versions[0].DefinitionHash, second.repository.versions[0].DefinitionHash);
});

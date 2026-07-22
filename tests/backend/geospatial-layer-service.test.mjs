import assert from 'node:assert/strict';
import test from 'node:test';

import { DATASET_CATALOG } from '../../src/backend/geospatial/dataset-catalog.mjs';
import { createGeospatialLayerService } from '../../src/backend/geospatial/layer-service.mjs';

const allowed = Object.freeze({ actions: ['READ_HOTSPOT'], scopeUnitId: 101, syntheticData: true });
const denied = Object.freeze({ actions: [], scopeUnitId: 101, syntheticData: true });
const hotspotRequest = Object.freeze({
  layer: { id: 'layer-1', datasetId: 'hotspots', renderer: 'POINT', tooltipFields: ['id', 'magnitude'] },
  runtime: { limit: 2, viewport: { bounds: [77, 12, 78, 14] } },
});
const currentRunGroup = Object.freeze({
  RunGroupID: 'RUN-1', PublishedAt: '2026-07-20T13:55:00.000Z',
  runs: [{
    AnalysisType: 'HOTSPOT', EngineVersion: 'engine-1',
    ObservationStart: '2026-06-01T00:00:00.000Z', ObservationEnd: '2026-06-30T23:59:59.000Z',
  }],
});
const repository = Object.freeze({
  async getCurrentRunGroup() { return structuredClone(currentRunGroup); },
  async getRefreshStatus() { return { currentRunGroup: structuredClone(currentRunGroup), latestAttempt: null }; },
});

function envelope(items) {
  return {
    data: { items },
    meta: {
      requestId: 'READ-1', analysisRunId: 'RUN-1', generatedAt: '2026-07-20T14:00:00.000Z',
      observationPeriod: { from: '2026-06-01T00:00:00.000Z', to: '2026-06-30T23:59:59.000Z' },
      methodVersion: 'engine-1', dataQualityStatus: 'ACCEPTED', syntheticData: true,
    },
  };
}

function harness(items = [{
  id: 'HOT-1', centroid: { latitude: 12.9718, longitude: 77.5949 }, magnitude: 6,
  confidence: 0.9, method: 'HAVERSINE_DBSCAN', version: '1.0.0', limitations: ['SYNTHETIC_DATA'],
  evidenceCaseIds: ['CASE-1'], evidenceUnits: { 'CASE-1': 101 }, internal: 'secret', futureField: 'future-secret',
}]) {
  const calls = [];
  const service = createGeospatialLayerService({
    repository,
    readServices: { async listHotspots(input) { calls.push(input); return envelope(items); } },
    clock: () => new Date('2026-07-20T15:00:00.000Z'), idFactory: () => { throw new Error('must not allocate request IDs'); },
  });
  return { service, calls };
}

test('catalog is immutable, authorized, truthful, and strips server-only fields', async () => {
  assert.ok(Object.isFrozen(DATASET_CATALOG));
  assert.ok(DATASET_CATALOG.every(Object.isFrozen));
  const { service } = harness();
  const response = await service.listDatasets({ access: allowed, requestId: 'REQ-GEO-1' });
  assert.equal(response.meta.requestId, 'REQ-GEO-1');
  assert.deepEqual(response.data.items.map(item => item.id), ['hotspots']);
  const [dataset] = response.data.items;
  assert.deepEqual(dataset.access, { actions: ['READ_HOTSPOT'] });
  assert.equal(dataset.spatialStatus, 'AVAILABLE');
  for (const hidden of ['sourceReference', 'service', 'requiredAction', 'internalService', 'evidenceCaseIds']) {
    assert.equal(hidden in dataset, false);
  }
  assert.deepEqual((await service.listDatasets({ access: denied, requestId: 'REQ-GEO-2' })).data.items, []);
});

test('catalog reports unavailable geometry without inventing mappings', async () => {
  const access = { ...allowed, actions: ['READ_ANOMALY', 'READ_AREA_RISK', 'READ_ALERT'] };
  const items = (await harness().service.listDatasets({ access, requestId: 'REQ-GEO-1' })).data.items;
  assert.deepEqual(items.map(item => item.id), ['anomalies', 'areaRisk', 'alerts']);
  for (const item of items) {
    assert.equal(item.spatialStatus, 'GEOMETRY_NOT_AVAILABLE');
    assert.ok(item.missingRequiredFields.length > 0);
    assert.equal('geometry' in item, false);
  }
});

test('execution enforces action and emits governed GeoJSON metadata', async () => {
  const { service, calls } = harness();
  await assert.rejects(service.executeLayer({ access: denied, body: hotspotRequest }), { code: 'FORBIDDEN_ACTION' });
  const response = await service.executeLayer({ access: allowed, body: hotspotRequest, requestId: 'REQ-GEO-1' });
  assert.equal(response.data.type, 'FeatureCollection');
  assert.deepEqual(response.data.features[0].geometry.coordinates, [77.5949, 12.9718]);
  assert.deepEqual(response.data.features[0].properties, { id: 'HOT-1', magnitude: 6, evidenceCaseIds: ['CASE-1'] });
  for (const hidden of ['centroid', 'evidenceUnits', 'internal', 'futureField']) {
    assert.equal(hidden in response.data.features[0].properties, false);
  }
  assert.equal(response.meta.runGroupId, 'RUN-1');
  assert.equal(response.meta.publishedAt, '2026-07-20T13:55:00.000Z');
  assert.equal(response.meta.observationStart, '2026-06-01T00:00:00.000Z');
  assert.equal(response.meta.observationEnd, '2026-06-30T23:59:59.000Z');
  assert.equal(response.meta.freshnessState, 'CURRENT');
  assert.equal(response.meta.requestId, 'REQ-GEO-1');
  assert.equal(response.meta.sourceRequestId, 'READ-1');
  assert.equal(response.meta.analysisRunId, 'RUN-1');
  assert.equal(response.meta.generatedAt, '2026-07-20T14:00:00.000Z');
  assert.deepEqual(response.meta.observationPeriod, envelope([]).meta.observationPeriod);
  assert.deepEqual(response.meta.observationWindow, envelope([]).meta.observationPeriod);
  assert.equal(response.meta.engineVersion, 'engine-1');
  assert.equal(response.meta.methodVersion, 'engine-1');
  assert.equal(response.meta.recordMethodVersion, '1.0.0');
  assert.equal(response.meta.dataQualityStatus, 'ACCEPTED');
  assert.equal(response.meta.syntheticData, true);
  assert.equal(response.meta.sourceRecordCount, 1);
  assert.equal(response.meta.outputFeatureCount, 1);
  assert.equal(response.meta.omittedFeatureCount, 0);
  assert.deepEqual(response.meta.limitations, ['SYNTHETIC_DATA']);
  assert.deepEqual(calls[0].query, { limit: 200, unitId: 101, bounds: '77,12,78,14' });
});

test('default execution emits the catalog display evidence projection without undeclared source fields', async () => {
  const { service } = harness();
  const response = await service.executeLayer({
    access: allowed,
    requestId: 'REQ-GEO-DISPLAY',
    body: { layer: { id: 'layer-default', datasetId: 'hotspots', renderer: 'POINT' }, runtime: {} },
  });
  assert.deepEqual(response.data.features[0].properties, {
    id: 'HOT-1', confidence: 0.9, magnitude: 6,
    method: 'HAVERSINE_DBSCAN', version: '1.0.0', evidenceCaseIds: ['CASE-1'],
  });
  for (const hidden of ['centroid', 'evidenceUnits', 'internal', 'futureField']) {
    assert.equal(hidden in response.data.features[0].properties, false);
  }
});

test('freshness returns only authorized dataset run metadata without feature or private evidence payloads', async () => {
  const { service } = harness();
  const response = await service.getFreshness({ access: allowed, requestId: 'REQ-FRESH-1' });
  assert.deepEqual(response.data.layers.map(item => item.datasetId), ['hotspots']);
  assert.deepEqual(response.data.layers[0], {
    datasetId: 'hotspots', version: 'engine-1', runGroupId: 'RUN-1',
    publishedAt: '2026-07-20T13:55:00.000Z',
    observationStart: '2026-06-01T00:00:00.000Z', observationEnd: '2026-06-30T23:59:59.000Z',
    state: 'CURRENT',
  });
  assert.deepEqual((await service.getFreshness({ access: denied, requestId: 'REQ-FRESH-2' })).data.layers, []);
  assert.doesNotMatch(JSON.stringify(response), /CASE-1|centroid|features|evidence/iu);
});

test('output limit applies after local viewport filtering', async () => {
  const rows = [
    { id: 'OUTSIDE', centroid: { latitude: 20, longitude: 80 } },
    { id: 'INSIDE', centroid: { latitude: 12.9718, longitude: 77.5949 } },
  ];
  const body = { ...hotspotRequest, runtime: { ...hotspotRequest.runtime, limit: 1 } };
  const { service, calls } = harness(rows);
  const response = await service.executeLayer({ access: allowed, body, requestId: 'REQ-GEO-1' });
  assert.deepEqual(response.data.features.map(feature => feature.id), ['INSIDE']);
  assert.equal(calls[0].query.limit, 200);
});

test('execution follows opaque pagination until the requested output is filled', async () => {
  const calls = [];
  const pages = new Map([
    [undefined, { items: [{ id: 'OUTSIDE', centroid: { latitude: 20, longitude: 80 } }], nextToken: 'PAGE-2' }],
    ['PAGE-2', { items: [{ id: 'INSIDE', centroid: { latitude: 12.9718, longitude: 77.5949 } }] }],
  ]);
  const service = createGeospatialLayerService({
    repository,
    readServices: { async listHotspots({ query }) {
      calls.push(query);
      const response = { ...envelope([]), data: pages.get(query.nextToken) };
      response.meta.requestId = `READ-${calls.length}`;
      response.meta.generatedAt = `2026-07-20T14:00:0${calls.length}.000Z`;
      return response;
    } },
    clock: () => new Date('2026-07-20T15:00:00.000Z'), idFactory: () => { throw new Error('must not allocate request IDs'); },
  });
  const response = await service.executeLayer({
    access: allowed, requestId: 'REQ-GEO-1',
    body: { ...hotspotRequest, runtime: { ...hotspotRequest.runtime, limit: 1 } },
  });
  assert.deepEqual(response.data.features.map(feature => feature.id), ['INSIDE']);
  assert.deepEqual(calls.map(query => query.nextToken), [undefined, 'PAGE-2']);
  assert.ok(calls.every(query => query.limit === 200));
});

test('execution rejects pages from different analytical snapshots', async () => {
  let page = 0;
  const service = createGeospatialLayerService({
    repository,
    readServices: { async listHotspots() {
      page += 1;
      const response = envelope(page === 1
        ? [{ id: 'OUTSIDE', centroid: { latitude: 20, longitude: 80 } }]
        : [{ id: 'INSIDE', centroid: { latitude: 12.9718, longitude: 77.5949 } }]);
      response.meta.analysisRunId = page === 1 ? 'RUN-OLD' : 'RUN-NEW';
      response.data.nextToken = page === 1 ? 'PAGE-2' : undefined;
      return response;
    } },
    clock: () => new Date('2026-07-20T15:00:00.000Z'),
  });
  await assert.rejects(service.executeLayer({
    access: allowed, requestId: 'REQ-GEO-1',
    body: { ...hotspotRequest, runtime: { ...hotspotRequest.runtime, limit: 1 } },
  }), { code: 'DATA_NOT_READY' });
});

test('execution reports incomplete results when the 5000-row scan cap is reached', async () => {
  const calls = [];
  const outside = Array.from({ length: 200 }, (_, index) => ({
    id: `OUTSIDE-${index}`, centroid: { latitude: 20, longitude: 80 },
  }));
  const service = createGeospatialLayerService({
    repository,
    readServices: { async listHotspots({ query }) {
      calls.push(query); return { ...envelope([]), data: { items: outside, nextToken: `PAGE-${calls.length + 1}` } };
    } },
    clock: () => new Date('2026-07-20T15:00:00.000Z'), idFactory: () => { throw new Error('must not allocate request IDs'); },
  });
  const response = await service.executeLayer({
    access: allowed, body: hotspotRequest, requestId: 'REQ-GEO-1',
  });
  assert.equal(calls.length, 25);
  assert.equal(response.meta.sourceRecordCount, 5000);
  assert.equal(response.meta.resultComplete, false);
  assert.equal(response.meta.scanTruncated, true);
  assert.ok(response.meta.limitations.includes('GEOSPATIAL_SCAN_LIMIT_REACHED'));
});

test('execution fails safely when a source pagination token loops', async () => {
  const service = createGeospatialLayerService({
    repository,
    readServices: { async listHotspots() { return { ...envelope([]), data: { items: [], nextToken: 'LOOP' } }; } },
    clock: () => new Date('2026-07-20T15:00:00.000Z'), idFactory: () => { throw new Error('must not allocate request IDs'); },
  });
  await assert.rejects(service.executeLayer({
    access: allowed, body: hotspotRequest, requestId: 'REQ-GEO-1',
  }), { code: 'DATA_NOT_READY' });
});

test('invalid coordinates are omitted, counted, and never defaulted', async () => {
  const valid = { id: 'HOT-1', centroid: { latitude: 12.9718, longitude: 77.5949 } };
  const invalid = { id: 'HOT-2', centroid: { latitude: Number.NaN, longitude: undefined } };
  const response = await harness([invalid, valid]).service.executeLayer({ access: allowed, body: hotspotRequest });
  assert.equal(response.data.features.length, 1);
  assert.deepEqual(response.data.features[0].geometry.coordinates, [77.5949, 12.9718]);
  assert.equal(response.meta.omittedFeatureCount, 1);
  assert.doesNotMatch(JSON.stringify(response.data), /\[0,0\]/u);
});

test('authorized evidence lineage is bounded per feature and reports truncation', async () => {
  const evidenceCaseIds = Array.from({ length: 201 }, (_, index) => `CASE-${index + 1}`);
  const row = {
    id: 'HOT-EVIDENCE', centroid: { latitude: 12.9718, longitude: 77.5949 },
    evidenceCaseIds, evidenceUnits: Object.fromEntries(evidenceCaseIds.map(id => [id, 101])),
  };
  const response = await harness([row]).service.executeLayer({ access: allowed, body: hotspotRequest });
  assert.equal(response.data.features[0].properties.evidenceCaseIds.length, 200);
  assert.ok(response.meta.limitations.includes('EVIDENCE_CASE_IDS_TRUNCATED'));
});

test('output remains bounded when a source ignores its requested limit', async () => {
  const rows = [1, 2, 3].map(index => ({
    id: `HOT-${index}`, centroid: { latitude: 12.9 + index / 100, longitude: 77.5 },
  }));
  const response = await harness(rows).service.executeLayer({ access: allowed, body: hotspotRequest });
  assert.equal(response.data.features.length, 2);
  assert.equal(response.meta.sourceRecordCount, 2);
});

test('semantic source limits are capped after compilation for layer and default limits', async () => {
  const runtimeLimited = harness();
  await runtimeLimited.service.executeLayer({
    access: allowed, body: { ...hotspotRequest, runtime: { limit: 5000 } },
  });
  assert.equal(runtimeLimited.calls[0].query.limit, 200);

  const layerLimited = harness();
  await layerLimited.service.executeLayer({
    access: allowed,
    body: { layer: { ...hotspotRequest.layer, limit: 5000 }, runtime: { viewport: hotspotRequest.runtime.viewport } },
  });
  assert.equal(layerLimited.calls[0].query.limit, 200);

  const defaultLimited = harness();
  await defaultLimited.service.executeLayer({
    access: allowed,
    body: { layer: { id: 'layer-default', datasetId: 'hotspots', renderer: 'POINT' }, runtime: {} },
  });
  assert.equal(defaultLimited.calls[0].query.limit, 200);
});

test('execution rejects authority filters and malformed bodies and unavailable geometry', async () => {
  const { service } = harness();
  await assert.rejects(service.executeLayer({ access: allowed, body: {
    ...hotspotRequest, layer: { ...hotspotRequest.layer, filter: { organizationId: 'other' } },
  } }), { code: 'INVALID_REQUEST' });
  await assert.rejects(service.executeLayer({ access: allowed, body: { ...hotspotRequest, role: 'ADMIN' } }), { code: 'INVALID_REQUEST' });
  await assert.rejects(service.executeLayer({
    access: { ...allowed, actions: ['READ_ANOMALY'] },
    body: { layer: { id: 'layer-2', datasetId: 'anomalies', renderer: 'POINT' }, runtime: {} },
  }), { code: 'DATA_NOT_READY' });
});

test('all unavailable coordinates return DATA_NOT_READY', async () => {
  const { service } = harness([{ id: 'HOT-1', centroid: { latitude: null, longitude: null } }]);
  await assert.rejects(service.executeLayer({ access: allowed, body: hotspotRequest }), { code: 'DATA_NOT_READY' });
});

test('source dispatch never resolves inherited services', async () => {
  let called = false;
  const readServices = Object.create({ async listHotspots() { called = true; return envelope([]); } });
  const service = createGeospatialLayerService({
    repository,
    readServices, clock: () => new Date('2026-07-20T15:00:00.000Z'), idFactory: () => 'REQ-GEO-1',
  });
  await assert.rejects(service.executeLayer({ access: allowed, body: hotspotRequest }));
  assert.equal(called, false);
});

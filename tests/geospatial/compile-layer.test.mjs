import assert from 'node:assert/strict';
import test from 'node:test';

import { MAX_FEATURES, compileLayerExecution } from '@ksp/geospatial-core';

const dataset = {
  id: 'hotspots', name: 'Crime hotspots', sourceType: 'SEMANTIC_API',
  sourceReference: 'listHotspots', geometryType: 'POINT',
  fields: {
    longitude: { type: 'number', uses: ['geometry'] },
    latitude: { type: 'number', uses: ['geometry'] },
    caseCount: { type: 'number', uses: ['weight', 'display'] },
    severity: { type: 'number', uses: ['color', 'display', 'filter'] },
  },
  geometry: { longitudeField: 'longitude', latitudeField: 'latitude' },
  sensitivity: 'RESTRICTED', requiredAction: 'READ_HOTSPOT',
};

const layer = {
  id: 'layer-1', datasetId: 'hotspots', renderer: 'HEATMAP',
  weightField: 'caseCount', filter: { severity: { $gte: 2 } },
};

test('compiles deterministic, deeply frozen execution input with required fields', () => {
  const input = {
    dataset,
    layer,
    runtime: {
      viewport: { bounds: [77, 12, 78, 13] },
      timeWindow: { from: '2026-07-01T00:00:00.000Z', to: '2026-07-22T00:00:00.000Z' },
      limit: 9000,
    },
  };
  const first = compileLayerExecution(input);
  const second = compileLayerExecution(structuredClone(input));

  assert.deepEqual(first, second);
  assert.deepEqual(first, {
    datasetId: 'hotspots',
    sourceReference: 'listHotspots',
    renderer: 'HEATMAP',
    fields: ['caseCount', 'latitude', 'longitude', 'severity'],
    filter: { severity: { $gte: 2 } },
    viewport: { bounds: [77, 12, 78, 13] },
    timeWindow: { from: '2026-07-01T00:00:00.000Z', to: '2026-07-22T00:00:00.000Z' },
    limit: MAX_FEATURES,
  });
  assert.ok(Object.isFrozen(first));
  assert.ok(Object.isFrozen(first.fields));
  assert.ok(Object.isFrozen(first.viewport.bounds));
});

test('uses the bounded default limit and rejects excessive layer limits', () => {
  assert.equal(compileLayerExecution({ dataset, layer, runtime: {} }).limit, 1000);
  assert.throws(() => compileLayerExecution({
    dataset,
    layer: { ...layer, limit: MAX_FEATURES + 1 },
    runtime: {},
  }), /limit/);
});

test('rejects non-finite or invalid coordinates and reversed time windows', () => {
  for (const bounds of [
    [77, 12, Number.NaN, 13],
    [-181, 12, 78, 13],
    [78, 12, 77, 13],
    [77, 14, 78, 13],
  ]) {
    assert.throws(() => compileLayerExecution({ dataset, layer, runtime: { viewport: { bounds } } }), /viewport|bounds/);
  }
  assert.throws(() => compileLayerExecution({
    dataset, layer,
    runtime: { timeWindow: { from: '2026-07-22T00:00:00Z', to: '2026-07-01T00:00:00Z' } },
  }), /timeWindow/);
});

test('rejects client attempts to inject authorization scope', () => {
  assert.throws(() => compileLayerExecution({
    dataset, layer,
    runtime: { viewport: { bounds: [77, 12, 78, 13] }, authorizedUnitIds: ['UNIT-2'] },
  }), /authorizedUnitIds/);
  assert.throws(() => compileLayerExecution({
    dataset,
    layer: { ...layer, filter: { severity: { $eq: { permissions: ['ADMIN'] } } } },
    runtime: {},
  }), /permissions/);
});

test('bounds filter depth, arrays, and strings', () => {
  assert.throws(() => compileLayerExecution({
    dataset,
    layer: { ...layer, filter: { severity: { $in: Array.from({ length: 101 }, (_, index) => index) } } },
    runtime: {},
  }), /array/);
  assert.throws(() => compileLayerExecution({
    dataset,
    layer: { ...layer, filter: { severity: 'x'.repeat(257) } },
    runtime: {},
  }), /string/);
  assert.throws(() => compileLayerExecution({
    dataset,
    layer: { ...layer, filter: { $not: { $not: { $not: { $not: { $not: { severity: 2 } } } } } } },
    runtime: {},
  }), /depth/);
});

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
    category: { type: 'string', uses: ['filter'] },
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
  const second = compileLayerExecution({
    runtime: {
      limit: 9000,
      timeWindow: { to: '2026-07-22T00:00:00.000Z', from: '2026-07-01T00:00:00.000Z' },
      viewport: { bounds: [77, 12, 78, 13] },
    },
    layer: {
      filter: { severity: { $gte: 2 } },
      weightField: 'caseCount', renderer: 'HEATMAP', datasetId: 'hotspots', id: 'layer-1',
    },
    dataset: {
      ...dataset,
      fields: Object.fromEntries(Object.entries(dataset.fields).reverse()),
      geometry: { latitudeField: 'latitude', longitudeField: 'longitude' },
    },
  });

  assert.deepEqual(first, second);
  assert.equal(JSON.stringify(first), JSON.stringify(second));
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

test('default projection includes declared display evidence and excludes filter-only fields', () => {
  const plan = compileLayerExecution({
    dataset,
    layer: { id: 'layer-default', datasetId: 'hotspots', renderer: 'POINT' },
    runtime: {},
  });
  assert.deepEqual(plan.fields, ['caseCount', 'latitude', 'longitude', 'severity']);
  assert.equal(plan.fields.includes('category'), false);
});

test('default display evidence projection is deterministically bounded', () => {
  const displayFields = Object.fromEntries(Array.from({ length: 101 }, (_, index) => [
    `display${String(index).padStart(3, '0')}`, { type: 'string', uses: ['display'] },
  ]));
  const plan = compileLayerExecution({
    dataset: {
      ...dataset, fields: { ...dataset.fields, ...displayFields },
      weightField: 'caseCount', severityField: 'severity',
    },
    layer: { id: 'layer-bounded', datasetId: 'hotspots', renderer: 'POINT' },
    runtime: {},
  });
  assert.equal(plan.fields.filter(field => (
    field === 'caseCount' || field === 'severity' || field.startsWith('display')
  )).length, 100);
  assert.equal(plan.fields.includes('caseCount'), true);
  assert.equal(plan.fields.includes('severity'), true);
  assert.equal(plan.fields.includes('display100'), false);
});

test('label, weight, and color-only fields require renderer mappings and never join the default display projection', () => {
  const mixedDataset = {
    id: 'mixed', name: 'Mixed field permissions', sourceType: 'SEMANTIC_API', sourceReference: 'mixedSource',
    geometryType: 'POINT', sensitivity: 'RESTRICTED', requiredAction: 'READ_MIXED',
    fields: {
      longitude: { type: 'number', uses: ['geometry'] },
      latitude: { type: 'number', uses: ['geometry'] },
      labelOnly: { type: 'string', uses: ['label'] },
      weightOnly: { type: 'number', uses: ['weight'] },
      colorOnly: { type: 'number', uses: ['color'] },
      displayEvidence: { type: 'string', uses: ['display'] },
    },
    geometry: { longitudeField: 'longitude', latitudeField: 'latitude' },
    labelFields: ['labelOnly'], weightField: 'weightOnly', severityField: 'colorOnly',
  };
  const defaultPlan = compileLayerExecution({
    dataset: mixedDataset,
    layer: { id: 'mixed-default', datasetId: 'mixed', renderer: 'POINT' },
    runtime: {},
  });
  assert.deepEqual(defaultPlan.fields, ['displayEvidence', 'latitude', 'longitude']);

  const renderedPlan = compileLayerExecution({
    dataset: mixedDataset,
    layer: {
      id: 'mixed-rendered', datasetId: 'mixed', renderer: 'POINT',
      labelField: 'labelOnly', weightField: 'weightOnly', colorField: 'colorOnly',
    },
    runtime: {},
  });
  assert.deepEqual(renderedPlan.fields, [
    'colorOnly', 'displayEvidence', 'labelOnly', 'latitude', 'longitude', 'weightOnly',
  ]);
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
  assert.throws(() => compileLayerExecution({
    dataset, layer,
    runtime: { timeWindow: { from: '2026-02-30T00:00:00Z', to: '2026-03-02T00:00:00Z' } },
  }), /timeWindow\.from/);
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
    layer: { ...layer, filter: { category: 'x'.repeat(257) } },
    runtime: {},
  }), /string/);
  assert.throws(() => compileLayerExecution({
    dataset,
    layer: { ...layer, filter: { $not: { $not: { $not: { $not: { $not: { severity: 2 } } } } } } },
    runtime: {},
  }), /depth/);
});

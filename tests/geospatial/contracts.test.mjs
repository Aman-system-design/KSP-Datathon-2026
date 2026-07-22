import assert from 'node:assert/strict';
import test from 'node:test';

import {
  MAX_FEATURES,
  RENDERERS,
  SOURCE_TYPES,
  VISIBILITIES,
  normalizeDatasetDefinition,
  normalizeLayerDefinition,
  normalizeMapViewDefinition,
} from '@ksp/geospatial-core';

const dataset = {
  id: 'hotspots',
  name: 'Crime hotspots',
  sourceType: 'SEMANTIC_API',
  sourceReference: 'listHotspots',
  geometryType: 'POINT',
  fields: {
    longitude: { type: 'number', uses: ['geometry'] },
    latitude: { type: 'number', uses: ['geometry'] },
    caseCount: { type: 'number', uses: ['weight', 'display', 'filter'] },
    severity: { type: 'number', uses: ['color', 'display', 'filter'] },
  },
  geometry: { longitudeField: 'longitude', latitudeField: 'latitude' },
  sensitivity: 'RESTRICTED',
  requiredAction: 'READ_HOTSPOT',
};

const catalog = new Map([['hotspots', dataset]]);

test('exports the governed allowlists and workload limit', () => {
  assert.deepEqual(RENDERERS, ['POINT', 'CLUSTER', 'HEATMAP', 'H3', 'CHOROPLETH', 'PATH', 'ARC']);
  assert.deepEqual(SOURCE_TYPES, ['SEMANTIC_API', 'DATASTORE_VIEW', 'CSV', 'GEOJSON', 'PMTILES']);
  assert.deepEqual(VISIBILITIES, ['PRIVATE', 'SHARED', 'ROLE_DEFAULT', 'ORGANIZATION_GLOBAL']);
  assert.equal(MAX_FEATURES, 5000);
});

test('normalizes a semantic point dataset into a deeply frozen copy', () => {
  const normalized = normalizeDatasetDefinition(dataset);
  assert.notEqual(normalized, dataset);
  assert.equal(normalized.geometryType, 'POINT');
  assert.ok(Object.isFrozen(normalized));
  assert.ok(Object.isFrozen(normalized.fields));
  assert.ok(Object.isFrozen(normalized.fields.longitude.uses));
  dataset.fields.longitude.uses.push('display');
  assert.deepEqual(normalized.fields.longitude.uses, ['geometry']);
  dataset.fields.longitude.uses.pop();
});

test('rejects non-plain inputs, unknown keys, invalid IDs, and unsafe source references', () => {
  assert.throws(() => normalizeDatasetDefinition([]), /plain object/);
  assert.throws(() => normalizeDatasetDefinition({ ...dataset, extra: true }), /extra/);
  assert.throws(() => normalizeDatasetDefinition({ ...dataset, id: '-bad' }), /id/);
  assert.throws(() => normalizeDatasetDefinition({ ...dataset, sourceReference: 'https://private.invalid/data' }), /sourceReference/);
  assert.throws(() => normalizeDatasetDefinition({ ...dataset, sourceReference: '../secret' }), /sourceReference/);
  assert.throws(() => normalizeDatasetDefinition({ ...dataset, sourceReference: 'user:password@host' }), /sourceReference/);
  assert.throws(() => normalizeDatasetDefinition({ ...dataset, sourceReference: 'password:secret' }), /sourceReference/);
  assert.throws(() => normalizeDatasetDefinition({
    ...dataset,
    fields: { ...dataset.fields, severity: { ...dataset.fields.severity, secret: true } },
  }), /secret/);
  assert.throws(() => normalizeDatasetDefinition({
    ...dataset,
    fields: { ...dataset.fields, constructor: { type: 'string', uses: ['display'] } },
  }), /constructor/);
});

test('requires dataset mappings to reference declared fields with an allowed use', () => {
  assert.throws(() => normalizeDatasetDefinition({
    ...dataset,
    geometry: { ...dataset.geometry, longitudeField: 'otherLongitude' },
  }), /otherLongitude/);
  assert.throws(() => normalizeDatasetDefinition({
    ...dataset,
    geometry: { ...dataset.geometry, longitudeField: 'caseCount' },
  }), /geometry/);
  assert.throws(() => normalizeDatasetDefinition({
    ...dataset,
    fields: { ...dataset.fields, longitude: { type: 'string', uses: ['geometry'] } },
  }), /longitudeField.*number/);
  assert.throws(() => normalizeDatasetDefinition({
    ...dataset,
    geometryType: 'H3',
    geometry: { h3Field: 'caseCount' },
  }), /h3Field.*string/);
  assert.throws(() => normalizeDatasetDefinition({
    ...dataset,
    geometryType: 'LINE',
    geometry: { geometryField: 'caseCount' },
  }), /geometryField.*string/);
});

test('validates layer fields against its dataset and renderer geometry', () => {
  const layer = normalizeLayerDefinition({
    id: 'layer-1', datasetId: 'hotspots', renderer: 'HEATMAP', weightField: 'caseCount',
    filter: { severity: { $gte: 2 } }, tooltipFields: ['caseCount'],
  }, catalog);
  assert.equal(layer.renderer, 'HEATMAP');
  assert.ok(Object.isFrozen(layer.filter.severity));

  assert.throws(() => normalizeLayerDefinition({
    id: 'layer-1', datasetId: 'hotspots', renderer: 'HEATMAP', weightField: 'foreignCount',
  }, catalog), /foreignCount/);
  assert.throws(() => normalizeLayerDefinition({
    id: 'layer-1', datasetId: 'hotspots', renderer: 'POINT', weightField: 'severity',
  }, catalog), /weight/);
  assert.throws(() => normalizeLayerDefinition({
    id: 'layer-1', datasetId: 'hotspots', renderer: 'PATH',
  }, catalog), /renderer.*geometry/i);
  assert.throws(() => normalizeLayerDefinition({
    id: 'layer-1', datasetId: 'hotspots', renderer: 'UNKNOWN',
  }, catalog), /renderer/);
});

test('normalizes a safe map view and rejects authority keys anywhere in filters', () => {
  const view = normalizeMapViewDefinition({
    id: 'view-1', name: 'Verified hotspots', version: 1, visibility: 'PRIVATE',
    viewport: { center: [77.5949, 12.9718], zoom: 10 },
    layers: [{
      id: 'layer-1', datasetId: 'hotspots', renderer: 'POINT',
      filter: { severity: { $gte: 2 } },
    }],
  }, catalog);
  assert.ok(Object.isFrozen(view.layers));
  assert.deepEqual(view.viewport.center, [77.5949, 12.9718]);

  for (const authorityKey of ['organizationId', 'role', 'authorizedUnitIds', 'permissions']) {
    assert.throws(() => normalizeMapViewDefinition({
      id: 'view-1', name: 'Unsafe', version: 1, visibility: 'PRIVATE',
      layers: [{
        id: 'layer-1', datasetId: 'hotspots', renderer: 'POINT',
        filter: { severity: { $in: [{ [authorityKey]: 'other' }] } },
      }],
    }, catalog), new RegExp(authorityKey));
  }
});

test('rejects unsafe filters and unknown nested view keys', () => {
  assert.throws(() => normalizeMapViewDefinition({
    id: 'view-1', name: 'Bad', version: 1, visibility: 'PRIVATE',
    layers: [{ id: 'layer-1', datasetId: 'hotspots', renderer: 'POINT', filter: { missing: 1 } }],
  }, catalog), /missing/);
  assert.throws(() => normalizeMapViewDefinition({
    id: 'view-1', name: 'Bad', version: 1, visibility: 'PRIVATE',
    viewport: { center: [77, 12], zoom: 10, secret: true },
    layers: [],
  }, catalog), /secret/);
  assert.throws(() => normalizeMapViewDefinition({
    id: 'view-1', name: 'Bad', version: 1, visibility: 'PRIVATE',
    layers: [{ id: 'layer-1', datasetId: 'hotspots', renderer: 'POINT', limit: MAX_FEATURES + 1 }],
  }, catalog), /limit/);
});

test('rejects maliciously deep filters with a controlled validation error', () => {
  let filter = { severity: 2 };
  for (let depth = 0; depth < 20_000; depth += 1) filter = { $not: filter };

  assert.throws(
    () => normalizeLayerDefinition({ id: 'layer-1', datasetId: 'hotspots', renderer: 'POINT', filter }, catalog),
    error => !(error instanceof RangeError) && /depth/.test(error.message),
  );
});

test('type-checks filter values and operator compatibility against field schemas', () => {
  assert.throws(() => normalizeLayerDefinition({
    id: 'layer-1', datasetId: 'hotspots', renderer: 'POINT', filter: { severity: '2' },
  }, catalog), /severity.*number/);
  assert.throws(() => normalizeLayerDefinition({
    id: 'layer-1', datasetId: 'hotspots', renderer: 'POINT', filter: { severity: { $in: [1, '2'] } },
  }, catalog), /severity.*number/);

  const categoricalDataset = {
    ...dataset,
    fields: { ...dataset.fields, category: { type: 'string', uses: ['filter'] } },
  };
  assert.throws(() => normalizeLayerDefinition({
    id: 'layer-1', datasetId: 'hotspots', renderer: 'POINT', filter: { category: { $gt: 'THEFT' } },
  }, new Map([['hotspots', categoricalDataset]])), /\$gt.*string/);
});

test('requires a catalog key to match the normalized dataset ID', () => {
  assert.throws(() => normalizeLayerDefinition({
    id: 'layer-1', datasetId: 'alias', renderer: 'POINT',
  }, new Map([['alias', dataset]])), /catalog key.*hotspots/);
});

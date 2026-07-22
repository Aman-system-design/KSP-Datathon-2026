import { describe, expect, test, vi } from 'vitest';
import { buildDeckLayerSpecs } from './layer-adapters.js';

const point = (id, longitude, latitude, properties = {}) => ({
  type: 'Feature',
  id,
  geometry: { type: 'Point', coordinates: [longitude, latitude] },
  properties,
});

const collection = (...features) => ({ type: 'FeatureCollection', features });

test('POINT uses GeoJSON longitude-latitude coordinates and emits a safe selection', () => {
  const onFeatureSelect = vi.fn();
  const feature = point('HOT-1', 77.5949, 12.9718, { area: 'Central', caseCount: 6 });
  const [spec] = buildDeckLayerSpecs({
    layer: { id: 'hotspots', renderer: 'POINT' },
    featureCollection: collection(feature),
    onFeatureSelect,
  });

  expect(spec.kind).toBe('ScatterplotLayer');
  expect(spec.id).toBe('hotspots:points');
  expect(spec.getPosition(feature)).toEqual([77.5949, 12.9718]);
  spec.onClick({ object: feature });
  expect(onFeatureSelect).toHaveBeenCalledWith({
    id: 'HOT-1',
    properties: { area: 'Central', caseCount: 6 },
  });
  expect(onFeatureSelect.mock.calls[0][0]).not.toHaveProperty('geometry');
});

test('HEATMAP reads finite weights from the configured field', () => {
  const feature = point('HOT-1', 77.5949, 12.9718, { caseCount: 6 });
  const [spec] = buildDeckLayerSpecs({
    layer: { id: 'hotspots', renderer: 'HEATMAP', weightField: 'caseCount' },
    featureCollection: collection(feature),
  });

  expect(spec.kind).toBe('HeatmapLayer');
  expect(spec.getWeight(feature)).toBe(6);
  expect(spec.getPosition(feature)).toEqual([77.5949, 12.9718]);
});

test('point renderers reject non-finite and out-of-range coordinates', () => {
  for (const coordinates of [[Number.NaN, 12], [77, Number.POSITIVE_INFINITY], [181, 12], [77, -91]]) {
    expect(() => buildDeckLayerSpecs({
      layer: { id: 'invalid', renderer: 'POINT' },
      featureCollection: collection(point('bad', ...coordinates)),
    })).toThrow(/coordinates/);
  }
});

test('CLUSTER output is deterministic regardless of input order', () => {
  const first = point('A', 77.5949, 12.9718, { label: 'A' });
  const second = point('B', 77.595, 12.972, { label: 'B' });
  const compile = features => buildDeckLayerSpecs({
    layer: { id: 'clustered', renderer: 'CLUSTER' },
    featureCollection: collection(...features),
    viewport: { zoom: 8 },
  }).map(spec => ({
    id: spec.id,
    kind: spec.kind,
    data: spec.data.map(feature => ({ id: feature.id, geometry: feature.geometry, properties: feature.properties })),
  }));

  expect(compile([first, second])).toEqual(compile([second, first]));
});

test('H3 accepts valid cells and rejects invalid cells', () => {
  const valid = { type: 'Feature', id: '8928308280fffff', geometry: null, properties: { h3: '8928308280fffff', count: 4 } };
  const [spec] = buildDeckLayerSpecs({
    layer: { id: 'hexes', renderer: 'H3', h3Field: 'h3', weightField: 'count' },
    featureCollection: collection(valid),
  });
  expect(spec.kind).toBe('H3HexagonLayer');
  expect(spec.getHexagon(valid)).toBe('8928308280fffff');

  const invalid = { ...valid, properties: { ...valid.properties, h3: 'not-an-h3-cell' } };
  expect(() => buildDeckLayerSpecs({
    layer: { id: 'hexes', renderer: 'H3', h3Field: 'h3' },
    featureCollection: collection(invalid),
  })).toThrow(/H3/);
});

test('CHOROPLETH requires polygon geometry', () => {
  const polygon = {
    type: 'Feature', id: 'district-1', properties: { name: 'District 1' },
    geometry: { type: 'Polygon', coordinates: [[[77, 12], [78, 12], [78, 13], [77, 12]]] },
  };
  const [spec] = buildDeckLayerSpecs({
    layer: { id: 'districts', renderer: 'CHOROPLETH' },
    featureCollection: collection(polygon),
  });
  expect(spec.kind).toBe('GeoJsonLayer');

  expect(() => buildDeckLayerSpecs({
    layer: { id: 'districts', renderer: 'CHOROPLETH' },
    featureCollection: collection(point('not-a-polygon', 77, 12)),
  })).toThrow(/polygon geometry/);

  const unclosed = {
    ...polygon,
    geometry: { type: 'Polygon', coordinates: [[[77, 12], [78, 12], [78, 13], [77.5, 12.5]]] },
  };
  expect(() => buildDeckLayerSpecs({
    layer: { id: 'districts', renderer: 'CHOROPLETH' },
    featureCollection: collection(unclosed),
  })).toThrow(/polygon geometry/);
});

describe.each(['PATH', 'ARC'])('%s', renderer => {
  test('is explicitly unsupported by the reusable canvas adapter', () => {
    expect(() => buildDeckLayerSpecs({
      layer: { id: renderer.toLowerCase(), renderer },
      featureCollection: collection(),
    })).toThrow(`${renderer} renderer is not supported`);
  });
});

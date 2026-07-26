import { describe, expect, test, vi } from 'vitest';
import Supercluster from 'supercluster';
import { buildDeckLayerSpecs, createDeckLayers } from './layer-adapters.js';

const point = (id, longitude, latitude, properties = {}) => ({
  type: 'Feature',
  id,
  geometry: { type: 'Point', coordinates: [longitude, latitude] },
  properties,
});

const collection = (...features) => ({ type: 'FeatureCollection', features });

test('POINT emits layer-scoped selection with the full authorized server projection', () => {
  const onFeatureSelect = vi.fn();
  const feature = point('HOT-1', 77.5949, 12.9718, { area: 'Central', caseCount: 6 });
  const [spec] = buildDeckLayerSpecs({
    layer: { id: 'hotspots', renderer: 'POINT', tooltipFields: ['area'] },
    featureCollection: collection(feature),
    onFeatureSelect,
  });

  expect(spec.kind).toBe('ScatterplotLayer');
  expect(spec.id).toBe('hotspots:points');
  expect(spec.getPosition(feature)).toEqual([77.5949, 12.9718]);
  spec.onClick({ object: feature });
  expect(onFeatureSelect).toHaveBeenCalledWith({
    layerId: 'hotspots',
    id: 'HOT-1',
    properties: { area: 'Central', caseCount: 6 },
  });
  expect(onFeatureSelect.mock.calls[0][0]).not.toHaveProperty('geometry');
});

test('POINT uses operational risk colours and a visible evidence marker', () => {
  const critical = point('HOT-CRITICAL', 77.5949, 12.9718, { severity: 0.91 });
  const elevated = point('HOT-ELEVATED', 77.6, 12.98, { severity: 0.62 });
  const monitoring = point('HOT-MONITORING', 77.61, 12.99, { severity: 0.22 });
  const [spec] = buildDeckLayerSpecs({
    layer: { id: 'hotspots', renderer: 'POINT', colorField: 'severity' },
    featureCollection: collection(critical, elevated, monitoring),
  });

  expect(spec.stroked).toBe(true);
  expect(spec.radiusMinPixels).toBeGreaterThanOrEqual(7);
  expect(spec.lineWidthMinPixels).toBeGreaterThanOrEqual(2);
  expect(spec.getFillColor(critical)).toEqual([239, 68, 68, 235]);
  expect(spec.getFillColor(elevated)).toEqual([245, 158, 11, 230]);
  expect(spec.getFillColor(monitoring)).toEqual([59, 130, 246, 225]);
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
  expect(spec.colorRange.at(-1)).toEqual([239, 68, 68, 255]);
});

test('optional heatmap constructor loads on demand and produces a real deck layer', async () => {
  const pending = createDeckLayers({
    layer: { id: 'hotspots', renderer: 'HEATMAP', weightField: 'caseCount' },
    featureCollection: collection(point('HOT-1', 77.59, 12.97, { caseCount: 4 })),
  });
  expect(pending).toBeInstanceOf(Promise);
  const [layer] = await pending;
  expect(layer.id).toBe('hotspots:heatmap');
  expect(layer.constructor.name).toBe('HeatmapLayer');
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

test('CLUSTER caches indexing by data identity and config while querying current bounds', () => {
  const load = vi.spyOn(Supercluster.prototype, 'load');
  const getClusters = vi.spyOn(Supercluster.prototype, 'getClusters');
  const featureCollection = collection(point('A', 77.5949, 12.9718), point('B', 77.595, 12.972));
  const compile = (data, viewport, layer = { id: 'clustered', renderer: 'CLUSTER' }) => buildDeckLayerSpecs({
    layer, featureCollection: data, viewport,
  });

  compile(featureCollection, { zoom: 8, bounds: [77, 12, 78, 13] });
  compile(featureCollection, { zoom: 8, bounds: [77.2, 12.2, 78.2, 13.2] });
  expect(load).toHaveBeenCalledTimes(1);
  expect(getClusters.mock.calls.at(-1)[0]).toEqual([77.2, 12.2, 78.2, 13.2]);

  compile(collection(...featureCollection.features), { zoom: 8, bounds: [77, 12, 78, 13] });
  expect(load).toHaveBeenCalledTimes(2);
  compile(featureCollection, { zoom: 8, bounds: [77, 12, 78, 13] }, {
    id: 'clustered', renderer: 'CLUSTER', clusterRadius: 60,
  });
  expect(load).toHaveBeenCalledTimes(3);
  load.mockRestore();
  getClusters.mockRestore();
});

test('CLUSTER rebuilds when a stable collection receives a replacement features array', () => {
  const load = vi.spyOn(Supercluster.prototype, 'load');
  const featureCollection = collection(point('A', 77.5949, 12.9718));
  const options = { layer: { id: 'clustered', renderer: 'CLUSTER' }, featureCollection };
  buildDeckLayerSpecs(options);
  featureCollection.features = [point('B', 77.6, 12.98)];
  buildDeckLayerSpecs(options);
  expect(load).toHaveBeenCalledTimes(2);
  load.mockRestore();
});

test('CLUSTER rejects in-place features array mutation as an immutable-input contract violation', () => {
  const featureCollection = collection(point('A', 77.5949, 12.9718));
  const options = { layer: { id: 'clustered', renderer: 'CLUSTER' }, featureCollection };
  buildDeckLayerSpecs(options);
  featureCollection.features.push(point('B', 77.6, 12.98));
  expect(() => buildDeckLayerSpecs(options)).toThrow(/features array is immutable/);
});

test('CLUSTER aggregate marks request geographic drilldown while leaf points remain evidence selections', () => {
  const onFeatureSelect = vi.fn();
  const clustered = buildDeckLayerSpecs({
    layer: { id: 'clustered', renderer: 'CLUSTER', tooltipFields: ['label'] },
    featureCollection: collection(
      point('A', 77.5949, 12.9718, { label: 'A' }),
      point('B', 77.595, 12.972, { label: 'B' }),
    ),
    viewport: { zoom: 0, bounds: [77, 12, 78, 13] },
    onFeatureSelect,
  });
  const scatter = clustered.find(spec => spec.kind === 'ScatterplotLayer');
  const aggregate = scatter.data.find(feature => feature.properties.cluster);
  scatter.onClick({ object: aggregate });
  expect(onFeatureSelect).toHaveBeenCalledWith(expect.objectContaining({
    kind: 'CLUSTER_DRILLDOWN', layerId: 'clustered',
    center: aggregate.geometry.coordinates, zoom: expect.any(Number),
  }));

  onFeatureSelect.mockClear();

  const leaf = buildDeckLayerSpecs({
    layer: { id: 'clustered', renderer: 'CLUSTER', tooltipFields: ['label'] },
    featureCollection: collection(point('A', 77.5949, 12.9718, { label: 'A' })),
    viewport: { zoom: 16, bounds: [77, 12, 78, 13] },
    onFeatureSelect,
  }).find(spec => spec.kind === 'ScatterplotLayer');
  leaf.onClick({ object: leaf.data[0] });
  expect(onFeatureSelect).toHaveBeenCalledWith({ layerId: 'clustered', id: 'A', properties: { label: 'A' } });
});

test('CLUSTER isolates Supercluster metadata from colliding leaf properties', () => {
  const onFeatureSelect = vi.fn();
  const source = point('LEAF-1', 77.5949, 12.9718, {
    cluster: true,
    cluster_id: 999,
    point_count: 42,
    label: 'Source leaf',
    evidenceCode: 'AUTHORIZED-EVIDENCE',
  });
  const scatter = buildDeckLayerSpecs({
    layer: { id: 'clustered', renderer: 'CLUSTER', tooltipFields: ['cluster', 'label'] },
    featureCollection: collection(source),
    viewport: { zoom: 16, bounds: [77, 12, 78, 13] },
    onFeatureSelect,
  }).find(spec => spec.kind === 'ScatterplotLayer');

  scatter.onClick({ object: scatter.data[0] });

  expect(onFeatureSelect).toHaveBeenCalledWith({
    layerId: 'clustered',
    id: 'LEAF-1',
    properties: { cluster: true, cluster_id: 999, point_count: 42, label: 'Source leaf', evidenceCode: 'AUTHORIZED-EVIDENCE' },
  });
});

test('CLUSTER derives a bounded non-world query for a single point', () => {
  const getClusters = vi.spyOn(Supercluster.prototype, 'getClusters');
  buildDeckLayerSpecs({
    layer: { id: 'clustered', renderer: 'CLUSTER' },
    featureCollection: collection(point('A', 77.5949, 12.9718)),
    viewport: { zoom: 8 },
  });
  const bounds = getClusters.mock.calls.at(-1)[0];
  expect(bounds[0]).toBeLessThan(bounds[2]);
  expect(bounds[1]).toBeLessThan(bounds[3]);
  expect(bounds).not.toEqual([-180, -90, 180, 90]);
  getClusters.mockRestore();
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
  expect(spec.getFillColor({ ...polygon, properties: { severity: 0.9 } })).toEqual([239, 68, 68, 205]);
  expect(spec.getFillColor({ ...polygon, properties: { severity: 0.55 } })).toEqual([180, 83, 47, 200]);
  expect(spec.getFillColor(polygon)).toEqual([31, 56, 86, 205]);
  expect(spec.lineWidthMinPixels).toBe(1);

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

  const degenerate = {
    ...polygon,
    geometry: { type: 'Polygon', coordinates: [[[77, 12], [78, 12], [79, 12], [77, 12]]] },
  };
  expect(() => buildDeckLayerSpecs({
    layer: { id: 'districts', renderer: 'CHOROPLETH' },
    featureCollection: collection(degenerate),
  })).toThrow(/structural polygon geometry/);
});

test('CHOROPLETH honors a configured sequential palette and boundary colour', () => {
  const polygon = value => ({
    type: 'Feature', id: `district-${value}`, properties: { caseCount: value },
    geometry: { type: 'Polygon', coordinates: [[[77, 12], [78, 12], [78, 13], [77, 12]]] },
  });
  const features = [polygon(0), polygon(50), polygon(100)];
  const [spec] = buildDeckLayerSpecs({
    layer: { id: 'districts', renderer: 'CHOROPLETH', colorField: 'caseCount', colorRange: ['#dbeafe', '#3b82f6', '#172554'], lineColor: '#ffffff' },
    featureCollection: collection(...features),
  });
  expect(spec.getFillColor(features[0])).toEqual([219, 234, 254, 230]);
  expect(spec.getFillColor(features[1])).toEqual([59, 130, 246, 230]);
  expect(spec.getFillColor(features[2])).toEqual([23, 37, 84, 230]);
  expect(spec.getLineColor).toEqual([255, 255, 255, 255]);
});

test('CHOROPLETH can add readable value-only labels', () => {
  const polygon = {
    type: 'Feature', id: 'district-1', properties: { districtName: 'Mysuru', caseCount: 128 },
    geometry: { type: 'Polygon', coordinates: [[[76.4, 12.1], [77, 12.1], [77, 12.7], [76.4, 12.1]]] },
  };
  const specs = buildDeckLayerSpecs({
    layer: { id: 'districts', renderer: 'CHOROPLETH', labelValueField: 'caseCount' },
    featureCollection: collection(polygon),
  });
  expect(specs.map(spec => spec.kind)).toEqual(['GeoJsonLayer', 'TextLayer']);
  expect(specs[1].getText(polygon)).toBe('128');
  expect(specs[1].getPosition(polygon)[0]).toBeCloseTo(76.7);
  expect(specs[1].getPosition(polygon)[1]).toBeCloseTo(12.4);
});

describe.each(['PATH', 'ARC'])('%s', renderer => {
  test('is explicitly unsupported by the reusable canvas adapter', () => {
    expect(() => buildDeckLayerSpecs({
      layer: { id: renderer.toLowerCase(), renderer },
      featureCollection: collection(),
    })).toThrow(`${renderer} renderer is not supported`);
  });
});

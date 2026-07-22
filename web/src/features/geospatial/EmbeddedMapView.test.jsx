import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';

import { EmbeddedMapView } from './EmbeddedMapView.jsx';
import { createEmbeddedExecutionManager } from './embedded-execution-manager.js';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const definition = {
  id: 'MAP-1', name: 'Hotspot posture', visibility: 'SHARED', version: 2,
  viewport: { center: [77.59, 12.97], zoom: 9 },
  layers: [{ id: 'L-1', datasetId: 'hotspots', renderer: 'POINT', visible: true, order: 0, limit: 100 }],
};
const descriptor = {
  layer: { ...definition.layers[0], filter: { magnitude: { $gte: 5 } } },
  runtime: { viewport: definition.viewport, limit: 100 },
};

const dataset = {
  id: 'hotspots', name: 'Crime hotspots', spatialStatus: 'AVAILABLE', geometryType: 'POINT',
  fields: { id: { type: 'string', uses: ['display', 'label'] }, magnitude: { type: 'number', uses: ['display', 'weight'] } },
  geometry: { longitudeField: 'longitude', latitudeField: 'latitude' }, labelFields: ['id'],
};

function TestMap({ layers, onFeatureSelect }) {
  return <section aria-label="Embedded test map">
    <output>{layers.map(input => input.layer.id).join(',')}</output>
    {layers.flatMap(input => input.featureCollection.features).map(feature => (
      <button key={feature.id} type="button" onClick={() => onFeatureSelect({
        layerId: 'L-1', id: feature.id, properties: feature.properties,
      })}>Select {feature.id}</button>
    ))}
  </section>;
}

test('read-only embedded map reuses governed layer execution and evidence', async () => {
  const api = {
    get: vi.fn(async path => {
      if (path === '/v1/geospatial/datasets') return { data: { items: [dataset] } };
      if (path === '/v1/geospatial/views') return { data: { items: [] } };
      if (path === '/v1/geospatial/freshness') return { data: { layers: [] } };
      throw new Error(`Unexpected GET ${path}`);
    }),
    post: vi.fn(async (path, body) => {
      expect(path).toBe('/v1/geospatial/layers/execute');
      expect(body).toEqual(descriptor);
      return {
        data: { type: 'FeatureCollection', features: [{
          type: 'Feature', id: 'HOT-1', geometry: { type: 'Point', coordinates: [77.59, 12.97] },
          properties: { id: 'HOT-1', magnitude: 9 },
        }] },
        meta: { runGroupId: 'RUN-1', generatedAt: '2026-07-22T10:00:00.000Z', limitations: ['HUMAN_REVIEW'] },
      };
    }),
  };

  render(<EmbeddedMapView
    api={api} MapComponent={TestMap}
    mapExecution={{ mapView: { id: 'MAP-1', name: 'Hotspot posture', visibility: 'SHARED', version: 2, definition }, executions: [descriptor] }}
  />);

  expect(await screen.findByRole('region', { name: 'Embedded test map' })).toBeInTheDocument();
  await waitFor(() => expect(screen.getByText('L-1')).toBeInTheDocument());
  expect(api.get).not.toHaveBeenCalledWith('/v1/geospatial/views');
  expect(screen.queryByRole('button', { name: /configure|remove|save/i })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Select HOT-1' }));
  expect(await screen.findByRole('heading', { name: 'Evidence for HOT-1' })).toBeInTheDocument();
  expect(screen.getByText('RUN-1')).toBeInTheDocument();
});

test('embedded map fails locally when its governed execution is unavailable', async () => {
  const api = {
    get: vi.fn(async path => path === '/v1/geospatial/datasets'
      ? { data: { items: [dataset] } } : { data: { items: [] } }),
    post: vi.fn(async () => { throw new Error('Layer unavailable'); }),
  };
  render(<EmbeddedMapView api={api} MapComponent={TestMap} mapExecution={{
    mapView: { id: 'MAP-1', name: 'Hotspot posture', visibility: 'SHARED', version: 2, definition }, executions: [descriptor],
  }} />);

  expect(await screen.findByRole('alert')).toHaveTextContent('Layer unavailable');
});

test('24 embedded maps share one catalog, create no freshness timers and remain budgeted', async () => {
  const intervalSpy = vi.spyOn(globalThis, 'setInterval');
  const api = {
    get: vi.fn(async () => ({ data: { items: [dataset] } })),
    post: vi.fn(async () => ({ data: { type: 'FeatureCollection', features: [] }, meta: {} })),
  };
  const executionManager = createEmbeddedExecutionManager(api, {
    maxConcurrent: 4, maxLayers: 24, maxFeatures: 100,
  });

  render(<>{Array.from({ length: 24 }, (_, index) => {
    const layer = { ...definition.layers[0], id: `L-${index}` };
    const mapDefinition = { ...definition, id: `MAP-${index}`, layers: [layer] };
    return <EmbeddedMapView
      key={mapDefinition.id}
      api={api}
      MapComponent={TestMap}
      executionManager={executionManager}
      executionScope={`W-${index}`}
      mapExecution={{
        mapView: { id: mapDefinition.id, name: `Map ${index}`, version: 1, definition: mapDefinition },
        executions: [{ layer, runtime: { viewport: definition.viewport, limit: 100 } }],
      }}
    />;
  })}</>);

  expect(intervalSpy).not.toHaveBeenCalled();
  await waitFor(() => expect(api.post).toHaveBeenCalledTimes(24));
  expect(api.get).toHaveBeenCalledTimes(1);
});

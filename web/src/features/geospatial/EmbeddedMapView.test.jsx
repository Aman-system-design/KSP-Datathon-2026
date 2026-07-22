import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';

import { EmbeddedMapView } from './EmbeddedMapView.jsx';

afterEach(cleanup);

const definition = {
  id: 'MAP-1', name: 'Hotspot posture', visibility: 'SHARED', version: 2,
  viewport: { center: [77.59, 12.97], zoom: 9 },
  layers: [{ id: 'L-1', datasetId: 'hotspots', renderer: 'POINT', visible: true, order: 0, limit: 100 }],
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
      expect(body.layer).toEqual(definition.layers[0]);
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
    mapExecution={{ mapView: { id: 'MAP-1', name: 'Hotspot posture', visibility: 'SHARED', version: 2, definition }, executions: [] }}
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
    mapView: { id: 'MAP-1', name: 'Hotspot posture', visibility: 'SHARED', version: 2, definition }, executions: [],
  }} />);

  expect(await screen.findByRole('alert')).toHaveTextContent('Layer unavailable');
});

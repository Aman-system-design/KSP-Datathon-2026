import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';

import { GeospatialStudio } from './GeospatialStudio.jsx';

afterEach(cleanup);

const datasets = [
  {
    id: 'hotspots', name: 'Crime hotspots', description: 'Verified cluster centroids',
    spatialStatus: 'AVAILABLE', geometryType: 'POINT', labelFields: ['id'],
    fields: {
      id: { type: 'string', uses: ['display', 'label'] },
      magnitude: { type: 'number', uses: ['display', 'weight', 'size'] },
      method: { type: 'string', uses: ['display'] },
    },
  },
  {
    id: 'patrol', name: 'Patrol observations', description: 'Authorized patrol locations',
    spatialStatus: 'AVAILABLE', geometryType: 'POINT', labelFields: ['id'],
    fields: { id: { type: 'string', uses: ['display', 'label'] } },
  },
  {
    id: 'alerts', name: 'Intelligence alerts', description: 'No authorized geometry',
    spatialStatus: 'GEOMETRY_NOT_AVAILABLE', geometryType: undefined,
    missingRequiredFields: ['latitude', 'longitude'], fields: {},
  },
];

function featureResponse(datasetId) {
  const id = datasetId === 'patrol' ? 'PATROL-1' : 'HOT-1';
  return {
    data: {
      type: 'FeatureCollection', features: [{
        type: 'Feature', id, geometry: { type: 'Point', coordinates: [77.59, 12.97] },
        properties: { id, magnitude: 8, method: 'DBSCAN' },
      }],
    },
    meta: {
      requestId: `REQ-${id}`, runGroupId: 'RUN-VERIFIED-1', generatedAt: '2026-07-22T10:00:00.000Z',
      observationWindow: { from: '2026-07-01T00:00:00.000Z', to: '2026-07-22T00:00:00.000Z' },
      recordMethodVersion: 'DBSCAN-1.0', sourceRecordCount: 18,
      limitations: ['REQUIRES_HUMAN_REVIEW'],
    },
  };
}

function harness() {
  const api = {
    get: vi.fn(path => {
      if (path === '/v1/geospatial/datasets') return Promise.resolve({ data: { items: datasets } });
      if (path === '/v1/geospatial/views') return Promise.resolve({ data: { items: [] } });
      if (path === '/v1/geospatial/freshness') return Promise.resolve({ data: { layers: [] } });
      throw new Error(`unexpected GET ${path}`);
    }),
    post: vi.fn((path, body) => {
      if (path === '/v1/geospatial/layers/execute') return Promise.resolve(featureResponse(body.layer.datasetId));
      if (path === '/v1/geospatial/views') return Promise.resolve({ data: { id: body.definition.id, ...body } });
      throw new Error(`unexpected POST ${path}`);
    }),
  };
  return api;
}

function FakeMap({ layers, onFeatureSelect }) {
  return <section aria-label="Test map">
    <output data-testid="map-layers">{layers.map(input => `${input.layer.id}:${input.layer.renderer}`).join('|')}</output>
    {layers.flatMap(input => input.featureCollection.features).map(feature => (
      <button key={feature.id} type="button" onClick={() => onFeatureSelect({ id: feature.id, properties: feature.properties })}>
        Select {feature.id}
      </button>
    ))}
  </section>;
}

async function addDataset(name, api = harness()) {
  render(<GeospatialStudio api={api} MapComponent={FakeMap} />);
  await screen.findByRole('heading', { name: 'Datasets' });
  fireEvent.click(screen.getByRole('button', { name: `Add ${name}` }));
  return api;
}

test('searches the governed catalog, adds datasets, and explains unavailable geometry without plotting it', async () => {
  const api = harness();
  render(<GeospatialStudio api={api} MapComponent={FakeMap} />);
  await screen.findByRole('heading', { name: 'Datasets' });

  fireEvent.change(screen.getByRole('searchbox', { name: 'Search datasets' }), { target: { value: 'alerts' } });
  expect(screen.getByText('Intelligence alerts')).toBeInTheDocument();
  expect(screen.queryByText('Crime hotspots')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Add Intelligence alerts' }));

  expect((await screen.findAllByText(/geometry is not available/i)).length).toBeGreaterThan(0);
  expect(screen.getByTestId('map-layers')).toHaveTextContent('');
  fireEvent.change(screen.getByRole('textbox', { name: 'Map view name' }), { target: { value: 'Unavailable view' } });
  expect(screen.getByRole('button', { name: 'Save map view' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Remove Intelligence alerts' }));
  expect(screen.queryByRole('button', { name: 'Configure Intelligence alerts' })).not.toBeInTheDocument();
  expect(api.post).not.toHaveBeenCalledWith('/v1/geospatial/layers/execute', expect.objectContaining({
    layer: expect.objectContaining({ datasetId: 'alerts' }),
  }));
});

test('visibility and keyboard ordering control renderer input', async () => {
  const api = harness();
  render(<GeospatialStudio api={api} MapComponent={FakeMap} />);
  await screen.findByRole('heading', { name: 'Datasets' });
  fireEvent.click(screen.getByRole('button', { name: 'Add Crime hotspots' }));
  fireEvent.click(screen.getByRole('button', { name: 'Add Patrol observations' }));
  await waitFor(() => expect(screen.getByTestId('map-layers')).toHaveTextContent('hotspots-1:POINT|patrol-2:POINT'));

  fireEvent.click(screen.getByRole('button', { name: 'Move Patrol observations up' }));
  expect(screen.getByTestId('map-layers')).toHaveTextContent('patrol-2:POINT|hotspots-1:POINT');
  fireEvent.click(screen.getByRole('checkbox', { name: 'Show Crime hotspots' }));
  expect(screen.getByTestId('map-layers')).not.toHaveTextContent('hotspots-1');
});

test('inspector applies a compatible renderer only after confirmation', async () => {
  await addDataset('Crime hotspots');
  await waitFor(() => expect(screen.getByTestId('map-layers')).toHaveTextContent('POINT'));
  fireEvent.click(screen.getByRole('button', { name: 'Configure Crime hotspots' }));
  fireEvent.change(screen.getByRole('combobox', { name: 'Renderer' }), { target: { value: 'HEATMAP' } });
  expect(screen.getByTestId('map-layers')).toHaveTextContent('POINT');
  expect(screen.queryByRole('option', { name: 'PATH' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Apply layer configuration' }));
  await waitFor(() => expect(screen.getByTestId('map-layers')).toHaveTextContent('HEATMAP'));
});

test('feature selection opens titled evidence and the accessible table contains the same authorized feature', async () => {
  await addDataset('Crime hotspots');
  fireEvent.click(await screen.findByRole('button', { name: 'Select HOT-1' }));

  const evidence = screen.getByRole('complementary', { name: 'Evidence for HOT-1' });
  expect(within(evidence).getByRole('heading', { name: 'Evidence for HOT-1' })).toBeInTheDocument();
  expect(within(evidence).getByText('RUN-VERIFIED-1')).toBeInTheDocument();
  expect(within(evidence).getByText('DBSCAN-1.0')).toBeInTheDocument();
  expect(within(evidence).getByText('REQUIRES_HUMAN_REVIEW')).toBeInTheDocument();
  expect(within(evidence).getAllByText(/22 Jul 2026/i).length).toBeGreaterThan(0);

  const table = screen.getByRole('table', { name: 'Visible authorized map features' });
  expect(within(table).getByRole('cell', { name: 'HOT-1' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Close evidence' })).toBeInTheDocument();
});

test('saves a normalized view definition without client supplied organization or role authority', async () => {
  const api = await addDataset('Crime hotspots');
  await waitFor(() => expect(screen.getByTestId('map-layers')).toHaveTextContent('POINT'));
  fireEvent.change(screen.getByRole('textbox', { name: 'Map view name' }), { target: { value: 'Verified hotspot picture' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save map view' }));
  await screen.findByText('Map view saved.');

  const [, body] = api.post.mock.calls.find(([path]) => path === '/v1/geospatial/views');
  expect(body).toMatchObject({
    name: 'Verified hotspot picture', visibility: 'PRIVATE',
    definition: {
      name: 'Verified hotspot picture', version: 1, visibility: 'PRIVATE',
      layers: [{ datasetId: 'hotspots', renderer: 'POINT', visible: true, order: 0 }],
    },
  });
  expect(JSON.stringify(body)).not.toMatch(/organization|role|employee|permission/i);
});

test('provides an accessible layer-panel toggle for constrained workspaces', async () => {
  render(<GeospatialStudio api={harness()} MapComponent={FakeMap} />);
  await screen.findByRole('heading', { name: 'Datasets' });
  const studio = screen.getByLabelText('Geospatial Intelligence Studio');
  const toggle = screen.getByRole('button', { name: 'Hide map configuration' });
  expect(studio).toHaveClass('is-layer-panel-open');
  fireEvent.click(toggle);
  expect(studio).not.toHaveClass('is-layer-panel-open');
  expect(toggle).toHaveAccessibleName('Show map configuration');
});

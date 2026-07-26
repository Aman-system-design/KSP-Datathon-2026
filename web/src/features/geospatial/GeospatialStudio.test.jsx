import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';

import { GeospatialStudio } from './GeospatialStudio.jsx';

afterEach(cleanup);

const datasets = [
  {
    id: 'hotspots', name: 'Crime hotspots', description: 'Verified cluster centroids',
    spatialStatus: 'AVAILABLE', geometryType: 'POINT', labelFields: ['id'], sensitivity: 'RESTRICTED',
    owner: 'Crime Analysis Wing', provenance: 'Verified intelligence analytics',
    geometry: { longitudeField: 'longitude', latitudeField: 'latitude' }, timeField: 'observedAt',
    fields: {
      id: { type: 'string', uses: ['display', 'label'] },
      magnitude: { type: 'number', uses: ['display', 'weight', 'size'] },
      method: { type: 'string', uses: ['display'] },
      confidence: { type: 'number', uses: ['display', 'color'] },
      measure: { type: 'number', uses: ['display'] },
      units: { type: 'string', uses: ['display'] },
      observedAt: { type: 'datetime', uses: ['time'] },
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
      properties: { id, magnitude: 8, method: 'DBSCAN', confidence: 0.91, measure: 8, units: 'cases' },
      }],
    },
    meta: {
      requestId: `REQ-${id}`, runGroupId: 'RUN-VERIFIED-1', generatedAt: '2026-07-22T10:00:00.000Z',
      observationWindow: { from: '2026-07-01T00:00:00.000Z', to: '2026-07-22T00:00:00.000Z' },
      recordMethodVersion: 'DBSCAN-1.0', sourceRecordCount: 18,
      publishedAt: '2026-07-22T09:55:00.000Z', modelOrMethod: 'DBSCAN',
      parameterSet: { epsilonMetres: 500, minimumPoints: 4 }, qualityMetrics: { silhouette: 0.73 },
      limitations: ['REQUIRES_HUMAN_REVIEW'],
      contributingRecords: [
        { id: 'CASE-1', authorized: true, actions: [{ label: 'Open case', href: '/cases/CASE-1' }] },
        { id: 'CASE-HIDDEN', authorized: false, actions: [{ label: 'Open hidden case', href: '/cases/CASE-HIDDEN' }] },
      ],
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

function FakeMap({ layers, viewport, onFeatureSelect }) {
  return <section aria-label="Test map">
    <output data-testid="map-layers">{layers.map(input => `${input.layer.id}:${input.layer.renderer}`).join('|')}</output>
    <output data-testid="map-viewport">{JSON.stringify(viewport)}</output>
    {layers.flatMap(input => input.featureCollection.features.map(feature => ({ input, feature }))).map(({ input, feature }) => (
      <button key={`${input.layer.id}:${feature.id}`} type="button" onClick={() => onFeatureSelect({ layerId: input.layer.id, id: feature.id, properties: { id: feature.id } })}>
        Select {input.layer.id} feature {feature.id}
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
  const trigger = screen.getByRole('button', { name: 'Configure Crime hotspots' });
  trigger.focus();
  fireEvent.click(trigger);
  const inspector = screen.getByRole('dialog', { name: 'Configure Crime hotspots' });
  expect(within(inspector).getByText('Verified intelligence analytics')).toBeInTheDocument();
  expect(within(inspector).getByText('Crime Analysis Wing')).toBeInTheDocument();
  expect(within(inspector).getByText('RESTRICTED')).toBeInTheDocument();
  expect(within(inspector).getByRole('heading', { name: 'Geometry' })).toBeInTheDocument();
  expect(within(inspector).getByRole('heading', { name: 'Interaction' })).toBeInTheDocument();
  fireEvent.change(screen.getByRole('combobox', { name: 'Renderer' }), { target: { value: 'HEATMAP' } });
  expect(screen.getByTestId('map-layers')).toHaveTextContent('POINT');
  expect(screen.queryByRole('option', { name: 'PATH' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Apply layer configuration' }));
  await waitFor(() => expect(screen.getByTestId('map-layers')).toHaveTextContent('HEATMAP'));
  fireEvent.keyDown(inspector, { key: 'Escape' });
  expect(screen.queryByRole('dialog', { name: 'Configure Crime hotspots' })).not.toBeInTheDocument();
  expect(trigger).toHaveFocus();
});

test('feature selection opens titled evidence and the accessible table contains the same authorized feature', async () => {
  await addDataset('Crime hotspots');
  const featureTrigger = await screen.findByRole('button', { name: 'Select hotspots-1 feature HOT-1' });
  featureTrigger.focus();
  fireEvent.click(featureTrigger);

  const evidence = screen.getByRole('dialog', { name: 'Evidence for HOT-1' });
  expect(within(evidence).getByRole('heading', { name: 'Evidence for HOT-1' })).toBeInTheDocument();
  expect(within(evidence).getByText('RUN-VERIFIED-1')).toBeInTheDocument();
  expect(within(evidence).getByText('DBSCAN-1.0')).toBeInTheDocument();
  expect(within(evidence).getByText('REQUIRES_HUMAN_REVIEW')).toBeInTheDocument();
  expect(within(evidence).getAllByText(/22 Jul 2026/i).length).toBeGreaterThan(0);
  expect(within(evidence).getAllByText('8').length).toBeGreaterThan(0);
  expect(within(evidence).getAllByText('cases').length).toBeGreaterThan(0);
  expect(within(evidence).getByText('Verified intelligence analytics')).toBeInTheDocument();
  expect(within(evidence).getByRole('link', { name: 'Open case' })).toHaveAttribute('href', '/cases/CASE-1');
  expect(within(evidence).queryByText('CASE-HIDDEN')).not.toBeInTheDocument();

  const table = screen.getByRole('table', { name: 'Visible authorized map features' });
  expect(within(table).getByRole('cell', { name: 'HOT-1' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Close evidence' })).toBeInTheDocument();
  fireEvent.keyDown(evidence, { key: 'Escape' });
  expect(screen.queryByRole('dialog', { name: 'Evidence for HOT-1' })).not.toBeInTheDocument();
  expect(featureTrigger).toHaveFocus();
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

test('returns the saved governed map view to an embedding report workflow', async () => {
  const api = harness();
  const onViewSaved = vi.fn();
  render(<GeospatialStudio api={api} MapComponent={FakeMap} onViewSaved={onViewSaved} />);
  await screen.findByRole('heading', { name: 'Datasets' });
  fireEvent.click(screen.getByRole('button', { name: 'Add Crime hotspots' }));
  await waitFor(() => expect(screen.getByTestId('map-layers')).toHaveTextContent('POINT'));
  fireEvent.change(screen.getByRole('textbox', { name: 'Map view name' }), { target: { value: 'Reusable hotspot map' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save map view' }));

  await waitFor(() => expect(onViewSaved).toHaveBeenCalledWith(expect.objectContaining({
    id: expect.any(String), name: 'Reusable hotspot map', visibility: 'PRIVATE',
  })));
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

test('map authoring starts map-first with the requested dataset and keeps controls available', async () => {
  const api = harness();
  render(<GeospatialStudio
    api={api} MapComponent={FakeMap} mode="authoring"
    defaultDatasetIds={['hotspots']}
    organizationConfig={{ defaultViewport: { center: [75.7139, 15.3173], zoom: 6.1 } }}
  />);

  await waitFor(() => expect(screen.getByTestId('map-layers')).toHaveTextContent('hotspots-1:POINT'));
  await waitFor(() => expect(screen.getByTestId('map-viewport')).toHaveTextContent('"center":[77.59,12.97]'));
  expect(screen.getByTestId('map-viewport')).toHaveTextContent('"zoom":9');
  expect(screen.getByLabelText('Geospatial Intelligence Studio')).toHaveClass('geospatial-studio--authoring');
  expect(screen.getByLabelText('Geospatial Intelligence Studio')).not.toHaveClass('is-layer-panel-open');
  expect(screen.getByRole('button', { name: 'Show map configuration' })).toBeVisible();
});

test('uses tenant configuration, functional workspace search and time range without KSP defaults', async () => {
  const api = harness();
  render(<GeospatialStudio
    api={api} MapComponent={FakeMap}
    organizationConfig={{
      defaultViewport: { center: [10, 20], zoom: 5 }, jurisdictionLabel: 'Northern Region',
      locale: 'en-GB', timezone: 'Europe/London',
    }}
    clock={() => new Date('2026-07-22T12:00:00.000Z')}
  />);
  await screen.findByRole('heading', { name: 'Datasets' });
  expect(screen.getByTestId('map-viewport')).toHaveTextContent('"center":[10,20]');
  expect(screen.getByRole('combobox', { name: 'Jurisdiction' })).toBeDisabled();
  expect(screen.getByRole('option', { name: 'Northern Region' })).toBeInTheDocument();

  fireEvent.change(screen.getByRole('searchbox', { name: 'Search workspace' }), { target: { value: 'patrol' } });
  expect(screen.getByText('Patrol observations')).toBeInTheDocument();
  expect(screen.queryByText('Crime hotspots')).not.toBeInTheDocument();
  fireEvent.change(screen.getByRole('searchbox', { name: 'Search workspace' }), { target: { value: '' } });
  fireEvent.click(screen.getByRole('button', { name: 'Add Crime hotspots' }));
  await waitFor(() => expect(screen.getByTestId('map-layers')).toHaveTextContent('hotspots-1'));
  const timeRange = screen.getByRole('combobox', { name: 'Time range' });
  expect(timeRange).toBeEnabled();
  fireEvent.change(timeRange, { target: { value: 'LAST_30_DAYS' } });
  await waitFor(() => {
    const executions = api.post.mock.calls.filter(([path]) => path === '/v1/geospatial/layers/execute');
    expect(executions.at(-1)[1].runtime.timeWindow).toEqual({
      from: '2026-06-22T12:00:00.000Z', to: '2026-07-22T12:00:00.000Z',
    });
  });
  fireEvent.change(screen.getByRole('textbox', { name: 'Map view name' }), { target: { value: 'Timed view' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save map view' }));
  await screen.findByText('Map view saved.');
  const [, saved] = api.post.mock.calls.find(([path]) => path === '/v1/geospatial/views');
  expect(saved.definition.timeWindow).toEqual({
    from: '2026-06-22T12:00:00.000Z', to: '2026-07-22T12:00:00.000Z',
  });
});

test('desktop panel separators resize with keyboard and pointer within declared bounds', async () => {
  render(<GeospatialStudio api={harness()} MapComponent={FakeMap} />);
  await screen.findByRole('heading', { name: 'Datasets' });
  const left = screen.getByRole('separator', { name: 'Resize layer panel' });
  const before = Number(left.getAttribute('aria-valuenow'));
  fireEvent.keyDown(left, { key: 'ArrowRight' });
  expect(Number(left.getAttribute('aria-valuenow'))).toBe(before + 10);
  fireEvent.keyDown(left, { key: 'Home' });
  expect(left).toHaveAttribute('aria-valuenow', '260');
  fireEvent.pointerDown(left, { clientX: 100, pointerId: 1 });
  fireEvent.pointerMove(left, { clientX: 130, pointerId: 1 });
  fireEvent.pointerUp(left, { pointerId: 1 });
  expect(left).toHaveAttribute('aria-valuenow', '290');
});

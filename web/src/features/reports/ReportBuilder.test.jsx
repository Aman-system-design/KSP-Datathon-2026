import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, expect, test, vi } from 'vitest';

import { ReportBuilder } from './ReportBuilder.jsx';

afterEach(cleanup);

const anomalySource = {
  key: 'anomalies', label: 'Trend anomalies',
  fields: {
    unitId: { type: 'string', dimension: true },
    observed: { type: 'number', aggregates: ['sum'] },
  },
  visualizations: ['table', 'bar', 'line'],
};

const stationCaseSource = {
  key: 'stationCases', label: 'Station cases',
  fields: {
    isOpen: { type: 'boolean', dimension: true },
    recordCount: { type: 'number', aggregates: ['sum'] },
  },
  visualizations: ['table', 'number'],
};

function renderNew(api, props = {}) {
  return render(<MemoryRouter initialEntries={['/reports/new']}><ReportBuilder api={api} {...props} /></MemoryRouter>);
}

function next() { fireEvent.click(screen.getByRole('button', { name: /^Next$/i })); }

test('creates and executes a governed report through the progressive workflow', async () => {
  const api = {
    get: vi.fn(async path => path === '/v1/report-sources' ? { data: [anomalySource] } : { data: { items: [] } }),
    post: vi.fn(async path => path.endsWith('/execute')
      ? { data: { result: { data: { items: [{ unitId: 'Unit 101', observed_sum: 7 }] } } } }
      : { data: { id: 'R-1', name: 'Anomaly watch', version: 1 } }),
  };

  renderNew(api);
  expect(await screen.findByRole('option', { name: 'Trend anomalies' })).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Report name'), { target: { value: 'Anomaly watch' } });
  next();
  expect(screen.getByRole('heading', { name: 'Select a visualization' })).toBeInTheDocument();
  next();
  fireEvent.change(screen.getByLabelText('Group by'), { target: { value: 'unitId' } });
  fireEvent.change(screen.getByLabelText('Measure'), { target: { value: 'observed:sum' } });
  next();
  next();
  fireEvent.click(screen.getByRole('button', { name: 'Run report' }));

  expect(await screen.findByText('Unit 101')).toBeInTheDocument();
  await waitFor(() => expect(api.post).toHaveBeenCalledTimes(2));
  expect(api.post).toHaveBeenNthCalledWith(1, '/v1/reports', expect.objectContaining({
    name: 'Anomaly watch', dimensions: ['unitId'], measures: [{ field: 'observed', aggregate: 'sum' }],
  }));
});

test.each([
  ['eq', 'true', true],
  ['neq', 'false', false],
])('creates station case reports with typed boolean %s filters', async (operator, input, expected) => {
  const api = {
    get: vi.fn(async () => ({ data: [stationCaseSource] })),
    post: vi.fn(async () => ({ data: { id: 'R-BOOL', version: 1 } })),
  };
  renderNew(api);
  await screen.findByRole('option', { name: 'Station cases' });
  fireEvent.change(screen.getByLabelText('Report name'), { target: { value: 'Open case filter' } });
  next(); next();
  fireEvent.change(screen.getByLabelText('Filter field'), { target: { value: 'isOpen' } });
  fireEvent.change(screen.getByLabelText('Filter operator'), { target: { value: operator } });
  fireEvent.change(screen.getByLabelText('Filter value'), { target: { value: input } });
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));

  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/v1/reports', expect.objectContaining({
    sourceKey: 'stationCases', filters: [{ field: 'isOpen', operator, value: expected }],
  })));
});

test('edits station case reports with typed boolean in filters', async () => {
  const api = {
    get: vi.fn(async path => {
      if (path === '/v1/report-sources') return { data: [stationCaseSource] };
      if (path === '/v1/reports/R-BOOL') return { data: {
        id: 'R-BOOL', name: 'Boolean cases', version: 2,
        definition: {
          name: 'Boolean cases', sourceKey: 'stationCases', dimensions: [], measures: [],
          filters: [{ field: 'isOpen', operator: 'in', value: [true, false] }], sort: [],
          visualization: { type: 'table' }, limit: 100,
        },
      } };
      throw new Error(`Unexpected GET ${path}`);
    }),
    patch: vi.fn(async () => ({ data: { id: 'R-BOOL', version: 3 } })), post: vi.fn(),
  };

  render(<MemoryRouter initialEntries={['/reports/R-BOOL']}><Routes><Route path="/reports/:reportId" element={<ReportBuilder api={api} />} /></Routes></MemoryRouter>);
  expect(await screen.findByLabelText('Report title')).toHaveValue('Boolean cases');
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));

  await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/v1/reports/R-BOOL', {
    expectedVersion: 2,
    definition: expect.objectContaining({
      filters: [{ field: 'isOpen', operator: 'in', value: [true, false] }],
    }),
  }));
});

test('map reports use an authorized saved map view and render the governed execution', async () => {
  const api = {
    get: vi.fn(async path => {
      if (path === '/v1/report-sources') return { data: [{ key: 'hotspots', label: 'Crime hotspots', fields: {}, visualizations: ['table', 'map'] }] };
      if (path === '/v1/geospatial/views') return { data: { items: [{ id: 'MAP-AUTH', name: 'Authorized hotspot posture', definition: { layers: [] } }] } };
      throw new Error(`Unexpected GET ${path}`);
    }),
    post: vi.fn(async path => path.endsWith('/execute')
      ? { data: { result: { data: { mapView: { id: 'MAP-AUTH', definition: { layers: [] } }, executions: [] } } } }
      : { data: { id: 'REPORT-MAP', version: 1 } }),
  };
  function MapPreview({ mapExecution }) { return <div>Embedded {mapExecution.mapView.id}</div>; }

  renderNew(api, { EmbeddedMapComponent: MapPreview });
  await screen.findByRole('option', { name: 'Crime hotspots' });
  fireEvent.change(screen.getByLabelText('Report name'), { target: { value: 'Hotspot posture' } });
  next();
  fireEvent.click(screen.getByRole('radio', { name: 'Map' }));
  next();
  expect(await screen.findByRole('option', { name: 'Authorized hotspot posture' })).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Saved map view'), { target: { value: 'MAP-AUTH' } });
  next();
  next();
  fireEvent.click(screen.getByRole('button', { name: 'Run report' }));

  expect(await screen.findByText('Embedded MAP-AUTH')).toBeInTheDocument();
  expect(api.post).toHaveBeenCalledWith('/v1/reports', expect.objectContaining({ visualization: { type: 'map', mapViewId: 'MAP-AUTH' } }));
});

test('authors a reusable governed map inside the report workflow and selects the saved view', async () => {
  const api = {
    get: vi.fn(async path => {
      if (path === '/v1/report-sources') return { data: [{ key: 'hotspots', label: 'Crime hotspots', fields: {}, visualizations: ['map'] }] };
      if (path === '/v1/geospatial/views') return { data: { items: [] } };
      throw new Error(`Unexpected GET ${path}`);
    }),
    post: vi.fn(async path => path.endsWith('/execute')
      ? { data: { result: { data: { mapView: { id: 'MAP-NEW', definition: { layers: [] } }, executions: [] } } } }
      : { data: { id: 'REPORT-MAP', version: 1 } }),
  };
  function MapComposer({ onViewSaved, onCancel, defaultDatasetIds, organizationConfig, mode }) {
    return <div aria-label="Embedded map composer">
      <output data-testid="composer-defaults">{JSON.stringify({ defaultDatasetIds, organizationConfig, mode })}</output>
      <button type="button" onClick={() => onViewSaved({ id: 'MAP-NEW', name: 'District incident drilldown', visibility: 'PRIVATE' })}>Save composed map</button>
      <button type="button" onClick={onCancel}>Cancel map authoring</button>
    </div>;
  }

  renderNew(api, { MapComposerComponent: MapComposer });
  await screen.findByRole('option', { name: 'Crime hotspots' });
  fireEvent.change(screen.getByLabelText('Report name'), { target: { value: 'District incident map' } });
  next();
  next();
  fireEvent.click(screen.getByRole('button', { name: 'Create map view' }));
  expect(screen.getByLabelText('Embedded map composer')).toBeInTheDocument();
  expect(screen.getByTestId('composer-defaults')).toHaveTextContent('"defaultDatasetIds":["hotspots"]');
  expect(screen.getByTestId('composer-defaults')).toHaveTextContent('"center":[75.7139,15.3173]');
  expect(screen.getByTestId('composer-defaults')).toHaveTextContent('"mode":"authoring"');
  fireEvent.click(screen.getByRole('button', { name: 'Save composed map' }));

  expect(screen.queryByLabelText('Embedded map composer')).not.toBeInTheDocument();
  expect(screen.getByRole('option', { name: 'District incident drilldown' })).toBeInTheDocument();
  expect(screen.getByLabelText('Saved map view')).toHaveValue('MAP-NEW');
  next();
  next();
  fireEvent.click(screen.getByRole('button', { name: 'Run report' }));
  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/v1/reports', expect.objectContaining({
    visualization: { type: 'map', mapViewId: 'MAP-NEW' },
  })));
});

test('updates an existing report with the versioned API contract', async () => {
  const api = {
    get: vi.fn(async path => {
      if (path === '/v1/report-sources') return { data: [anomalySource] };
      if (path === '/v1/reports/R-7') return { data: { id: 'R-7', name: 'Existing report', version: 4, definition: { name: 'Existing report', sourceKey: 'anomalies', dimensions: [], measures: [], filters: [], sort: [], visualization: { type: 'table' }, limit: 100 } } };
      throw new Error(`Unexpected GET ${path}`);
    }),
    patch: vi.fn(async () => ({ data: { id: 'R-7', version: 5 } })),
    post: vi.fn(),
  };

  render(<MemoryRouter initialEntries={['/reports/R-7']}><Routes><Route path="/reports/:reportId" element={<ReportBuilder api={api} />} /></Routes></MemoryRouter>);
  expect(await screen.findByLabelText('Report title')).toHaveValue('Existing report');
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));

  await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/v1/reports/R-7', {
    expectedVersion: 4,
    definition: expect.objectContaining({ name: 'Existing report', sourceKey: 'anomalies' }),
  }));
});

test('missing report sources leaves the authoring surface usable instead of crashing', async () => {
  const api = { get: vi.fn(async () => ({ data: {} })), post: vi.fn() };
  renderNew(api);
  expect(await screen.findByRole('heading', { name: 'Choose data' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /^Next$/i })).toBeDisabled();
});

test('station report builder presents only server-authorized station sources', async () => {
  const alertSource = { key: 'alerts', label: 'Intelligence alerts', fields: {}, visualizations: ['table'] };
  const api = { get: vi.fn(async () => ({ data: [alertSource, stationCaseSource] })), post: vi.fn() };
  renderNew(api);

  expect(await screen.findByRole('option', { name: 'Intelligence alerts' })).toBeInTheDocument();
  expect(screen.getByRole('option', { name: 'Station cases' })).toBeInTheDocument();
  expect(screen.queryByRole('option', { name: 'Trend anomalies' })).not.toBeInTheDocument();
  expect(screen.queryByRole('option', { name: /hotspot/i })).not.toBeInTheDocument();
});

test('keeps the report preview beside every authoring step', async () => {
  const api = { get: vi.fn(async () => ({ data: [anomalySource] })), post: vi.fn() };
  renderNew(api);

  await screen.findByRole('option', { name: 'Trend anomalies' });
  expect(screen.getByRole('region', { name: 'Report preview workspace' })).toBeInTheDocument();
  expect(screen.getByLabelText('Ask Intelligence')).toBeInTheDocument();
  expect(screen.getByText('Run the report to generate its preview.')).toBeInTheDocument();

  fireEvent.change(screen.getByLabelText('Report name'), { target: { value: 'Hourly FIR pattern' } });
  next();
  expect(screen.getByRole('heading', { name: 'Select a visualization' })).toBeInTheDocument();
  expect(screen.getByRole('region', { name: 'Report preview workspace' })).toBeInTheDocument();
});

test('using the deferred Intelligence bar never calls the report API', async () => {
  const api = { get: vi.fn(async () => ({ data: [anomalySource] })), post: vi.fn() };
  renderNew(api);

  await screen.findByRole('option', { name: 'Trend anomalies' });
  fireEvent.change(screen.getByLabelText('Ask Intelligence'), { target: { value: 'Show FIR count by hour' } });
  fireEvent.click(screen.getByRole('button', { name: 'Ask Intelligence' }));

  expect(api.post).not.toHaveBeenCalled();
  expect(screen.getByRole('status')).toHaveTextContent('Your report was not changed');
}, 10_000);

test('keeps the Intelligence control inside the builder without nesting forms', async () => {
  const api = { get: vi.fn(async () => ({ data: [anomalySource] })), post: vi.fn() };
  const { container } = renderNew(api);

  await screen.findByRole('option', { name: 'Trend anomalies' });
  expect(container.querySelectorAll('form')).toHaveLength(1);
});

test('shows governed Data Store sources and the complete chart catalogue', async () => {
  const api = { get: vi.fn(async () => ({ data: [anomalySource] })), post: vi.fn() };
  renderNew(api);

  await screen.findByRole('option', { name: 'Trend anomalies' });
  expect(screen.getByText('Approved Data Store source · viewer scoped')).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Report name'), { target: { value: 'Chart discovery' } });
  next();

  for (const label of ['Table', 'KPI Number', 'Bar', 'Line', 'Pie', 'Funnel', 'Karnataka Map']) {
    expect(screen.getByRole('radio', { name: new RegExp(label, 'i') })).toBeInTheDocument();
  }
});

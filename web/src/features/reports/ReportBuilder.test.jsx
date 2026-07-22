import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';

import { ReportBuilder } from './ReportBuilder.jsx';

afterEach(cleanup);

test('analyst configures, previews and saves a governed anomaly report', async () => {
  const api = {
    get: vi.fn(async () => ({ data: [{ key: 'anomalies', label: 'Trend anomalies', fields: {
      unitId: { type: 'string', dimension: true }, observed: { type: 'number', aggregates: ['sum'] },
    }, visualizations: ['table', 'bar', 'line'] }] })),
    post: vi.fn(async (path) => path.endsWith('/execute')
      ? { data: { result: { data: { items: [{ unitId: 101, observed: 7 }] } } } }
      : { data: { id: 'R-1', name: 'Anomaly watch', version: 1 } }),
  };
  render(<ReportBuilder api={api} />);
  expect(await screen.findByRole('option', { name: 'Trend anomalies' })).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Report name'), { target: { value: 'Anomaly watch' } });
  fireEvent.change(screen.getByLabelText('Group by'), { target: { value: 'unitId' } });
  fireEvent.change(screen.getByLabelText('Measure'), { target: { value: 'observed:sum' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save and preview' }));
  expect(await screen.findByText('Unit 101')).toBeInTheDocument();
  await waitFor(() => expect(api.post).toHaveBeenCalledTimes(2));
});

test('missing report-source data renders an empty governed builder instead of crashing', async () => {
  const api = { get: vi.fn(async () => ({ data: {} })), post: vi.fn() };

  render(<ReportBuilder api={api} />);

  expect(await screen.findByRole('heading', { name: 'Build a report' })).toBeInTheDocument();
  expect(screen.getByText('Configure the report to inspect live governed results.')).toBeInTheDocument();
});

test('map reports select only viewer-authorized saved views and submit the governed reference', async () => {
  const api = {
    get: vi.fn(async path => {
      if (path === '/v1/report-sources') return { data: [{
        key: 'hotspots', label: 'Crime hotspots', fields: {}, visualizations: ['table', 'map'],
      }] };
      if (path === '/v1/geospatial/views') return { data: { items: [
        { id: 'MAP-AUTH', name: 'Authorized hotspot posture', visibility: 'SHARED', definition: { layers: [] } },
      ] } };
      throw new Error(`Unexpected GET ${path}`);
    }),
    post: vi.fn(async path => path.endsWith('/execute')
      ? { data: { result: { data: { mapView: { id: 'MAP-AUTH', definition: { layers: [] } }, executions: [] } } } }
      : { data: { id: 'REPORT-MAP' } }),
  };
  function MapPreview({ mapExecution }) { return <div>Embedded {mapExecution.mapView.id}</div>; }

  render(<ReportBuilder api={api} EmbeddedMapComponent={MapPreview} />);
  await screen.findByRole('option', { name: 'Crime hotspots' });
  fireEvent.change(screen.getByLabelText('Report name'), { target: { value: 'Hotspot posture' } });
  fireEvent.change(screen.getByLabelText('Visualization'), { target: { value: 'map' } });
  expect(await screen.findByRole('option', { name: 'Authorized hotspot posture' })).toBeInTheDocument();
  expect(screen.queryByText(/private.invalid/i)).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Saved map view'), { target: { value: 'MAP-AUTH' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save and preview' }));

  expect(await screen.findByText('Embedded MAP-AUTH')).toBeInTheDocument();
  expect(api.post).toHaveBeenCalledWith('/v1/reports', expect.objectContaining({
    visualization: { type: 'map', mapViewId: 'MAP-AUTH' },
  }));
});

test('source capability changes reset map state and stale previews cannot overwrite the new configuration', async () => {
  let resolveCreate;
  const createPending = new Promise(resolve => { resolveCreate = resolve; });
  const api = {
    get: vi.fn(async path => path === '/v1/report-sources' ? { data: [
      { key: 'hotspots', label: 'Crime hotspots', fields: {}, visualizations: ['table', 'map'] },
      { key: 'anomalies', label: 'Trend anomalies', fields: {}, visualizations: ['table'] },
    ] } : { data: { items: [{ id: 'MAP-1', name: 'Hotspots', definition: { layers: [] } }] } }),
    post: vi.fn(path => path === '/v1/reports' ? createPending : Promise.resolve({
      data: { result: { data: { mapView: { id: 'MAP-1', definition: { layers: [] } }, executions: [] } },
    } })),
  };
  function MapPreview() { return <div>Stale map preview</div>; }
  render(<ReportBuilder api={api} EmbeddedMapComponent={MapPreview} />);
  await screen.findByRole('option', { name: 'Crime hotspots' });
  fireEvent.change(screen.getByLabelText('Report name'), { target: { value: 'Map' } });
  fireEvent.change(screen.getByLabelText('Visualization'), { target: { value: 'map' } });
  await screen.findByRole('option', { name: 'Hotspots' });
  fireEvent.click(screen.getByRole('button', { name: 'Save and preview' }));
  expect(screen.getByRole('button', { name: /saving/i })).toBeDisabled();

  fireEvent.change(screen.getByLabelText('Intelligence source'), { target: { value: 'anomalies' } });
  expect(screen.getByLabelText('Visualization')).toHaveValue('table');
  expect(screen.queryByLabelText('Saved map view')).not.toBeInTheDocument();
  resolveCreate({ data: { id: 'R-OLD' } });
  await waitFor(() => expect(screen.getByRole('button', { name: 'Save and preview' })).not.toBeDisabled());
  expect(screen.queryByText('Stale map preview')).not.toBeInTheDocument();
});

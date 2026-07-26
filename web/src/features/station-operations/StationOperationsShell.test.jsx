import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, expect, test, vi } from 'vitest';

import { StationOperationsShell } from './StationOperationsShell.jsx';

afterEach(cleanup);

const reportDefinitions = {
  'R-OPEN': { name: 'Open Cases', sourceKey: 'stationCases', dimensions: [], measures: [{ field: 'recordCount', aggregate: 'sum' }], filters: [], visualization: { type: 'number' } },
  'R-NEW': { name: 'New Cases · Last 30 Days', sourceKey: 'stationCases', dimensions: [], measures: [{ field: 'recordCount', aggregate: 'sum' }], filters: [{ field: 'registeredAgeDays', operator: 'lte', value: 30 }], visualization: { type: 'number' } },
  'R-AGE': { name: 'Case Ageing', sourceKey: 'stationCases', dimensions: ['ageingBucket'], measures: [{ field: 'recordCount', aggregate: 'sum' }], filters: [], visualization: { type: 'bar' } },
  'R-REGISTER': { name: 'Open Case Register', sourceKey: 'stationCases', dimensions: ['caseId', 'caseNumber', 'ageingBucket'], measures: [], filters: [], visualization: { type: 'table' } },
};

const workspace = {
  role: 'STATION_OPERATIONS', scopeUnitId: 1001,
  scopeUnit: { name: 'Central Police Station', type: 'Police station' },
  landingDashboard: { id: 'D-STATION' },
  availableDashboards: [{ id: 'D-STATION', name: 'Station Operations', relationship: 'SYSTEM', defaultRole: 'STATION_OPERATIONS' }],
  availableReports: Object.entries(reportDefinitions).map(([id, definition]) => ({ id, name: definition.name, definition })),
};

function response(reportId, body) {
  const definition = reportDefinitions[reportId];
  const period = body?.runtimeFilters?.[0]?.value ?? 30;
  const data = reportId === 'R-OPEN' ? [{ recordCount_sum: 18 }]
    : reportId === 'R-NEW' ? [{ recordCount_sum: period }]
      : reportId === 'R-AGE' ? [
        { ageingBucket: '0–7 days', recordCount_sum: 8 },
        { ageingBucket: '60+ days', recordCount_sum: 4 },
      ] : [
        { caseId: 'CASE-1', caseNumber: '11/2026', ageingBucket: '60+ days' },
        { caseId: 'CASE-2', caseNumber: '12/2026', ageingBucket: '0–7 days' },
      ];
  return { data: { definition: { name: definition.name, definition }, result: { data: { items: data } } } };
}

function apiHarness() {
  return {
    get: vi.fn(async path => {
      if (path === '/v1/dashboards/D-STATION') return { data: { id: 'D-STATION', name: 'Station Operations', items: [
        { id: 'I-1', reportId: 'R-OPEN', column: 1, row: 1, width: 3, height: 2 },
        { id: 'I-2', reportId: 'R-NEW', column: 4, row: 1, width: 3, height: 2 },
        { id: 'I-3', reportId: 'R-AGE', column: 1, row: 3, width: 7, height: 5 },
        { id: 'I-4', reportId: 'R-REGISTER', column: 8, row: 3, width: 5, height: 5 },
      ] } };
      if (path === '/v1/reports') return { data: [] };
      throw new Error(`Unexpected request ${path}`);
    }),
    post: vi.fn(async (path, body) => response(path.split('/')[3], body)),
    put: vi.fn(async () => ({ data: [] })),
  };
}

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}{location.search}</output>;
}

test('renders the station identity and role dashboard without internal or state-leadership copy', async () => {
  render(<MemoryRouter initialEntries={['/?persona=STATION_OPERATIONS']}><StationOperationsShell api={apiHarness()} workspace={workspace} /></MemoryRouter>);

  expect(await screen.findByRole('heading', { name: 'Station Operations' })).toBeInTheDocument();
  expect(screen.getByText('Central Police Station')).toBeInTheDocument();
  expect(screen.getByLabelText('Station reporting period')).toBeInTheDocument();
  expect(screen.queryByText(/authorized workspace|scopeunit|unit 1001|backend/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/FIRs by Karnataka District|State Intelligence/i)).not.toBeInTheDocument();
});

test('ignores personal and state dashboards and shows an honest setup state', async () => {
  const api = apiHarness();
  const unsafeWorkspace = {
    ...workspace,
    landingDashboard: { id: 'D-STATE' },
    availableDashboards: [{ id: 'D-STATE', name: 'State Intelligence', relationship: 'OWNED' }],
  };
  render(<MemoryRouter><StationOperationsShell api={api} workspace={unsafeWorkspace} /></MemoryRouter>);

  expect(await screen.findByText('Station dashboard is not configured yet.')).toBeInTheDocument();
  expect(api.get).not.toHaveBeenCalledWith('/v1/dashboards/D-STATE');
  expect(screen.getByRole('button', { name: 'Edit dashboard' })).toBeDisabled();
});

test('does not execute or render non-station report items from a loaded dashboard', async () => {
  const api = apiHarness();
  api.get.mockImplementation(async path => {
    if (path === '/v1/dashboards/D-STATION') return { data: { id: 'D-STATION', items: [
      { id: 'I-1', reportId: 'R-OPEN', column: 1, row: 1, width: 3, height: 2 },
      { id: 'I-STATE', reportId: 'R-STATE', column: 1, row: 3, width: 12, height: 5 },
    ] } };
    if (path === '/v1/reports') return { data: [] };
    throw new Error(`Unexpected request ${path}`);
  });
  const guardedWorkspace = { ...workspace, availableReports: [
    ...workspace.availableReports,
    { id: 'R-STATE', name: 'Karnataka district map', definition: { sourceKey: 'hotspots', visualization: { type: 'map' } } },
  ] };
  render(<MemoryRouter><StationOperationsShell api={api} workspace={guardedWorkspace} /></MemoryRouter>);

  expect(await screen.findByText('Open Cases')).toBeInTheDocument();
  expect(api.post).not.toHaveBeenCalledWith('/v1/reports/R-STATE/execute', expect.anything());
  expect(screen.queryByText('Karnataka district map')).not.toBeInTheDocument();
});

test('period selection performs validated ephemeral station-case executions and updates the metric', async () => {
  const api = apiHarness();
  render(<MemoryRouter><StationOperationsShell api={api} workspace={workspace} /></MemoryRouter>);
  expect(await screen.findByText('New Cases · Last 30 Days')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: '7 days' }));

  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/v1/reports/R-NEW/execute', {
    runtimeFilters: [{ field: 'registeredAgeDays', operator: 'lte', value: 7 }],
  }));
  expect(api.post.mock.calls.filter(([path]) => path === '/v1/reports/R-OPEN/execute').at(-1)[1]).toEqual({});
  expect(api.post.mock.calls.filter(([path]) => path === '/v1/reports/R-AGE/execute').at(-1)[1]).toEqual({});
  expect(api.post.mock.calls.filter(([path]) => path === '/v1/reports/R-REGISTER/execute').at(-1)[1]).toEqual({});
  expect(await screen.findByText('7')).toBeInTheDocument();
});

test('chart selection filters compatible register rows and the removable status clears it', async () => {
  render(<MemoryRouter><StationOperationsShell api={apiHarness()} workspace={workspace} /></MemoryRouter>);
  fireEvent.click(await screen.findByTitle('60+ days: 4'));

  expect(screen.getByRole('button', { name: 'Clear Ageing: 60+ days filter' })).toBeInTheDocument();
  expect(screen.getByText('11/2026')).toBeInTheDocument();
  expect(screen.queryByText('12/2026')).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Clear Ageing: 60+ days filter' }));
  expect(screen.getByText('12/2026')).toBeInTheDocument();
});

test('case selection navigates to the prepared detail target and preserves persona', async () => {
  render(<MemoryRouter initialEntries={['/?persona=STATION_OPERATIONS']}>
    <StationOperationsShell api={apiHarness()} workspace={workspace} /><LocationProbe />
  </MemoryRouter>);
  fireEvent.click(await screen.findByRole('button', { name: 'Open case 11/2026' }));
  expect(screen.getByTestId('location')).toHaveTextContent('/cases/CASE-1?persona=STATION_OPERATIONS');
});

test('edit cancellation restores layout and save persists staged changes', async () => {
  const api = apiHarness();
  render(<MemoryRouter><StationOperationsShell api={api} workspace={workspace} /></MemoryRouter>);
  fireEvent.click(await screen.findByRole('button', { name: 'Edit dashboard' }));
  fireEvent.click(screen.getByRole('button', { name: 'Move Open Cases right' }));
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(api.put).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole('button', { name: 'Edit dashboard' }));
  fireEvent.click(screen.getByRole('button', { name: 'Move Open Cases right' }));
  fireEvent.click(screen.getByRole('button', { name: 'Save dashboard' }));
  await waitFor(() => expect(api.put).toHaveBeenCalledWith('/v1/dashboards/D-STATION/items', expect.objectContaining({ items: expect.arrayContaining([
    expect.objectContaining({ reportId: 'R-OPEN', column: 2 }),
  ]) })));
});

test('falls back to a safe station label and contains isolated report failures', async () => {
  const api = apiHarness();
  api.post.mockImplementation(async path => {
    if (path.includes('R-AGE')) throw Object.assign(new Error('private detail'), { code: 'REPORT_FAILED' });
    return response(path.split('/')[3], {});
  });
  render(<MemoryRouter><StationOperationsShell api={api} workspace={{ ...workspace, scopeUnit: undefined }} /></MemoryRouter>);
  expect(await screen.findByText('Local station')).toBeInTheDocument();
  expect(await screen.findByRole('alert')).toHaveTextContent('Report unavailable');
  expect(screen.getByText('Open Cases')).toBeInTheDocument();
  expect(screen.queryByText('private detail')).not.toBeInTheDocument();
});

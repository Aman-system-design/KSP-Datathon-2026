import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, expect, test, vi } from 'vitest';

import { StationOperationsShell, stationPlacementClass, stationPresentation } from './StationOperationsShell.jsx';

afterEach(cleanup);

test('places the lifecycle funnel beside case ageing', () => {
  expect(stationPlacementClass({ definition: { sourceKey: 'stationCases', dimensions: ['status'], visualization: { type: 'funnel' } } }))
    .toBe('station-placement--detail station-placement--lifecycle');
});

test('applies the restrained KSP presentation without changing report semantics', () => {
  const item = { definition: { sourceKey: 'stationCases', visualization: { type: 'pie' }, style: {} } };
  expect(stationPresentation(item).definition.style).toEqual({
    legend: 'right', palette: 'ksp', tableDensity: 'compact', valueLabels: true,
  });
  expect(stationPresentation(item).definition.sourceKey).toBe('stationCases');
});

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
  let clonedItems = [];
  return {
    get: vi.fn(async path => {
      if (path === '/v1/dashboards/D-STATION' || path === '/v1/dashboards/D-OWNED') return { data: { id: path.endsWith('D-OWNED') ? 'D-OWNED' : 'D-STATION', name: 'Station Operations', items: path.endsWith('D-OWNED') ? clonedItems : [
        { id: 'I-1', reportId: 'R-OPEN', column: 1, row: 1, width: 3, height: 2 },
        { id: 'I-2', reportId: 'R-NEW', column: 4, row: 1, width: 3, height: 2 },
        { id: 'I-3', reportId: 'R-AGE', column: 1, row: 3, width: 7, height: 5 },
        { id: 'I-4', reportId: 'R-REGISTER', column: 8, row: 3, width: 5, height: 5 },
      ] } };
      if (path === '/v1/reports') return { data: [] };
      throw new Error(`Unexpected request ${path}`);
    }),
    post: vi.fn(async (path, body) => {
      if (path === '/v1/dashboards/D-STATION/clone') {
        clonedItems = [{ id: 'CLONE-0', reportId: 'R-OPEN', column: 1, row: 1, width: 3, height: 2 }];
        return { data: { id: 'D-OWNED', name: 'Station Operations', description: body.description, relationship: 'OWNED' } };
      }
      return response(path.split('/')[3], body);
    }),
    put: vi.fn(async (path, body) => {
      if (path === '/v1/dashboards/D-OWNED/items') clonedItems = body.items.map((item, index) => ({ id: `CLONE-${index}`, ...item }));
      return { data: clonedItems };
    }),
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
  expect((await screen.findByText('Case Ageing')).closest('.command-center-dashboard-placement')).toHaveClass('station-placement--ageing');
  expect(screen.getByText('Open Case Register').closest('.command-center-dashboard-placement')).toHaveClass('station-placement--register');
});

test('ignores state dashboards and bootstraps a private governed station workspace', async () => {
  const api = bootstrapApi();
  const unsafeWorkspace = {
    ...workspace,
    landingDashboard: { id: 'D-STATE' },
    availableDashboards: [{ id: 'D-STATE', name: 'State Intelligence', relationship: 'SYSTEM' }],
    availableReports: [],
  };
  render(<MemoryRouter><StationOperationsShell api={api} workspace={unsafeWorkspace} /></MemoryRouter>);

  expect(await screen.findByRole('status')).toHaveTextContent('Preparing station dashboard');
  expect(await screen.findByText('Open Cases')).toBeInTheDocument();
  expect(api.get).not.toHaveBeenCalledWith('/v1/dashboards/D-STATE');
  expect(api.put).toHaveBeenCalledWith('/v1/preferences/landing-dashboard', { dashboardId: 'D-BOOTSTRAP' });
  expect(screen.queryByText(/Karnataka district map|State Intelligence/i)).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Edit dashboard' })).toBeEnabled();
});

test('shows a bounded retry state and resumes an incomplete bootstrap without duplicates', async () => {
  const api = bootstrapApi({ failItemsOnce: true });
  const emptyWorkspace = { ...workspace, landingDashboard: undefined, availableDashboards: [], availableReports: [] };
  render(<MemoryRouter><StationOperationsShell api={api} workspace={emptyWorkspace} /></MemoryRouter>);

  expect(await screen.findByRole('alert')).toHaveTextContent('Station dashboard setup could not be completed.');
  expect(screen.queryByText('placement storage unavailable')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Retry setup' }));

  expect(await screen.findByText('Open Cases')).toBeInTheDocument();
  expect(api.post.mock.calls.filter(([path]) => path === '/v1/reports')).toHaveLength(9);
  expect(api.post.mock.calls.filter(([path]) => path === '/v1/dashboards')).toHaveLength(1);
});

test('an inaccessible requested dashboard stays unavailable without bootstrap mutations', async () => {
  const api = bootstrapApi();
  const emptyWorkspace = { ...workspace, landingDashboard: undefined, availableDashboards: [], availableReports: [] };
  render(<MemoryRouter><StationOperationsShell api={api} workspace={emptyWorkspace} requestedDashboardId="D-BLOCKED" /></MemoryRouter>);

  expect(await screen.findByRole('alert')).toHaveTextContent('Requested station dashboard is unavailable.');
  expect(api.get).not.toHaveBeenCalledWith('/v1/reports');
  expect(api.post).not.toHaveBeenCalled();
  expect(api.put).not.toHaveBeenCalled();
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

  expect(screen.getByText('Filter applied: Ageing: 60+ days.')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Clear Ageing: 60+ days filter' })).toBeInTheDocument();
  expect(screen.getByText('11/2026')).toBeInTheDocument();
  expect(screen.queryByText('12/2026')).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Clear Ageing: 60+ days filter' }));
  expect(screen.getByText('Filter cleared.')).toBeInTheDocument();
  expect(screen.getByText('12/2026')).toBeInTheDocument();
});

test('case selection navigates to the prepared detail target and preserves only its governed persona', async () => {
  render(<MemoryRouter initialEntries={['/?persona=STATION_OPERATIONS&token=unsafe']}>
    <StationOperationsShell api={apiHarness()} workspace={workspace} /><LocationProbe />
  </MemoryRouter>);
  fireEvent.click(await screen.findByRole('button', { name: 'Open case 11/2026' }));
  expect(screen.getByTestId('location')).toHaveTextContent('/cases/CASE-1?persona=STATION_OPERATIONS');
});

test('system default clones allowed placements before edit and saves the owned dashboard', async () => {
  const api = apiHarness();
  const baseGet = api.get.getMockImplementation();
  api.get.mockImplementation(async path => path === '/v1/dashboards/D-STATION' ? { data: {
    id: 'D-STATION', name: 'Station Operations', items: [
      { id: 'I-1', reportId: 'R-OPEN', column: 1, row: 1, width: 3, height: 2 },
      { id: 'I-STATE', reportId: 'R-STATE', column: 1, row: 4, width: 12, height: 5 },
    ],
  } } : baseGet(path));
  const guardedWorkspace = { ...workspace, availableReports: [
    ...workspace.availableReports,
    { id: 'R-STATE', name: 'State map', definition: { sourceKey: 'hotspots', visualization: { type: 'map' } } },
  ] };
  render(<MemoryRouter><StationOperationsShell api={api} workspace={guardedWorkspace} /></MemoryRouter>);
  fireEvent.click(await screen.findByRole('button', { name: 'Edit dashboard' }));
  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/v1/dashboards/D-STATION/clone', expect.objectContaining({
    description: expect.any(String),
  })));
  expect(await screen.findByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Move Open Cases right' }));
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

  fireEvent.click(screen.getByRole('button', { name: 'Edit dashboard' }));
  fireEvent.click(screen.getByRole('button', { name: 'Move Open Cases right' }));
  fireEvent.click(screen.getByRole('button', { name: 'Save dashboard' }));
  await waitFor(() => expect(api.put).toHaveBeenCalledWith('/v1/dashboards/D-OWNED/items', expect.objectContaining({ items: expect.arrayContaining([
    expect.objectContaining({ reportId: 'R-OPEN', column: 2 }),
  ]) })));

  cleanup();
  api.get.mockClear();
  const remountedWorkspace = {
    ...workspace,
    landingDashboard: { id: 'D-OWNED' },
    availableDashboards: [{ id: 'D-OWNED', name: 'Station Operations', relationship: 'OWNED' }],
  };
  render(<MemoryRouter><StationOperationsShell api={api} workspace={remountedWorkspace} /></MemoryRouter>);
  expect(await screen.findByText('Open Cases')).toBeInTheDocument();
  expect(api.get).toHaveBeenCalledWith('/v1/dashboards/D-OWNED');
});

test('owned station dashboard enters edit directly without cloning', async () => {
  const api = apiHarness();
  const owned = {
    ...workspace,
    availableDashboards: [{ ...workspace.availableDashboards[0], relationship: 'OWNED', defaultRole: undefined }],
  };
  render(<MemoryRouter><StationOperationsShell api={api} workspace={owned} /></MemoryRouter>);
  fireEvent.click(await screen.findByRole('button', { name: 'Edit dashboard' }));

  expect(await screen.findByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  expect(api.post).not.toHaveBeenCalledWith(expect.stringMatching(/\/clone$/), expect.anything());
});

test('clone failure stays read-only and exposes only a bounded error', async () => {
  const api = apiHarness();
  api.post.mockImplementation(async path => {
    if (path.endsWith('/clone')) throw new Error('private storage detail');
    return response(path.split('/')[3], {});
  });
  render(<MemoryRouter><StationOperationsShell api={api} workspace={workspace} /></MemoryRouter>);
  fireEvent.click(await screen.findByRole('button', { name: 'Edit dashboard' }));

  expect(await screen.findByRole('alert')).toHaveTextContent('A private station dashboard could not be created.');
  expect(screen.queryByText('private storage detail')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Save dashboard' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Edit dashboard' })).toBeEnabled();
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

function bootstrapApi({ failItemsOnce = false } = {}) {
  const state = { reports: [], dashboard: null, landing: null, failedItems: false };
  return {
    get: vi.fn(async path => {
      if (path === '/v1/reports') return { data: structuredClone(state.reports) };
      if (path === '/v1/dashboards') return { data: state.dashboard ? [{ ...state.dashboard, items: undefined }] : [] };
      if (path === '/v1/workspace') return { data: { landingDashboard: state.dashboard?.id === state.landing ? state.dashboard : undefined } };
      if (path === '/v1/dashboards/D-BOOTSTRAP') return { data: structuredClone(state.dashboard) };
      throw new Error(`Unexpected GET ${path}`);
    }),
    post: vi.fn(async (path, body) => {
      if (path === '/v1/reports') {
        const report = { id: `R-${state.reports.length + 1}`, name: body.name, definition: structuredClone(body), relationship: 'OWNED' };
        state.reports.push(report);
        return { data: structuredClone(report) };
      }
      if (path === '/v1/dashboards') {
        state.dashboard = { id: 'D-BOOTSTRAP', ...body, relationship: 'OWNED', visibility: 'PRIVATE', version: 1, items: [] };
        return { data: structuredClone(state.dashboard) };
      }
      const reportId = path.match(/^\/v1\/reports\/([^/]+)\/execute$/)?.[1];
      if (reportId) {
        const report = state.reports.find(item => item.id === reportId);
        return { data: { definition: report, result: { data: { items: [{ recordCount_sum: 1 }] } } } };
      }
      throw new Error(`Unexpected POST ${path}`);
    }),
    put: vi.fn(async (path, body) => {
      if (path === '/v1/dashboards/D-BOOTSTRAP/items') {
        if (failItemsOnce && !state.failedItems) {
          state.failedItems = true;
          throw new Error('placement storage unavailable');
        }
        state.dashboard.items = structuredClone(body.items.map((item, index) => ({ id: `I-${index + 1}`, ...item })));
        return { data: structuredClone(body.items) };
      }
      if (path === '/v1/preferences/landing-dashboard') {
        state.landing = body.dashboardId;
        return { data: { landingDashboardId: body.dashboardId } };
      }
      throw new Error(`Unexpected PUT ${path}`);
    }),
    patch: vi.fn(async (_path, body) => {
      state.dashboard = { ...state.dashboard, name: body.name, description: body.description, version: state.dashboard.version + 1 };
      return { data: structuredClone(state.dashboard) };
    }),
  };
}

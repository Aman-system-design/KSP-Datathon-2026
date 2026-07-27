import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, test, vi } from 'vitest';

import { isPoliceStationReport, PoliceStationDashboardWorkspace } from './PoliceStationDashboardWorkspace.jsx';

afterEach(cleanup);

test('renders a standalone police station dashboard without changing the station homepage', async () => {
  const stationReport = { id: 'R-S', name: 'Open case register', definition: { sourceKey: 'stationCases', visualization: { type: 'table' } } };
  const api = {
    get: vi.fn(async () => ({ data: { id: 'D-S', name: 'Station dashboard', items: [] } })),
    post: vi.fn(), put: vi.fn(), delete: vi.fn(),
  };
  const workspace = {
    role: 'STATION_OPERATIONS', scopeUnit: { name: 'Synthetic Central Police Station' },
    landingDashboard: { id: 'D-S' }, availableDashboards: [{ id: 'D-S', name: 'Station dashboard' }],
    availableReports: [stationReport],
  };
  render(<MemoryRouter><PoliceStationDashboardWorkspace api={api} workspace={workspace} dashboardId="D-S" /></MemoryRouter>);

  expect(await screen.findByRole('heading', { name: 'Police Station Dashboard' })).toBeVisible();
  expect(screen.getByText('Central Police Station')).toBeVisible();
  expect(screen.queryByRole('group', { name: 'Station reporting period' })).not.toBeInTheDocument();
  expect(isPoliceStationReport(stationReport)).toBe(true);
  expect(isPoliceStationReport({ definition: { sourceKey: 'catalog.caseMaster' } })).toBe(false);
});

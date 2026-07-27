import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, test, vi } from 'vitest';

import { AnalystDashboardWorkspace, isAnalystReport } from './AnalystDashboardWorkspace.jsx';

afterEach(cleanup);

test('renders an analyst evidence dashboard and excludes station-only reports', async () => {
  const report = { id: 'R-A', name: 'Anomaly evidence', definition: { sourceKey: 'anomalies', visualization: { type: 'table' } } };
  const api = {
    get: vi.fn(async () => ({ data: { id: 'D-A', name: 'Analyst desk', items: [] } })),
    post: vi.fn(), put: vi.fn(), delete: vi.fn(),
  };
  const workspace = {
    role: 'CRIME_ANALYST', landingDashboard: { id: 'D-A' },
    availableDashboards: [{ id: 'D-A', name: 'Analyst desk' }], availableReports: [report],
  };
  render(<MemoryRouter><AnalystDashboardWorkspace api={api} workspace={workspace} dashboardId="D-A" /></MemoryRouter>);

  expect(await screen.findByRole('heading', { name: 'Analyst Evidence Dashboard' })).toBeVisible();
  expect(screen.getByText(/signals require human review/i)).toBeVisible();
  expect(isAnalystReport(report)).toBe(true);
  expect(isAnalystReport({ definition: { sourceKey: 'stationCases' } })).toBe(false);
});

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, test, vi } from 'vitest';

import { DistrictDashboardWorkspace } from './DistrictDashboardWorkspace.jsx';

afterEach(cleanup);

const districtReport = {
  id: 'R-DISTRICT', name: 'District FIR trend',
  definition: { sourceKey: 'catalog.caseMaster', dimensions: ['IncidentMonth'], measures: [{ field: 'RecordCount', aggregate: 'sum' }], visualization: { type: 'line' } },
};

test('renders an editable district-scoped governed dashboard', async () => {
  const api = {
    get: vi.fn(async path => path === '/v1/reports' ? { data: [
      districtReport,
      { id: 'R-STATION', name: 'Station case register', definition: { sourceKey: 'stationCases', visualization: { type: 'table' } } },
    ] } : { data: { id: 'D-1', name: 'District pulse', items: [
      { id: 'I-1', reportId: 'R-DISTRICT', column: 1, row: 1, width: 6, height: 4 },
    ] } }),
    post: vi.fn(async () => ({ data: {
      definition: districtReport,
      result: { data: { items: [{ IncidentMonth: '2026-07', RecordCount_sum: 18 }] } },
    } })),
    put: vi.fn(async () => ({ data: {} })),
    delete: vi.fn(async () => ({ data: {} })),
  };
  const workspace = {
    role: 'DISTRICT_LEADERSHIP', scopeUnit: { name: 'Mysuru' },
    landingDashboard: { id: 'D-1' }, availableDashboards: [{ id: 'D-1', name: 'District pulse' }],
    availableReports: [districtReport],
  };
  render(<MemoryRouter initialEntries={['/dashboards/D-1?persona=DISTRICT_LEADERSHIP']}>
    <DistrictDashboardWorkspace api={api} workspace={workspace} dashboardId="D-1" />
  </MemoryRouter>);

  expect(await screen.findByRole('heading', { name: 'Mysuru District Intelligence' })).toBeVisible();
  fireEvent.click(await screen.findByRole('button', { name: 'Dashboard options' }));
  fireEvent.click(screen.getByRole('menuitem', { name: 'Edit dashboard' }));
  fireEvent.click(screen.getByRole('button', { name: 'Dashboard options' }));
  fireEvent.click(screen.getByRole('menuitem', { name: 'Add chart' }));

  expect(await screen.findByRole('button', { name: 'Add District FIR trend' })).toBeVisible();
  expect(screen.getByRole('button', { name: 'Add Station case register' })).toBeVisible();
  expect(screen.getByRole('link', { name: 'Create new report' }))
    .toHaveAttribute('href', '/reports/new?persona=DISTRICT_LEADERSHIP&returnTo=dashboards');
});

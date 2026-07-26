import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, test, vi } from 'vitest';

import { StateLeadershipDashboard } from './StateLeadershipDashboard.jsx';

afterEach(cleanup);

const ownedWorkspace = {
  role: 'STATE_LEADERSHIP', landingDashboard: { id: 'D-STATE' },
  availableDashboards: [{ id: 'D-STATE', name: 'State Crime Intelligence', relationship: 'OWNED' }],
};

const dashboard = {
  id: 'D-STATE', name: 'State Crime Intelligence', defaultRole: 'STATE_LEADERSHIP',
  items: [{ id: 'I-1', reportId: 'R-1', column: 1, row: 1, width: 6, height: 4 }],
};

function apiWithDashboard({ relationship = 'OWNED', failSecond = false } = {}) {
  const activeDashboard = failSecond ? { ...dashboard, items: [...dashboard.items, { id: 'I-2', reportId: 'R-2', column: 7, row: 1, width: 6, height: 4 }] } : dashboard;
  return {
    workspace: { ...ownedWorkspace, availableDashboards: [{ ...ownedWorkspace.availableDashboards[0], relationship }] },
    api: {
      get: vi.fn(async path => ({ data: path === '/v1/reports' ? [{ id: 'R-3', name: 'District volume', definition: { dimensions: ['district'], measures: [{ field: 'cases', aggregate: 'sum' }], visualization: { type: 'bar' } } }] : activeDashboard })),
      post: vi.fn(async path => {
        if (failSecond && path.includes('R-2')) throw Object.assign(new Error('failed'), { code: 'REPORT_FAILED' });
        return { data: { definition: { name: 'Crime Category Share', definition: { name: 'Crime Category Share', dimensions: ['category'], measures: [{ field: 'cases', aggregate: 'sum' }], visualization: { type: 'pie', variant: 'doughnut' }, style: { legend: 'right', valueLabels: true } } }, result: { data: { items: [{ category: 'Theft', cases_sum: 28 }, { category: 'Violence', cases_sum: 20 }] } } } };
      }),
      put: vi.fn(async () => ({ data: [] })),
    },
  };
}

test('keeps the leadership heading visible while the shared dashboard loads', () => {
  const api = { get: vi.fn(() => new Promise(() => {})), post: vi.fn(), put: vi.fn() };
  render(<MemoryRouter><StateLeadershipDashboard api={api} workspace={ownedWorkspace} /></MemoryRouter>);
  expect(screen.getByRole('heading', { name: 'State Intelligence Brief' })).toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent('Loading shared dashboard');
  expect(screen.queryByText('Data as of')).not.toBeInTheDocument();
});

test('renders an interactive governed report and shared dashboard editing controls', async () => {
  const { api, workspace } = apiWithDashboard();
  render(<MemoryRouter initialEntries={['/?persona=STATE_LEADERSHIP']}><StateLeadershipDashboard api={api} workspace={workspace} /></MemoryRouter>);
  expect(await screen.findByTestId('report-pie-chart')).toBeInTheDocument();
  const theft = within(screen.getByTestId('report-legend')).getByRole('button', { name: /Theft/ });
  fireEvent.click(theft);
  expect(screen.getByRole('region', { name: 'Selected category' })).toHaveTextContent('28');

  fireEvent.click(screen.getByRole('button', { name: 'Edit dashboard' }));
  expect(screen.getByText('Shared role default')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Add report' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Resize Crime Category Share' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Edit Crime Category Share report' })).toHaveAttribute('href', '/reports/R-1?persona=STATE_LEADERSHIP&returnTo=state-leadership');
  expect(screen.getByRole('button', { name: 'Remove Crime Category Share report' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Save changes' })).toBeInTheDocument();
});

test('keeps shared system dashboards view-only for ordinary State Leadership viewers', async () => {
  const { api, workspace } = apiWithDashboard({ relationship: 'SYSTEM' });
  render(<MemoryRouter><StateLeadershipDashboard api={api} workspace={workspace} /></MemoryRouter>);
  expect(await screen.findByTestId('report-pie-chart')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Edit dashboard' })).not.toBeInTheDocument();
});

test('contains a failed report without hiding successful dashboard intelligence', async () => {
  const { api, workspace } = apiWithDashboard({ failSecond: true });
  render(<MemoryRouter><StateLeadershipDashboard api={api} workspace={workspace} /></MemoryRouter>);
  expect(await screen.findByTestId('report-pie-chart')).toBeInTheDocument();
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Other dashboard intelligence remains available'));
});

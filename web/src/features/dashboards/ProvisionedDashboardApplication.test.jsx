import { render, screen } from '@testing-library/react';
import { expect, test, vi } from 'vitest';

import { ProvisionedDashboardApplication } from './ProvisionedDashboardApplication.jsx';

test('renders the application with the refreshed dashboard workspace', async () => {
  const dashboard = { id: 'D-A', name: 'Crime Analyst Dashboard', description: '[ACE:crime-analyst:v1:complete]', relationship: 'OWNED' };
  const api = {
    get: vi.fn(async path => {
      if (path === '/v1/reports' || path === '/v1/dashboards') return { data: path.endsWith('dashboards') ? [dashboard] : [] };
      if (path === '/v1/workspace') return { data: { role: 'CRIME_ANALYST', availableDashboards: [dashboard] } };
      throw new Error(`Unexpected ${path}`);
    }),
  };
  render(<ProvisionedDashboardApplication api={api} workspace={{ role: 'CRIME_ANALYST', availableDashboards: [dashboard] }}>
    {workspace => <output>{workspace.availableDashboards.map(value => value.name).join('|')}</output>}
  </ProvisionedDashboardApplication>);
  expect(await screen.findByText('Crime Analyst Dashboard')).toBeInTheDocument();
});

test('shows a setup gate while a matching dashboard is missing', () => {
  const api = { get: vi.fn(() => new Promise(() => {})) };
  render(<ProvisionedDashboardApplication api={api} workspace={{ role: 'DISTRICT_LEADERSHIP', availableDashboards: [] }}>
    {() => <output>Application</output>}
  </ProvisionedDashboardApplication>);
  expect(screen.getByRole('status', { name: 'Preparing governed dashboardâ€¦' })).toHaveTextContent('Preparing governed dashboard');
  expect(screen.queryByText('Application')).not.toBeInTheDocument();
});

test('keeps the application usable and exposes only bounded setup failure details', async () => {
  const workspace = { role: 'CRIME_ANALYST', availableDashboards: [] };
  const api = { get: vi.fn(async path => {
    if (path === '/v1/reports') throw Object.assign(new Error('private infrastructure detail'), { code: 'DATA_NOT_READY' });
    if (path === '/v1/workspace') return { data: workspace };
    return { data: [] };
  }) };
  render(<ProvisionedDashboardApplication api={api} workspace={workspace}>
    {() => <output>Application</output>}
  </ProvisionedDashboardApplication>);

  expect(await screen.findByText('Application')).toBeInTheDocument();
  expect(screen.getByRole('alert')).toHaveTextContent('Dashboard setup incomplete');
  expect(screen.getByRole('alert')).toHaveTextContent('crime-analyst/v1 · DATA_NOT_READY');
  expect(screen.getByRole('alert')).not.toHaveTextContent('private infrastructure detail');
});

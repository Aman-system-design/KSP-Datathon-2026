import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, test, vi } from 'vitest';

import { PersonaDashboardHome, personaHomeDashboard } from './PersonaDashboardHome.jsx';

afterEach(cleanup);

test.each([
  ['DISTRICT_LEADERSHIP', 'District Intelligence Dashboard', 'D-DISTRICT'],
  ['CRIME_ANALYST', 'Crime Analyst Dashboard', 'D-ANALYST'],
])('selects the provisioned %s dashboard for home', (role, name, id) => {
  const workspace = { role, availableDashboards: [{ id, name }] };
  expect(personaHomeDashboard(workspace)).toEqual({ id, name });
});

test('falls back safely when the persona dashboard is unavailable', () => {
  render(<MemoryRouter><PersonaDashboardHome api={{}} workspace={{ role: 'CRIME_ANALYST', availableDashboards: [] }} fallback={<p>Existing home</p>} /></MemoryRouter>);
  expect(screen.getByText('Existing home')).toBeVisible();
});

test('renders the selected persona dashboard on home', async () => {
  const api = {
    get: vi.fn(async () => ({ data: { id: 'D-DISTRICT', name: 'District Intelligence Dashboard', items: [] } })),
    post: vi.fn(), put: vi.fn(), delete: vi.fn(),
  };
  const workspace = {
    role: 'DISTRICT_LEADERSHIP', scopeUnit: { name: 'Mysuru' },
    availableDashboards: [{ id: 'D-DISTRICT', name: 'District Intelligence Dashboard' }], availableReports: [],
  };
  render(<MemoryRouter><PersonaDashboardHome api={api} workspace={workspace} fallback={<p>Existing home</p>} /></MemoryRouter>);
  expect(await screen.findByRole('heading', { name: 'Mysuru District Intelligence' })).toBeVisible();
});

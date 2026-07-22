import { cleanup, render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, expect, test, vi } from 'vitest';

import { AlertsPage, Application, Failure } from './router.jsx';

vi.mock('../features/geospatial/GeospatialStudio.jsx', () => ({
  default: function FakeGeospatialStudio({ api }) {
    const [status, setStatus] = React.useState('Loading authorized geospatial datasets');
    React.useEffect(() => {
      api.get('/v1/geospatial/datasets').then(result => {
        const items = result.data?.items ?? [];
        setStatus(items.length ? `Geospatial Studio: ${items.map(item => item.name).join(', ')}` : 'No authorized geospatial datasets');
      });
    }, [api]);
    return <h1>{status}</h1>;
  },
}));

afterEach(cleanup);

const analystWorkspace = {
  role: 'CRIME_ANALYST', scopeUnitId: 101, syntheticData: false,
  availableDashboards: [], alertSummary: { total: 0 },
};

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}</output>;
}

test('failure state never exposes an internal JavaScript error', () => {
  render(<Failure error={new TypeError("Cannot read properties of undefined (reading 'items')")} />);

  expect(screen.getByText('The request could not be completed.')).toBeInTheDocument();
  expect(screen.queryByText(/Cannot read properties/)).not.toBeInTheDocument();
});

test('alerts page treats a missing collection as an empty authorized result', async () => {
  const api = { get: vi.fn(async () => ({ data: {} })) };
  render(<MemoryRouter><AlertsPage api={api} /></MemoryRouter>);

  expect(await screen.findByText('No alerts are visible in the current authorized scope.')).toBeInTheDocument();
  expect(screen.queryByText('Intelligence is unavailable')).not.toBeInTheDocument();
});

test('unauthenticated workspace renders native Catalyst sign-in without protected navigation', async () => {
  const api = { get: vi.fn(async () => { throw Object.assign(new Error('Authentication is required.'), { status: 401, code: 'UNAUTHENTICATED' }); }) };
  render(<MemoryRouter><Application api={api} /></MemoryRouter>);

  expect(await screen.findByRole('heading', { name: 'Sign in to continue' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Sign in with Catalyst' })).toHaveAttribute('href', '/__catalyst/auth/login');
  expect(screen.queryByRole('navigation', { name: 'Platform modules' })).not.toBeInTheDocument();
});

test('authenticated user without an access profile receives safe provisioning guidance', async () => {
  const api = { get: vi.fn(async () => { throw Object.assign(new Error('Internal profile detail'), { status: 403, code: 'INACTIVE_ACCESS_PROFILE', requestId: 'REQ-403' }); }) };
  render(<MemoryRouter><Application api={api} /></MemoryRouter>);

  expect(await screen.findByRole('heading', { name: 'Access is not provisioned' })).toBeInTheDocument();
  expect(screen.getByText('REQ-403')).toBeInTheDocument();
  expect(screen.queryByText('Internal profile detail')).not.toBeInTheDocument();
  expect(screen.queryByRole('navigation', { name: 'Platform modules' })).not.toBeInTheDocument();
});

test('demo presenter lands on persona directory without requesting unauthorized intelligence', async () => {
  const api = { get: vi.fn(async path => {
    if (path === '/v1/workspace') return { data: { role: 'DEMO_PRESENTER', scopeUnitId: 1, syntheticData: true, availableDashboards: [], alertSummary: { total: 0 } } };
    throw new Error(`Unexpected request: ${path}`);
  }) };
  render(<MemoryRouter><Application api={api} /></MemoryRouter>);

  expect(await screen.findByRole('heading', { name: 'Persona Workspaces', level: 1 })).toBeInTheDocument();
  expect(api.get).toHaveBeenCalledTimes(1);
});

test('authorized workspace lazy-loads Geospatial Studio from the governed catalog', async () => {
  const api = { get: vi.fn(async path => {
    if (path === '/v1/workspace') return { data: analystWorkspace };
    if (path === '/v1/geospatial/datasets') return { data: { items: [{ id: 'hotspots', name: 'Crime hotspots' }] } };
    throw new Error(`Unexpected request: ${path}`);
  }) };

  render(<MemoryRouter initialEntries={['/geospatial']}><Application api={api} /></MemoryRouter>);

  expect(await screen.findByRole('heading', { name: 'Geospatial Studio: Crime hotspots' })).toBeInTheDocument();
  expect(api.get).toHaveBeenCalledWith('/v1/geospatial/datasets');
  expect(screen.getByRole('navigation', { name: 'Platform modules' })).toBeInTheDocument();
});

test('profile without a spatial dataset action receives an empty Studio without catalog leakage', async () => {
  const api = { get: vi.fn(async path => {
    if (path === '/v1/workspace') return { data: analystWorkspace };
    if (path === '/v1/geospatial/datasets') return { data: { items: [] } };
    throw new Error(`Unexpected request: ${path}`);
  }) };

  render(<MemoryRouter initialEntries={['/geospatial']}><Application api={api} /></MemoryRouter>);

  expect(await screen.findByRole('heading', { name: 'No authorized geospatial datasets' })).toBeInTheDocument();
  expect(screen.queryByText(/hotspot|anomal|area risk/i)).not.toBeInTheDocument();
});

test('legacy maps route redirects to the canonical geospatial workspace', async () => {
  const api = { get: vi.fn(async path => {
    if (path === '/v1/workspace') return { data: analystWorkspace };
    if (path === '/v1/geospatial/datasets') return { data: { items: [] } };
    throw new Error(`Unexpected request: ${path}`);
  }) };

  render(<MemoryRouter initialEntries={['/maps']}>
    <Application api={api} /><LocationProbe />
  </MemoryRouter>);

  expect(await screen.findByRole('heading', { name: 'No authorized geospatial datasets' })).toBeInTheDocument();
  expect(screen.getByTestId('location')).toHaveTextContent('/geospatial');
});

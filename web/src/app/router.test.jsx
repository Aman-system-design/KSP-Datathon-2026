import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { lazy } from 'react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, expect, test, vi } from 'vitest';

import { AlertsPage, Application, Failure, GeospatialPage } from './router.jsx';

vi.mock('../features/geospatial/MapCanvas.jsx', () => ({
  MapCanvas: () => <div role="region" aria-label="Geospatial intelligence map" />,
}));

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const analystWorkspace = {
  role: 'CRIME_ANALYST', scopeUnitId: 101, syntheticData: false,
  availableDashboards: [], alertSummary: { total: 0 },
};

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}{location.search}{location.hash}</output>;
}

const geospatialApi = ({ datasets = [], datasetError } = {}) => ({
  get: vi.fn(async path => {
    if (path === '/v1/workspace') return { data: analystWorkspace };
    if (path === '/v1/geospatial/datasets') {
      if (datasetError) throw datasetError;
      return { data: { items: datasets } };
    }
    if (path === '/v1/geospatial/views') return { data: { items: [] } };
    throw new Error(`Unexpected request: ${path}`);
  }),
  post: vi.fn(),
});

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
  const api = geospatialApi({ datasets: [{
    id: 'hotspots', name: 'Crime hotspots', description: 'Authorized output',
    geometryType: 'POINT', spatialStatus: 'AVAILABLE', fields: {},
  }] });

  render(<MemoryRouter initialEntries={['/geospatial']}><Application api={api} /></MemoryRouter>);

  expect(await screen.findByRole('heading', { name: 'Geospatial Studio' })).toBeInTheDocument();
  expect(await screen.findByText('Crime hotspots')).toBeInTheDocument();
  expect(api.get).toHaveBeenCalledWith('/v1/geospatial/datasets');
  expect(screen.getByRole('navigation', { name: 'Platform modules' })).toBeInTheDocument();
});

test('profile without a spatial dataset action receives an empty Studio without catalog leakage', async () => {
  const api = geospatialApi();

  render(<MemoryRouter initialEntries={['/geospatial']}><Application api={api} /></MemoryRouter>);

  expect(await screen.findByRole('heading', { name: 'Geospatial Studio' })).toBeInTheDocument();
  expect(await screen.findByText('Add an authorized dataset to begin.')).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Datasets' }).parentElement).toHaveTextContent('0');
  expect(screen.queryByText(/hotspot|anomal|area risk/i)).not.toBeInTheDocument();
});

test('catalog authorization failure stays inside Studio and exposes no hidden dataset names', async () => {
  const api = geospatialApi({ datasetError: Object.assign(new Error('The request could not be completed.'), { status: 403, code: 'FORBIDDEN_ACTION' }) });
  render(<MemoryRouter initialEntries={['/geospatial']}><Application api={api} /></MemoryRouter>);

  expect(await screen.findByRole('heading', { name: 'Geospatial Studio' })).toBeInTheDocument();
  expect(await screen.findByText('The request could not be completed.')).toBeInTheDocument();
  expect(screen.queryByText(/hotspot|anomal|area risk/i)).not.toBeInTheDocument();
  expect(screen.getByRole('navigation', { name: 'Platform modules' })).toBeInTheDocument();
});

test('legacy maps route redirects to the canonical geospatial workspace', async () => {
  const api = geospatialApi();

  render(<MemoryRouter initialEntries={['/maps?persona=CRIME_ANALYST&token=unsafe#evidence']}>
    <Application api={api} /><LocationProbe />
  </MemoryRouter>);

  expect(await screen.findByRole('heading', { name: 'Geospatial Studio' })).toBeInTheDocument();
  expect(screen.getByTestId('location')).toHaveTextContent('/geospatial?persona=CRIME_ANALYST#evidence');
  expect(screen.getByTestId('location')).not.toHaveTextContent('token');
});

test('governed persona reaches workspace and Studio API requests through the same identity header', async () => {
  const fetch = vi.fn(async (url, options) => {
    const path = String(url).replace('/server/crime_intelligence_api', '');
    const data = path === '/v1/workspace' ? analystWorkspace
      : path === '/v1/alerts' || path === '/v1/geospatial/datasets' || path === '/v1/geospatial/views' ? { items: [] }
        : null;
    if (data === null) throw new Error(`Unexpected request: ${path}`);
    return { ok: true, status: 200, json: async () => ({ data }) };
  });
  vi.stubGlobal('fetch', fetch);

  render(<MemoryRouter initialEntries={['/alerts?persona=CRIME_ANALYST']}><Application /><LocationProbe /></MemoryRouter>);

  expect(await screen.findByText('No alerts are visible in the current authorized scope.')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('link', { name: 'Geospatial' }));
  expect(await screen.findByRole('heading', { name: 'Geospatial Studio' })).toBeInTheDocument();
  expect(screen.getByTestId('location')).toHaveTextContent('/geospatial?persona=CRIME_ANALYST');
  expect(fetch).toHaveBeenCalledTimes(4);
  for (const [, options] of fetch.mock.calls) expect(options.headers['X-Demo-Persona']).toBe('CRIME_ANALYST');
});

test('geospatial route failure is contained and offers a safe reload without blanking its parent shell', () => {
  const reload = vi.fn();
  const ThrowingStudio = () => { throw new Error('private module path'); };
  vi.spyOn(console, 'error').mockImplementation(() => {});
  render(<MemoryRouter><div><span>Shell remains</span><GeospatialPage api={geospatialApi()} Studio={ThrowingStudio} reload={reload} /></div></MemoryRouter>);

  expect(screen.getByText('Shell remains')).toBeInTheDocument();
  expect(screen.getByRole('alert')).toHaveTextContent('Geospatial workspace is unavailable');
  screen.getByRole('button', { name: 'Reload map workspace' }).click();
  expect(reload).toHaveBeenCalledOnce();
  expect(screen.queryByText('private module path')).not.toBeInTheDocument();
  console.error.mockRestore();
});

test('rejected lazy Studio module is contained without blanking the route shell', async () => {
  const RejectedStudio = lazy(() => Promise.reject(new Error('private chunk URL')));
  const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});
  render(<MemoryRouter><div><span>Shell remains</span><GeospatialPage api={geospatialApi()} Studio={RejectedStudio} reload={vi.fn()} /></div></MemoryRouter>);

  expect(await screen.findByRole('alert')).toHaveTextContent('Geospatial workspace is unavailable');
  expect(screen.getByText('Shell remains')).toBeInTheDocument();
  expect(screen.queryByText('private chunk URL')).not.toBeInTheDocument();
  errorLog.mockRestore();
});

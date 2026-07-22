import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, test, vi } from 'vitest';

import { DashboardPage } from '../../app/router.jsx';

afterEach(cleanup);

test('dashboard page executes each configured report in viewer scope', async () => {
  const api = {
    get: vi.fn(async () => ({ data: { id: 'D-1', name: 'District command', items: [{ id: 'I-1', reportId: 'R-1' }] } })),
    post: vi.fn(async () => ({ data: { definition: { name: 'Active anomalies' }, result: { data: { items: [{ unitId: 101, observed_sum: 12 }] } } } })),
  };

  render(<MemoryRouter><DashboardPage api={api} dashboardId="D-1" /></MemoryRouter>);

  expect(await screen.findByRole('heading', { name: 'District command' })).toBeInTheDocument();
  expect(screen.getByText('12')).toBeInTheDocument();
  expect(api.post).toHaveBeenCalledWith('/v1/reports/R-1/execute', {});
});

test('dashboard page preserves governed map execution without exposing saved-view ownership', async () => {
  const mapExecution = {
    mapView: { id: 'MAP-1', name: 'Hotspots', visibility: 'SHARED', version: 1, definition: { layers: [] } },
    executions: [],
  };
  const api = {
    get: vi.fn(async () => ({ data: { id: 'D-1', name: 'Map desk', items: [{ id: 'I-1', reportId: 'R-MAP' }] } })),
    post: vi.fn(async () => ({ data: {
      definition: { name: 'Hotspots', definition: { visualization: { type: 'map' } } },
      result: { data: mapExecution },
    } })),
  };
  function TestMap({ mapExecution: execution }) { return <div>Map {execution.mapView.id}</div>; }

  render(<MemoryRouter><DashboardPage api={api} dashboardId="D-1" EmbeddedMapComponent={TestMap} /></MemoryRouter>);

  expect(await screen.findByText('Map MAP-1')).toBeInTheDocument();
});

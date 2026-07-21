import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { expect, test, vi } from 'vitest';

import { DashboardPage } from '../../app/router.jsx';

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

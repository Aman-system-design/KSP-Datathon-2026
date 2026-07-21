import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

import { DashboardWorkspace } from './DashboardWorkspace.jsx';

test('dashboard renders governed widgets and isolates a failed widget', () => {
  render(<MemoryRouter><DashboardWorkspace dashboard={{ name: 'District command', items: [
    { id: 'I-1', reportId: 'R-1', title: 'Active anomalies', status: 'ready', data: [{ unitId: 101, observed_sum: 12 }] },
    { id: 'I-2', reportId: 'R-2', title: 'Hotspot movement', status: 'error' },
  ] }} /></MemoryRouter>);
  expect(screen.getByRole('heading', { name: 'District command' })).toBeInTheDocument();
  expect(screen.getByText('12')).toBeInTheDocument();
  expect(screen.getByText('Unit 101')).toBeInTheDocument();
  expect(screen.getByText(/widget unavailable/i)).toBeInTheDocument();
  expect(screen.getAllByRole('link', { name: /open evidence/i })).toHaveLength(2);
});

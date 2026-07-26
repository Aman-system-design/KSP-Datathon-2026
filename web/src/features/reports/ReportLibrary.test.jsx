import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, test, vi } from 'vitest';

import { ReportLibrary } from './ReportLibrary.jsx';

afterEach(cleanup);

test('lists real saved reports and filters the catalogue without fake actions', async () => {
  const api = { get: vi.fn(async () => ({ data: [
    { id: 'R-1', name: 'District anomaly watch', visibility: 'PRIVATE', updatedAt: '2026-07-24T08:00:00Z', definition: { sourceKey: 'anomalies', visualization: { type: 'table' } } },
    { id: 'R-2', name: 'State hotspot posture', visibility: 'GLOBAL', updatedAt: '2026-07-24T09:00:00Z', definition: { sourceKey: 'hotspots', visualization: { type: 'map' } } },
  ] })) };

  render(<MemoryRouter><ReportLibrary api={api} /></MemoryRouter>);
  expect(await screen.findByRole('link', { name: 'District anomaly watch' })).toHaveAttribute('href', '/reports/R-1');
  expect(screen.getByRole('link', { name: 'State hotspot posture' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /favorite/i })).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Search reports'), { target: { value: 'hotspot' } });
  expect(screen.queryByRole('link', { name: 'District anomaly watch' })).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'State hotspot posture' })).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Search reports'), { target: { value: '' } });
  fireEvent.click(screen.getByRole('button', { name: 'Organization' }));
  expect(screen.queryByRole('link', { name: 'District anomaly watch' })).not.toBeInTheDocument();
});

test('preserves the active persona when opening report authoring and saved reports', async () => {
  const api = { get: vi.fn(async () => ({ data: [
    { id: 'R-1', name: 'District anomaly watch', visibility: 'PRIVATE', definition: { sourceKey: 'anomalies', visualization: { type: 'table' } } },
  ] })) };

  render(<MemoryRouter initialEntries={['/reports?persona=CRIME_ANALYST']}><ReportLibrary api={api} /></MemoryRouter>);

  expect(await screen.findByRole('link', { name: 'District anomaly watch' })).toHaveAttribute('href', '/reports/R-1?persona=CRIME_ANALYST');
  expect(screen.getByRole('link', { name: 'Create report' })).toHaveAttribute('href', '/reports/new?persona=CRIME_ANALYST');
});

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

import { DashboardWorkspace } from './DashboardWorkspace.jsx';

afterEach(cleanup);

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

test('dashboard embeds a governed map lazily without affecting sibling reports', () => {
  function TestMap({ mapExecution }) { return <div>Read-only map {mapExecution.mapView.id}</div>; }
  render(<MemoryRouter><DashboardWorkspace api={{}} EmbeddedMapComponent={TestMap} dashboard={{ name: 'District command', items: [
    { id: 'I-1', reportId: 'R-1', title: 'Active anomalies', status: 'ready', data: [{ unitId: 101, observed_sum: 12 }] },
    { id: 'I-2', reportId: 'R-2', title: 'Hotspot movement', status: 'ready', visualization: 'map', mapExecution: { mapView: { id: 'MAP-1' }, executions: [] } },
    { id: 'I-3', reportId: 'R-3', title: 'Unavailable map', status: 'error', visualization: 'map' },
  ] }} /></MemoryRouter>);

  expect(screen.getByText('Read-only map MAP-1')).toBeInTheDocument();
  expect(screen.getByText('12')).toBeInTheDocument();
  expect(screen.getByText(/widget unavailable/i)).toBeInTheDocument();
});

test('dashboard evidence links preserve only the governed persona query', () => {
  render(<MemoryRouter initialEntries={['/dashboards/D-1?persona=CRIME_ANALYST&token=drop-me']}><DashboardWorkspace dashboard={{
    name: 'Analyst desk', items: [{ id: 'I-1', reportId: 'R-1', title: 'Anomalies', status: 'ready', data: [] }],
  }} /></MemoryRouter>);

  expect(screen.getByRole('link', { name: 'Open evidence' })).toHaveAttribute('href', '/reports/R-1?persona=CRIME_ANALYST');
});

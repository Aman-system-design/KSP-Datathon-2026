import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, test } from 'vitest';

import { CrimeAnalystDashboard } from './CrimeAnalystDashboard.jsx';

afterEach(cleanup);

test('organises analyst work around change, concentration, timing and evidence', () => {
  render(<MemoryRouter><CrimeAnalystDashboard data={{ anomalies: [{ id: 'A-1', label: 'Vehicle theft change', observed: 27, expected: 11, confidence: .91, utility: 'Hotspot Detection' }] }} /></MemoryRouter>);
  expect(screen.getByRole('heading', { name: 'What changed' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Where it concentrates' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'When it occurs' })).toBeInTheDocument();
  expect(screen.getByText('Hotspot Detection')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Open supporting evidence' })).toHaveAttribute('href', '/alerts');
  expect(screen.getByRole('link', { name: 'Open geospatial analysis' })).toHaveAttribute('href', '/geospatial');
  expect(screen.getByRole('link', { name: 'Open network analysis' })).toHaveAttribute('href', '/networks');
  expect(screen.getByRole('link', { name: 'Open governed utilities' })).toHaveAttribute('href', '/utilities');
});

test('does not invent findings when no governed signal is returned', () => {
  render(<MemoryRouter><CrimeAnalystDashboard data={{ partial: true }} /></MemoryRouter>);
  expect(screen.getByText(/some analyst evidence is unavailable/i)).toBeInTheDocument();
  expect(screen.getByText(/no governed finding is available/i)).toBeInTheDocument();
});

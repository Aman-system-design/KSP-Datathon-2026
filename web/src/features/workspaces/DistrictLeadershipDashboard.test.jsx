import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, test } from 'vitest';

import { DistrictLeadershipDashboard } from './DistrictLeadershipDashboard.jsx';

afterEach(cleanup);

test('shows a district-scoped operational pulse and governed destinations', () => {
  render(<MemoryRouter><DistrictLeadershipDashboard data={{ scopeName: 'Mysuru District' }} /></MemoryRouter>);
  expect(screen.getByRole('heading', { name: 'Mysuru District operational pulse' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Monthly FIR trend' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Station concentration' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Crime mix' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Lifecycle health' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Open district map' })).toHaveAttribute('href', '/geospatial');
  expect(screen.getByRole('link', { name: 'Open reports' })).toHaveAttribute('href', '/reports');
  expect(screen.getByRole('link', { name: 'Open utilities' })).toHaveAttribute('href', '/utilities');
  expect(screen.queryByText(/all karnataka/i)).not.toBeInTheDocument();
});

test('uses honest unavailable states when scoped reports have no rows', () => {
  render(<MemoryRouter><DistrictLeadershipDashboard data={{ partial: true }} /></MemoryRouter>);
  expect(screen.getByText(/some district intelligence is unavailable/i)).toBeInTheDocument();
  expect(screen.getAllByText(/no governed result is available/i)).toHaveLength(4);
});

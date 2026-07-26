import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, test } from 'vitest';

import { CommandCenterIntelligence } from './CommandCenterIntelligence.jsx';

afterEach(cleanup);

test('presents operational intelligence rather than a leadership dashboard or report library', () => {
  render(<MemoryRouter initialEntries={['/intelligence?persona=COMMAND_CENTER']}><CommandCenterIntelligence data={{
    anomalies: [{ id: 'A-1', label: 'Vehicle theft movement', observed: 27, expected: 11, confidence: .91 }],
    hotspots: [{ id: 'H-1', area: 'Central corridor', caseCount: 6, severity: .82 }],
    risk: { limitation: 'Area and time risk only.' },
  }} /></MemoryRouter>);
  expect(screen.getByRole('heading', { name: 'Operational Intelligence' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'What changed' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Where it concentrates' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'When it occurs' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Connections' })).toBeInTheDocument();
  expect(screen.getByText('Vehicle theft movement')).toBeInTheDocument();
  expect(screen.getByText('Central corridor')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Open governed reports' })).toHaveAttribute('href', '/reports?persona=COMMAND_CENTER');
  expect(screen.queryByText(/state leadership/i)).not.toBeInTheDocument();
});

test('shows honest operational empty states', () => {
  render(<MemoryRouter><CommandCenterIntelligence data={{}} /></MemoryRouter>);
  expect(screen.getByText(/no current change signal/i)).toBeInTheDocument();
  expect(screen.getByText(/no hotspot result/i)).toBeInTheDocument();
});

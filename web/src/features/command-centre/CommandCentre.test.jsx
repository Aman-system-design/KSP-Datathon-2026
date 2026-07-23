import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { expect, test } from 'vitest';

import { CommandCentre } from './CommandCentre.jsx';

test('command centre is a presentation-safe aggregate view', () => {
  render(<MemoryRouter><CommandCentre synthetic freshness="21 Jul 2026, 23:15 IST" data={{
    brief: { executiveSummary: 'One verified pattern requires coordinated review.' },
    anomalies: [{ id: 'A-1', label: 'Vehicle theft change', observed: 27, expected: 11, confidence: 0.91 }],
    hotspots: [{ id: 'H-1', area: 'Central corridor', caseCount: 6, severity: 0.82 }],
  }} /></MemoryRouter>);

  expect(screen.getByRole('heading', { name: 'KSP ACE Command Centre' })).toBeInTheDocument();
  expect(screen.getByText('21 Jul 2026, 23:15 IST')).toBeInTheDocument();
  expect(screen.getByText(/synthetic demonstration/i)).toBeInTheDocument();
  expect(screen.getByText('Vehicle theft change')).toBeInTheDocument();
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /assign|note|conclude|build report/i })).not.toBeInTheDocument();
});

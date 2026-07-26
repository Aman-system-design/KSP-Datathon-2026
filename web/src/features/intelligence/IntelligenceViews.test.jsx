import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

import { LeadershipView } from './LeadershipView.jsx';

afterEach(cleanup);

test('leadership workspace renders the approved report-led state brief', () => {
  render(<MemoryRouter><LeadershipView data={{
    brief: { patternCount: 1, executiveSummary: 'One evidence-linked pattern requires human review.' },
    anomalies: [{ id: 'A-1', label: 'Vehicle theft', observed: 27, expected: 11, confidence: 0.91 }],
    hotspots: [{ id: 'H-1', area: 'Central corridor', caseCount: 6, severity: 0.82 }],
    risk: { score: 86, components: { recency: 0.7, anomaly: 0.8 }, limitation: 'Area and time risk only.' },
  }} /></MemoryRouter>);
  expect(screen.getByRole('heading', { name: 'State Intelligence Brief' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Crime category composition' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'District crime volume & movement' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: '24-hour crime occurrence curve' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Crime-mix divergence from state baseline' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Leadership intervention queue' })).toBeInTheDocument();
  expect(screen.getByText('Category mix')).toBeInTheDocument();
  expect(screen.queryByText(/2,486\s+FIRs/i)).not.toBeInTheDocument();
  expect(screen.getByText(/expected baseline 11/i)).toBeInTheDocument();
  expect(screen.getByText(/area and time risk only/i)).toBeInTheDocument();
  expect(screen.getByText('86')).toBeInTheDocument();
  expect(screen.getByText(/6 contributing cases/i)).toBeInTheDocument();
  expect(screen.queryByText('18 linked cases')).not.toBeInTheDocument();
  expect(screen.getAllByRole('link', { name: /inspect evidence/i }).length).toBeGreaterThan(0);
  expect(screen.getByText(/complete 31-district command matrix/i)).toBeInTheDocument();
});

test('leadership workspace never converts missing evidence into a zero score', () => {
  render(<MemoryRouter><LeadershipView data={{
    anomalies: [{ id: 'A-1', label: 'Incomplete result' }],
    hotspots: [{ id: 'H-1', area: 'Central corridor' }],
  }} /></MemoryRouter>);

  expect(screen.getAllByText('Unavailable').length).toBeGreaterThan(0);
  expect(screen.queryByText('0%')).not.toBeInTheDocument();
  expect(screen.queryByText(/0 contributing cases/i)).not.toBeInTheDocument();
});

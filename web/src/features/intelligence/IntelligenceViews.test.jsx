import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

import { LeadershipView } from './LeadershipView.jsx';

test('leadership workspace prioritizes explainable crime intelligence over generic totals', () => {
  render(<MemoryRouter><LeadershipView data={{
    brief: { patternCount: 1, executiveSummary: 'One evidence-linked pattern requires human review.' },
    anomalies: [{ id: 'A-1', label: 'Vehicle theft', observed: 27, expected: 11, confidence: 0.91 }],
    hotspots: [{ id: 'H-1', area: 'Central corridor', caseCount: 6, severity: 0.82 }],
    risk: { score: 86, components: { recency: 0.7, anomaly: 0.8 }, limitation: 'Area and time risk only.' },
  }} /></MemoryRouter>);
  expect(screen.getByRole('heading', { name: 'Crime intelligence command workspace' })).toBeInTheDocument();
  expect(screen.getByText('27')).toBeInTheDocument();
  expect(screen.getByText(/expected baseline 11/i)).toBeInTheDocument();
  expect(screen.getByText(/area and time risk only/i)).toBeInTheDocument();
  expect(screen.getByText('86')).toBeInTheDocument();
  expect(screen.getByText(/6 contributing cases/i)).toBeInTheDocument();
  expect(screen.queryByText('18 linked cases')).not.toBeInTheDocument();
  expect(screen.getAllByRole('link', { name: /inspect evidence/i }).length).toBeGreaterThan(0);
});

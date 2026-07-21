import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, test } from 'vitest';

import { PersonaWorkspace } from './PersonaWorkspace.jsx';

afterEach(cleanup);

const data = {
  brief: { executiveSummary: 'One evidence-linked cross-district pattern requires human review.' },
  anomalies: [{ id: 'A-1', label: 'Vehicle theft change', observed: 27, expected: 11, confidence: 0.91 }],
  hotspots: [{ id: 'H-1', area: 'Central corridor', caseCount: 6, severity: 0.82 }],
  risk: { score: 0.76, limitation: 'Area and time risk only; not an individual prediction.' },
};

test.each([
  ['STATE_LEADERSHIP', 'State Intelligence Brief'],
  ['DISTRICT_LEADERSHIP', 'Jurisdiction Intelligence Pulse'],
  ['CRIME_ANALYST', 'Analyst Workbench'],
  ['STATION_OPERATIONS', 'Operational Intelligence'],
  ['INVESTIGATOR', 'Investigation Tasks'],
  ['PLATFORM_ADMIN', 'Governance Console'],
])('%s receives the approved default experience', (role, heading) => {
  render(<MemoryRouter><PersonaWorkspace role={role} data={data} /></MemoryRouter>);
  expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument();
});

test('analyst workspace keeps model output, limitations and evidence review visible', () => {
  render(<MemoryRouter><PersonaWorkspace role="CRIME_ANALYST" data={data} /></MemoryRouter>);
  expect(screen.getByText('Vehicle theft change')).toBeInTheDocument();
  expect(screen.getByText(/observed 27 against baseline 11/i)).toBeInTheDocument();
  expect(screen.getByText(/area and time risk only/i)).toBeInTheDocument();
  expect(screen.getAllByText(/human review/i).length).toBeGreaterThan(0);
});

test('workspace with unavailable governed results renders an honest partial state', () => {
  render(<MemoryRouter><PersonaWorkspace role="DISTRICT_LEADERSHIP" data={{ partial: true }} /></MemoryRouter>);
  expect(screen.getByText(/some intelligence services are unavailable/i)).toBeInTheDocument();
  expect(screen.queryByText(/0 alerts/i)).not.toBeInTheDocument();
});

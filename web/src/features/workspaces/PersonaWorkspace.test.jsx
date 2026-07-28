import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, test } from 'vitest';

import { PersonaWorkspace } from './PersonaWorkspace.jsx';

afterEach(cleanup);

const data = {
  brief: { executiveSummary: 'Synthetic decision brief requires human review.' },
  anomalies: [{ id: 'A-1', label: 'Vehicle theft change', observed: 27, expected: 11, confidence: 0.91 }],
  hotspots: [{ id: 'H-1', area: 'Central corridor', caseCount: 6, severity: 0.82 }],
  risk: { score: 0.76, limitation: 'Area and time risk only; not an individual prediction.' },
};

test.each([
  ['STATE_LEADERSHIP', 'State Intelligence Brief'],
  ['DISTRICT_LEADERSHIP', 'Authorized district operational pulse'],
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
  expect(screen.getByText(/some district intelligence is unavailable/i)).toBeInTheDocument();
  expect(screen.queryByText(/0 alerts/i)).not.toBeInTheDocument();
});

test('missing analytical values are unavailable rather than invented zeroes', () => {
  render(<MemoryRouter><PersonaWorkspace role="CRIME_ANALYST" data={{
    anomalies: [{ id: 'A-1', label: 'Incomplete anomaly result' }],
    hotspots: [{ id: 'H-1', area: 'Central corridor' }],
  }} /></MemoryRouter>);

  expect(screen.getByText(/observed unavailable against baseline unavailable/i)).toBeInTheDocument();
  expect(screen.getAllByText(/Unavailable/).length).toBeGreaterThan(0);
  expect(screen.queryByText('0%')).not.toBeInTheDocument();
});

test('district leadership receives a jurisdiction decision flow, not the generic platform home', () => {
  render(<MemoryRouter><PersonaWorkspace role="DISTRICT_LEADERSHIP" data={data} /></MemoryRouter>);
  expect(screen.getByRole('heading', { name: 'Authorized district operational pulse' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Monthly FIR trend' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Station concentration' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Open district map' })).toHaveAttribute('href', '/geospatial');
});

test('station operations receives local action and hotspot context', () => {
  render(<MemoryRouter><PersonaWorkspace role="STATION_OPERATIONS" data={data} /></MemoryRouter>);
  expect(screen.getByRole('heading', { name: 'Local attention queue' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Station hotspot context' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Open local alerts' })).toHaveAttribute('href', '/alerts');
});

test('investigator receives an assignment-first verification workspace', () => {
  render(<MemoryRouter><PersonaWorkspace role="INVESTIGATOR" data={data} /></MemoryRouter>);
  expect(screen.getByRole('heading', { name: 'Assigned verification' })).toBeInTheDocument();
  expect(screen.getByText(/system signal/i)).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Review assigned evidence' })).toHaveAttribute('href', '/alerts');
});

test('governance roles expose their real governed destinations', () => {
  const { rerender } = render(<MemoryRouter><PersonaWorkspace role="PLATFORM_ADMIN" data={{}} /></MemoryRouter>);
  expect(screen.getByRole('link', { name: 'Inspect intelligence runs' })).toHaveAttribute('href', '/admin/intelligence-runs');
  expect(screen.getByRole('link', { name: 'Review persona workspaces' })).toHaveAttribute('href', '/admin/personas');

  rerender(<MemoryRouter><PersonaWorkspace role="AUDITOR" data={{}} /></MemoryRouter>);
  expect(screen.getByRole('heading', { name: 'Audit Console' })).toBeInTheDocument();
  expect(screen.getByText(/read-only traceability/i)).toBeInTheDocument();
});

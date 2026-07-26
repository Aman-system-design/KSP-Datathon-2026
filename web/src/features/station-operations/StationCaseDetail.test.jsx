import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, expect, test, vi } from 'vitest';

import { StationCaseDetail } from './StationCaseDetail.jsx';

afterEach(cleanup);

const governedCase = {
  caseId: 'CASE / 17', caseNumber: '0017/2026', status: 'Under Investigation',
  ageDays: 9, ageingBucket: '8–30 days', registeredAt: '2026-07-20T00:00:00Z',
  incidentAt: '2026-07-19T22:00:00Z', majorHead: 'Property', minorHead: 'Burglary',
  unitName: 'Central Police Station', syntheticData: true,
  BriefFacts: 'restricted narrative', accused: ['restricted'], complainant: 'restricted',
  latitude: 12.97, longitude: 77.59, unitId: 1001, employeeId: 'E-1',
};

function renderDetail(api, entry = '/cases/CASE%20%2F%2017?persona=STATION_OPERATIONS&token=unsafe') {
  return render(<MemoryRouter initialEntries={[entry]}><Routes>
    <Route path="/cases/:caseId" element={<StationCaseDetail api={api} />} />
  </Routes></MemoryRouter>);
}

test('loads the encoded case path and renders only the approved governed projection', async () => {
  const api = { get: vi.fn(async () => ({ data: governedCase, provenance: 'SYNTHETIC' })) };
  renderDetail(api);

  expect(await screen.findByRole('heading', { name: 'Case 0017/2026' })).toBeInTheDocument();
  expect(api.get).toHaveBeenCalledWith('/v1/cases/CASE%20%2F%2017');
  expect(screen.getAllByText('Under Investigation')).toHaveLength(2);
  expect(screen.getByText('9 days')).toBeInTheDocument();
  expect(screen.getByText('8–30 days')).toBeInTheDocument();
  expect(screen.getByText('20 July 2026, 5:30 am')).toBeInTheDocument();
  expect(screen.getByText('20 July 2026, 3:30 am')).toBeInTheDocument();
  expect(screen.getByText('Property')).toBeInTheDocument();
  expect(screen.getByText('Burglary')).toBeInTheDocument();
  expect(screen.getByText('Central Police Station')).toBeInTheDocument();
  expect(screen.getByText('Synthetic data')).toBeInTheDocument();
  expect(screen.getByText('Read-only case record')).toBeInTheDocument();
  expect(screen.queryByText('restricted narrative')).not.toBeInTheDocument();
  expect(screen.queryByText('restricted')).not.toBeInTheDocument();
  expect(screen.queryByText('E-1')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /edit/i })).not.toBeInTheDocument();
});

test('uses unavailable fallbacks for partial governed fields', async () => {
  const api = { get: vi.fn(async () => ({ data: { caseNumber: '0020/2026', status: null, registeredAt: 'invalid' } })) };
  renderDetail(api, '/cases/20?persona=STATION_OPERATIONS');

  expect(await screen.findByRole('heading', { name: 'Case 0020/2026' })).toBeInTheDocument();
  expect(screen.getAllByText('Unavailable').length).toBeGreaterThanOrEqual(7);
});

test.each([
  Object.assign(new Error('outside station detail'), { status: 403, code: 'FORBIDDEN_ACTION' }),
  Object.assign(new Error('missing private id'), { status: 404, code: 'NOT_FOUND' }),
])('uses one generic governed state for inaccessible and missing cases', async error => {
  const api = { get: vi.fn(async () => { throw error; }) };
  renderDetail(api, '/cases/SECRET-99?persona=STATION_OPERATIONS');

  expect(await screen.findByRole('heading', { name: 'Case unavailable' })).toBeInTheDocument();
  expect(screen.getByText('This case cannot be displayed in the current authorized station scope.')).toBeInTheDocument();
  expect(screen.queryByText(/SECRET-99|outside station|missing private/i)).not.toBeInTheDocument();
});

test('fails closed on an empty or contract-invalid response', async () => {
  const api = { get: vi.fn(async () => ({ data: { caseId: 'PRIVATE', BriefFacts: 'secret' } })) };
  renderDetail(api, '/cases/PRIVATE?persona=STATION_OPERATIONS');

  expect(await screen.findByRole('heading', { name: 'Case unavailable' })).toBeInTheDocument();
  expect(screen.queryByText(/PRIVATE|secret/)).not.toBeInTheDocument();
});

test('back link preserves only the governed station persona', async () => {
  const api = { get: vi.fn(async () => ({ data: governedCase })) };
  renderDetail(api);

  expect(await screen.findByRole('link', { name: 'Back to Station Operations' })).toHaveAttribute(
    'href', '/?persona=STATION_OPERATIONS',
  );
});

test('announces a professional loading state', () => {
  const api = { get: vi.fn(() => new Promise(() => {})) };
  renderDetail(api);
  expect(screen.getByRole('status', { name: 'Loading governed case record…' })).toBeInTheDocument();
});

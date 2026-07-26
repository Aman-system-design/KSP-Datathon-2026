import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { StrictMode } from 'react';
import { MemoryRouter } from 'react-router-dom';

import { UtilitiesPage } from './UtilitiesPage.jsx';

afterEach(cleanup);

const definitions = [
  {
    key: 'patterns', name: 'Cross-District Pattern Intelligence',
    description: 'Connects related signals across authorized districts for human review.',
    category: 'patterns-networks', availability: 'AVAILABLE', icon: 'network',
    stages: [
      { stage: 'Data', label: 'Authorized case features' },
      { stage: 'Analyze', label: 'Fuse cross-district signals' },
      { stage: 'Explain', label: 'Review linked evidence' },
      { stage: 'Alert', label: 'Apply a confidence rule' },
      { stage: 'Deliver', label: 'Open alerts and reports' },
    ],
  },
  {
    key: 'hotspots', name: 'Emerging Hotspot Intelligence',
    description: 'Highlights recent geographic concentrations within authorized areas.',
    category: 'spatial-intelligence', availability: 'AVAILABLE', icon: 'map-pin',
    stages: [
      { stage: 'Data', label: 'Authorized geocoded cases' },
      { stage: 'Analyze', label: 'Detect spatial concentrations' },
      { stage: 'Explain', label: 'Inspect cluster evidence' },
      { stage: 'Alert', label: 'Apply a minimum-case rule' },
      { stage: 'Deliver', label: 'Open maps, alerts and reports' },
    ],
  },
  {
    key: 'anomalies', name: 'Trend Anomaly Intelligence',
    description: 'Surfaces material departures from an authorized area baseline.',
    category: 'trends-anomalies', availability: 'AVAILABLE', icon: 'chart-no-axes-combined',
    stages: [
      { stage: 'Data', label: 'Authorized area time series' },
      { stage: 'Analyze', label: 'Compare values with baselines' },
      { stage: 'Explain', label: 'Inspect observed deviation' },
      { stage: 'Alert', label: 'Apply a deviation rule' },
      { stage: 'Deliver', label: 'Open monitoring, alerts and reports' },
    ],
  },
  {
    key: 'area-attention', name: 'Area Attention Intelligence',
    description: 'Prioritizes areas for review using bounded aggregate signals.',
    category: 'risk-prioritization', availability: 'ANALYSIS_ONLY', icon: 'scan-search',
    stages: [
      { stage: 'Data', label: 'Authorized aggregate area signals' },
      { stage: 'Analyze', label: 'Score area attention signals' },
      { stage: 'Explain', label: 'Inspect score components' },
      { stage: 'Alert', label: 'Alert policy awaiting validation' },
      { stage: 'Deliver', label: 'Open monitoring, maps and reports' },
    ],
  },
];

test('loads one API-driven catalogue with one compact lifecycle and four open links', async () => {
  const api = { get: vi.fn(async () => ({ data: definitions })) };
  render(<MemoryRouter><UtilitiesPage api={api} /></MemoryRouter>);

  expect(await screen.findByRole('heading', { name: 'Intelligence Utilities' })).toBeInTheDocument();
  expect(api.get).toHaveBeenCalledOnce();
  expect(api.get).toHaveBeenCalledWith('/v1/utilities');
  expect(screen.getAllByRole('list', { name: 'Utility lifecycle' })).toHaveLength(1);
  expect(within(screen.getByRole('list', { name: 'Utility lifecycle' })).getAllByRole('listitem'))
    .toHaveLength(5);
  expect(screen.getAllByRole('article')).toHaveLength(4);
  expect(screen.getByRole('link', { name: /open cross-district pattern intelligence/i }))
    .toHaveAttribute('href', '/utilities/patterns');
  expect(screen.queryByText(/QuickML/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/accuracy|runs today|success rate/i)).not.toBeInTheDocument();
});

test('deduplicates the catalogue request during StrictMode effect replay', async () => {
  const api = { get: vi.fn(async () => ({ data: definitions })) };
  render(<StrictMode><MemoryRouter><UtilitiesPage api={api} /></MemoryRouter></StrictMode>);

  expect(await screen.findByRole('heading', { name: 'Intelligence Utilities' })).toBeInTheDocument();
  expect(api.get).toHaveBeenCalledOnce();
});

test('evicts a rejected in-flight catalogue request so a retry can succeed', async () => {
  const catalog = await import('./utility-catalog.js');
  expect(catalog.loadUtilities).toBeTypeOf('function');
  const api = { get: vi.fn()
    .mockRejectedValueOnce(new Error('temporary failure'))
    .mockResolvedValueOnce({ data: definitions }) };

  await expect(catalog.loadUtilities(api)).rejects.toThrow('temporary failure');
  await expect(catalog.loadUtilities(api)).resolves.toHaveLength(4);
  expect(api.get).toHaveBeenCalledTimes(2);
});

test('discards malformed catalogue definitions at the API boundary', async () => {
  const malformed = { ...definitions[0], key: 'broken', name: 'Broken utility', stages: null };
  const api = { get: vi.fn(async () => ({ data: [...definitions, malformed] })) };
  render(<MemoryRouter><UtilitiesPage api={api} /></MemoryRouter>);

  await screen.findByRole('heading', { name: 'Intelligence Utilities' });
  expect(screen.getAllByRole('article')).toHaveLength(4);
  expect(screen.queryByText('Broken utility')).not.toBeInTheDocument();
});

test('derives category filters from the catalogue response and exposes pressed state', async () => {
  const api = { get: vi.fn(async () => ({ data: definitions })) };
  render(<MemoryRouter><UtilitiesPage api={api} /></MemoryRouter>);
  await screen.findByText('Area Attention Intelligence');

  const spatial = screen.getByRole('button', { name: 'Spatial intelligence' });
  expect(spatial).toHaveAttribute('aria-pressed', 'false');
  fireEvent.click(spatial);

  expect(spatial).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getAllByRole('article')).toHaveLength(1);
  expect(screen.getByText('Emerging Hotspot Intelligence')).toBeInTheDocument();
  expect(screen.queryByText('Area Attention Intelligence')).not.toBeInTheDocument();
  expect(api.get).toHaveBeenCalledOnce();
});

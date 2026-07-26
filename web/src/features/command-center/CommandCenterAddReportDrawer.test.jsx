import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

import { CommandCenterAddReportDrawer } from './CommandCenterAddReportDrawer.jsx';

afterEach(cleanup);

test('shows a compact searchable governed report picker', async () => {
  const api = { get: vi.fn(async () => ({ data: [
    { id: 'R-1', name: 'District trend', relationship: 'OWNED', definition: { sourceKey: 'anomalies', visualization: { type: 'line' } } },
    { id: 'R-2', name: 'Hotspot posture', relationship: 'SHARED', definition: { sourceKey: 'hotspots', visualization: { type: 'map' } } },
  ] })) };
  const onAdd = vi.fn();
  render(<MemoryRouter initialEntries={['/?persona=COMMAND_CENTER&release=qa']}><CommandCenterAddReportDrawer api={api} open onAdd={onAdd} onClose={() => {}} /></MemoryRouter>);
  expect(await screen.findByText('District trend')).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Search saved reports'), { target: { value: 'hotspot' } });
  expect(screen.queryByText('District trend')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Add Hotspot posture' }));
  expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({ id: 'R-2' }));
  expect(screen.getByRole('link', { name: 'Create new report' })).toHaveAttribute('href', '/reports/new?persona=COMMAND_CENTER&returnTo=command-center');
});

test('renders nothing outside operator edit mode', () => {
  const api = { get: vi.fn() };
  const { container } = render(<MemoryRouter><CommandCenterAddReportDrawer api={api} open={false} /></MemoryRouter>);
  expect(container).toBeEmptyDOMElement();
  expect(api.get).not.toHaveBeenCalled();
});

test('an optional predicate excludes reports that the workspace cannot add', async () => {
  const api = { get: vi.fn(async () => ({ data: [
    { id: 'R-STATION', name: 'Open cases', definition: { sourceKey: 'stationCases', visualization: { type: 'table' } } },
    { id: 'R-MAP', name: 'Karnataka district map', definition: { sourceKey: 'hotspots', visualization: { type: 'map' } } },
  ] })) };
  const onAdd = vi.fn();
  render(<MemoryRouter><CommandCenterAddReportDrawer
    api={api} open onAdd={onAdd}
    reportPredicate={report => ['stationCases', 'alerts'].includes(report.definition?.sourceKey)}
  /></MemoryRouter>);

  expect(await screen.findByText('Open cases')).toBeInTheDocument();
  expect(screen.queryByText('Karnataka district map')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Add Karnataka district map' })).not.toBeInTheDocument();
});

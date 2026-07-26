import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
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

test('creates a recommended governed report before adding it to the dashboard', async () => {
  const api = {
    get: vi.fn(async () => ({ data: [] })),
    post: vi.fn(async (_path, definition) => ({ data: { id: 'R-NEW', name: definition.name, definition } })),
  };
  const onAdd = vi.fn();
  render(<MemoryRouter><CommandCenterAddReportDrawer api={api} open onAdd={onAdd} /></MemoryRouter>);
  fireEvent.click(await screen.findByRole('button', { name: 'Add District FIR Ranking' }));
  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/v1/reports', expect.objectContaining({
    name: 'District FIR Ranking', sourceKey: 'catalog.caseMaster', dimensions: ['DistrictCode'],
  })));
  expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({ id: 'R-NEW', name: 'District FIR Ranking' }));
});

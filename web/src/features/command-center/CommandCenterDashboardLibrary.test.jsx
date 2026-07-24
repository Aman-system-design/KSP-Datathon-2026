import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';

import { CommandCenterDashboardLibrary } from './CommandCenterDashboardLibrary.jsx';

afterEach(cleanup);

test('shows the full library even when no dashboards exist', () => {
  render(<CommandCenterDashboardLibrary api={{ post: vi.fn() }} dashboards={[]} onOpen={() => {}} onCreateMode={() => {}} />);
  expect(screen.getByRole('heading', { name: 'Dashboard Library' })).toBeInTheDocument();
  expect(screen.getByText('No dashboards yet')).toBeInTheDocument();
  expect(screen.getAllByRole('button', { name: 'New dashboard' })).toHaveLength(2);
});

test('searches authorized dashboards and opens a result', () => {
  const onOpen = vi.fn();
  render(<CommandCenterDashboardLibrary api={{ post: vi.fn() }} dashboards={[
    { id: 'D-1', name: 'State intelligence', relationship: 'SYSTEM' },
    { id: 'D-2', name: 'Night crime', relationship: 'OWNED' },
  ]} onOpen={onOpen} onCreateMode={() => {}} />);
  fireEvent.change(screen.getByRole('searchbox', { name: 'Search dashboard library' }), { target: { value: 'night' } });
  expect(screen.queryByText('State intelligence')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Open Night crime' }));
  expect(onOpen).toHaveBeenCalledWith('D-2');
});

test('names and creates a dashboard on the full page', async () => {
  const api = { post: vi.fn(async () => ({ data: { id: 'D-9', name: 'Election Intelligence' } })) };
  const onCreated = vi.fn();
  render(<CommandCenterDashboardLibrary api={api} dashboards={[]} createMode onCreated={onCreated} onCancelCreate={() => {}} />);

  fireEvent.click(screen.getByRole('button', { name: 'Create dashboard' }));
  expect(await screen.findByText('Enter a dashboard name.')).toBeInTheDocument();

  fireEvent.change(screen.getByRole('textbox', { name: 'Dashboard name' }), { target: { value: '  Election Intelligence  ' } });
  fireEvent.click(screen.getByRole('button', { name: 'Create dashboard' }));

  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/v1/dashboards', { name: 'Election Intelligence', description: '' }));
  expect(onCreated).toHaveBeenCalledWith('D-9');
});

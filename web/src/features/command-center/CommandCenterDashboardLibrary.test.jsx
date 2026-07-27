import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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

test('deletes a dashboard while keeping its reports available', async () => {
  const api = { delete: vi.fn(async () => ({ data: { deleted: true } })) };
  render(<CommandCenterDashboardLibrary api={api} dashboards={[{ id: 'D-1', name: 'Night crime', relationship: 'SYSTEM' }]} />);

  fireEvent.click(screen.getByRole('button', { name: 'More actions for Night crime' }));
  fireEvent.click(screen.getByRole('menuitem', { name: 'Delete dashboard' }));
  const dialog = screen.getByRole('dialog', { name: 'Delete Night crime?' });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Delete dashboard' }));

  await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/v1/dashboards/D-1'));
  expect(screen.queryByText('Night crime')).not.toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent('Night crime was deleted. Reports remain available.');
});

test('cancel leaves the dashboard untouched', () => {
  const api = { delete: vi.fn() };
  render(<CommandCenterDashboardLibrary api={api} dashboards={[{ id: 'D-1', name: 'Night crime', relationship: 'OWNED' }]} />);
  fireEvent.click(screen.getByRole('button', { name: 'More actions for Night crime' }));
  fireEvent.click(screen.getByRole('menuitem', { name: 'Delete dashboard' }));
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(api.delete).not.toHaveBeenCalled();
  expect(screen.getByText('Night crime')).toBeVisible();
});

test('failed deletion keeps the dashboard and reports the error', async () => {
  const api = { delete: vi.fn(async () => { throw new Error('Unavailable'); }) };
  render(<CommandCenterDashboardLibrary api={api} dashboards={[{ id: 'D-1', name: 'Night crime', relationship: 'SHARED' }]} />);
  fireEvent.click(screen.getByRole('button', { name: 'More actions for Night crime' }));
  fireEvent.click(screen.getByRole('menuitem', { name: 'Delete dashboard' }));
  fireEvent.click(screen.getByRole('button', { name: 'Delete dashboard' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Unavailable');
  expect(screen.getByText('Night crime')).toBeVisible();
});

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';

import { CommandCenterDashboardPicker } from './CommandCenterDashboardPicker.jsx';

afterEach(cleanup);

test('searches authorized dashboards and selects one in place', () => {
  const onSelect = vi.fn();
  render(<CommandCenterDashboardPicker open dashboards={[
    { id: 'D-1', name: 'State overview', relationship: 'SYSTEM' },
    { id: 'D-2', name: 'Night crime', relationship: 'OWNED' },
    { id: 'D-3', name: 'Election watch', relationship: 'SHARED' },
  ]} onSelect={onSelect} onClose={() => {}} onOpenAll={() => {}} />);
  expect(screen.getByRole('dialog', { name: 'Dashboards' })).toBeInTheDocument();
  fireEvent.change(screen.getByRole('searchbox', { name: 'Search dashboards' }), { target: { value: 'night' } });
  expect(screen.queryByRole('button', { name: 'State overview' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Night crime' }));
  expect(onSelect).toHaveBeenCalledWith('D-2');
});

test('opens the complete dashboard library', () => {
  const onOpenAll = vi.fn();
  render(<CommandCenterDashboardPicker open dashboards={[
    { id: 'D-1', name: 'Recent board', relationship: 'SYSTEM' },
    { id: 'D-2', name: 'Owned board', relationship: 'OWNED' },
    { id: 'D-3', name: 'Shared board', relationship: 'SHARED' },
    { id: 'D-4', name: 'System board', relationship: 'SYSTEM' },
    { id: 'D-5', name: 'Another board', relationship: 'SYSTEM' },
    { id: 'D-6', name: 'Older owned board', relationship: 'OWNED' },
  ]} onSelect={() => {}} onClose={() => {}} onOpenAll={onOpenAll} />);
  expect(screen.queryByRole('heading', { name: 'Owned by you' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Open all dashboards' }));
  expect(onOpenAll).toHaveBeenCalledOnce();
  expect(screen.getByRole('heading', { name: 'Owned by you' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Shared with you' })).toBeInTheDocument();
});

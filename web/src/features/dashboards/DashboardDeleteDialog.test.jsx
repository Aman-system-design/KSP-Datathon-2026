import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';

import { DashboardDeleteDialog } from './DashboardDeleteDialog.jsx';

afterEach(cleanup);

test('explains that reports remain and confirms deletion', () => {
  const onConfirm = vi.fn();
  render(<DashboardDeleteDialog dashboard={{ id: 'D-1', name: 'Night crime' }} onCancel={() => {}} onConfirm={onConfirm} />);
  const dialog = screen.getByRole('dialog', { name: 'Delete Night crime?' });
  expect(within(dialog).getByText(/Reports used by this dashboard will remain available/i)).toBeVisible();
  fireEvent.click(within(dialog).getByRole('button', { name: 'Delete dashboard' }));
  expect(onConfirm).toHaveBeenCalledOnce();
});

test('cancels without confirming', () => {
  const onCancel = vi.fn();
  const onConfirm = vi.fn();
  render(<DashboardDeleteDialog dashboard={{ id: 'D-1', name: 'Night crime' }} onCancel={onCancel} onConfirm={onConfirm} />);
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(onCancel).toHaveBeenCalledOnce();
  expect(onConfirm).not.toHaveBeenCalled();
});

test('locks actions while deleting and shows an error', () => {
  render(<DashboardDeleteDialog dashboard={{ id: 'D-1', name: 'Night crime' }} deleting error="Unavailable" onCancel={() => {}} onConfirm={() => {}} />);
  expect(screen.getByRole('alert')).toHaveTextContent('Unavailable');
  expect(screen.getByRole('button', { name: 'Deleting dashboard…' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
});

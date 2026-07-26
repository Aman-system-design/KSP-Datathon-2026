import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';

import { CommandCenterWorkspaceToolbar } from './CommandCenterWorkspaceToolbar.jsx';

afterEach(cleanup);

test('collapses dashboard navigation and actions into one options menu', () => {
  const onTab = vi.fn();
  const onEdit = vi.fn();
  const onPresent = vi.fn();
  render(<CommandCenterWorkspaceToolbar dashboard={{ name: 'State overview', tabs: [{ id: 'overview', name: 'Overview' }, { id: 'risk', name: 'Risk' }] }} activeTab="overview" onTab={onTab} onEdit={onEdit} onPresent={onPresent} />);
  expect(screen.queryByRole('menu', { name: 'Dashboard tabs' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Edit dashboard' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Dashboard options' }));
  fireEvent.click(screen.getByRole('menuitem', { name: 'Risk' }));
  expect(onTab).toHaveBeenCalledWith('risk');
  fireEvent.click(screen.getByRole('button', { name: 'Dashboard options' }));
  fireEvent.click(screen.getByRole('menuitem', { name: 'Edit dashboard' }));
  expect(onEdit).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole('button', { name: 'Dashboard options' }));
  fireEvent.click(screen.getByRole('menuitem', { name: 'Present dashboard' }));
  expect(onPresent).toHaveBeenCalledOnce();
});

test('hides dashboard actions until an authorized dashboard is selected', () => {
  render(<CommandCenterWorkspaceToolbar dashboard={null} />);
  expect(screen.queryByText(/Command Cent(?:er|re)/)).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Edit dashboard' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Present' })).not.toBeInTheDocument();
});

test('offers datastore-backed charts while editing', () => {
  const onAdd = vi.fn();
  render(<CommandCenterWorkspaceToolbar dashboard={{ name: 'State overview', tabs: [{ id: 'overview', name: 'Overview' }] }} editing onAdd={onAdd} />);
  fireEvent.click(screen.getByRole('button', { name: 'Dashboard options' }));
  fireEvent.click(screen.getByRole('menuitem', { name: 'Add chart' }));
  expect(onAdd).toHaveBeenCalledOnce();
});

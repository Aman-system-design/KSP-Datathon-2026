import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';

import { CommandCenterWorkspaceToolbar } from './CommandCenterWorkspaceToolbar.jsx';

afterEach(cleanup);

test('keeps dashboard tabs collapsed until requested', () => {
  const onTab = vi.fn();
  render(<CommandCenterWorkspaceToolbar dashboard={{ name: 'State overview', tabs: [{ id: 'overview', name: 'Overview' }, { id: 'risk', name: 'Risk' }] }} activeTab="overview" onTab={onTab} />);
  expect(screen.queryByRole('menu', { name: 'Dashboard tabs' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Overview dashboard tab' }));
  fireEvent.click(screen.getByRole('menuitem', { name: 'Risk' }));
  expect(onTab).toHaveBeenCalledWith('risk');
});

test('disables dashboard actions until an authorized dashboard is selected', () => {
  render(<CommandCenterWorkspaceToolbar dashboard={null} />);
  expect(screen.getByRole('button', { name: 'Edit dashboard' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Present' })).toBeDisabled();
});

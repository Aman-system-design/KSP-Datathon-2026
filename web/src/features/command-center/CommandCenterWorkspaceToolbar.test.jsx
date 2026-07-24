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

test('hides dashboard actions until an authorized dashboard is selected', () => {
  render(<CommandCenterWorkspaceToolbar dashboard={null} />);
  expect(screen.queryByText(/Command Cent(?:er|re)/)).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Edit dashboard' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Present' })).not.toBeInTheDocument();
});

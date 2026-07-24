import { fireEvent, render, screen } from '@testing-library/react';
import { expect, test, vi } from 'vitest';

import { CommandCenterWorkspaceToolbar } from './CommandCenterWorkspaceToolbar.jsx';

test('keeps dashboard tabs collapsed until requested', () => {
  const onTab = vi.fn();
  render(<CommandCenterWorkspaceToolbar dashboard={{ name: 'State overview', tabs: [{ id: 'overview', name: 'Overview' }, { id: 'risk', name: 'Risk' }] }} activeTab="overview" onTab={onTab} />);
  expect(screen.queryByRole('menu', { name: 'Dashboard tabs' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Overview dashboard tab' }));
  fireEvent.click(screen.getByRole('menuitem', { name: 'Risk' }));
  expect(onTab).toHaveBeenCalledWith('risk');
});

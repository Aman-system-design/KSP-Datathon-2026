import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { CommandCenterPersonaMenu } from './CommandCenterPersonaMenu.jsx';

afterEach(cleanup);

test('filters retired and unsupported personas without crashing the account menu', () => {
  const onSelect = vi.fn();
  render(<CommandCenterPersonaMenu
    personas={['STATE_LEADERSHIP', 'REGIONAL_LEADERSHIP', 'CRIME_ANALYST']}
    onSelect={onSelect}
    onAllWorkspaces={vi.fn()}
  />);

  expect(screen.queryByText('Regional Leadership')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('menuitem', { name: 'Crime Analyst' }));
  expect(onSelect).toHaveBeenCalledWith('CRIME_ANALYST');
});

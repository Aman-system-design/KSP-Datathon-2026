import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';

import { AccountMenu } from './AccountMenu.jsx';

afterEach(cleanup);

test('uses a compact account menu with workspace switching and sign out', () => {
  const onPersonaChange = vi.fn();
  const signOut = vi.fn();
  const workspace = {
    role: 'STATE_LEADERSHIP', scopeUnitId: 1,
    identity: { employeeId: 9900, actualRole: 'DEMO_PRESENTER', demoPersona: true },
    personaSwitch: { allowed: true, personas: ['STATE_LEADERSHIP', 'CRIME_ANALYST'] },
  };

  render(<AccountMenu workspace={workspace} auth={{ signOut }} onPersonaChange={onPersonaChange} />);
  fireEvent.click(screen.getByRole('button', { name: /account: state leadership/i }));

  expect(screen.queryByRole('group', { name: 'Switch demonstration persona' })).not.toBeInTheDocument();
  expect(screen.getByText('State Leadership')).toBeInTheDocument();
  expect(screen.getByText('State Intelligence Brief')).toBeInTheDocument();
  expect(screen.queryByText('Unit 1')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Switch workspace' }));
  expect(onPersonaChange).toHaveBeenCalledWith(null);

  fireEvent.click(screen.getByRole('button', { name: /account: state leadership/i }));
  fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
  expect(signOut).toHaveBeenCalledOnce();
});

test('station account fallback never exposes a numeric scope identifier', () => {
  render(<AccountMenu
    workspace={{ role: 'STATION_OPERATIONS', scopeUnitId: 1001 }}
    auth={{ signOut: vi.fn() }} onPersonaChange={vi.fn()}
  />);
  fireEvent.click(screen.getByRole('button', { name: /account: station operations/i }));
  expect(screen.getByText('Local station')).toBeInTheDocument();
  expect(screen.queryByText(/Unit 1001/i)).not.toBeInTheDocument();
});

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';

import { AccountMenu } from './AccountMenu.jsx';

afterEach(cleanup);

test('keeps persona switching and sign out inside the account feature', () => {
  const onPersonaChange = vi.fn();
  const signOut = vi.fn();
  const workspace = {
    role: 'STATE_LEADERSHIP', scopeUnitId: 1,
    identity: { employeeId: 9900, actualRole: 'DEMO_PRESENTER', demoPersona: true },
    personaSwitch: { allowed: true, personas: ['STATE_LEADERSHIP', 'CRIME_ANALYST'] },
  };

  render(<AccountMenu workspace={workspace} auth={{ signOut }} onPersonaChange={onPersonaChange} />);
  fireEvent.click(screen.getByRole('button', { name: /account: state leadership/i }));

  const group = screen.getByRole('group', { name: 'Switch demonstration persona' });
  fireEvent.click(within(group).getByRole('button', { name: 'Crime Analyst' }));
  expect(onPersonaChange).toHaveBeenCalledWith('CRIME_ANALYST');

  fireEvent.click(screen.getByRole('button', { name: /account: state leadership/i }));
  fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
  expect(signOut).toHaveBeenCalledOnce();
});

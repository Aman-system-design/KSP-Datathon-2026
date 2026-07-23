import { render, screen } from '@testing-library/react';
import { expect, test, vi } from 'vitest';

import { SignInRequired } from './SignInRequired.jsx';

test('opens the dedicated Catalyst sign-in page', () => {
  const auth = { openSignIn: vi.fn() };

  render(<SignInRequired auth={auth} />);

  expect(auth.openSignIn).toHaveBeenCalledOnce();
  expect(screen.getByRole('link', { name: 'Continue to sign in' })).toHaveAttribute('href', '/login.html');
});

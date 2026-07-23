import { render, screen } from '@testing-library/react';
import { expect, test, vi } from 'vitest';

import { SignInRequired } from './SignInRequired.jsx';

test('mounts Catalyst embedded authentication once in the native login host', async () => {
  const auth = { embeddedSignIn: vi.fn() };

  const { container } = render(<SignInRequired auth={auth} />);

  expect(screen.getByLabelText('Catalyst sign in')).toHaveAttribute('id', 'loginDivElementId');
  expect(container.querySelectorAll('#loginDivElementId')).toHaveLength(1);
  expect(auth.embeddedSignIn).toHaveBeenCalledOnce();
  expect(auth.embeddedSignIn).toHaveBeenCalledWith('loginDivElementId');
  expect(screen.queryByRole('link', { name: 'Sign in with Catalyst' })).not.toBeInTheDocument();
});

test('reports an asynchronous Catalyst embed failure without exposing internals', async () => {
  const auth = { embeddedSignIn: vi.fn(async () => { throw new Error('private SDK detail'); }) };

  render(<SignInRequired auth={auth} />);

  expect(await screen.findByRole('alert')).toHaveTextContent('Catalyst sign in is temporarily unavailable.');
  expect(screen.queryByText('private SDK detail')).not.toBeInTheDocument();
});

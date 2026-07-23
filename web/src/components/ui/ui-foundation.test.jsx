import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';

import { Avatar, AvatarFallback } from './avatar.jsx';
import { Button } from './button.jsx';

test('KSP UI foundation exposes accessible shadcn primitives', () => {
  render(<><Avatar><AvatarFallback>AD</AvatarFallback></Avatar><Button>Open workspace</Button></>);

  expect(screen.getByText('AD')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Open workspace' })).toBeEnabled();
});

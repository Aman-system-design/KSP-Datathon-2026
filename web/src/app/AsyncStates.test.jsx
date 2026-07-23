import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';

import { Busy } from './AsyncStates.jsx';

afterEach(cleanup);

test('renders a branded secure application loader for startup gates', () => {
  render(<Busy branded label="Verifying Catalyst identity…" />);

  expect(screen.getByRole('status')).toHaveAccessibleName('Verifying Catalyst identity…');
  expect(screen.getByRole('img', { name: 'Karnataka State emblem' })).toHaveAttribute(
    'src',
    '/brand/karnataka-state-emblem.png',
  );
  expect(screen.getByText('Secure intelligence platform')).toBeInTheDocument();
});

test('keeps ordinary in-page loading compact', () => {
  render(<Busy label="Loading scoped alerts…" />);

  expect(screen.queryByRole('img', { name: 'Karnataka State emblem' })).not.toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveAccessibleName('Loading scoped alerts…');
});

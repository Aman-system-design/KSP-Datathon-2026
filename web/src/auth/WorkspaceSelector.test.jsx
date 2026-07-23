import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';

import { WorkspaceSelector } from './WorkspaceSelector.jsx';

afterEach(cleanup);

test('renders only personas returned by the backend', () => {
  render(<WorkspaceSelector workspace={{ personaSwitch: {
    allowed: true,
    personas: ['STATE_LEADERSHIP', 'CRIME_ANALYST'],
  } }} onSelect={() => {}} onSignOut={() => {}} />);

  expect(screen.getByRole('radio', { name: /State Leadership/i })).toBeVisible();
  expect(screen.getByRole('radio', { name: /Crime Analyst/i })).toBeVisible();
  expect(screen.queryByRole('radio', { name: /Station Operations/i })).not.toBeInTheDocument();
});

test('opens only the selected backend-authorized workspace', () => {
  const onSelect = vi.fn();
  render(<WorkspaceSelector workspace={{ personaSwitch: {
    allowed: true,
    personas: ['STATE_LEADERSHIP', 'CRIME_ANALYST'],
  } }} onSelect={onSelect} onSignOut={() => {}} />);

  const open = screen.getByRole('button', { name: 'Open workspace' });
  expect(open).toBeDisabled();
  fireEvent.click(screen.getByRole('radio', { name: /Crime Analyst/i }));
  fireEvent.click(open);

  expect(onSelect).toHaveBeenCalledWith('CRIME_ANALYST');
});

test('fails closed when persona switching is not authorized', () => {
  render(<WorkspaceSelector workspace={{ personaSwitch: { allowed: false, personas: [] } }} onSelect={() => {}} onSignOut={() => {}} />);

  expect(screen.getByRole('alert')).toHaveTextContent('No demonstration workspace is authorized');
  expect(screen.queryByRole('button', { name: 'Open workspace' })).not.toBeInTheDocument();
});

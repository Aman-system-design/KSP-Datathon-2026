import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, test, vi } from 'vitest';

import { AppShell } from './AppShell.jsx';

const workspace = {
  role: 'CRIME_ANALYST', scopeUnitId: 101, syntheticData: true,
  availableDashboards: [{ id: 'D-1', name: 'Analyst desk' }],
  alertSummary: { total: 3 }, freshness: '21 Jul 2026, 23:15 IST',
};

afterEach(cleanup);

test('renders one branded enterprise shell with persistent operational context', () => {
  render(<MemoryRouter><AppShell workspace={workspace}><p>Workspace content</p></AppShell></MemoryRouter>);

  expect(screen.getByRole('banner')).toHaveTextContent('KSP Crime Decision Intelligence');
  expect(screen.getByRole('img', { name: 'Government of Karnataka seal' })).toBeInTheDocument();
  expect(screen.getByRole('navigation', { name: 'Platform modules' })).toBeInTheDocument();
  expect(screen.getByRole('navigation', { name: 'Workspace navigation' })).toHaveTextContent('Analyst Workbench');
  expect(screen.getByRole('searchbox', { name: 'Global search' })).toBeDisabled();
  expect(screen.getByRole('link', { name: /alerts 3/i })).toBeInTheDocument();
  expect(screen.getAllByText('Unit 101')).toHaveLength(2);
  expect(screen.getByText('21 Jul 2026, 23:15 IST')).toBeInTheDocument();
  expect(screen.getByText(/synthetic demonstration data/i)).toBeInTheDocument();
  expect(screen.getByText('Workspace content')).toBeInTheDocument();
});

test('production workspaces expose account sign-out but no persona selector', () => {
  const signOut = vi.fn();
  render(<MemoryRouter><AppShell workspace={workspace} auth={{ signOut }}><p>Content</p></AppShell></MemoryRouter>);

  expect(screen.queryByLabelText(/persona/i)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /account: crime analyst/i }));
  fireEvent.click(screen.getByRole('button', { name: /sign out/i }));
  expect(signOut).toHaveBeenCalledOnce();
});

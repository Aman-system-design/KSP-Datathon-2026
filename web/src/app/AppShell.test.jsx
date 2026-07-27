import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, expect, test, vi } from 'vitest';

import { AppShell } from './AppShell.jsx';

const workspace = {
  role: 'CRIME_ANALYST', scopeUnitId: 101, syntheticData: true,
  availableDashboards: [{ id: 'D-1', name: 'Analyst desk' }],
  alertSummary: { total: 3 }, freshness: '21 Jul 2026, 23:15 IST',
};

const demoWorkspace = {
  ...workspace,
  role: 'STATE_LEADERSHIP',
  identity: {
    employeeId: 9900, actualRole: 'DEMO_PRESENTER',
    effectiveRole: 'STATE_LEADERSHIP', demoPersona: true,
  },
  personaSwitch: {
    allowed: true,
    personas: ['STATE_LEADERSHIP', 'REGIONAL_LEADERSHIP', 'DISTRICT_LEADERSHIP', 'CRIME_ANALYST', 'STATION_OPERATIONS'],
  },
};

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}{location.search}</output>;
}

afterEach(cleanup);

test('renders a focused branded shell without report-level status clutter', () => {
  render(<MemoryRouter><AppShell workspace={workspace}><p>Workspace content</p></AppShell></MemoryRouter>);

  expect(screen.getByRole('banner')).toHaveTextContent('Karnataka State Police');
  expect(screen.getByRole('banner')).toHaveTextContent('Analytics · Crime · Enforcement');
  expect(screen.getByRole('banner')).not.toHaveTextContent('KSP Crime Decision Intelligence');
  expect(screen.getByRole('img', { name: 'Karnataka State Police emblem' })).toBeInTheDocument();
  expect(screen.getByRole('navigation', { name: 'Platform modules' })).toBeInTheDocument();
  expect(screen.getByRole('navigation', { name: 'Workspace navigation' })).toHaveTextContent('Analyst Workbench');
  expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Support' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Open settings' })).toBeInTheDocument();
  expect(screen.getAllByRole('link', { name: /^alerts$/i }).length).toBeGreaterThan(0);
  expect(screen.getAllByText('Analyst Workbench').length).toBeGreaterThan(0);
  expect(screen.queryByText('Intelligence freshness')).not.toBeInTheDocument();
  expect(screen.queryByText('21 Jul 2026, 23:15 IST')).not.toBeInTheDocument();
  expect(screen.queryByText('Data mode')).not.toBeInTheDocument();
  expect(screen.queryByText('Demonstration')).not.toBeInTheDocument();
  expect(screen.queryByText(/not for operational policing/i)).not.toBeInTheDocument();
  expect(screen.getByText('Workspace content')).toBeInTheDocument();
  const utilities = screen.getByTestId('platform-header-utilities');
  expect(Array.from(utilities.querySelectorAll('a,button')).map(control => control.getAttribute('aria-label'))).toEqual(['Notifications', 'Open settings', 'Open account menu']);
});

test('workspace context panel collapses without removing platform navigation', () => {
  render(<MemoryRouter><AppShell workspace={workspace}><p>Workspace content</p></AppShell></MemoryRouter>);
  const toggle = screen.getByRole('button', { name: 'Collapse workspace panel' });
  expect(toggle).toHaveAttribute('aria-expanded', 'true');
  fireEvent.click(toggle);
  expect(screen.getByRole('button', { name: 'Expand workspace panel' })).toHaveAttribute('aria-expanded', 'false');
  expect(screen.queryByText('Analyst Workbench')).not.toBeInTheDocument();
  expect(screen.getByRole('navigation', { name: 'Platform modules' })).toBeInTheDocument();
});

test('State Leadership keeps the workspace context panel permanently collapsed', () => {
  render(<MemoryRouter><AppShell workspace={demoWorkspace}><p>Leadership content</p></AppShell></MemoryRouter>);

  expect(document.querySelector('.app-shell')).toHaveClass('context-collapsed');
  expect(screen.queryByRole('navigation', { name: 'Workspace navigation' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /workspace panel/i })).not.toBeInTheDocument();
  expect(screen.getByRole('navigation', { name: 'Platform modules' })).toBeInTheDocument();
});

test('production workspaces expose account sign-out but no persona selector', () => {
  const signOut = vi.fn();
  render(<MemoryRouter><AppShell workspace={workspace} auth={{ signOut }}><p>Content</p></AppShell></MemoryRouter>);

  expect(screen.queryByLabelText(/persona/i)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Open account menu' }));
  fireEvent.click(screen.getByRole('button', { name: /sign out/i }));
  expect(signOut).toHaveBeenCalledOnce();
});

test('Development demo presenter returns to workspace selection from the profile menu', () => {
  render(<MemoryRouter initialEntries={['/?persona=STATE_LEADERSHIP']}>
    <AppShell workspace={demoWorkspace} auth={{ signOut: vi.fn() }}><p>Content</p></AppShell>
    <LocationProbe />
  </MemoryRouter>);

  fireEvent.click(screen.getByRole('button', { name: 'Open account menu' }));

  expect(screen.getByText('Employee 9900')).toBeInTheDocument();
  expect(screen.getByText('KSP Intelligence')).toBeInTheDocument();
  expect(screen.queryByRole('group', { name: 'Switch demonstration persona' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Switch workspace' }));
  expect(screen.getByTestId('location')).toHaveTextContent('/');
});

test('platform navigation preserves the governed persona but drops unrelated query data', () => {
  render(<MemoryRouter initialEntries={['/?persona=CRIME_ANALYST&token=unsafe']}>
    <AppShell workspace={demoWorkspace} auth={{ signOut: vi.fn() }}><p>Content</p></AppShell>
    <LocationProbe />
  </MemoryRouter>);

  fireEvent.click(screen.getByRole('link', { name: 'Intelligence' }));
  expect(screen.getByTestId('location')).toHaveTextContent('/intelligence?persona=CRIME_ANALYST');
  expect(screen.getByTestId('location')).not.toHaveTextContent('token');
});

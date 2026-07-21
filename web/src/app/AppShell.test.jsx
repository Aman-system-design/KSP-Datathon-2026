import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
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

test('renders one branded enterprise shell with persistent operational context', () => {
  render(<MemoryRouter><AppShell workspace={workspace}><p>Workspace content</p></AppShell></MemoryRouter>);

  expect(screen.getByRole('banner')).toHaveTextContent('KSP Crime Decision Intelligence');
  expect(screen.getByRole('img', { name: 'Government of Karnataka seal' })).toBeInTheDocument();
  expect(screen.getByRole('navigation', { name: 'Platform modules' })).toBeInTheDocument();
  expect(screen.getByRole('navigation', { name: 'Workspace navigation' })).toHaveTextContent('Analyst Workbench');
  expect(screen.getByRole('searchbox', { name: 'Global search' })).toBeDisabled();
  expect(screen.getAllByRole('link', { name: /^alerts$/i }).length).toBeGreaterThan(0);
  expect(screen.getAllByText('Unit 101')).toHaveLength(2);
  expect(screen.getByText('21 Jul 2026, 23:15 IST')).toBeInTheDocument();
  expect(screen.getByText('Demonstration')).toBeInTheDocument();
  expect(screen.queryByText(/not for operational policing/i)).not.toBeInTheDocument();
  expect(screen.getByText('Workspace content')).toBeInTheDocument();
});

test('workspace context panel collapses without removing platform navigation', () => {
  render(<MemoryRouter><AppShell workspace={workspace}><p>Workspace content</p></AppShell></MemoryRouter>);
  const toggle = screen.getByRole('button', { name: 'Collapse workspace panel' });
  fireEvent.click(toggle);
  expect(screen.getByRole('button', { name: 'Expand workspace panel' })).toBeInTheDocument();
  expect(screen.queryByText('Analyst Workbench')).not.toBeInTheDocument();
  expect(screen.getByRole('navigation', { name: 'Platform modules' })).toBeInTheDocument();
});

test('production workspaces expose account sign-out but no persona selector', () => {
  const signOut = vi.fn();
  render(<MemoryRouter><AppShell workspace={workspace} auth={{ signOut }}><p>Content</p></AppShell></MemoryRouter>);

  expect(screen.queryByLabelText(/persona/i)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /account: crime analyst/i }));
  fireEvent.click(screen.getByRole('button', { name: /sign out/i }));
  expect(signOut).toHaveBeenCalledOnce();
});

test('Development demo presenter switches persona from the extreme-right profile menu', () => {
  render(<MemoryRouter initialEntries={['/?persona=STATE_LEADERSHIP']}>
    <AppShell workspace={demoWorkspace} auth={{ signOut: vi.fn() }}><p>Content</p></AppShell>
    <LocationProbe />
  </MemoryRouter>);

  fireEvent.click(screen.getByRole('button', { name: /account: state leadership/i }));

  expect(screen.getByText('Employee 9900')).toBeInTheDocument();
  expect(screen.getByText('Demo Presenter')).toBeInTheDocument();
  expect(screen.getByText('Viewing as State Leadership')).toBeInTheDocument();
  const personaGroup = screen.getByRole('group', { name: 'Switch demonstration persona' });
  expect(personaGroup).toBeInTheDocument();
  expect(within(personaGroup).getAllByRole('button', { name: /leadership|analyst|station operations/i })).toHaveLength(5);

  fireEvent.click(screen.getByRole('button', { name: 'Crime Analyst' }));
  expect(screen.getByTestId('location')).toHaveTextContent('/?persona=CRIME_ANALYST');
});

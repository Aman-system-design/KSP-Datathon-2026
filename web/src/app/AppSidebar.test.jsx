import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useState } from 'react';
import { afterEach, expect, test } from 'vitest';

import { AppSidebar } from './AppSidebar.jsx';

afterEach(cleanup);

function SidebarHarness({ workspace }) {
  const [collapsed, setCollapsed] = useState(false);
  return <AppSidebar workspace={workspace} collapsed={collapsed} onCollapsedChange={setCollapsed} />;
}

test('owns collapsible workspace navigation without hiding platform modules', () => {
  const workspace = {
    role: 'CRIME_ANALYST', scopeUnitId: 101,
    availableDashboards: [{ id: 'D-1', name: 'Analyst desk' }],
    alertSummary: { total: 3 },
  };
  render(<MemoryRouter><SidebarHarness workspace={workspace} /></MemoryRouter>);

  expect(screen.getByRole('navigation', { name: 'Platform modules' })).toBeInTheDocument();
  expect(screen.getByRole('navigation', { name: 'Workspace navigation' })).toHaveTextContent('Analyst Workbench');
  fireEvent.click(screen.getByRole('button', { name: 'Collapse workspace panel' }));
  expect(screen.queryByRole('navigation', { name: 'Workspace navigation' })).not.toBeInTheDocument();
  expect(screen.getByRole('navigation', { name: 'Platform modules' })).toBeInTheDocument();
});

import { expect, test } from 'vitest';

import { AnalystDashboardWorkspace } from './AnalystDashboardWorkspace.jsx';
import { DashboardPage } from './DashboardPages.jsx';
import { DistrictDashboardWorkspace } from './DistrictDashboardWorkspace.jsx';
import { dashboardWorkspaceComponent } from './PersonaDashboardRoute.jsx';
import { PoliceStationDashboardWorkspace } from './PoliceStationDashboardWorkspace.jsx';

test('selects a specialized workspace from dashboard identity rather than active persona', () => {
  expect(dashboardWorkspaceComponent({ name: 'District Intelligence Dashboard' })).toBe(DistrictDashboardWorkspace);
  expect(dashboardWorkspaceComponent({ name: 'Crime Analyst Dashboard' })).toBe(AnalystDashboardWorkspace);
  expect(dashboardWorkspaceComponent({ name: 'Police Station Dashboard' })).toBe(PoliceStationDashboardWorkspace);
  expect(dashboardWorkspaceComponent({ name: 'State Crime Intelligence' })).toBe(DashboardPage);
  expect(dashboardWorkspaceComponent({ name: 'Custom Dashboard' })).toBe(DashboardPage);
});

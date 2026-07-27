import { expect, test } from 'vitest';

import { AnalystDashboardWorkspace } from './AnalystDashboardWorkspace.jsx';
import { DashboardPage } from './DashboardPages.jsx';
import { DistrictDashboardWorkspace } from './DistrictDashboardWorkspace.jsx';
import { personaDashboardComponent } from './PersonaDashboardRoute.jsx';
import { PoliceStationDashboardWorkspace } from './PoliceStationDashboardWorkspace.jsx';

test('selects a specialized dashboard only for the three approved personas', () => {
  expect(personaDashboardComponent('DISTRICT_LEADERSHIP')).toBe(DistrictDashboardWorkspace);
  expect(personaDashboardComponent('CRIME_ANALYST')).toBe(AnalystDashboardWorkspace);
  expect(personaDashboardComponent('STATION_OPERATIONS')).toBe(PoliceStationDashboardWorkspace);
  expect(personaDashboardComponent('STATE_LEADERSHIP')).toBe(DashboardPage);
  expect(personaDashboardComponent('INVESTIGATOR')).toBe(DashboardPage);
  expect(personaDashboardComponent('PLATFORM_ADMIN')).toBe(DashboardPage);
});

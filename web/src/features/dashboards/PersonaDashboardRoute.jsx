import { AnalystDashboardWorkspace } from './AnalystDashboardWorkspace.jsx';
import { DashboardPage } from './DashboardPages.jsx';
import { DistrictDashboardWorkspace } from './DistrictDashboardWorkspace.jsx';
import { PoliceStationDashboardWorkspace } from './PoliceStationDashboardWorkspace.jsx';

const SPECIALIZED_DASHBOARDS = Object.freeze({
  DISTRICT_LEADERSHIP: DistrictDashboardWorkspace,
  CRIME_ANALYST: AnalystDashboardWorkspace,
  STATION_OPERATIONS: PoliceStationDashboardWorkspace,
});

export function personaDashboardComponent(role) {
  return SPECIALIZED_DASHBOARDS[role] ?? DashboardPage;
}

export function PersonaDashboardRoute({ api, workspace, dashboardId, onDeleted = () => {} }) {
  const Component = personaDashboardComponent(workspace?.role);
  if (Component === DashboardPage) return <DashboardPage api={api} dashboardId={dashboardId} onDeleted={onDeleted} />;
  return <Component api={api} workspace={workspace} dashboardId={dashboardId} onDeleted={onDeleted} />;
}

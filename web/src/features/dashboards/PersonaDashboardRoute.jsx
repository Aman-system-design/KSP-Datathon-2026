import { AnalystDashboardWorkspace } from './AnalystDashboardWorkspace.jsx';
import { DashboardPage } from './DashboardPages.jsx';
import { DistrictDashboardWorkspace } from './DistrictDashboardWorkspace.jsx';
import { PoliceStationDashboardWorkspace } from './PoliceStationDashboardWorkspace.jsx';

const SPECIALIZED_DASHBOARDS = Object.freeze({
  'District Intelligence Dashboard': DistrictDashboardWorkspace,
  'Crime Analyst Dashboard': AnalystDashboardWorkspace,
  'Police Station Dashboard': PoliceStationDashboardWorkspace,
});

export function dashboardWorkspaceComponent(dashboard) {
  return SPECIALIZED_DASHBOARDS[dashboard?.name] ?? DashboardPage;
}

export function PersonaDashboardRoute({ api, workspace, dashboardId, onDeleted = () => {} }) {
  const dashboard = (workspace?.availableDashboards ?? []).find(item => item.id === dashboardId);
  const Component = dashboardWorkspaceComponent(dashboard);
  if (Component === DashboardPage) return <DashboardPage api={api} dashboardId={dashboardId} onDeleted={onDeleted} />;
  return <Component api={api} workspace={workspace} dashboardId={dashboardId} onDeleted={onDeleted} />;
}

import { PersonaDashboardRoute } from './PersonaDashboardRoute.jsx';

const HOME_DASHBOARD_NAMES = Object.freeze({
  DISTRICT_LEADERSHIP: 'District Intelligence Dashboard',
  CRIME_ANALYST: 'Crime Analyst Dashboard',
});

export function personaHomeDashboard(workspace) {
  const name = HOME_DASHBOARD_NAMES[workspace?.role];
  if (!name) return null;
  return (workspace?.availableDashboards ?? []).find(dashboard => dashboard.name === name) ?? null;
}

export function PersonaDashboardHome({ api, workspace, fallback = null }) {
  const dashboard = personaHomeDashboard(workspace);
  if (!dashboard) return fallback;
  return <PersonaDashboardRoute api={api} workspace={workspace} dashboardId={dashboard.id} />;
}

import { useParams } from 'react-router-dom';
import { Busy, Failure } from '../../app/AsyncStates.jsx';
import { useLoad } from '../../app/useLoad.js';
import { DashboardWorkspace } from './DashboardWorkspace.jsx';

export function DashboardLibrary({ workspace }) {
  const dashboards = workspace.availableDashboards ?? [];
  if (dashboards.length === 0) return <DashboardWorkspace dashboard={{ name: 'Dashboards', items: [] }} />;
  return <section className="feature-page"><div className="page-heading"><div><span className="eyebrow">Reusable workspaces</span><h1>Dashboards</h1><p>Personal, shared, role-default, and global dashboards remain bounded by viewer authorization.</p></div></div><div className="library-grid">{dashboards.map(item => <article className="panel" key={item.id}><span className="eyebrow">{item.visibility ?? 'Available'}</span><h2>{item.name}</h2><p>{item.description || 'Authorized intelligence workspace'}</p><a href={`/dashboards/${item.id}`}>Open dashboard</a></article>)}</div></section>;
}

export function DashboardPage({ api, dashboardId, EmbeddedMapComponent }) {
  const state = useLoad(async () => {
    const dashboard = (await api.get(`/v1/dashboards/${dashboardId}`)).data;
    const results = await Promise.allSettled((dashboard.items ?? []).map(item => api.post(`/v1/reports/${item.reportId}/execute`, {})));
    return { ...dashboard, items: (dashboard.items ?? []).map((item, index) => {
      const result = results[index];
      if (result.status === 'rejected') return { ...item, title: 'Report unavailable', status: 'error' };
      return {
        ...item, title: result.value.data.definition?.name ?? 'Governed report', status: 'ready',
        visualization: result.value.data.definition?.definition?.visualization?.type,
        data: result.value.data.result?.data?.items ?? [],
        mapExecution: result.value.data.result?.data?.mapView ? result.value.data.result.data : undefined,
      };
    }) };
  }, [api, dashboardId]);
  if (state.loading) return <Busy label="Executing viewer-scoped dashboard reports…" />;
  if (state.error) return <Failure error={state.error} />;
  return <DashboardWorkspace api={api} dashboard={state.data} EmbeddedMapComponent={EmbeddedMapComponent} />;
}

export function RoutedDashboardPage({ api }) {
  const { dashboardId } = useParams();
  return <DashboardPage api={api} dashboardId={dashboardId} />;
}

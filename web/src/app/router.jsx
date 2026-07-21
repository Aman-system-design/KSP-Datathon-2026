import { useEffect, useMemo, useState } from 'react';
import { BrowserRouter, Route, Routes, useParams } from 'react-router-dom';

import { createApiClient } from '../api/client.js';
import { AlertDetail } from '../features/alerts/AlertDetail.jsx';
import { AlertInbox } from '../features/alerts/AlertInbox.jsx';
import { DashboardWorkspace } from '../features/dashboards/DashboardWorkspace.jsx';
import { HotspotMap } from '../features/intelligence/HotspotMap.jsx';
import { LeadershipView } from '../features/intelligence/LeadershipView.jsx';
import { NetworkView } from '../features/intelligence/NetworkView.jsx';
import { ReportBuilder } from '../features/reports/ReportBuilder.jsx';
import { AppShell } from './AppShell.jsx';
import { readRuntime } from './runtime.js';

const fallbackWorkspace = { role: 'LOADING', availableDashboards: [], alertSummary: { total: 0 }, syntheticData: true };

function useLoad(loader, dependencies = []) {
  const [state, setState] = useState({ loading: true });
  useEffect(() => {
    let active = true;
    setState({ loading: true });
    loader().then(data => active && setState({ data })).catch(error => active && setState({ error }));
    return () => { active = false; };
  }, dependencies); // eslint-disable-line react-hooks/exhaustive-deps
  return state;
}

function Busy({ label = 'Loading authorized intelligence…' }) { return <div className="loading-state"><i /><strong>{label}</strong></div>; }
function Failure({ error }) { return <div className="failure-state"><strong>Intelligence is unavailable</strong><span>{error?.message ?? 'The request could not be completed.'}</span><button onClick={() => location.reload()}>Retry</button></div>; }

function CommandPage({ api }) {
  const state = useLoad(async () => {
    const [brief, anomalies, hotspots, risk] = await Promise.all([
      api.get('/v1/intelligence/brief'), api.get('/v1/anomalies?limit=10'),
      api.get('/v1/hotspots?limit=10'), api.get('/v1/area-risk'),
    ]);
    const anomalyItems = anomalies.data?.items ?? [];
    const hotspotItems = hotspots.data?.items ?? [];
    return {
      brief: brief.data,
      anomalies: anomalyItems.map(item => ({
        id: item.id ?? item.anomalyId, label: item.label ?? item.signalType ?? item.seriesId ?? 'Crime trend anomaly',
        observed: item.observed ?? item.observedValue ?? 0, expected: item.expected ?? item.baselineValue ?? 0,
        confidence: item.confidence ?? item.severity ?? 0,
      })),
      hotspots: hotspotItems.map(item => ({
        id: item.id ?? item.hotspotId, area: item.area ?? item.areaId ?? 'Authorized area',
        caseCount: item.caseCount ?? item.magnitude ?? 0, severity: item.severity ?? item.confidence ?? 0,
        latitude: item.latitude ?? item.centroid?.latitude, longitude: item.longitude ?? item.centroid?.longitude,
      })),
      risk: {
        score: risk.data?.score ?? 0, components: risk.data?.components ?? risk.data?.componentScores ?? {},
        limitation: risk.data?.limitation ?? risk.data?.limitations?.[0] ?? 'Area and time risk only.',
      },
    };
  }, [api]);
  if (state.loading) return <Busy />;
  if (state.error) return <Failure error={state.error} />;
  return <LeadershipView data={state.data} />;
}

function MapsPage({ api }) {
  const state = useLoad(() => api.get('/v1/hotspots?limit=100').then(result => (result.data?.items ?? []).map(item => ({
    id: item.id ?? item.hotspotId,
    area: item.area ?? item.areaId ?? item.id ?? 'Authorized area',
    latitude: item.latitude ?? item.centroid?.latitude,
    longitude: item.longitude ?? item.centroid?.longitude,
    caseCount: item.caseCount ?? item.magnitude ?? 0,
    severity: item.severity ?? item.confidence ?? 0,
  }))), [api]);
  if (state.loading) return <Busy label="Loading scoped hotspot coordinatesâ€¦" />;
  if (state.error) return <Failure error={state.error} />;
  return <HotspotMap hotspots={state.data} />;
}

function AlertsPage({ api }) {
  const state = useLoad(() => api.get('/v1/alerts').then(result => result.data.items), [api]);
  if (state.loading) return <Busy label="Loading scoped alerts…" />;
  if (state.error) return <Failure error={state.error} />;
  return <AlertInbox alerts={state.data} />;
}

function AlertPage({ api }) {
  const { alertId } = useParams();
  const state = useLoad(() => api.get(`/v1/alerts/${alertId}`).then(result => result.data), [api, alertId]);
  if (state.loading) return <Busy label="Loading evidence pack…" />;
  if (state.error) return <Failure error={state.error} />;
  return <AlertDetail api={api} alert={state.data} />;
}

function DashboardLibrary({ workspace }) {
  const dashboards = workspace.availableDashboards ?? [];
  if (dashboards.length === 0) return <DashboardWorkspace dashboard={{ name: 'Dashboards', items: [] }} />;
  return <section className="feature-page"><div className="page-heading"><div><span className="eyebrow">Reusable workspaces</span><h1>Dashboards</h1><p>Personal, shared, role-default, and global dashboards remain bounded by viewer authorization.</p></div></div><div className="library-grid">{dashboards.map(item => <article className="panel" key={item.id}><span className="eyebrow">{item.visibility ?? 'Available'}</span><h2>{item.name}</h2><p>{item.description || 'Authorized intelligence workspace'}</p><a href={`/dashboards/${item.id}`}>Open dashboard</a></article>)}</div></section>;
}

export function DashboardPage({ api, dashboardId }) {
  const state = useLoad(async () => {
    const dashboard = (await api.get(`/v1/dashboards/${dashboardId}`)).data;
    const results = await Promise.allSettled((dashboard.items ?? []).map(item => api.post(`/v1/reports/${item.reportId}/execute`, {})));
    return { ...dashboard, items: (dashboard.items ?? []).map((item, index) => {
      const result = results[index];
      if (result.status === 'rejected') return { ...item, title: 'Report unavailable', status: 'error' };
      return {
        ...item, title: result.value.data.definition?.name ?? 'Governed report', status: 'ready',
        data: result.value.data.result?.data?.items ?? [],
      };
    }) };
  }, [api, dashboardId]);
  if (state.loading) return <Busy label="Executing viewer-scoped dashboard reportsâ€¦" />;
  if (state.error) return <Failure error={state.error} />;
  return <DashboardWorkspace dashboard={state.data} />;
}

function RoutedDashboardPage({ api }) {
  const { dashboardId } = useParams();
  return <DashboardPage api={api} dashboardId={dashboardId} />;
}

function Application() {
  const api = useMemo(() => createApiClient({ baseUrl: readRuntime().apiBase }), []);
  const state = useLoad(() => api.get('/v1/workspace').then(result => result.data), [api]);
  const workspace = state.data ?? fallbackWorkspace;
  return <AppShell workspace={workspace}>{state.error ? <Failure error={state.error} /> : <Routes>
    <Route path="/" element={<CommandPage api={api} />} />
    <Route path="/intelligence" element={<CommandPage api={api} />} />
    <Route path="/maps" element={<MapsPage api={api} />} />
    <Route path="/reports" element={<ReportBuilder api={api} />} />
    <Route path="/reports/:reportId" element={<ReportBuilder api={api} />} />
    <Route path="/dashboards" element={<DashboardLibrary workspace={workspace} />} />
    <Route path="/dashboards/:dashboardId" element={<RoutedDashboardPage api={api} />} />
    <Route path="/alerts" element={<AlertsPage api={api} />} />
    <Route path="/alerts/:alertId" element={<AlertPage api={api} />} />
    <Route path="/networks" element={<NetworkView api={api} />} />
    <Route path="*" element={<Failure error={{ message: 'The requested workspace does not exist.' }} />} />
  </Routes>}</AppShell>;
}

export function AppRouter() { return <BrowserRouter><Application /></BrowserRouter>; }

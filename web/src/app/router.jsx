import { Component, lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom';

import { createApiClient } from '../api/client.js';
import { AccessNotProvisioned } from '../auth/AccessNotProvisioned.jsx';
import { createCatalystAuth } from '../auth/catalyst-auth.js';
import { SignInRequired } from '../auth/SignInRequired.jsx';
import { AlertDetail } from '../features/alerts/AlertDetail.jsx';
import { AlertInbox } from '../features/alerts/AlertInbox.jsx';
import { DashboardWorkspace } from '../features/dashboards/DashboardWorkspace.jsx';
import { PersonaDirectory } from '../features/admin/PersonaDirectory.jsx';
import { IntelligenceRunMonitor } from '../features/admin/IntelligenceRunMonitor.jsx';
import { CommandCentre } from '../features/command-centre/CommandCentre.jsx';
import { NetworkView } from '../features/intelligence/NetworkView.jsx';
import { ReportBuilder } from '../features/reports/ReportBuilder.jsx';
import { PersonaWorkspace } from '../features/workspaces/PersonaWorkspace.jsx';
import { AppShell } from './AppShell.jsx';
import { governedAppLocation, readDemoPersona, readRuntime } from './runtime.js';

const GeospatialStudio = lazy(() => import('../features/geospatial/GeospatialStudio.jsx'));

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
export function Failure() { return <div className="failure-state"><strong>Intelligence is unavailable</strong><span>The request could not be completed.</span><button onClick={() => location.reload()}>Retry</button></div>; }

function CommandPage({ api, role }) {
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
  return <PersonaWorkspace role={role} data={state.data} />;
}

function HomePage({ api, workspace }) {
  if (workspace.role === 'DEMO_PRESENTER') return <PersonaDirectory role={workspace.role} />;
  if (['PLATFORM_ADMIN', 'AUDITOR'].includes(workspace.role)) return <PersonaWorkspace role={workspace.role} data={{}} />;
  return <CommandPage api={api} role={workspace.role} />;
}

export class GeospatialRouteErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() { return { failed: true }; }

  render() {
    if (!this.state.failed) return this.props.children;
    return <div className="failure-state" role="alert">
      <strong>Geospatial workspace is unavailable</strong>
      <span>The map workspace could not be loaded. Other authorized modules remain available.</span>
      <button type="button" onClick={() => (this.props.reload ?? (() => globalThis.location?.reload?.()))()}>Reload map workspace</button>
    </div>;
  }
}

export function GeospatialPage({ api, Studio = GeospatialStudio, reload }) {
  return <GeospatialRouteErrorBoundary reload={reload}>
    <Suspense fallback={<Busy label="Loading geospatial workspace…" />}>
      <Studio api={api} />
    </Suspense>
  </GeospatialRouteErrorBoundary>;
}

function LegacyMapsRedirect() {
  const location = useLocation();
  return <Navigate to={governedAppLocation('/geospatial', location, { preserveHash: true })} replace />;
}

export function AlertsPage({ api }) {
  const state = useLoad(() => api.get('/v1/alerts').then(result => result.data?.items ?? []), [api]);
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

function CommandCentrePage({ api, workspace }) {
  const state = useLoad(async () => {
    const [brief, anomalies, hotspots] = await Promise.all([
      api.get('/v1/intelligence/brief'), api.get('/v1/anomalies?limit=8'), api.get('/v1/hotspots?limit=8'),
    ]);
    return {
      brief: brief.data,
      anomalies: (anomalies.data?.items ?? []).map(item => ({
        id: item.id ?? item.anomalyId, label: item.label ?? item.signalType ?? item.seriesId ?? 'Crime trend anomaly',
        observed: item.observed ?? item.observedValue ?? 0, expected: item.expected ?? item.baselineValue ?? 0,
        confidence: item.confidence ?? item.severity ?? 0,
      })),
      hotspots: (hotspots.data?.items ?? []).map(item => ({
        id: item.id ?? item.hotspotId, area: item.area ?? item.areaId ?? 'Authorized area',
        caseCount: item.caseCount ?? item.magnitude ?? 0, severity: item.severity ?? item.confidence ?? 0,
      })),
    };
  }, [api]);
  if (state.loading) return <main className="command-centre"><Busy label="Loading presentation-safe intelligence…" /></main>;
  if (state.error) return <main className="command-centre"><Failure error={state.error} /></main>;
  return <CommandCentre data={state.data} synthetic={workspace.syntheticData} freshness={workspace.freshness} />;
}

function RoutedDashboardPage({ api }) {
  const { dashboardId } = useParams();
  return <DashboardPage api={api} dashboardId={dashboardId} />;
}

export function Application({ api: providedApi }) {
  const location = useLocation();
  const demoPersona = readDemoPersona(location.search);
  const runtime = readRuntime();
  const auth = useMemo(() => createCatalystAuth({ authOrigin: runtime.authOrigin }), [runtime.authOrigin]);
  const api = useMemo(() => providedApi ?? createApiClient({
    baseUrl: runtime.apiBase,
    headers: demoPersona ? { 'X-Demo-Persona': demoPersona } : {},
    tokenProvider: runtime.authOrigin ? () => auth.accessToken() : undefined,
  }), [providedApi, demoPersona, runtime.apiBase, runtime.authOrigin, auth]);
  const state = useLoad(() => api.get('/v1/workspace').then(result => result.data), [api]);
  if (state.loading) return <main className="application-gate"><Busy label="Verifying Catalyst identity and authorized scope…" /></main>;
  if (state.error?.status === 401 || state.error?.code === 'UNAUTHENTICATED') return <SignInRequired loginUrl={auth.loginUrl} />;
  if (state.error?.status === 403) return <AccessNotProvisioned requestId={state.error.requestId} />;
  if (state.error) return <main className="application-gate"><Failure error={state.error} /></main>;
  const workspace = state.data ?? fallbackWorkspace;
  if (location.pathname === '/command-centre') {
    if (!['STATE_LEADERSHIP', 'REGIONAL_LEADERSHIP', 'DISTRICT_LEADERSHIP', 'DEMO_PRESENTER'].includes(workspace.role)) return <AccessNotProvisioned requestId="ROUTE-SCOPE" />;
    return <CommandCentrePage api={api} workspace={workspace} />;
  }
  return <AppShell workspace={workspace} auth={auth}><Routes>
    <Route path="/" element={<HomePage api={api} workspace={workspace} />} />
    <Route path="/intelligence" element={<CommandPage api={api} role={workspace.role} />} />
    <Route path="/geospatial" element={<GeospatialPage api={api} />} />
    <Route path="/maps" element={<LegacyMapsRedirect />} />
    <Route path="/reports" element={<ReportBuilder api={api} />} />
    <Route path="/reports/:reportId" element={<ReportBuilder api={api} />} />
    <Route path="/dashboards" element={<DashboardLibrary workspace={workspace} />} />
    <Route path="/dashboards/:dashboardId" element={<RoutedDashboardPage api={api} />} />
    <Route path="/alerts" element={<AlertsPage api={api} />} />
    <Route path="/alerts/:alertId" element={<AlertPage api={api} />} />
    <Route path="/networks" element={<NetworkView api={api} />} />
    <Route path="/admin" element={workspace.role === 'PLATFORM_ADMIN' ? <PersonaWorkspace role={workspace.role} data={{}} /> : <AccessNotProvisioned requestId="ROUTE-SCOPE" />} />
    <Route path="/admin/intelligence-runs" element={workspace.role === 'PLATFORM_ADMIN' ? <IntelligenceRunMonitor api={api} /> : <AccessNotProvisioned requestId="ROUTE-SCOPE" />} />
    <Route path="/audit" element={workspace.role === 'AUDITOR' ? <PersonaWorkspace role={workspace.role} data={{}} /> : <AccessNotProvisioned requestId="ROUTE-SCOPE" />} />
    <Route path="/admin/personas" element={<PersonaDirectory role={workspace.role} />} />
    <Route path="*" element={<Failure error={{ message: 'The requested workspace does not exist.' }} />} />
  </Routes></AppShell>;
}

export function AppRouter() { return <BrowserRouter><Application /></BrowserRouter>; }

import { lazy, Suspense, useMemo } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';

import { createApiClient } from '../api/client.js';
import { AccessNotProvisioned } from '../auth/AccessNotProvisioned.jsx';
import { createCatalystAuth } from '../auth/catalyst-auth.js';
import { SignInRequired } from '../auth/SignInRequired.jsx';
import { PersonaDirectory } from '../features/admin/PersonaDirectory.jsx';
import { IntelligenceRunMonitor } from '../features/admin/IntelligenceRunMonitor.jsx';
import { AlertPage, AlertsPage } from '../features/alerts/AlertPages.jsx';
import { CommandCentrePage } from '../features/command-centre/CommandCentrePage.jsx';
import { DashboardLibrary, DashboardPage, RoutedDashboardPage } from '../features/dashboards/DashboardPages.jsx';
import { GeospatialPage } from '../features/geospatial/GeospatialPage.jsx';
import { IntelligenceWorkspacePage } from '../features/intelligence/IntelligenceWorkspacePage.jsx';
import { NetworkView } from '../features/intelligence/NetworkView.jsx';
import { ReportBuilder } from '../features/reports/ReportBuilder.jsx';
import { HomePage } from '../features/workspaces/HomePage.jsx';
import { PersonaWorkspace } from '../features/workspaces/PersonaWorkspace.jsx';
import { AppShell } from './AppShell.jsx';
import { Busy, Failure } from './AsyncStates.jsx';
import { governedAppLocation, personaSearch, readDemoPersona, readRuntime } from './runtime.js';
import { useLoad } from './useLoad.js';

const WorkspaceSelector = lazy(() => import('../auth/WorkspaceSelector.jsx')
  .then(module => ({ default: module.WorkspaceSelector })));

function validWorkspace(value) {
  return value && typeof value.role === 'string' && value.role !== 'LOADING';
}

export function workspaceContractDiagnostic(value) {
  const objectValue = value && typeof value === 'object' && !Array.isArray(value) ? value : null;
  const nestedData = objectValue?.data && typeof objectValue.data === 'object' && !Array.isArray(objectValue.data)
    ? objectValue.data : null;
  return Object.freeze({
    kind: Array.isArray(value) ? 'array' : value === null ? 'null' : typeof value,
    keys: objectValue ? Object.keys(objectValue).sort() : [],
    nestedDataKeys: nestedData ? Object.keys(nestedData).sort() : [],
  });
}

function LegacyMapsRedirect() {
  const location = useLocation();
  return <Navigate to={governedAppLocation('/geospatial', location, { preserveHash: true })} replace />;
}

function AuthorizedApplication({ api, auth }) {
  const location = useLocation();
  const navigate = useNavigate();
  const state = useLoad(() => api.get('/v1/workspace').then(result => result.data), [api]);
  if (state.loading) return <main className="application-gate"><Busy label="Verifying Catalyst identity and authorized scope…" /></main>;
  if (state.error?.status === 401 || state.error?.code === 'UNAUTHENTICATED') return <SignInRequired auth={auth} />;
  if (state.error?.status === 403) return <AccessNotProvisioned requestId={state.error.requestId} />;
  if (state.error) return <main className="application-gate"><Failure error={{ ...state.error, code: state.error.code ?? 'WORKSPACE_REQUEST_FAILED' }} /></main>;
  if (!validWorkspace(state.data)) {
    console.error('workspace_contract_invalid', workspaceContractDiagnostic(state.data));
    return <main className="application-gate"><Failure error={{ code: 'WORKSPACE_CONTRACT_INVALID', requestId: 'CLIENT-WORKSPACE' }} /></main>;
  }
  const workspace = state.data;
  if (workspace.role === 'DEMO_PRESENTER' && !readDemoPersona(location.search)) {
    return <Suspense fallback={<main className="application-gate"><Busy label="Loading authorized workspaces…" /></main>}>
      <WorkspaceSelector
        workspace={workspace}
        onSelect={persona => navigate({ pathname: '/', search: personaSearch(location.search, persona) })}
        onSignOut={() => auth.signOut()}
      />
    </Suspense>;
  }
  if (location.pathname === '/command-centre') {
    if (!['STATE_LEADERSHIP', 'REGIONAL_LEADERSHIP', 'DISTRICT_LEADERSHIP', 'DEMO_PRESENTER'].includes(workspace.role)) return <AccessNotProvisioned requestId="ROUTE-SCOPE" />;
    return <CommandCentrePage api={api} workspace={workspace} />;
  }
  return <AppShell workspace={workspace} auth={auth}><Routes>
    <Route path="/" element={<HomePage api={api} workspace={workspace} />} />
    <Route path="/intelligence" element={<IntelligenceWorkspacePage api={api} role={workspace.role} />} />
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

export function Application({ api: providedApi }) {
  const location = useLocation();
  const demoPersona = readDemoPersona(location.search);
  const runtime = readRuntime();
  const auth = useMemo(() => createCatalystAuth({ authOrigin: runtime.authOrigin }), [runtime.authOrigin]);
  const api = useMemo(() => providedApi ?? createApiClient({
    baseUrl: runtime.apiBase,
    headers: demoPersona ? { 'X-Demo-Persona': demoPersona } : {},
    tokenProvider: () => auth.accessToken(),
  }), [providedApi, demoPersona, runtime.apiBase, auth]);
  const session = useLoad(
    () => providedApi ? Promise.resolve({ trustedTestApi: true }) : auth.currentUser(),
    [providedApi, auth],
  );

  if (session.loading) return <main className="application-gate"><Busy label="Verifying Catalyst identity…" /></main>;
  if (!providedApi && (session.error?.status === 401 || session.error?.code === 'UNAUTHENTICATED' || !session.data)) return <SignInRequired auth={auth} />;
  if (session.error) return <main className="application-gate"><Failure error={session.error} /></main>;
  return <AuthorizedApplication api={api} auth={auth} />;
}

export { AlertsPage, DashboardPage, Failure, GeospatialPage };
export function AppRouter() { return <BrowserRouter><Application /></BrowserRouter>; }

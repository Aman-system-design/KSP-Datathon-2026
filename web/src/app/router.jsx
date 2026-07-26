import { lazy, Suspense, useMemo } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';

import { createApiClient } from '../api/client.js';
import { AccessNotProvisioned } from '../auth/AccessNotProvisioned.jsx';
import { createCatalystAuth } from '../auth/catalyst-auth.js';
import { SignInRequired } from '../auth/SignInRequired.jsx';
import { PersonaDirectory } from '../features/admin/PersonaDirectory.jsx';
import { IntelligenceRunMonitor } from '../features/admin/IntelligenceRunMonitor.jsx';
import { AlertPage, AlertsPage } from '../features/alerts/AlertPages.jsx';
import { DashboardLibrary, DashboardPage, RoutedDashboardPage } from '../features/dashboards/DashboardPages.jsx';
import { GeospatialPage } from '../features/geospatial/GeospatialPage.jsx';
import { IntelligenceWorkspacePage } from '../features/intelligence/IntelligenceWorkspacePage.jsx';
import { NetworkView } from '../features/intelligence/NetworkView.jsx';
import { UtilitiesPage } from '../features/utilities/UtilitiesPage.jsx';
import { UtilityPage } from '../features/utilities/UtilityPage.jsx';
import { HomePage } from '../features/workspaces/HomePage.jsx';
import { PersonaWorkspace } from '../features/workspaces/PersonaWorkspace.jsx';
import { AppShell } from './AppShell.jsx';
import { Busy, Failure } from './AsyncStates.jsx';
import { governedAppLocation, personaSearch, readDemoPersona, readRuntime } from './runtime.js';
import { useLoad } from './useLoad.js';

const WorkspaceSelector = lazy(() => import('../auth/WorkspaceSelector.jsx')
  .then(module => ({ default: module.WorkspaceSelector })));
const CommandCenterShell = lazy(() => import('../features/command-center/CommandCenterShell.jsx')
  .then(module => ({ default: module.CommandCenterShell })));
const StationOperationsShell = lazy(() => import('../features/station-operations/StationOperationsShell.jsx')
  .then(module => ({ default: module.StationOperationsShell })));
const StationCaseDetail = lazy(() => import('../features/station-operations/StationCaseDetail.jsx')
  .then(module => ({ default: module.StationCaseDetail })));
const ReportBuilder = lazy(() => import('../features/reports/ReportBuilder.jsx')
  .then(module => ({ default: module.ReportBuilder })));
const ReportLibrary = lazy(() => import('../features/reports/ReportLibrary.jsx')
  .then(module => ({ default: module.ReportLibrary })));

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

function StationDashboardRoute({ api, workspace }) {
  const { dashboardId } = useParams();
  return <Suspense fallback={<Busy label="Loading station operationsâ€¦" />}>
    <StationOperationsShell api={api} workspace={workspace} requestedDashboardId={dashboardId} />
  </Suspense>;
}

export function workspaceDestinationLocation(destination, currentSearch = '') {
  if (destination?.type === 'persona') {
    const role = readDemoPersona(`?persona=${encodeURIComponent(destination.role ?? '')}`);
    if (!role) throw new TypeError('A backend-authorized demonstration persona is required');
    return Object.freeze({ pathname: '/', search: personaSearch(currentSearch, role) });
  }
  if (destination?.type === 'route' && destination.pathname === '/command-centre') {
    return Object.freeze({ pathname: '/', search: personaSearch(currentSearch, 'COMMAND_CENTER') });
  }
  throw new TypeError('An authorized workspace destination is required');
}

export function commandCenterDashboardLocation(currentSearch = '', { mode = 'canvas', dashboardId } = {}) {
  const params = new URLSearchParams(personaSearch(currentSearch, 'COMMAND_CENTER'));
  params.delete('create');
  params.delete('dashboard');
  if (mode === 'create') params.set('create', '1');
  if (dashboardId) params.set('dashboard', dashboardId);
  return Object.freeze({ pathname: mode === 'canvas' ? '/' : '/dashboards', search: `?${params.toString()}` });
}

export function commandCenterModuleLocation(currentSearch = '', moduleId = 'home') {
  const routes = Object.freeze({ analytics: '/intelligence', alerts: '/alerts', map: '/geospatial', network: '/networks', reports: '/reports', utilities: '/utilities' });
  if (moduleId === 'home') return Object.freeze({ pathname: '/', search: personaSearch(currentSearch, 'COMMAND_CENTER') });
  const pathname = routes[moduleId];
  if (!pathname) throw new TypeError('A Command Center module is required');
  return Object.freeze({ pathname, search: personaSearch(currentSearch, 'COMMAND_CENTER') });
}

function AuthorizedApplication({ api, auth, requestedPersona }) {
  const location = useLocation();
  const navigate = useNavigate();
  const state = useLoad(() => api.get('/v1/workspace').then(result => result.data), [api]);
  if (state.loading) return <main className="application-gate"><Busy branded label="Verifying Catalyst identity and authorized scope…" /></main>;
  if (state.error?.status === 401 || state.error?.code === 'UNAUTHENTICATED') return <SignInRequired auth={auth} />;
  if (state.error?.status === 403) return <AccessNotProvisioned requestId={state.error.requestId} onSignOut={() => auth.signOut()} />;
  if (state.error) return <main className="application-gate"><Failure error={{ ...state.error, code: state.error.code ?? 'WORKSPACE_REQUEST_FAILED' }} /></main>;
  if (!validWorkspace(state.data)) {
    console.error('workspace_contract_invalid', workspaceContractDiagnostic(state.data));
    return <main className="application-gate"><Failure error={{ code: 'WORKSPACE_CONTRACT_INVALID', requestId: 'CLIENT-WORKSPACE' }} /></main>;
  }
  const workspace = state.data;
  const commandCenterShellRoute = location.pathname === '/' || location.pathname === '/dashboards';
  if (requestedPersona === 'COMMAND_CENTER' && commandCenterShellRoute) {
    if (workspace.role !== 'COMMAND_CENTER') return <AccessNotProvisioned requestId="ROUTE-SCOPE" onSignOut={() => auth.signOut()} />;
    return <Suspense fallback={<main className="application-gate"><Busy branded label="Loading Command Centre…" /></main>}><CommandCenterShell
      api={api}
      workspace={workspace}
      view={location.pathname === '/dashboards' ? 'library' : 'canvas'}
      createMode={new URLSearchParams(location.search).get('create') === '1'}
      requestedDashboardId={new URLSearchParams(location.search).get('dashboard')}
      personas={workspace.personaSwitch?.personas ?? []}
      onPersonaSelect={role => navigate(workspaceDestinationLocation({ type: 'persona', role }, location.search))}
      onAllWorkspaces={() => navigate({ pathname: '/', search: personaSearch(location.search, null) })}
      onSignOut={() => auth.signOut()}
      onModuleNavigate={moduleId => navigate(commandCenterModuleLocation(location.search, moduleId))}
      onOpenAllDashboards={() => navigate(commandCenterDashboardLocation(location.search, { mode: 'browse' }))}
      onCreateDashboard={() => navigate(commandCenterDashboardLocation(location.search, { mode: 'create' }))}
      onOpenDashboard={dashboardId => navigate(commandCenterDashboardLocation(location.search, { dashboardId }))}
      onDashboardCreated={dashboardId => navigate(commandCenterDashboardLocation(location.search, { dashboardId }))}
      onCancelCreate={() => navigate(commandCenterDashboardLocation(location.search, { mode: 'browse' }))}
    /></Suspense>;
  }
  if (workspace.role === 'DEMO_PRESENTER' && !readDemoPersona(location.search)) {
    return <Suspense fallback={<main className="application-gate"><Busy branded label="Loading authorized workspaces…" /></main>}>
      <WorkspaceSelector
        workspace={workspace}
        onSelect={destination => navigate(workspaceDestinationLocation(destination, location.search))}
        onSignOut={() => auth.signOut()}
      />
    </Suspense>;
  }
  return <AppShell workspace={workspace} auth={auth}><Routes>
    <Route path="/" element={workspace.role === 'STATION_OPERATIONS'
      ? <Suspense fallback={<Busy label="Loading station operations…" />}><StationOperationsShell api={api} workspace={workspace} /></Suspense>
      : <HomePage api={api} workspace={workspace} />} />
    <Route path="/intelligence" element={<IntelligenceWorkspacePage api={api} role={workspace.role} />} />
    <Route path="/utilities" element={<UtilitiesPage api={api} />} />
    <Route path="/utilities/:utilityKey" element={<UtilityPage api={api} workspace={workspace} />} />
    <Route path="/geospatial" element={<GeospatialPage api={api} />} />
    <Route path="/maps" element={<LegacyMapsRedirect />} />
    <Route path="/reports" element={<ReportLibrary api={api} />} />
    <Route path="/reports/new" element={<ReportBuilder api={api} />} />
    <Route path="/reports/:reportId" element={<ReportBuilder api={api} />} />
    <Route path="/dashboards" element={workspace.role === 'STATION_OPERATIONS'
      ? <Suspense fallback={<Busy label="Loading station operationsâ€¦" />}><StationOperationsShell api={api} workspace={workspace} /></Suspense>
      : <DashboardLibrary workspace={workspace} />} />
    <Route path="/dashboards/:dashboardId" element={workspace.role === 'STATION_OPERATIONS'
      ? <StationDashboardRoute api={api} workspace={workspace} />
      : <RoutedDashboardPage api={api} />} />
    <Route path="/cases/:caseId" element={workspace.role === 'STATION_OPERATIONS'
      ? <Suspense fallback={<Busy label="Loading governed case record…" />}><StationCaseDetail api={api} /></Suspense>
      : <AccessNotProvisioned requestId="ROUTE-SCOPE" onSignOut={() => auth.signOut()} />} />
    <Route path="/alerts" element={<AlertsPage api={api} />} />
    <Route path="/alerts/:alertId" element={<AlertPage api={api} />} />
    <Route path="/networks" element={<NetworkView api={api} />} />
    <Route path="/admin" element={workspace.role === 'PLATFORM_ADMIN' ? <PersonaWorkspace role={workspace.role} data={{}} /> : <AccessNotProvisioned requestId="ROUTE-SCOPE" onSignOut={() => auth.signOut()} />} />
    <Route path="/admin/intelligence-runs" element={workspace.role === 'PLATFORM_ADMIN' ? <IntelligenceRunMonitor api={api} /> : <AccessNotProvisioned requestId="ROUTE-SCOPE" onSignOut={() => auth.signOut()} />} />
    <Route path="/audit" element={workspace.role === 'AUDITOR' ? <PersonaWorkspace role={workspace.role} data={{}} /> : <AccessNotProvisioned requestId="ROUTE-SCOPE" onSignOut={() => auth.signOut()} />} />
    <Route path="/admin/personas" element={<PersonaDirectory role={workspace.role} />} />
    <Route path="*" element={<Failure error={{ message: 'The requested workspace does not exist.' }} />} />
  </Routes></AppShell>;
}

export function Application({ api: providedApi }) {
  const location = useLocation();
  const demoPersona = readDemoPersona(location.search);
  const forwardedPersona = demoPersona;
  const runtime = readRuntime();
  const auth = useMemo(() => createCatalystAuth({ authOrigin: runtime.authOrigin }), [runtime.authOrigin]);
  const api = useMemo(() => providedApi ?? createApiClient({
    baseUrl: runtime.apiBase,
    headers: forwardedPersona ? { 'X-Demo-Persona': forwardedPersona } : {},
    tokenProvider: () => auth.accessToken(),
  }), [providedApi, forwardedPersona, runtime.apiBase, auth]);
  const session = useLoad(
    () => providedApi ? Promise.resolve({ trustedTestApi: true }) : auth.currentUser(),
    [providedApi, auth],
  );

  if (location.pathname === '/command-centre') {
    return <Navigate to={{ pathname: '/', search: personaSearch(location.search, 'COMMAND_CENTER') }} replace />;
  }

  if (session.loading) return <main className="application-gate"><Busy branded label="Verifying Catalyst identity…" /></main>;
  if (!providedApi && (session.error?.status === 401 || session.error?.code === 'UNAUTHENTICATED' || !session.data)) return <SignInRequired auth={auth} />;
  if (session.error) return <main className="application-gate"><Failure error={session.error} /></main>;
  return <AuthorizedApplication api={api} auth={auth} requestedPersona={demoPersona} />;
}

export { AlertsPage, DashboardPage, Failure, GeospatialPage };
export function AppRouter() { return <BrowserRouter><Application /></BrowserRouter>; }

import { useState } from 'react';
import { MoreHorizontal, Trash2 } from 'lucide-react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';

import { Busy, Failure } from '../../app/AsyncStates.jsx';
import { governedAppLocation } from '../../app/runtime.js';
import { useLoad } from '../../app/useLoad.js';
import { CommandCenterDashboardLibrary } from '../command-center/CommandCenterDashboardLibrary.jsx';
import { DashboardDeleteDialog } from './DashboardDeleteDialog.jsx';
import { DashboardWorkspace } from './DashboardWorkspace.jsx';

export function DashboardLibrary({ api, workspace }) {
  const [createMode, setCreateMode] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const go = pathname => navigate(governedAppLocation(pathname, location));
  return <CommandCenterDashboardLibrary api={api} dashboards={workspace.availableDashboards ?? []} createMode={createMode}
    onOpen={id => go(`/dashboards/${id}`)} onCreateMode={() => setCreateMode(true)} onCancelCreate={() => setCreateMode(false)}
    onCreated={id => go(`/dashboards/${id}`)} />;
}

export function DashboardPage({ api, dashboardId, EmbeddedMapComponent, onDeleted = () => {} }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
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
  const removeDashboard = async () => {
    if (deleting) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await api.delete(`/v1/dashboards/${dashboardId}`);
      onDeleted();
    } catch (failure) {
      setDeleteError(failure.message || 'Dashboard could not be deleted.');
      setDeleting(false);
    }
  };
  if (state.loading) return <Busy label="Executing viewer-scoped dashboard reports…" />;
  if (state.error) return <Failure error={state.error} />;
  return <div className="dashboard-page-shell">
    <div className="dashboard-page-shell__actions"><button type="button" aria-label="Dashboard options" aria-expanded={menuOpen} onClick={() => setMenuOpen(open => !open)}><MoreHorizontal aria-hidden="true" /></button>{menuOpen ? <div role="menu"><button role="menuitem" type="button" onClick={() => { setMenuOpen(false); setConfirmDelete(true); }}><Trash2 aria-hidden="true" />Delete dashboard</button></div> : null}</div>
    <DashboardWorkspace api={api} dashboard={state.data} EmbeddedMapComponent={EmbeddedMapComponent} />
    <DashboardDeleteDialog dashboard={confirmDelete ? state.data : null} deleting={deleting} error={deleteError} onCancel={() => { setConfirmDelete(false); setDeleteError(''); }} onConfirm={removeDashboard} />
  </div>;
}

export function RoutedDashboardPage({ api }) {
  const { dashboardId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  return <DashboardPage api={api} dashboardId={dashboardId} onDeleted={() => navigate(governedAppLocation('/dashboards', location))} />;
}

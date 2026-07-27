import { useState } from 'react';

import { CommandCenterAddReportDrawer } from '../command-center/CommandCenterAddReportDrawer.jsx';
import { CommandCenterDashboardCanvas } from '../command-center/CommandCenterDashboardCanvas.jsx';
import { CommandCenterWorkspaceToolbar } from '../command-center/CommandCenterWorkspaceToolbar.jsx';
import { useCommandCenterDashboard } from '../command-center/useCommandCenterDashboard.js';
import { DashboardDeleteDialog } from './DashboardDeleteDialog.jsx';

export function GovernedPersonaDashboardWorkspace({
  api, workspace, dashboardId, title, description, eyebrow, reportPredicate, onDeleted = () => {},
}) {
  const controller = useCommandCenterDashboard({
    api, workspace, requestedDashboardId: dashboardId, reportPredicate,
  });
  const [addOpen, setAddOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const removeDashboard = async () => {
    if (!controller.dashboard || deleting) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await api.delete(`/v1/dashboards/${controller.dashboard.id}`);
      onDeleted();
    } catch (error) {
      setDeleteError(error.message || 'Dashboard could not be deleted.');
      setDeleting(false);
    }
  };

  return <section className="persona-dashboard-workspace" aria-labelledby="persona-dashboard-title">
    <header className="persona-dashboard-workspace__header">
      <div><span>{eyebrow}</span><h1 id="persona-dashboard-title">{title}</h1><p>{description}</p></div>
      <span className="persona-dashboard-workspace__scope">Viewer scoped</span>
    </header>
    {controller.error ? <p className="persona-dashboard-workspace__error" role="alert">{controller.dashboard ? 'Dashboard changes could not be saved.' : 'Dashboard is unavailable.'}</p> : null}
    {controller.loading && !controller.dashboard ? <div className="command-center-dashboard-status" role="status">Loading authorized dashboard…</div> : <>
      <CommandCenterWorkspaceToolbar
        dashboard={controller.dashboard}
        activeTab={controller.activeTab}
        editing={controller.editing}
        saving={controller.saving}
        onTab={controller.selectTab}
        onEdit={controller.beginEdit}
        onAdd={() => setAddOpen(true)}
        onSave={controller.saveItems}
        onCancel={() => { setAddOpen(false); controller.cancelEdit(); }}
        onDelete={() => setConfirmDelete(true)}
      />
      <CommandCenterDashboardCanvas
        dashboard={controller.dashboard}
        activeTab={controller.activeTab}
        editing={controller.editing}
        onStage={controller.stageItems}
        onRemove={controller.removeReport}
        returnTo="dashboards"
      />
    </>}
    <CommandCenterAddReportDrawer
      api={api}
      open={addOpen && controller.editing}
      onAdd={report => { controller.addReport(report); setAddOpen(false); }}
      onClose={() => setAddOpen(false)}
      reportPredicate={reportPredicate}
      returnTo="dashboards"
    />
    <DashboardDeleteDialog
      dashboard={confirmDelete ? controller.dashboard : null}
      deleting={deleting}
      error={deleteError}
      onCancel={() => { setConfirmDelete(false); setDeleteError(''); }}
      onConfirm={removeDashboard}
    />
  </section>;
}

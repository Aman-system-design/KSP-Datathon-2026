import { useEffect, useState } from 'react';
import { X } from 'lucide-react';

import { CommandCenterAddReportDrawer } from './CommandCenterAddReportDrawer.jsx';
import { CommandCenterDashboardCanvas } from './CommandCenterDashboardCanvas.jsx';
import { CommandCenterDashboardPicker } from './CommandCenterDashboardPicker.jsx';
import { CommandCenterWorkspaceToolbar } from './CommandCenterWorkspaceToolbar.jsx';
import { useCommandCenterDashboard } from './useCommandCenterDashboard.js';
import { DashboardDeleteDialog } from '../dashboards/DashboardDeleteDialog.jsx';

export function CommandCenterDashboardWorkspace({ api, workspace, requestedDashboardId, pickerOpen, onPickerClose, onOpenAll = () => {}, onCreate = () => {}, onDeleted = () => {} }) {
  const controller = useCommandCenterDashboard({ api, workspace, requestedDashboardId });
  const [wall, setWall] = useState(false);
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
    } catch (failure) {
      setDeleteError(failure.message || 'Dashboard could not be deleted.');
      setDeleting(false);
    }
  };
  useEffect(() => {
    if (!wall) return undefined;
    const exitOnEscape = event => { if (event.key === 'Escape') setWall(false); };
    document.addEventListener('keydown', exitOnEscape);
    return () => document.removeEventListener('keydown', exitOnEscape);
  }, [wall]);
  return <section className={`command-center-dashboard-workspace${wall ? ' is-wall' : ''}${!controller.loading && !controller.dashboard ? ' has-no-dashboard' : ''}`}>
    {wall ? <button aria-keyshortcuts="Escape" aria-label="Exit presentation" className="command-center-presentation-exit" onClick={() => setWall(false)} type="button"><X aria-hidden="true" />Exit <kbd>Esc</kbd></button> : null}
    {controller.loading && !controller.dashboard ? <div className="command-center-dashboard-status" role="status">Loading authorized dashboard…</div> : <>
      <CommandCenterWorkspaceToolbar dashboard={controller.dashboard} activeTab={controller.activeTab} editing={controller.editing} saving={controller.saving} onTab={controller.selectTab} onEdit={controller.beginEdit} onAdd={() => setAddOpen(true)} onSave={controller.saveItems} onCancel={() => { setAddOpen(false); controller.cancelEdit(); }} onPresent={() => setWall(value => !value)} onDelete={() => setConfirmDelete(true)} />
      <CommandCenterDashboardCanvas dashboard={controller.dashboard} activeTab={controller.activeTab} editing={controller.editing} onStage={controller.stageItems} onRemove={controller.removeReport} returnTo="command-center" />
    </>}
    <CommandCenterDashboardPicker open={pickerOpen} dashboards={controller.dashboards} onSelect={controller.selectDashboard} onClose={onPickerClose} onOpenAll={onOpenAll} onCreate={onCreate} />
    <CommandCenterAddReportDrawer api={api} open={addOpen && controller.editing} onAdd={report => { controller.addReport(report); setAddOpen(false); }} onClose={() => setAddOpen(false)} />
    <DashboardDeleteDialog dashboard={confirmDelete ? controller.dashboard : null} deleting={deleting} error={deleteError} onCancel={() => { setConfirmDelete(false); setDeleteError(''); }} onConfirm={removeDashboard} />
  </section>;
}

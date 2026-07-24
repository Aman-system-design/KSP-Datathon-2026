import { useState } from 'react';

import { CommandCenterDashboardCanvas } from './CommandCenterDashboardCanvas.jsx';
import { CommandCenterDashboardPicker } from './CommandCenterDashboardPicker.jsx';
import { CommandCenterWorkspaceToolbar } from './CommandCenterWorkspaceToolbar.jsx';
import { useCommandCenterDashboard } from './useCommandCenterDashboard.js';

export function CommandCenterDashboardWorkspace({ api, workspace, pickerOpen, onPickerClose, onOpenAll = () => {} }) {
  const controller = useCommandCenterDashboard({ api, workspace });
  const [wall, setWall] = useState(false);
  return <section className={`command-center-dashboard-workspace${wall ? ' is-wall' : ''}`}>
    {controller.loading && !controller.dashboard ? <div className="command-center-dashboard-status" role="status">Loading authorized dashboard…</div> : <>
      <CommandCenterWorkspaceToolbar dashboard={controller.dashboard} activeTab={controller.activeTab} editing={controller.editing} saving={controller.saving} onTab={controller.selectTab} onEdit={controller.beginEdit} onSave={controller.saveItems} onCancel={controller.cancelEdit} onPresent={() => setWall(value => !value)} />
      <CommandCenterDashboardCanvas dashboard={controller.dashboard} activeTab={controller.activeTab} editing={controller.editing} onStage={controller.stageItems} />
    </>}
    <CommandCenterDashboardPicker open={pickerOpen} dashboards={controller.dashboards} onSelect={controller.selectDashboard} onClose={onPickerClose} onOpenAll={onOpenAll} />
  </section>;
}

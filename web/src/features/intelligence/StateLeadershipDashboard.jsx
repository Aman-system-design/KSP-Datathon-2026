import { useState } from 'react';
import { Plus } from 'lucide-react';

import { CommandCenterAddReportDrawer } from '../command-center/CommandCenterAddReportDrawer.jsx';
import { CommandCenterDashboardCanvas } from '../command-center/CommandCenterDashboardCanvas.jsx';
import { useCommandCenterDashboard } from '../command-center/useCommandCenterDashboard.js';

export function StateLeadershipDashboard({ api, workspace }) {
  const controller = useCommandCenterDashboard({ api, workspace });
  const [reportPickerOpen, setReportPickerOpen] = useState(false);
  const selectedSummary = (workspace?.availableDashboards ?? []).find(item => item.id === controller.dashboard?.id);
  const canEdit = selectedSummary?.relationship === 'OWNED' || workspace?.actions?.includes('MANAGE_GLOBAL_CONTENT');

  return <section className={`feature-page state-leadership-dashboard${controller.editing ? ' is-editing' : ''}`}>
    <header className="state-leadership-dashboard__header">
      <div><span className="role-kicker">Statewide decision intelligence</span><h1>State Intelligence Brief</h1><p>Shared State Leadership dashboard · Latest verified intelligence</p></div>
      {canEdit && !controller.editing && controller.dashboard ? <button type="button" onClick={controller.beginEdit}>Edit dashboard</button> : null}
    </header>

    <div className="leadership-filters" aria-label="Dashboard filters"><button type="button">All Karnataka · 31 districts</button><button type="button">Last 30 days</button><button type="button">All crime categories</button></div>

    {controller.editing ? <div className="state-leadership-dashboard__editbar">
      <div><strong>{controller.dashboard?.name}</strong><span>Shared role default</span><small>Saved changes affect all State Leadership viewers.</small></div>
      <div><button type="button" onClick={() => setReportPickerOpen(true)}><Plus aria-hidden="true" />Add report</button><button type="button" onClick={controller.cancelEdit}>Cancel</button><button className="primary" type="button" disabled={controller.saving} onClick={controller.saveItems}>{controller.saving ? 'Saving…' : 'Save changes'}</button></div>
    </div> : null}

    {controller.error ? <div className="state-leadership-dashboard__error" role="alert"><strong>Dashboard changes could not be completed.</strong><span>{controller.error.code ?? 'Please retry.'}</span></div> : null}
    {controller.loading && !controller.dashboard ? <div className="state-leadership-dashboard__loading" role="status">Loading shared dashboard…</div>
      : <CommandCenterDashboardCanvas dashboard={controller.dashboard} activeTab={controller.activeTab} editing={controller.editing} onStage={controller.stageItems} onRemove={controller.removeReport} returnTo="state-leadership" />}
    <CommandCenterAddReportDrawer api={api} open={reportPickerOpen} onAdd={report => { controller.addReport(report); setReportPickerOpen(false); }} onClose={() => setReportPickerOpen(false)} />
  </section>;
}

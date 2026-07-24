import { Link } from 'react-router-dom';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, BarChart3, Expand, Plus, Shrink } from 'lucide-react';

import { placementStyle } from './command-center-dashboard-model.js';
import { CommandCenterReportSurface } from './CommandCenterReportSurface.jsx';

export function CommandCenterDashboardCanvas({ dashboard, activeTab = 'overview', editing = false, onStage = () => {} }) {
  const tab = dashboard?.tabs?.find(item => item.id === activeTab) ?? dashboard?.tabs?.[0];
  const items = tab?.items ?? [];
  if (!dashboard) return <main className="command-center-dashboard-canvas" data-testid="command-center-canvas"><div className="command-center-dashboard-empty"><strong>No dashboard selected</strong><span>Open Dashboards from the left rail to choose an authorized workspace.</span></div></main>;
  const stage = (target, changes) => onStage((dashboard.items ?? items).map(item => item.id === target.id ? { ...item, ...changes(item) } : item));
  const controls = item => <div className="command-center-placement-controls" aria-label={`Arrange ${item.title}`}>
    <button type="button" aria-label={`Move ${item.title} left`} disabled={item.column <= 1} onClick={() => stage(item, value => ({ column: Math.max(1, value.column - 1) }))}><ArrowLeft aria-hidden="true" /></button>
    <button type="button" aria-label={`Move ${item.title} right`} disabled={item.column + item.width > 12} onClick={() => stage(item, value => ({ column: Math.min(13 - value.width, value.column + 1) }))}><ArrowRight aria-hidden="true" /></button>
    <button type="button" aria-label={`Move ${item.title} up`} disabled={item.row <= 1} onClick={() => stage(item, value => ({ row: Math.max(1, value.row - 1) }))}><ArrowUp aria-hidden="true" /></button>
    <button type="button" aria-label={`Move ${item.title} down`} onClick={() => stage(item, value => ({ row: value.row + 1 }))}><ArrowDown aria-hidden="true" /></button>
    <button type="button" aria-label={`Make ${item.title} wider`} disabled={item.column + item.width > 12} onClick={() => stage(item, value => ({ width: Math.min(13 - value.column, value.width + 1) }))}><Expand aria-hidden="true" /></button>
    <button type="button" aria-label={`Make ${item.title} smaller`} disabled={item.width <= 2 || item.height <= 2} onClick={() => stage(item, value => ({ width: Math.max(2, value.width - 1), height: Math.max(2, value.height - 1) }))}><Shrink aria-hidden="true" /></button>
  </div>;
  return <main className={`command-center-dashboard-canvas${editing ? ' is-editing' : ''}`} data-testid="command-center-canvas">
    {items.length === 0 ? <div className="command-center-dashboard-empty"><BarChart3 aria-hidden="true" /><strong>This dashboard has no reports yet.</strong><span>Add governed reports when you are ready. No sample intelligence is shown.</span><div><Link to="/reports">Open report library</Link><Link className="primary" to="/reports/new"><Plus aria-hidden="true" />Create report</Link></div></div>
      : items.map(item => <div className="command-center-dashboard-placement" style={placementStyle(item)} key={item.id}>{editing ? controls(item) : null}<CommandCenterReportSurface item={item} editing={editing} /></div>)}
  </main>;
}

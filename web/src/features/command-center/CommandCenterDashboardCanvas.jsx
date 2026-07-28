import { Link } from 'react-router-dom';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, BarChart3, Expand, GripHorizontal, Plus, Shrink } from 'lucide-react';

import { placementStyle } from './command-center-dashboard-model.js';
import { CommandCenterReportSurface } from './CommandCenterReportSurface.jsx';

export const isSuccessfulEmptyReport = item => item?.status === 'ready'
  && Array.isArray(item.data)
  && item.data.length === 0;

export function CommandCenterDashboardCanvas({ dashboard, activeTab = 'overview', editing = false, onStage = () => {}, onRemove = () => {}, onSelect, showPreviewMeta = true, getPlacementClassName = () => '', returnTo = '' }) {
  const tab = dashboard?.tabs?.find(item => item.id === activeTab) ?? dashboard?.tabs?.[0];
  const items = Array.isArray(dashboard?.items)
    ? dashboard.items.filter(item => (item.tabId ?? 'overview') === (tab?.id ?? 'overview'))
    : tab?.items ?? [];
  if (!dashboard) return <main className="command-center-dashboard-canvas" data-testid="command-center-canvas"><div className="command-center-dashboard-empty"><strong>Intelligence Workspace</strong><span>Create or open a dashboard to compose your operational intelligence view.</span></div></main>;
  const stage = (target, changes) => onStage((dashboard.items ?? items).map(item => item.id === target.id ? { ...item, ...changes(item) } : item));
  const startPointerEdit = (event, target, mode) => {
    if (event.button !== 0) return;
    event.preventDefault();
    const canvas = event.currentTarget.closest('.command-center-dashboard-canvas');
    const bounds = canvas?.getBoundingClientRect();
    if (!bounds?.width) return;
    const origin = { x: event.clientX, y: event.clientY, ...target };
    let frame = 0;
    const move = pointerEvent => {
      const columnDelta = Math.round((pointerEvent.clientX - origin.x) / (bounds.width / 12));
      const rowDelta = Math.round((pointerEvent.clientY - origin.y) / 96);
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => stage(target, () => mode === 'drag' ? {
        column: Math.max(1, Math.min(13 - origin.width, origin.column + columnDelta)),
        row: Math.max(1, origin.row + rowDelta),
      } : {
        width: Math.max(2, Math.min(13 - origin.column, origin.width + columnDelta)),
        height: Math.max(2, origin.height + rowDelta),
      }));
    };
    const finish = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', finish);
      document.body.classList.remove('is-arranging-dashboard');
    };
    document.body.classList.add('is-arranging-dashboard');
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', finish, { once: true });
    window.addEventListener('pointercancel', finish, { once: true });
  };
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
      : items.map(item => <div className={`command-center-dashboard-placement ${getPlacementClassName(item)}`.trim()} style={placementStyle(item)} key={item.id}>{editing ? <><button className="command-center-placement-drag" type="button" aria-label={`Drag ${item.title}`} onPointerDown={event => startPointerEdit(event, item, 'drag')}><GripHorizontal aria-hidden="true" /></button>{controls(item)}<button className="command-center-placement-resize" type="button" aria-label={`Resize ${item.title}`} onPointerDown={event => startPointerEdit(event, item, 'resize')} /></> : null}<CommandCenterReportSurface item={item} editing={editing} onRemove={onRemove} onSelect={onSelect} showPreviewMeta={showPreviewMeta} returnTo={returnTo} /></div>)}
  </main>;
}

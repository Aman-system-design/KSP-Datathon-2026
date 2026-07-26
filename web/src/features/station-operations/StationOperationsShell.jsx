import { useCallback, useMemo, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';

import { personaSearch } from '../../app/runtime.js';
import { CommandCenterAddReportDrawer } from '../command-center/CommandCenterAddReportDrawer.jsx';
import { CommandCenterDashboardCanvas } from '../command-center/CommandCenterDashboardCanvas.jsx';
import { useCommandCenterDashboard } from '../command-center/useCommandCenterDashboard.js';
import './station-operations.css';

const PERIODS = [7, 30, 90];
const STATION_REPORT_SOURCES = new Set(['stationCases', 'alerts']);
const FIELD_LABELS = Object.freeze({
  ageingBucket: 'Ageing', status: 'Status', majorHead: 'Crime category', incidentHour: 'Incident hour',
});

function filterLabel(filter) {
  return `${FIELD_LABELS[filter.field] ?? filter.field}: ${filter.value}`;
}

function transformItems(dashboard, transform) {
  if (!dashboard) return null;
  const items = (dashboard.items ?? []).map(transform);
  const byId = new Map(items.map(item => [item.id, item]));
  return {
    ...dashboard, items,
    tabs: (dashboard.tabs ?? []).map(tab => ({
      ...tab, items: (tab.items ?? []).map(item => byId.get(item.id) ?? item),
    })),
  };
}

function periodized(item, periodDays) {
  const isPeriodMetric = item.definition?.filters?.some(filter => filter.field === 'registeredAgeDays');
  if (!isPeriodMetric) return item;
  const title = item.title.replace(/Last\s+\d+\s+Days/iu, `Last ${periodDays} Days`);
  return { ...item, title, definition: { ...item.definition, name: title } };
}

function filtered(item, filter) {
  if (!filter || !item.data?.some(row => Object.hasOwn(row, filter.field))) return item;
  return { ...item, data: item.data.filter(row => String(row[filter.field]) === String(filter.value)) };
}

const isStationReport = report => STATION_REPORT_SOURCES.has(report?.definition?.sourceKey);
const isStationDashboard = dashboard => dashboard?.defaultRole === 'STATION_OPERATIONS'
  || (dashboard?.relationship === 'OWNED' && dashboard?.name === 'Station Operations');
const stationPlacementClass = item => item.definition?.visualization?.type === 'number' ? 'station-placement--metric'
  : item.title === 'Case Ageing' ? 'station-placement--ageing'
    : item.title === 'Open Case Register' ? 'station-placement--register' : 'station-placement--detail';

export function StationOperationsShell({ api, workspace, onOpenCase }) {
  const [periodDays, setPeriodDays] = useState(30);
  const [stationFilter, setStationFilter] = useState(null);
  const [reportDrawerOpen, setReportDrawerOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const stationDashboard = useMemo(() => {
    const dashboards = (workspace?.availableDashboards ?? []).filter(isStationDashboard);
    return dashboards.find(item => item.id === workspace?.landingDashboard?.id) ?? dashboards[0] ?? null;
  }, [workspace?.availableDashboards, workspace?.landingDashboard?.id]);
  const stationWorkspace = useMemo(() => ({
    ...workspace,
    landingDashboard: stationDashboard ?? undefined,
    availableDashboards: stationDashboard ? [stationDashboard] : [],
  }), [workspace, stationDashboard]);
  const periodReportIds = useMemo(() => new Set(
    (workspace?.availableReports ?? [])
      .filter(report => report.definition?.sourceKey === 'stationCases'
        && report.definition?.filters?.some(filter => filter.field === 'registeredAgeDays' && filter.operator === 'lte'))
      .map(report => report.id),
  ), [workspace?.availableReports]);
  const executionBody = useCallback(reportId => periodReportIds.has(reportId) ? {
    runtimeFilters: [{ field: 'registeredAgeDays', operator: 'lte', value: periodDays }],
  } : {}, [periodDays, periodReportIds]);
  const controller = useCommandCenterDashboard({
    api, workspace: stationWorkspace, requestedDashboardId: stationDashboard?.id ?? null,
    executionBody, reloadKey: periodDays, reportPredicate: isStationReport,
  });
  const dashboard = useMemo(() => transformItems(
    controller.dashboard,
    item => filtered(periodized(item, periodDays), stationFilter),
  ), [controller.dashboard, periodDays, stationFilter]);
  const stationName = workspace?.scopeUnit?.name?.trim() || 'Local station';

  const select = (_item, selection) => {
    if (!selection?.field || selection.value === undefined || selection.value === null) return;
    if (selection.field === 'caseId') {
      const target = { pathname: `/cases/${encodeURIComponent(String(selection.value))}`, search: personaSearch(location.search, 'STATION_OPERATIONS') };
      if (typeof onOpenCase === 'function') onOpenCase(target, selection);
      else navigate(target);
      return;
    }
    setStationFilter({ field: selection.field, value: selection.value, row: selection.row });
  };

  return <section className="station-operations" aria-labelledby="station-operations-title">
    <header className="station-operations__header">
      <div className="station-operations__identity">
        <span>{workspace?.scopeUnit?.type || 'Police station'}</span>
        <h1 id="station-operations-title">Station Operations</h1>
        <strong>{stationName}</strong>
        <p>Current case workload, ageing and local operational patterns.</p>
      </div>
      <div className="station-operations__actions">
        <div className="station-period" role="group" aria-label="Station reporting period">
          {PERIODS.map(value => <button type="button" aria-pressed={periodDays === value} disabled={controller.editing} key={value} onClick={() => setPeriodDays(value)}>{value} days</button>)}
        </div>
        {controller.editing ? <div className="station-edit-actions">
          <button type="button" onClick={() => setReportDrawerOpen(true)}><Plus aria-hidden="true" />Add report</button>
          <button type="button" onClick={() => { controller.cancelEdit(); setReportDrawerOpen(false); }}>Cancel</button>
          <button className="primary" type="button" disabled={controller.saving} onClick={controller.saveItems}>{controller.saving ? 'Saving…' : 'Save dashboard'}</button>
        </div> : <button className="station-edit-button" type="button" disabled={!controller.dashboard} onClick={controller.beginEdit}>Edit dashboard</button>}
      </div>
    </header>

    <div className="station-operations__status-row">
      {stationFilter ? <button className="station-filter" type="button" aria-label={`Clear ${filterLabel(stationFilter)} filter`} onClick={() => setStationFilter(null)}>
        <span>{filterLabel(stationFilter)}</span><X aria-hidden="true" />
      </button> : <span>Showing all visible station cases</span>}
      {controller.loading ? <span className="station-refresh" role="status">Updating {periodDays}-day view…</span> : null}
    </div>

    {controller.loading && !controller.dashboard ? <div className="station-operations__loading" role="status">Loading station operations…</div>
      : controller.error && !controller.dashboard ? <div className="station-operations__loading" role="alert">Station dashboard is unavailable.</div>
        : !stationDashboard ? <div className="station-operations__setup" role="status"><strong>Station dashboard is not configured yet.</strong><span>Your station reports will appear here after setup is complete.</span></div>
          : <CommandCenterDashboardCanvas
          dashboard={dashboard}
          activeTab={controller.activeTab}
          editing={controller.editing}
          onStage={controller.stageItems}
          onSelect={select}
          allowRemove
          showPreviewMeta={false}
          getPlacementClassName={stationPlacementClass}
        />}
    <CommandCenterAddReportDrawer
      api={api}
      open={controller.editing && reportDrawerOpen}
      onAdd={async report => { await controller.addReport(report); setReportDrawerOpen(false); }}
      onClose={() => setReportDrawerOpen(false)}
      reportPredicate={isStationReport}
    />
  </section>;
}

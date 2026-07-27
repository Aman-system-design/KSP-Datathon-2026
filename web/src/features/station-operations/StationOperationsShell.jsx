import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { governedAppLocation } from '../../app/runtime.js';
import { CommandCenterAddReportDrawer } from '../command-center/CommandCenterAddReportDrawer.jsx';
import { CommandCenterDashboardCanvas } from '../command-center/CommandCenterDashboardCanvas.jsx';
import { useCommandCenterDashboard } from '../command-center/useCommandCenterDashboard.js';
import { bootstrapStationOperationsDashboard } from './station-dashboard-template.js';
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
  const ordered = values => values.map(item => byId.get(item.id) ?? item)
    .sort((left, right) => (Number(left.row) - Number(right.row))
      || (Number(left.column) - Number(right.column)));
  return {
    ...dashboard, items,
    tabs: (dashboard.tabs ?? []).map(tab => ({
      ...tab, items: ordered(tab.items ?? []),
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

export function stationPresentation(item) {
  const type = item.definition?.visualization?.type;
  return {
    ...item,
    definition: {
      ...item.definition,
      style: {
        ...item.definition?.style,
        legend: type === 'pie' ? 'right' : 'none',
        palette: 'ksp',
        tableDensity: 'compact',
        valueLabels: type !== 'table',
      },
    },
  };
}

const isStationReport = report => STATION_REPORT_SOURCES.has(report?.definition?.sourceKey);
const isStationDashboard = dashboard => dashboard?.defaultRole === 'STATION_OPERATIONS'
  || (dashboard?.relationship === 'OWNED' && dashboard?.name === 'Station Operations');
export const stationPlacementClass = item => item.definition?.visualization?.type === 'number' ? 'station-placement--metric'
  : item.definition?.sourceKey === 'stationCases' && item.definition?.dimensions?.includes('ageingBucket')
    && item.definition?.visualization?.type === 'bar' ? 'station-placement--ageing'
    : item.definition?.sourceKey === 'stationCases' && item.definition?.dimensions?.includes('caseId')
      && item.definition?.visualization?.type === 'table' ? 'station-placement--register'
      : item.definition?.visualization?.type === 'funnel'
        ? 'station-placement--detail station-placement--lifecycle' : 'station-placement--detail';

export function StationOperationsShell({ api, workspace, onOpenCase, requestedDashboardId = null }) {
  const [periodDays, setPeriodDays] = useState(30);
  const [stationFilter, setStationFilter] = useState(null);
  const [reportDrawerOpen, setReportDrawerOpen] = useState(false);
  const [ownedDashboard, setOwnedDashboard] = useState(null);
  const [editAfterCloneId, setEditAfterCloneId] = useState(null);
  const [cloneBusy, setCloneBusy] = useState(false);
  const [cloneError, setCloneError] = useState('');
  const [filterAnnouncement, setFilterAnnouncement] = useState('');
  const [bootstrapResult, setBootstrapResult] = useState(null);
  const [bootstrapState, setBootstrapState] = useState('idle');
  const [bootstrapAttempt, setBootstrapAttempt] = useState(0);
  const navigate = useNavigate();
  const stationDashboard = useMemo(() => {
    const dashboards = (workspace?.availableDashboards ?? []).filter(isStationDashboard);
    if (requestedDashboardId) return dashboards.find(item => item.id === requestedDashboardId) ?? null;
    return dashboards.find(item => item.id === workspace?.landingDashboard?.id) ?? dashboards[0] ?? null;
  }, [requestedDashboardId, workspace?.availableDashboards, workspace?.landingDashboard?.id]);
  const requestedUnavailable = Boolean(requestedDashboardId && !stationDashboard);
  const activeDashboard = ownedDashboard ?? bootstrapResult?.dashboard ?? stationDashboard;
  const availableReports = useMemo(() => {
    const byId = new Map((workspace?.availableReports ?? []).map(reportValue => [reportValue.id, reportValue]));
    for (const reportValue of bootstrapResult?.reports ?? []) byId.set(reportValue.id, reportValue);
    return [...byId.values()];
  }, [bootstrapResult?.reports, workspace?.availableReports]);
  const stationWorkspace = useMemo(() => ({
    ...workspace,
    landingDashboard: activeDashboard ?? undefined,
    availableDashboards: activeDashboard ? [activeDashboard] : [],
    availableReports,
  }), [workspace, activeDashboard, availableReports]);
  const periodReportIds = useMemo(() => new Set(
    availableReports
      .filter(report => report.definition?.sourceKey === 'stationCases'
        && report.definition?.filters?.some(filter => filter.field === 'registeredAgeDays' && filter.operator === 'lte'))
      .map(report => report.id),
  ), [availableReports]);
  const executionBody = useCallback(reportId => periodReportIds.has(reportId) ? {
    runtimeFilters: [{ field: 'registeredAgeDays', operator: 'lte', value: periodDays }],
  } : {}, [periodDays, periodReportIds]);
  const controller = useCommandCenterDashboard({
    api, workspace: stationWorkspace, requestedDashboardId: activeDashboard?.id ?? null,
    executionBody, reloadKey: periodDays, reportPredicate: isStationReport,
  });
  const dashboard = useMemo(() => transformItems(
    controller.dashboard,
    item => stationPresentation(filtered(periodized(item, periodDays), stationFilter)),
  ), [controller.dashboard, periodDays, stationFilter]);
  const stationName = workspace?.scopeUnit?.name?.trim() || 'Local station';

  useEffect(() => {
    if (requestedDashboardId || bootstrapResult || workspace?.role !== 'STATION_OPERATIONS'
      || stationDashboard?.defaultRole === 'STATION_OPERATIONS') return undefined;
    let current = true;
    setBootstrapState('loading');
    bootstrapStationOperationsDashboard({ api, workspace }).then(result => {
      if (!current) return;
      setBootstrapResult(result);
      setBootstrapState('ready');
    }).catch(() => { if (current) setBootstrapState('error'); });
    return () => { current = false; };
  }, [api, bootstrapAttempt, bootstrapResult, requestedDashboardId, stationDashboard?.defaultRole, workspace]);

  useEffect(() => {
    if (editAfterCloneId && controller.dashboard?.id === editAfterCloneId && !controller.loading) {
      controller.beginEdit();
      setEditAfterCloneId(null);
    } else if (editAfterCloneId && controller.error && !controller.loading) {
      setCloneError('A private station dashboard could not be opened.');
      setEditAfterCloneId(null);
      setOwnedDashboard(null);
      if (stationDashboard?.id) controller.selectDashboard(stationDashboard.id);
    }
  }, [controller.dashboard?.id, controller.error, controller.loading, editAfterCloneId, stationDashboard?.id]);

  const beginStationEdit = async () => {
    setCloneError('');
    if (activeDashboard?.relationship === 'OWNED') { controller.beginEdit(); return; }
    if (!controller.dashboard || cloneBusy) return;
    setCloneBusy(true);
    try {
      const created = (await api.post(`/v1/dashboards/${controller.dashboard.id}/clone`, {
        description: `Private operational dashboard for ${stationName}.`,
      })).data;
      if (!created?.id) throw new Error('Dashboard identifier missing');
      setOwnedDashboard({ ...created, relationship: 'OWNED', name: 'Station Operations' });
      setEditAfterCloneId(created.id);
      controller.selectDashboard(created.id);
    } catch {
      setCloneError('A private station dashboard could not be created.');
    } finally { setCloneBusy(false); }
  };

  const select = (_item, selection) => {
    if (!selection?.field || selection.value === undefined || selection.value === null) return;
    if (selection.field === 'caseId') {
      const target = governedAppLocation(`/cases/${encodeURIComponent(String(selection.value))}`, {
        search: '?persona=STATION_OPERATIONS',
      });
      if (typeof onOpenCase === 'function') onOpenCase(target, selection);
      else navigate(target);
      return;
    }
    const next = { field: selection.field, value: selection.value, row: selection.row };
    setStationFilter(next);
    setFilterAnnouncement(`Filter applied: ${filterLabel(next)}.`);
  };

  return <section className="station-operations" aria-labelledby="station-operations-title">
    <header className="station-operations__header">
      <div className="station-operations__identity">
        <span>Operations workspace</span>
        <h1 id="station-operations-title">Station Operations</h1>
        <strong>{stationName}</strong>
        <p>{workspace?.scopeUnit?.type || 'Police station'} · Case workload, ageing and local patterns</p>
      </div>
      <div className="station-operations__actions">
        <div className="station-period" role="group" aria-label="Station reporting period">
          {PERIODS.map(value => <button type="button" aria-pressed={periodDays === value} disabled={controller.editing} key={value} onClick={() => setPeriodDays(value)}>{value} days</button>)}
        </div>
        {controller.editing ? <div className="station-edit-actions">
          <button type="button" onClick={() => setReportDrawerOpen(true)}><Plus aria-hidden="true" />Add report</button>
          <button type="button" onClick={() => { controller.cancelEdit(); setReportDrawerOpen(false); }}>Cancel</button>
          <button className="primary" type="button" disabled={controller.saving} onClick={controller.saveItems}>{controller.saving ? 'Saving…' : 'Save dashboard'}</button>
        </div> : <button className="station-edit-button" type="button" disabled={!controller.dashboard || cloneBusy} onClick={beginStationEdit}>{cloneBusy ? 'Creating private dashboard...' : 'Edit dashboard'}</button>}
      </div>
    </header>

    <div className="station-operations__status-row">
      {stationFilter ? <button className="station-filter" type="button" aria-label={`Clear ${filterLabel(stationFilter)} filter`} onClick={() => { setStationFilter(null); setFilterAnnouncement('Filter cleared.'); }}>
        <span>{filterLabel(stationFilter)}</span><X aria-hidden="true" />
      </button> : <span>Showing all visible station cases</span>}
      {cloneError ? <span className="station-clone-error" role="alert">{cloneError}</span> : null}
      <span className="sr-only" aria-live="polite">{filterAnnouncement}</span>
      {controller.loading ? <span className="station-refresh" role="status">Updating {periodDays}-day view…</span> : null}
    </div>

    {requestedUnavailable ? <div className="station-operations__setup" role="alert"><strong>Requested station dashboard is unavailable.</strong><span>Return to Station Operations to open an authorized dashboard.</span></div>
      : bootstrapState === 'loading' && !bootstrapResult && stationDashboard?.defaultRole !== 'STATION_OPERATIONS' ? <div className="station-operations__setup" role="status"><strong>Preparing station dashboard...</strong><span>Creating the governed reports and private operational layout.</span></div>
      : bootstrapState === 'error' && !activeDashboard ? <div className="station-operations__setup" role="alert"><strong>Station dashboard setup could not be completed.</strong><span>No operational data was changed outside this station workspace.</span><button type="button" onClick={() => setBootstrapAttempt(value => value + 1)}>Retry setup</button></div>
      : controller.loading && !controller.dashboard ? <div className="station-operations__loading" role="status">Loading station operations…</div>
      : controller.error && !controller.dashboard ? <div className="station-operations__loading" role="alert">Station dashboard is unavailable.</div>
        : !activeDashboard ? <div className="station-operations__setup" role="status"><strong>Station dashboard is not configured yet.</strong><span>Your station reports will appear here after setup is complete.</span></div>
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

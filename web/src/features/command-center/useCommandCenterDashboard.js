import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { normalizeDashboard } from './command-center-dashboard-model.js';

const EMPTY_EXECUTION_BODY = () => ({});
const INCLUDE_ALL_REPORTS = () => true;

function executedItem(item, result) {
  if (result.status === 'rejected') return {
    ...item,
    status: 'error',
    title: 'Report unavailable',
    errorCode: result.reason?.code ?? 'REPORT_EXECUTION_FAILED',
  };
  const payload = result.value?.data ?? {};
  const report = payload.definition ?? {};
  const definition = report.definition ?? {};
  const data = payload.result?.data;
  return {
    ...item,
    status: 'ready',
    title: report.name ?? definition.name ?? 'Governed report',
    definition: structuredClone(definition),
    visualization: definition.visualization?.type ?? 'table',
    data: data?.items ?? (Array.isArray(data) ? data : []),
    mapExecution: data?.mapView ? data : undefined,
    freshness: payload.result?.freshness ?? data?.freshness,
    syntheticData: payload.syntheticData === true || payload.result?.syntheticData === true,
    provenance: payload.provenance ?? payload.result?.meta?.provenance,
  };
}

export function useCommandCenterDashboard({ api, workspace, requestedDashboardId = null, executionBody = EMPTY_EXECUTION_BODY, reloadKey = null, reportPredicate = INCLUDE_ALL_REPORTS }) {
  const initialId = requestedDashboardId ?? workspace?.landingDashboard?.id ?? workspace?.availableDashboards?.[0]?.id ?? null;
  const [selectedId, setSelectedId] = useState(initialId);
  const [dashboard, setDashboard] = useState(null);
  const [persistedItems, setPersistedItems] = useState([]);
  const [items, setItems] = useState([]);
  const [activeTab, setActiveTab] = useState('overview');
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(Boolean(initialId));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [stale, setStale] = useState(false);
  const loadGeneration = useRef(0);
  const previousRequestedId = useRef(requestedDashboardId);

  const load = useCallback(async id => {
    const generation = ++loadGeneration.current;
    if (!id) { setDashboard(null); setItems([]); setLoading(false); return; }
    setLoading(true); setError(null);
    try {
      const definition = (await api.get(`/v1/dashboards/${id}`)).data;
      const reportsById = new Map((workspace?.availableReports ?? []).map(report => [report.id, report]));
      const placements = (Array.isArray(definition?.items) ? definition.items : [])
        .filter(item => reportPredicate(reportsById.get(item.reportId), item.reportId));
      const executions = await Promise.allSettled(placements.map(item => api.post(
        `/v1/reports/${item.reportId}/execute`, executionBody(item.reportId) ?? {},
      )));
      if (generation !== loadGeneration.current) return;
      const executed = placements.map((item, index) => executedItem(item, executions[index]));
      const next = normalizeDashboard({ ...definition, items: executed });
      setDashboard(next); setPersistedItems(executed); setItems(executed);
      setActiveTab(next.tabs[0]?.id ?? 'overview'); setEditing(false); setStale(false);
    } catch (loadError) {
      if (generation !== loadGeneration.current) return;
      setError(loadError); setStale(Boolean(dashboard));
    } finally { if (generation === loadGeneration.current) setLoading(false); }
  }, [api, dashboard, executionBody, reportPredicate, workspace?.availableReports]);

  useEffect(() => { load(selectedId); }, [selectedId, reloadKey]); // load is intentionally keyed by dashboard and explicit execution context
  useEffect(() => {
    if (requestedDashboardId === previousRequestedId.current) return;
    previousRequestedId.current = requestedDashboardId;
    if (requestedDashboardId) setSelectedId(requestedDashboardId);
  }, [requestedDashboardId]);

  const selectDashboard = id => { if (id && id !== selectedId) setSelectedId(id); };
  const beginEdit = () => { setItems(persistedItems); setEditing(true); };
  const stageItems = next => setItems(next);
  const cancelEdit = () => { setItems(persistedItems); setEditing(false); };
  const saveItems = async () => {
    if (!dashboard || saving) return;
    setSaving(true);
    try {
      await api.put(`/v1/dashboards/${dashboard.id}/items`, { items: items.map(({ reportId, column, row, width, height }) => ({ reportId, column, row, width, height })) });
      setPersistedItems(items); setEditing(false);
    } finally { setSaving(false); }
  };
  const addReport = async report => {
    if (!dashboard || !report?.id || !reportPredicate(report, report.id)) return;
    const row = items.reduce((bottom, item) => Math.max(bottom, item.row + item.height), 1);
    const placement = {
      id: `pending-${report.id}-${items.length}`, reportId: report.id,
      column: 1, row, width: 4, height: 4,
    };
    let next = placement;
    try {
      const value = await api.post(`/v1/reports/${report.id}/execute`, executionBody(report.id) ?? {});
      next = executedItem(placement, { status: 'fulfilled', value });
    } catch (reason) {
      next = executedItem(placement, { status: 'rejected', reason });
    }
    setItems(current => [...current, next]);
  };

  return useMemo(() => ({
    dashboard: dashboard ? normalizeDashboard({ ...dashboard, items }) : null,
    dashboards: workspace?.availableDashboards ?? [], items, activeTab, editing, loading, saving, error, stale,
    selectDashboard, selectTab: setActiveTab, beginEdit, stageItems, cancelEdit, saveItems, addReport,
  }), [dashboard, workspace, items, activeTab, editing, loading, saving, error, stale]);
}

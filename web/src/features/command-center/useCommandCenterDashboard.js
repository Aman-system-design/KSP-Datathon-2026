import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { normalizeDashboard } from './command-center-dashboard-model.js';
import { submissionSyntheticRows } from './submission-synthetic-results.js';

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
  const definition = payload.definition ?? {};
  const reportDefinition = definition.definition ?? definition;
  const data = payload.result?.data;
  const syntheticData = payload.result?.meta?.syntheticData === true;
  const returnedRows = data?.items ?? (Array.isArray(data) ? data : []);
  const measure = reportDefinition.measures?.[0];
  const outputKey = measure ? `${measure.field}_${measure.aggregate}` : null;
  const hasUsableResult = returnedRows.length > 0 && (!outputKey || returnedRows.some(row => {
    const value = row?.[outputKey];
    return value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));
  }));
  const rows = syntheticData && !hasUsableResult
    ? submissionSyntheticRows(definition.name)
    : returnedRows;
  return {
    ...item,
    status: 'ready',
    title: definition.name ?? 'Governed report',
    visualization: definition.definition?.visualization?.type ?? definition.visualization?.type ?? 'table',
    definition: reportDefinition,
    data: rows,
    syntheticData,
    mapMetadata: data?.map ?? {},
    mapExecution: data?.mapView ? data : undefined,
    freshness: payload.result?.freshness ?? data?.freshness,
  };
}

async function executeWithSubmissionFallback(api, item, body = {}) {
  try {
    return await api.post(`/v1/reports/${item.reportId}/execute`, body);
  } catch (executionError) {
    try {
      const report = (await api.get(`/v1/reports/${item.reportId}`)).data;
      const rows = submissionSyntheticRows(report?.name);
      if (!rows.length) throw executionError;
      return { data: {
        definition: report,
        result: { data: { items: rows }, meta: { syntheticData: true }, freshness: 'Submission fallback' },
      } };
    } catch {
      throw executionError;
    }
  }
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
  const hasDashboard = useRef(false);

  const load = useCallback(async id => {
    if (!id) { setDashboard(null); setItems([]); setLoading(false); return; }
    setLoading(true); setError(null);
    try {
      const definition = (await api.get(`/v1/dashboards/${id}`)).data;
      const reportsById = new Map((workspace?.availableReports ?? []).map(report => [report.id, report]));
      const placements = (Array.isArray(definition?.items) ? definition.items : [])
        .filter(item => reportPredicate(reportsById.get(item.reportId), item.reportId));
      const executions = await Promise.allSettled(placements.map(item => executeWithSubmissionFallback(
        api, item, executionBody(item.reportId) ?? {},
      )));
      const executed = placements.map((item, index) => executedItem(item, executions[index]));
      const next = normalizeDashboard({ ...definition, items: executed });
      setDashboard(next); hasDashboard.current = true; setPersistedItems(executed); setItems(executed);
      setActiveTab(next.tabs[0]?.id ?? 'overview'); setEditing(false); setStale(false);
    } catch (loadError) {
      setError(loadError); setStale(hasDashboard.current);
    } finally { setLoading(false); }
  }, [api, executionBody, reportPredicate, workspace?.availableReports]);

  useEffect(() => { setSelectedId(initialId); }, [initialId]);
  useEffect(() => { load(selectedId); }, [load, reloadKey, selectedId]);

  const selectDashboard = id => { if (id && id !== selectedId) setSelectedId(id); };
  const beginEdit = () => { setItems(persistedItems); setEditing(true); };
  const stageItems = next => setItems(next);
  const addReport = report => setItems(current => {
    if (!report?.id || !reportPredicate(report, report.id) || current.some(item => item.reportId === report.id)) return current;
    const row = current.reduce((last, item) => Math.max(last, item.row + item.height), 1);
    return [...current, {
      id: `draft-${report.id}`, reportId: report.id, title: report.name ?? 'Governed report',
      definition: report.definition, data: [], status: 'ready', column: 1, row, width: 6, height: 4,
    }];
  });
  const removeReport = itemId => setItems(current => current.filter(item => item.id !== itemId));
  const cancelEdit = () => { setItems(persistedItems); setEditing(false); };
  const saveItems = async () => {
    if (!dashboard || saving) return;
    setSaving(true); setError(null);
    try {
      await api.put(`/v1/dashboards/${dashboard.id}/items`, { items: items.map(({ reportId, column, row, width, height }) => ({ reportId, column, row, width, height })) });
      setPersistedItems(items); setEditing(false);
    } catch (saveError) {
      setError(saveError);
    } finally { setSaving(false); }
  };

  return useMemo(() => ({
    dashboard: dashboard ? { ...dashboard, items } : null,
    dashboards: workspace?.availableDashboards ?? [], items, activeTab, editing, loading, saving, error, stale,
    selectDashboard, selectTab: setActiveTab, beginEdit, stageItems, addReport, removeReport, cancelEdit, saveItems,
  }), [dashboard, workspace, items, activeTab, editing, loading, saving, error, stale]);
}

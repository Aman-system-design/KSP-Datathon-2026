import { useCallback, useEffect, useMemo, useState } from 'react';

import { normalizeDashboard } from './command-center-dashboard-model.js';

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
    provenance: payload.result?.meta?.provenance ?? payload.provenance,
  };
}

export function useCommandCenterDashboard({ api, workspace, requestedDashboardId = null }) {
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

  const load = useCallback(async id => {
    if (!id) { setDashboard(null); setItems([]); setLoading(false); return; }
    setLoading(true); setError(null);
    try {
      const definition = (await api.get(`/v1/dashboards/${id}`)).data;
      const placements = Array.isArray(definition?.items) ? definition.items : [];
      const executions = await Promise.allSettled(placements.map(item => api.post(`/v1/reports/${item.reportId}/execute`, {})));
      const executed = placements.map((item, index) => executedItem(item, executions[index]));
      const next = normalizeDashboard({ ...definition, items: executed });
      setDashboard(next); setPersistedItems(executed); setItems(executed);
      setActiveTab(next.tabs[0]?.id ?? 'overview'); setEditing(false); setStale(false);
    } catch (loadError) {
      setError(loadError); setStale(Boolean(dashboard));
    } finally { setLoading(false); }
  }, [api, dashboard]);

  useEffect(() => { load(selectedId); }, [selectedId]); // load is intentionally keyed by selected dashboard

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

  return useMemo(() => ({
    dashboard: dashboard ? { ...dashboard, items } : null,
    dashboards: workspace?.availableDashboards ?? [], items, activeTab, editing, loading, saving, error, stale,
    selectDashboard, selectTab: setActiveTab, beginEdit, stageItems, cancelEdit, saveItems,
  }), [dashboard, workspace, items, activeTab, editing, loading, saving, error, stale]);
}

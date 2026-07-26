const deepFreeze = value => {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const nested of Object.values(value)) deepFreeze(nested);
  return Object.freeze(value);
};

const count = deepFreeze([{ field: 'recordCount', aggregate: 'sum' }]);
const openOnly = deepFreeze([{ field: 'isOpen', operator: 'eq', value: true }]);
const PERIOD_OPTIONS = new Set([7, 30, 90]);
const report = value => deepFreeze({
  description: '', dimensions: [], measures: count, filters: [], sort: [], limit: 100, ...value,
});

export function createStationReports({ periodDays = 30 } = {}) {
  if (!PERIOD_OPTIONS.has(periodDays)) throw new TypeError('Station report period must be 7, 30, or 90 days');
  return deepFreeze([
    report({ name: 'Open Cases', sourceKey: 'stationCases', description: 'Open cases in the current authorised station scope.', filters: openOnly, visualization: { type: 'number' }, limit: 1 }),
    report({ name: '60+ Day Cases', sourceKey: 'stationCases', description: 'Open cases registered more than sixty days ago.', filters: [...openOnly, { field: 'ageingBucket', operator: 'eq', value: '60+ days' }], visualization: { type: 'number' }, limit: 1 }),
    report({ name: `New Cases · Last ${periodDays} Days`, sourceKey: 'stationCases', description: `Cases registered in the active selected ${periodDays}-day period across all lifecycle states.`, filters: [{ field: 'registeredAgeDays', operator: 'lte', value: periodDays }], visualization: { type: 'number' }, limit: 1 }),
    report({ name: 'Active Alerts', sourceKey: 'alerts', description: 'Alerts that have not reached the closed lifecycle state.', filters: [{ field: 'state', operator: 'in', value: ['GENERATED', 'ASSIGNED', 'ACKNOWLEDGED', 'CONCLUDED'] }], visualization: { type: 'number' }, limit: 1 }),
    report({ name: 'Case Ageing', sourceKey: 'stationCases', description: 'Open case workload by governed ageing bucket.', dimensions: ['ageingBucket'], filters: openOnly, sort: [{ field: 'recordCount_sum', direction: 'desc' }], visualization: { type: 'bar' } }),
    report({ name: 'Case Lifecycle', sourceKey: 'stationCases', description: 'All visible cases by lifecycle status.', dimensions: ['status'], sort: [{ field: 'recordCount_sum', direction: 'desc' }], visualization: { type: 'funnel' } }),
    report({ name: 'Crime Category', sourceKey: 'stationCases', description: 'Visible cases by major crime category.', dimensions: ['majorHead'], sort: [{ field: 'recordCount_sum', direction: 'desc' }], visualization: { type: 'pie' } }),
    report({ name: '24-Hour Incident Pattern', sourceKey: 'stationCases', description: 'Valid incident timestamps grouped by server-derived Karnataka civil hour.', dimensions: ['incidentHour'], filters: [{ field: 'incidentHour', operator: 'gte', value: 0 }], sort: [{ field: 'incidentHour', direction: 'asc' }], visualization: { type: 'line' } }),
    report({ name: 'Open Case Register', sourceKey: 'stationCases', description: 'Approved open-case fields in the current authorised station scope.', dimensions: ['caseId', 'caseNumber', 'status', 'registeredAt', 'majorHead', 'minorHead', 'ageingBucket'], measures: [], filters: openOnly, sort: [{ field: 'registeredAt', direction: 'desc' }], visualization: { type: 'table' }, limit: 200 }),
  ]);
}

export const STATION_REPORTS = createStationReports();

export const STATION_LAYOUT = deepFreeze([
  { column: 1, row: 1, width: 3, height: 2 },
  { column: 4, row: 1, width: 3, height: 2 },
  { column: 7, row: 1, width: 3, height: 2 },
  { column: 10, row: 1, width: 3, height: 2 },
  { column: 1, row: 3, width: 7, height: 5 },
  { column: 1, row: 8, width: 4, height: 4 },
  { column: 5, row: 8, width: 4, height: 4 },
  { column: 9, row: 8, width: 4, height: 4 },
  { column: 8, row: 3, width: 5, height: 5 },
]);

const list = response => Array.isArray(response?.data) ? response.data : response?.data?.items ?? [];
const stationDashboard = dashboards => dashboards.find(dashboard => dashboard?.name === 'Station Operations'
  && (dashboard.relationship === 'OWNED' || dashboard.defaultRole === 'STATION_OPERATIONS'));
const matchingReport = (reports, definition) => reports.find(report => report?.name === definition.name
  && report?.definition?.sourceKey === definition.sourceKey);
const placementsFor = reports => reports.map((reportValue, index) => ({
  reportId: reportValue.id, ...STATION_LAYOUT[index],
}));
const samePlacements = (actual, expected) => Array.isArray(actual) && actual.length === expected.length
  && expected.every((placement, index) => {
    const current = actual[index];
    return current && ['reportId', 'column', 'row', 'width', 'height']
      .every(field => current[field] === placement[field]);
  });

async function reconcileReport(api, definition, error) {
  const persisted = matchingReport(list(await api.get('/v1/reports')), definition);
  if (!persisted) throw error;
  return persisted;
}

async function reconcileDashboard(api, error) {
  const persisted = stationDashboard(list(await api.get('/v1/dashboards')));
  if (!persisted || persisted.relationship !== 'OWNED') throw error;
  return persisted;
}

const bootstrapByApi = new WeakMap();

export function bootstrapStationOperationsDashboard({ api, workspace }) {
  if (workspace?.role !== 'STATION_OPERATIONS') {
    return Promise.reject(new TypeError('Station Operations bootstrap requires the station persona'));
  }
  const configured = stationDashboard(workspace?.availableDashboards ?? []);
  if (configured) return Promise.resolve({ dashboard: configured, reports: workspace?.availableReports ?? [] });
  const running = bootstrapByApi.get(api);
  if (running) return running;
  const operation = performBootstrap({ api, workspace }).finally(() => {
    if (bootstrapByApi.get(api) === operation) bootstrapByApi.delete(api);
  });
  bootstrapByApi.set(api, operation);
  return operation;
}

async function performBootstrap({ api, workspace }) {
  let visibleReports = list(await api.get('/v1/reports'));
  let dashboard = stationDashboard(list(await api.get('/v1/dashboards')));
  if (dashboard?.defaultRole === 'STATION_OPERATIONS' && dashboard.relationship !== 'OWNED') {
    return { dashboard, reports: visibleReports };
  }
  const reports = [];
  for (const definition of STATION_REPORTS) {
    let persisted = matchingReport(visibleReports, definition);
    if (!persisted) {
      try { persisted = (await api.post('/v1/reports', definition)).data; }
      catch (error) { persisted = await reconcileReport(api, definition, error); }
      visibleReports = [...visibleReports, persisted];
    }
    reports.push(persisted);
  }

  if (!dashboard) {
    try {
      const created = (await api.post('/v1/dashboards', {
        name: 'Station Operations',
        description: 'Private operational dashboard for the current police station.',
      })).data;
      dashboard = { ...created, relationship: 'OWNED' };
    } catch (error) { dashboard = await reconcileDashboard(api, error); }
  }
  if (!dashboard?.id || dashboard.relationship !== 'OWNED') {
    throw new Error('An owned Station Operations dashboard is required');
  }

  const expectedItems = placementsFor(reports);
  const current = (await api.get(`/v1/dashboards/${encodeURIComponent(dashboard.id)}`)).data;
  if (!samePlacements(current?.items, expectedItems)) {
    try { await api.put(`/v1/dashboards/${encodeURIComponent(dashboard.id)}/items`, { items: expectedItems }); }
    catch (error) {
      const reconciled = (await api.get(`/v1/dashboards/${encodeURIComponent(dashboard.id)}`)).data;
      if (!samePlacements(reconciled?.items, expectedItems)) throw error;
    }
  }

  if (workspace?.landingDashboard?.id !== dashboard.id) {
    try { await api.put('/v1/preferences/landing-dashboard', { dashboardId: dashboard.id }); }
    catch (error) {
      const reconciled = (await api.get('/v1/workspace')).data;
      if (reconciled?.landingDashboard?.id !== dashboard.id) throw error;
    }
  }
  return {
    dashboard: { ...dashboard, relationship: 'OWNED', items: expectedItems },
    reports,
  };
}

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

export const STATION_BOOTSTRAP_MARKER = '[ACE:station-operations:v1:complete]';
const STATION_BOOTSTRAP_PENDING = '[ACE:station-operations:v1:pending]';
const STATION_LEGACY_DESCRIPTION = 'Private operational dashboard for the current police station.';
const TEMPLATE_KEY = 'station-operations/v1';
const list = response => Array.isArray(response?.data) ? response.data : response?.data?.items ?? [];
const canonical = value => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort()
    .map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
};
const systemDefault = dashboards => dashboards.find(dashboard => dashboard?.defaultRole === 'STATION_OPERATIONS'
  && dashboard?.relationship !== 'OWNED');
const bootstrapDashboard = dashboards => dashboards.find(dashboard => dashboard?.relationship === 'OWNED'
  && [STATION_BOOTSTRAP_PENDING, STATION_BOOTSTRAP_MARKER].includes(dashboard?.description));
const matchingReport = (reports, definition) => reports.find(report => report?.relationship === 'OWNED'
  && canonical(report?.definition) === canonical(definition));
const placementsFor = reports => reports.map((reportValue, index) => ({
  reportId: reportValue.id, ...STATION_LAYOUT[index],
}));
const samePlacements = (actual, expected) => Array.isArray(actual) && actual.length === expected.length
  && expected.every((placement, index) => {
    const current = actual[index];
    return current && ['reportId', 'column', 'row', 'width', 'height']
      .every(field => current[field] === placement[field]);
  });
const duplicateRaceRepair = (visibleReports, actual) => {
  const reports = STATION_REPORTS.map(definition => matchingReport(visibleReports, definition));
  if (reports.some(reportValue => !reportValue) || new Set(reports.map(reportValue => reportValue.id)).size !== reports.length) return null;
  const expected = placementsFor(reports);
  if (!Array.isArray(actual) || actual.length <= expected.length || actual.length % expected.length !== 0) return null;
  const copies = actual.length / expected.length;
  const duplicateCount = placement => actual.filter(current => ['reportId', 'column', 'row', 'width', 'height']
    .every(field => current?.[field] === placement[field])).length;
  return expected.every(placement => duplicateCount(placement) === copies) ? expected : null;
};

async function reconcileReport(api, definition, error) {
  const persisted = matchingReport(list(await api.get('/v1/reports')), definition);
  if (!persisted) throw error;
  return persisted;
}

async function reconcileDashboard(api, error) {
  const persisted = bootstrapDashboard(list(await api.get('/v1/dashboards')));
  if (!persisted) throw error;
  return persisted;
}

const createIdempotent = (api, path, body, key) => typeof api.idempotent === 'function'
  ? api.idempotent(path, body, key) : api.post(path, body);
const replaceIdempotent = (api, path, body, key) => typeof api.idempotentPut === 'function'
  ? api.idempotentPut(path, body, key) : api.put(path, body);

const bootstrapByApi = new WeakMap();

export function bootstrapStationOperationsDashboard({ api, workspace }) {
  if (workspace?.role !== 'STATION_OPERATIONS') {
    return Promise.reject(new TypeError('Station Operations bootstrap requires the station persona'));
  }
  const configuredDefault = systemDefault(workspace?.availableDashboards ?? []);
  if (configuredDefault) return Promise.resolve({ dashboard: configuredDefault, reports: workspace?.availableReports ?? [] });
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
  const visibleDashboards = list(await api.get('/v1/dashboards'));
  const configuredDefault = systemDefault(visibleDashboards);
  if (configuredDefault) {
    return { dashboard: configuredDefault, reports: visibleReports };
  }
  let dashboard = bootstrapDashboard(visibleDashboards);
  const wasComplete = dashboard?.description === STATION_BOOTSTRAP_MARKER;
  if (wasComplete) {
    let current = (await api.get(`/v1/dashboards/${encodeURIComponent(dashboard.id)}`)).data;
    const repairedItems = duplicateRaceRepair(visibleReports, current?.items);
    if (repairedItems) {
      try {
        await replaceIdempotent(api, `/v1/dashboards/${encodeURIComponent(dashboard.id)}/items`,
          { items: repairedItems }, `${TEMPLATE_KEY}/dashboard-items/duplicate-race-repair`);
      } catch (error) {
        const reconciled = (await api.get(`/v1/dashboards/${encodeURIComponent(dashboard.id)}`)).data;
        if (!samePlacements(reconciled?.items, repairedItems)) throw error;
      }
      current = (await api.get(`/v1/dashboards/${encodeURIComponent(dashboard.id)}`)).data;
      if (!samePlacements(current?.items, repairedItems)) throw new Error('Station dashboard duplicate placements remain');
    }
    return { dashboard: { ...dashboard, items: current?.items ?? [] }, reports: visibleReports };
  }
  const reports = [];
  for (const [index, definition] of STATION_REPORTS.entries()) {
    let persisted = matchingReport(visibleReports, definition);
    if (!persisted) {
      try { persisted = (await createIdempotent(api, '/v1/reports', definition, `${TEMPLATE_KEY}/report/${index}`)).data; }
      catch (error) { persisted = await reconcileReport(api, definition, error); }
      persisted = { ...persisted, relationship: 'OWNED' };
      visibleReports = [...visibleReports, persisted];
    }
    reports.push(persisted);
  }

  const expectedItems = placementsFor(reports);
  if (!dashboard) {
    for (const candidate of visibleDashboards.filter(item => item?.relationship === 'OWNED'
      && item?.name === 'Station Operations')) {
      const detail = (await api.get(`/v1/dashboards/${encodeURIComponent(candidate.id)}`)).data;
      const safeLegacy = (detail?.items ?? []).length === 0
        || (candidate.description === STATION_LEGACY_DESCRIPTION && samePlacements(detail?.items, expectedItems));
      if (!safeLegacy) continue;
      try {
        const adopted = (await api.patch(`/v1/dashboards/${encodeURIComponent(candidate.id)}`, {
          expectedVersion: candidate.version,
          name: 'Station Operations', description: STATION_BOOTSTRAP_PENDING,
        })).data;
        dashboard = { ...adopted, relationship: 'OWNED' };
      } catch (error) { dashboard = await reconcileDashboard(api, error); }
      break;
    }
  }
  if (!dashboard) {
    try {
      const created = (await createIdempotent(api, '/v1/dashboards', {
        name: 'Station Operations',
        description: STATION_BOOTSTRAP_PENDING,
      }, `${TEMPLATE_KEY}/dashboard`)).data;
      dashboard = { ...created, relationship: 'OWNED' };
    } catch (error) { dashboard = await reconcileDashboard(api, error); }
  }
  if (!dashboard?.id || dashboard.relationship !== 'OWNED'
    || ![STATION_BOOTSTRAP_PENDING, STATION_BOOTSTRAP_MARKER].includes(dashboard.description)) {
    throw new Error('An owned Station Operations dashboard is required');
  }

  let current = (await api.get(`/v1/dashboards/${encodeURIComponent(dashboard.id)}`)).data;
  if (!samePlacements(current?.items, expectedItems)) {
    try {
      await replaceIdempotent(api, `/v1/dashboards/${encodeURIComponent(dashboard.id)}/items`,
        { items: expectedItems }, `${TEMPLATE_KEY}/dashboard-items`);
    }
    catch (error) {
      const reconciled = (await api.get(`/v1/dashboards/${encodeURIComponent(dashboard.id)}`)).data;
      if (!samePlacements(reconciled?.items, expectedItems)) throw error;
    }
    current = (await api.get(`/v1/dashboards/${encodeURIComponent(dashboard.id)}`)).data;
    if (!samePlacements(current?.items, expectedItems)) throw new Error('Station dashboard placements are incomplete');
  }

  const currentWorkspace = (await api.get('/v1/workspace')).data;
  if (currentWorkspace?.landingDashboard?.id !== dashboard.id) {
    try { await api.put('/v1/preferences/landing-dashboard', { dashboardId: dashboard.id }); }
    catch (error) {
      const reconciled = (await api.get('/v1/workspace')).data;
      if (reconciled?.landingDashboard?.id !== dashboard.id) throw error;
    }
  }
  try {
    dashboard = (await api.patch(`/v1/dashboards/${encodeURIComponent(dashboard.id)}`, {
      expectedVersion: dashboard.version,
      name: 'Station Operations', description: STATION_BOOTSTRAP_MARKER,
    })).data;
  } catch (error) {
    const reconciled = (await api.get(`/v1/dashboards/${encodeURIComponent(dashboard.id)}`)).data;
    if (reconciled?.description !== STATION_BOOTSTRAP_MARKER) throw error;
    dashboard = reconciled;
  }
  return {
    dashboard: { ...dashboard, description: STATION_BOOTSTRAP_MARKER, relationship: 'OWNED', items: expectedItems },
    reports,
  };
}

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

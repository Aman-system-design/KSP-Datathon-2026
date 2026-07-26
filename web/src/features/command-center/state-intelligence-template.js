const style = overrides => ({ titleVisible: true, subtitleVisible: true, legend: 'right', valueLabels: true, palette: 'categorical', tableDensity: 'comfortable', ...overrides });

export const RECOMMENDED_COMMAND_REPORTS = Object.freeze([
  { name: 'District FIR Ranking', description: 'Highest FIR-volume districts for statewide prioritisation.', sourceKey: 'catalog.caseMaster', dimensions: ['DistrictCode'], measures: [{ field: 'RecordCount', aggregate: 'sum' }], filters: [], sort: [{ field: 'RecordCount_sum', direction: 'desc' }], visualization: { type: 'bar' }, limit: 12 },
  { name: 'Hourly FIR Demand', description: 'FIR demand curve across the 24-hour operational cycle.', sourceKey: 'catalog.caseMaster', dimensions: ['IncidentHour'], measures: [{ field: 'RecordCount', aggregate: 'sum' }], filters: [], sort: [{ field: 'IncidentHour', direction: 'asc' }], visualization: { type: 'line' }, limit: 24 },
  { name: 'Case Status Distribution', description: 'Current FIR distribution by investigation lifecycle status.', sourceKey: 'catalog.caseMaster', dimensions: ['CaseStatusLabel'], measures: [{ field: 'RecordCount', aggregate: 'sum' }], filters: [], sort: [{ field: 'RecordCount_sum', direction: 'desc' }], visualization: { type: 'pie' }, limit: 8 },
  { name: 'Major Crime Comparison', description: 'Comparison of FIR volume across major crime categories.', sourceKey: 'catalog.caseMaster', dimensions: ['CrimeMajorHeadName'], measures: [{ field: 'RecordCount', aggregate: 'sum' }], filters: [], sort: [{ field: 'RecordCount_sum', direction: 'desc' }], visualization: { type: 'bar' }, limit: 10 },
  { name: '24-Hour Crime Pattern', description: 'Optional operational demand curve by incident hour.', sourceKey: 'catalog.caseMaster', dimensions: ['IncidentHour'], measures: [{ field: 'RecordCount', aggregate: 'sum' }], filters: [], sort: [{ field: 'IncidentHour', direction: 'asc' }], visualization: { type: 'line' }, limit: 24 },
]);

export const STATE_INTELLIGENCE_REPORTS = Object.freeze([
  { name: 'FIRs by Karnataka District', description: 'Canonical district-level FIR totals and hotspot posture.', sourceKey: 'catalog.caseMaster', dimensions: ['DistrictCode'], measures: [{ field: 'RecordCount', aggregate: 'sum' }], filters: [], sort: [{ field: 'RecordCount_sum', direction: 'desc' }], visualization: { type: 'map', overlay: 'hotspots' }, style: style({ palette: 'sequential' }), limit: 31 },
  { name: 'Monthly FIR Trend', description: 'Month-by-month FIR movement for detecting sustained change.', sourceKey: 'catalog.caseMaster', dimensions: ['IncidentMonth'], measures: [{ field: 'RecordCount', aggregate: 'sum' }], filters: [], sort: [{ field: 'IncidentMonth', direction: 'asc' }], visualization: { type: 'line' }, limit: 24 },
  { name: 'District FIR Concentration', description: 'Districts contributing the highest current FIR workload.', sourceKey: 'catalog.caseMaster', dimensions: ['DistrictName'], measures: [{ field: 'RecordCount', aggregate: 'sum' }], filters: [], sort: [{ field: 'RecordCount_sum', direction: 'desc' }], visualization: { type: 'bar' }, limit: 10 },
  { name: 'Police Station Load Concentration', description: 'Stations carrying the greatest FIR workload for resource balancing.', sourceKey: 'catalog.caseMaster', dimensions: ['PoliceStationName'], measures: [{ field: 'RecordCount', aggregate: 'sum' }], filters: [], sort: [{ field: 'RecordCount_sum', direction: 'desc' }], visualization: { type: 'bar' }, limit: 10 },
  { name: 'Crime Category Mix', description: 'Current FIR mix across major crime categories.', sourceKey: 'catalog.caseMaster', dimensions: ['CrimeMajorHeadName'], measures: [{ field: 'RecordCount', aggregate: 'sum' }], filters: [], sort: [{ field: 'RecordCount_sum', direction: 'desc' }], visualization: { type: 'pie' }, limit: 8 },
  { name: 'Case Lifecycle', description: 'Investigation-stage distribution and chargesheet conversion.', sourceKey: 'catalog.caseMaster', dimensions: ['CaseStatusLabel'], measures: [{ field: 'RecordCount', aggregate: 'sum' }], filters: [], sort: [{ field: 'RecordCount_sum', direction: 'desc' }], visualization: { type: 'funnel' }, limit: 8 },
]);

export const STATE_INTELLIGENCE_LAYOUT = Object.freeze([
  { column: 1, row: 1, width: 7, height: 6 }, { column: 8, row: 1, width: 5, height: 3 },
  { column: 8, row: 4, width: 5, height: 3 }, { column: 1, row: 7, width: 6, height: 4 },
  { column: 7, row: 7, width: 6, height: 4 }, { column: 1, row: 11, width: 12, height: 3 },
]);

export async function createStateIntelligenceDashboard({ api, dashboards = [] }) {
  const response = await api.get('/v1/reports');
  const existingReports = Array.isArray(response?.data) ? response.data : response?.data?.items ?? [];
  const reports = [];
  for (const definition of STATE_INTELLIGENCE_REPORTS) {
    const existing = existingReports.find(report => report.name === definition.name);
    reports.push(existing ?? (await api.post('/v1/reports', definition)).data);
  }
  const existingDashboard = dashboards.find(dashboard => dashboard.name === 'State Crime Intelligence' && dashboard.relationship === 'OWNED');
  const dashboard = existingDashboard ?? (await api.post('/v1/dashboards', {
    name: 'State Crime Intelligence',
    description: 'Statewide FIR volume, hotspots, categories, time pattern, crime types, and case lifecycle.',
  })).data;
  await api.put(`/v1/dashboards/${dashboard.id}/items`, { items: reports.map((report, index) => ({ reportId: report.id, ...STATE_INTELLIGENCE_LAYOUT[index] })) });
  return dashboard;
}

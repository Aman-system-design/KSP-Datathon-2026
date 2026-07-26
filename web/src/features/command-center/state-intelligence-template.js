const style = overrides => ({ titleVisible: true, subtitleVisible: true, legend: 'right', valueLabels: true, palette: 'categorical', tableDensity: 'comfortable', ...overrides });

export const STATE_INTELLIGENCE_REPORTS = Object.freeze([
  { name: 'FIRs by Karnataka District', description: 'Canonical district-level FIR totals and hotspot posture.', sourceKey: 'catalog.caseMaster', dimensions: ['DistrictCode'], measures: [{ field: 'RecordCount', aggregate: 'sum' }], filters: [], sort: [{ field: 'RecordCount_sum', direction: 'desc' }], visualization: { type: 'map', overlay: 'hotspots' }, style: style({ palette: 'sequential' }), limit: 31 },
  { name: 'Statewide FIR Volume', description: 'Total governed FIR volume in the current viewer scope.', sourceKey: 'catalog.caseMaster', dimensions: [], measures: [{ field: 'RecordCount', aggregate: 'sum' }], filters: [], sort: [], visualization: { type: 'number' }, style: style({ legend: 'none' }), limit: 1 },
  { name: 'Crime Category Share', description: 'Share of FIRs by major crime category.', sourceKey: 'catalog.caseMaster', dimensions: ['CrimeMajorHeadName'], measures: [{ field: 'RecordCount', aggregate: 'sum' }], filters: [], sort: [{ field: 'RecordCount_sum', direction: 'desc' }], visualization: { type: 'pie', variant: 'doughnut' }, style: style({}), limit: 12 },
  { name: '24-Hour Crime Pattern', description: 'FIR occurrence curve by incident hour.', sourceKey: 'catalog.caseMaster', dimensions: ['IncidentHour'], measures: [{ field: 'RecordCount', aggregate: 'sum' }], filters: [], sort: [{ field: 'IncidentHour', direction: 'asc' }], visualization: { type: 'line', variant: 'area' }, style: style({ legend: 'none', palette: 'risk' }), limit: 24 },
  { name: 'Top Reported Crime Types', description: 'Highest-volume minor crime types.', sourceKey: 'catalog.caseMaster', dimensions: ['CrimeMinorHeadName'], measures: [{ field: 'RecordCount', aggregate: 'sum' }], filters: [], sort: [{ field: 'RecordCount_sum', direction: 'desc' }], visualization: { type: 'bar', variant: 'horizontal' }, style: style({}), limit: 10 },
  { name: 'Case Lifecycle Funnel', description: 'FIR distribution across lifecycle states.', sourceKey: 'catalog.caseMaster', dimensions: ['CaseStatusLabel'], measures: [{ field: 'RecordCount', aggregate: 'sum' }], filters: [], sort: [{ field: 'RecordCount_sum', direction: 'desc' }], visualization: { type: 'funnel' }, style: style({}), limit: 12 },
]);

export const STATE_INTELLIGENCE_LAYOUT = Object.freeze([
  { column: 1, row: 1, width: 7, height: 5 }, { column: 8, row: 1, width: 5, height: 2 },
  { column: 8, row: 3, width: 5, height: 3 }, { column: 1, row: 6, width: 12, height: 3 },
  { column: 1, row: 9, width: 6, height: 4 }, { column: 7, row: 9, width: 6, height: 4 },
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

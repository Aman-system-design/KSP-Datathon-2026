const measure = Object.freeze([{ field: 'RecordCount', aggregate: 'sum' }]);
const report = (name, description, dimensions, type, overrides = {}) => Object.freeze({
  name, description, sourceKey: 'catalog.caseMaster', dimensions, measures: measure,
  filters: [], sort: [{ field: type === 'line' ? dimensions[0] : 'RecordCount_sum', direction: type === 'line' ? 'asc' : 'desc' }],
  visualization: { type, ...(type === 'map' ? { overlay: 'hotspots' } : {}) }, limit: type === 'map' ? 31 : 24,
  ...overrides,
});

export const DISTRICT_DASHBOARD_TEMPLATE = Object.freeze({
  key: 'district-intelligence/v1',
  name: 'District Intelligence Dashboard',
  description: '[ACE:district-intelligence:v1:complete]',
  pendingDescription: '[ACE:district-intelligence:v1:pending]',
  roles: Object.freeze(['DISTRICT_LEADERSHIP']),
  reports: Object.freeze([
    report('District Monthly FIR Trend', 'Monthly FIR movement in the viewer-authorized district scope.', ['IncidentMonth'], 'line'),
    report('District Station Workload', 'Police-station FIR concentration in the viewer-authorized district.', ['PoliceStationName'], 'bar', { limit: 12 }),
    report('District Crime Category Mix', 'Major crime-category mix for the authorized district.', ['CrimeMajorHeadName'], 'pie', { limit: 8 }),
    report('District Case Lifecycle', 'Investigation lifecycle distribution in the authorized district.', ['CaseStatusLabel'], 'funnel', { limit: 8 }),
    report('District Hotspot Evidence', 'Governed geographic FIR concentration for district review.', ['DistrictCode'], 'map'),
    report('District Investigation Backlog', 'Case-status workload requiring district leadership review.', ['CaseStatusLabel'], 'bar', { limit: 8 }),
  ]),
  layout: Object.freeze([
    { column: 1, row: 1, width: 7, height: 5 }, { column: 8, row: 1, width: 5, height: 5 },
    { column: 1, row: 6, width: 4, height: 4 }, { column: 5, row: 6, width: 4, height: 4 },
    { column: 9, row: 6, width: 4, height: 4 }, { column: 1, row: 10, width: 12, height: 4 },
  ]),
});

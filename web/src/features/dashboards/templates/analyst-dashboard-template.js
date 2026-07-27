const measure = Object.freeze([{ field: 'RecordCount', aggregate: 'sum' }]);
const report = (name, description, dimensions, type, overrides = {}) => Object.freeze({
  name, description, sourceKey: 'catalog.caseMaster', dimensions, measures: measure,
  filters: [], sort: [{ field: type === 'line' ? dimensions[0] : 'RecordCount_sum', direction: type === 'line' ? 'asc' : 'desc' }],
  visualization: { type, ...(type === 'map' ? { overlay: 'hotspots' } : {}) }, limit: type === 'table' ? 100 : 24,
  ...overrides,
});

export const ANALYST_DASHBOARD_TEMPLATE = Object.freeze({
  key: 'crime-analyst/v1',
  name: 'Crime Analyst Dashboard',
  description: '[ACE:crime-analyst:v1:complete]',
  pendingDescription: '[ACE:crime-analyst:v1:pending]',
  roles: Object.freeze(['CRIME_ANALYST']),
  reports: Object.freeze([
    report('Analyst Incident Pattern', 'Viewer-scoped incident demand by Karnataka civil hour.', ['IncidentHour'], 'line'),
    report('Analyst Hotspot Evidence', 'Geographic FIR concentration for analytical review.', ['DistrictCode'], 'map'),
    report('Analyst Major Offence Comparison', 'Comparison across major crime heads.', ['CrimeMajorHeadName'], 'bar', { limit: 12 }),
    report('Analyst Monthly Change Signal', 'Monthly movement requiring human interpretation.', ['IncidentMonth'], 'line'),
    report('Analyst Case Status Evidence', 'Case-status evidence distribution without automated conclusions.', ['CaseStatusLabel'], 'pie', { limit: 8 }),
    report('Analyst Evidence Table', 'District, station and offence evidence for governed investigation.', ['DistrictName', 'PoliceStationName', 'CrimeMajorHeadName'], 'table', { limit: 100 }),
  ]),
  layout: Object.freeze([
    { column: 1, row: 1, width: 6, height: 4 }, { column: 7, row: 1, width: 6, height: 6 },
    { column: 1, row: 5, width: 6, height: 4 }, { column: 1, row: 9, width: 6, height: 4 },
    { column: 7, row: 7, width: 6, height: 6 }, { column: 1, row: 13, width: 12, height: 5 },
  ]),
});

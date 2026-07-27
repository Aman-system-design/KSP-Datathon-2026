const report = ({ name, description, sourceKey, dimension, measure, aggregate = 'sum', type = 'bar', limit = 24 }) => Object.freeze({
  name, description, sourceKey,
  dimensions: Object.freeze(dimension ? [dimension] : []),
  measures: Object.freeze([{ field: measure, aggregate }]),
  filters: Object.freeze([]),
  sort: Object.freeze([{ field: dimension ?? `${measure}_${aggregate}`, direction: dimension ? 'asc' : 'desc' }]),
  visualization: Object.freeze({ type }), limit,
});

export const DISTRICT_DASHBOARD_TEMPLATE = Object.freeze({
  key: 'district-intelligence/v1',
  name: 'District Intelligence Dashboard',
  description: '[ACE:district-intelligence:v1:complete]',
  pendingDescription: '[ACE:district-intelligence:v1:pending]',
  roles: Object.freeze(['DISTRICT_LEADERSHIP']),
  reports: Object.freeze([
    report({ name: 'District Command Brief', description: 'Viewer-scoped command metrics for the authorized district.', sourceKey: 'brief', dimension: 'metric', measure: 'value' }),
    report({ name: 'District Pattern Evidence', description: 'Evidence-linked pattern workload by governed method.', sourceKey: 'patterns', dimension: 'patternType', measure: 'caseCount' }),
    report({ name: 'District Hotspot Workload', description: 'Hotspot case magnitude by authorized unit.', sourceKey: 'hotspots', dimension: 'unitId', measure: 'caseCount' }),
    report({ name: 'District Anomaly Signals', description: 'Observed anomaly volume by governed signal type.', sourceKey: 'anomalies', dimension: 'signalType', measure: 'observed', type: 'line' }),
    report({ name: 'District Context Indicators', description: 'Aggregate district context indicators for human interpretation.', sourceKey: 'districtContext', dimension: 'indicator', measure: 'value' }),
    report({ name: 'District Alert Lifecycle', description: 'Visible intelligence alerts by accountable lifecycle state.', sourceKey: 'alerts', dimension: 'state', measure: 'recordCount' }),
  ]),
  layout: Object.freeze([
    { column: 1, row: 1, width: 7, height: 5 }, { column: 8, row: 1, width: 5, height: 5 },
    { column: 1, row: 6, width: 4, height: 4 }, { column: 5, row: 6, width: 4, height: 4 },
    { column: 9, row: 6, width: 4, height: 4 }, { column: 1, row: 10, width: 12, height: 4 },
  ]),
});

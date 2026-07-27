const report = ({ name, description, sourceKey, dimension, measure, aggregate = 'sum', type = 'bar', limit = 24 }) => Object.freeze({
  name, description, sourceKey,
  dimensions: Object.freeze(dimension ? [dimension] : []),
  measures: Object.freeze([{ field: measure, aggregate }]),
  filters: Object.freeze([]),
  sort: Object.freeze([{ field: dimension ?? `${measure}_${aggregate}`, direction: dimension ? 'asc' : 'desc' }]),
  visualization: Object.freeze({ type }), limit,
});

export const ANALYST_DASHBOARD_TEMPLATE = Object.freeze({
  key: 'crime-analyst/v1',
  name: 'Crime Analyst Dashboard',
  description: '[ACE:crime-analyst:v1:complete]',
  pendingDescription: '[ACE:crime-analyst:v1:pending]',
  roles: Object.freeze(['CRIME_ANALYST']),
  reports: Object.freeze([
    report({ name: 'Analyst Pattern Case Evidence', description: 'Evidence-linked case volume by governed pattern method.', sourceKey: 'patterns', dimension: 'patternType', measure: 'caseCount' }),
    report({ name: 'Analyst Hotspot Confidence', description: 'Average hotspot confidence by viewer-authorized unit.', sourceKey: 'hotspots', dimension: 'unitId', measure: 'severity', aggregate: 'avg' }),
    report({ name: 'Analyst Observed Anomalies', description: 'Observed anomaly volume by governed signal type.', sourceKey: 'anomalies', dimension: 'signalType', measure: 'observed', type: 'line' }),
    report({ name: 'Analyst Area Risk Evidence', description: 'Explainable area-risk score by governed area type.', sourceKey: 'areaRisk', dimension: 'areaType', measure: 'score', aggregate: 'avg' }),
    report({ name: 'Analyst Alert Evidence', description: 'Visible intelligence alerts by accountable lifecycle state.', sourceKey: 'alerts', dimension: 'state', measure: 'recordCount' }),
    report({ name: 'Analyst Command Metrics', description: 'Viewer-scoped brief metrics supporting analytical review.', sourceKey: 'brief', dimension: 'metric', measure: 'value', type: 'table' }),
  ]),
  layout: Object.freeze([
    { column: 1, row: 1, width: 6, height: 4 }, { column: 7, row: 1, width: 6, height: 4 },
    { column: 1, row: 5, width: 6, height: 4 }, { column: 7, row: 5, width: 6, height: 4 },
    { column: 1, row: 9, width: 6, height: 4 }, { column: 7, row: 9, width: 6, height: 4 },
  ]),
});

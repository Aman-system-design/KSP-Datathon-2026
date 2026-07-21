const field = (type, options = {}) => Object.freeze({ type, ...options });
const fields = (value) => Object.freeze(value);
const source = (value) => Object.freeze({
  ...value,
  fields: fields(value.fields),
  visualizations: Object.freeze(value.visualizations),
});

export const REPORT_SOURCES = Object.freeze({
  brief: source({
    key: 'brief', label: 'Command brief', service: 'getBrief',
    fields: {
      unitId: field('string', { dimension: true }),
      metric: field('string', { dimension: true }),
      value: field('number', { aggregates: ['sum', 'avg', 'min', 'max', 'count'] }),
      period: field('date', { dimension: true }),
    },
    visualizations: ['number', 'table', 'bar', 'line'],
  }),
  patterns: source({
    key: 'patterns', label: 'Crime patterns', service: 'listPatterns',
    fields: {
      patternId: field('string', { dimension: true }),
      patternType: field('string', { dimension: true }),
      unitId: field('string', { dimension: true }),
      caseCount: field('number', { aggregates: ['sum', 'avg', 'min', 'max', 'count'] }),
      confidence: field('number', { aggregates: ['avg', 'min', 'max'] }),
      period: field('date', { dimension: true }),
    },
    visualizations: ['number', 'table', 'bar', 'line'],
  }),
  hotspots: source({
    key: 'hotspots', label: 'Crime hotspots', service: 'listHotspots',
    fields: {
      areaId: field('string', { dimension: true }),
      unitId: field('string', { dimension: true }),
      latitude: field('number'), longitude: field('number'),
      caseCount: field('number', { aggregates: ['sum', 'avg', 'min', 'max', 'count'] }),
      severity: field('number', { aggregates: ['avg', 'min', 'max'] }),
      period: field('date', { dimension: true }),
    },
    visualizations: ['number', 'table', 'bar', 'line', 'map'],
  }),
  anomalies: source({
    key: 'anomalies', label: 'Trend anomalies', service: 'listAnomalies',
    fields: {
      anomalyId: field('string', { dimension: true }),
      unitId: field('string', { dimension: true }),
      signalType: field('string', { dimension: true }),
      observed: field('number', { aggregates: ['sum', 'avg', 'min', 'max', 'count'] }),
      expected: field('number', { aggregates: ['sum', 'avg', 'min', 'max'] }),
      severity: field('number', { aggregates: ['avg', 'min', 'max'] }),
      period: field('date', { dimension: true }),
    },
    visualizations: ['number', 'table', 'bar', 'line'],
  }),
  areaRisk: source({
    key: 'areaRisk', label: 'Explainable area risk', service: 'getAreaRisk',
    fields: {
      areaId: field('string', { dimension: true }), unitId: field('string', { dimension: true }),
      areaType: field('string', { dimension: true }),
      score: field('number', { aggregates: ['avg', 'min', 'max'] }),
      period: field('date', { dimension: true }),
    },
    visualizations: ['number', 'table', 'bar', 'line', 'map'],
  }),
  districtContext: source({
    key: 'districtContext', label: 'District context', service: 'getDistrictContext',
    fields: {
      unitId: field('string', { dimension: true }), indicator: field('string', { dimension: true }),
      value: field('number', { aggregates: ['sum', 'avg', 'min', 'max', 'count'] }),
      period: field('date', { dimension: true }),
    },
    visualizations: ['number', 'table', 'bar', 'line'],
  }),
  alerts: source({
    key: 'alerts', label: 'Intelligence alerts', service: 'listAlerts',
    fields: {
      alertId: field('string', { dimension: true }), alertType: field('string', { dimension: true }),
      state: field('string', { dimension: true }), unitId: field('string', { dimension: true }),
      severity: field('number', { aggregates: ['avg', 'min', 'max'] }),
      createdAt: field('date', { dimension: true }),
    },
    visualizations: ['number', 'table', 'bar', 'line'],
  }),
});

export function getReportSource(sourceKey) {
  const sourceDefinition = REPORT_SOURCES[sourceKey];
  if (!sourceDefinition) throw new TypeError('Invalid report source');
  return sourceDefinition;
}

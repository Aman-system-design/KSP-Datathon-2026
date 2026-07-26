const field = (type, options = {}) => Object.freeze({
  type,
  ...options,
  ...(options.aggregates ? { aggregates: Object.freeze([...options.aggregates]) } : {}),
});
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
      period: field('string', { dimension: true }),
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
      recordCount: field('number', { aggregates: ['sum', 'count'] }),
    },
    visualizations: ['number', 'table', 'bar', 'line'],
  }),
  stationCases: source({
    key: 'stationCases', label: 'Station cases', service: 'listStationCasesForAnalytics',
    fields: {
      caseId: field('string', { dimension: true }),
      caseNumber: field('string', { dimension: true }),
      unitId: field('number', { dimension: true }),
      unitName: field('string', { dimension: true }),
      status: field('string', { dimension: true }),
      registeredAt: field('date', { dimension: true }),
      incidentAt: field('date', { dimension: true }),
      incidentHour: field('number', { dimension: true }),
      majorHead: field('string', { dimension: true }),
      minorHead: field('string', { dimension: true }),
      ageDays: field('number', { aggregates: ['avg', 'min', 'max'] }),
      registeredAgeDays: field('number', { aggregates: ['avg', 'min', 'max'] }),
      ageingBucket: field('string', { dimension: true }),
      isOpen: field('boolean', { dimension: true }),
      recordCount: field('number', { aggregates: ['sum', 'count'] }),
    },
    visualizations: ['number', 'table', 'bar', 'line', 'pie', 'funnel'],
  }),
});

export function getReportSource(sourceKey) {
  const sourceDefinition = REPORT_SOURCES[sourceKey];
  if (!sourceDefinition) throw new TypeError('Invalid report source');
  return sourceDefinition;
}

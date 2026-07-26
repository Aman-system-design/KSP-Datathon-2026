const deepFreeze = (value) => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
};

const lifecycle = (labels) => [
  { stage: 'Data', label: labels.data },
  { stage: 'Analyze', label: labels.analyze },
  { stage: 'Explain', label: labels.explain },
  { stage: 'Alert', label: labels.alert },
  { stage: 'Deliver', label: labels.deliver },
];

const windowField = () => ({ kind: 'integer', min: 1, max: 180 });

const definitions = deepFreeze([
  {
    key: 'patterns',
    version: '1.0.0',
    name: 'Cross-District Pattern Intelligence',
    description: 'Connects related signals across authorized districts for human review.',
    category: 'patterns-networks',
    icon: 'network',
    findingType: 'PATTERN',
    availability: 'AVAILABLE',
    source: { service: 'readServices', method: 'listPatterns' },
    analyticalMethod: 'Multi-signal pattern fusion',
    aiAssistance: {
      method: 'EXPLAINABLE_MULTI_SIGNAL_FUSION',
      engineVersion: '1.0.0',
      explanation: 'The model creates a machine-generated pattern signal by linking authorized case features across districts and assigning confidence to each link. Alert delivery is qualified by a human-governed policy, and human review is required before action.',
      governance: { machineGeneratedSignal: true, humanGovernedDelivery: true, humanReviewRequired: true },
    },
    stages: lifecycle({
      data: 'Authorized case features',
      analyze: 'Fuse cross-district signals',
      explain: 'Review linked evidence',
      alert: 'Apply a confidence rule',
      deliver: 'Open alerts and reports',
    }),
    outputs: ['alerts', 'monitoring', 'reports'],
    limitations: ['SIMILARITY_IS_NOT_PROOF', 'REQUIRES_HUMAN_REVIEW'],
    alertPolicy: {
      enabled: true,
      fields: { threshold: { kind: 'number', min: 0.65, max: 1 }, evaluationWindowDays: windowField() },
    },
  },
  {
    key: 'hotspots',
    version: '1.0.0',
    name: 'Emerging Hotspot Intelligence',
    description: 'Highlights recent geographic concentrations within authorized areas.',
    category: 'spatial-intelligence',
    icon: 'map-pin',
    findingType: 'HOTSPOT',
    availability: 'AVAILABLE',
    source: { service: 'readServices', method: 'listHotspots' },
    analyticalMethod: 'Density-based spatial clustering',
    aiAssistance: {
      method: 'HAVERSINE_DBSCAN',
      engineVersion: '1.0.0',
      explanation: 'The HAVERSINE_DBSCAN engine groups nearby cases within an authorized spatial and time window, using case density to create a machine-generated hotspot signal. Alert delivery is qualified by a human-governed policy, and human review is required before action.',
      governance: { machineGeneratedSignal: true, humanGovernedDelivery: true, humanReviewRequired: true },
    },
    stages: lifecycle({
      data: 'Authorized geocoded cases',
      analyze: 'Detect spatial concentrations',
      explain: 'Inspect cluster evidence',
      alert: 'Apply a minimum-case rule',
      deliver: 'Open maps, alerts and reports',
    }),
    outputs: ['maps', 'alerts', 'monitoring', 'reports'],
    limitations: ['CLUSTERS_ARE_TIME_AND_RADIUS_DEPENDENT', 'REQUIRES_HUMAN_REVIEW'],
    alertPolicy: {
      enabled: true,
      fields: { minimumCases: { kind: 'integer', min: 2, max: 50 }, evaluationWindowDays: windowField() },
    },
  },
  {
    key: 'anomalies',
    version: '1.0.0',
    name: 'Trend Anomaly Intelligence',
    description: 'Surfaces material departures from an authorized area baseline.',
    category: 'trends-anomalies',
    icon: 'chart-no-axes-combined',
    findingType: 'ANOMALY',
    availability: 'AVAILABLE',
    source: { service: 'readServices', method: 'listAnomalies' },
    analyticalMethod: 'Baseline deviation analysis',
    aiAssistance: {
      method: 'MEDIAN_MAD',
      engineVersion: '1.0.0',
      explanation: 'The MEDIAN_MAD engine compares observed values with a robust median baseline and median absolute deviation; SEASONAL_MEDIAN_MAD is used only when a seasonal period is configured. The model creates a machine-generated anomaly signal for material departures. Alert delivery is qualified by a human-governed policy, and human review is required before action.',
      governance: { machineGeneratedSignal: true, humanGovernedDelivery: true, humanReviewRequired: true },
    },
    stages: lifecycle({
      data: 'Authorized area time series',
      analyze: 'Compare values with baselines',
      explain: 'Inspect observed deviation',
      alert: 'Apply a deviation rule',
      deliver: 'Open monitoring, alerts and reports',
    }),
    outputs: ['monitoring', 'alerts', 'reports'],
    limitations: ['DEVIATION_IS_NOT_CAUSATION', 'REQUIRES_HUMAN_REVIEW'],
    alertPolicy: {
      enabled: true,
      fields: { deviation: { kind: 'number', min: 1, max: 10 }, evaluationWindowDays: windowField() },
    },
  },
  {
    key: 'area-attention',
    version: '1.0.0',
    name: 'Area Attention Intelligence',
    description: 'Prioritizes areas for review using bounded aggregate signals.',
    category: 'risk-prioritization',
    icon: 'scan-search',
    findingType: 'AREA_RISK',
    availability: 'ANALYSIS_ONLY',
    source: { service: 'readServices', method: 'getAreaRisk' },
    analyticalMethod: 'Weighted area-attention scoring',
    stages: lifecycle({
      data: 'Authorized aggregate area signals',
      analyze: 'Score area attention signals',
      explain: 'Inspect score components',
      alert: 'Alert policy awaiting validation',
      deliver: 'Open monitoring, maps and reports',
    }),
    outputs: ['monitoring', 'maps', 'reports'],
    limitations: ['AREA_SIGNAL_NOT_INDIVIDUAL_PREDICTION', 'ALERT_POLICY_NOT_VALIDATED'],
    alertPolicy: { enabled: false, fields: {} },
  },
]);

const byKey = new Map(definitions.map((definition) => [definition.key, definition]));
const categories = deepFreeze([...new Set(definitions.map(({ category }) => category))]);

export function getUtility(key) {
  return byKey.get(key);
}

export function listUtilities({ category } = {}) {
  const selected = category === undefined
    ? definitions
    : definitions.filter((definition) => definition.category === category);
  return structuredClone(selected);
}

export function listUtilityCategories() {
  return categories;
}

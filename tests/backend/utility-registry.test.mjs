import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getUtility,
  listUtilities,
  listUtilityCategories,
} from '../../src/backend/utilities/utility-registry.mjs';

const EXPECTED_KEYS = ['patterns', 'hotspots', 'anomalies', 'area-attention'];
const EXPECTED_CATEGORIES = [
  'patterns-networks',
  'spatial-intelligence',
  'trends-anomalies',
  'risk-prioritization',
];

const EXPECTED_METADATA = [
  {
    key: 'patterns',
    name: 'Cross-District Pattern Intelligence',
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
    stageLabels: [
      'Authorized case features',
      'Fuse cross-district signals',
      'Review linked evidence',
      'Apply a confidence rule',
      'Open alerts and reports',
    ],
    outputs: ['alerts', 'monitoring', 'reports'],
    limitations: ['SIMILARITY_IS_NOT_PROOF', 'REQUIRES_HUMAN_REVIEW'],
  },
  {
    key: 'hotspots',
    name: 'Emerging Hotspot Intelligence',
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
    stageLabels: [
      'Authorized geocoded cases',
      'Detect spatial concentrations',
      'Inspect cluster evidence',
      'Apply a minimum-case rule',
      'Open maps, alerts and reports',
    ],
    outputs: ['maps', 'alerts', 'monitoring', 'reports'],
    limitations: ['CLUSTERS_ARE_TIME_AND_RADIUS_DEPENDENT', 'REQUIRES_HUMAN_REVIEW'],
  },
  {
    key: 'anomalies',
    name: 'Trend Anomaly Intelligence',
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
    stageLabels: [
      'Authorized area time series',
      'Compare values with baselines',
      'Inspect observed deviation',
      'Apply a deviation rule',
      'Open monitoring, alerts and reports',
    ],
    outputs: ['monitoring', 'alerts', 'reports'],
    limitations: ['DEVIATION_IS_NOT_CAUSATION', 'REQUIRES_HUMAN_REVIEW'],
  },
  {
    key: 'area-attention',
    name: 'Area Attention Intelligence',
    icon: 'scan-search',
    findingType: 'AREA_RISK',
    availability: 'ANALYSIS_ONLY',
    source: { service: 'readServices', method: 'getAreaRisk' },
    analyticalMethod: 'Weighted area-attention scoring',
    aiAssistance: undefined,
    stageLabels: [
      'Authorized aggregate area signals',
      'Score area attention signals',
      'Inspect score components',
      'Alert policy awaiting validation',
      'Open monitoring, maps and reports',
    ],
    outputs: ['monitoring', 'maps', 'reports'],
    limitations: ['AREA_SIGNAL_NOT_INDIVIDUAL_PREDICTION', 'ALERT_POLICY_NOT_VALIDATED'],
  },
];

test('registry exposes four ordered, categorized and versioned utility definitions', () => {
  const utilities = listUtilities();

  assert.deepEqual(utilities.map(({ key }) => key), EXPECTED_KEYS);
  assert.deepEqual(utilities.map(({ category }) => category), EXPECTED_CATEGORIES);
  assert.ok(utilities.every(({ version }) => version === '1.0.0'));
  assert.deepEqual(listUtilityCategories(), EXPECTED_CATEGORIES);
});

test('registry reuses one frozen, deduplicated category catalogue', () => {
  const categories = listUtilityCategories();

  assert.equal(Object.isFrozen(categories), true);
  assert.equal(new Set(categories).size, categories.length);
  assert.equal(listUtilityCategories(), categories);
});

test('category filtering preserves registry order and unknown categories return no utilities', () => {
  assert.deepEqual(
    listUtilities({ category: 'spatial-intelligence' }).map(({ key }) => key),
    ['hotspots'],
  );
  assert.deepEqual(listUtilities({ category: 'unknown' }), []);
});

test('only patterns, hotspots and anomalies enable alert policies with bounded fields', () => {
  const utilities = listUtilities();
  assert.deepEqual(
    utilities.filter(({ alertPolicy }) => alertPolicy.enabled).map(({ key }) => key),
    ['patterns', 'hotspots', 'anomalies'],
  );

  assert.deepEqual(getUtility('patterns').alertPolicy.fields, {
    threshold: { kind: 'number', min: 0.65, max: 1 },
    evaluationWindowDays: { kind: 'integer', min: 1, max: 180 },
  });
  assert.deepEqual(getUtility('hotspots').alertPolicy.fields, {
    minimumCases: { kind: 'integer', min: 2, max: 50 },
    evaluationWindowDays: { kind: 'integer', min: 1, max: 180 },
  });
  assert.deepEqual(getUtility('anomalies').alertPolicy.fields, {
    deviation: { kind: 'number', min: 1, max: 10 },
    evaluationWindowDays: { kind: 'integer', min: 1, max: 180 },
  });
  assert.deepEqual(getUtility('area-attention').alertPolicy.fields, {});
});

test('every utility describes its utility-specific five-stage lifecycle and contracts', () => {
  const utilities = listUtilities();
  for (const utility of utilities) {
    assert.deepEqual(utility.stages.map(({ stage }) => stage), [
      'Data', 'Analyze', 'Explain', 'Alert', 'Deliver',
    ]);
    assert.ok(utility.stages.every(({ label }) => typeof label === 'string' && label.length > 0));
    assert.equal(typeof utility.source.service, 'string');
    assert.equal(typeof utility.source.method, 'string');
    assert.ok(utility.outputs.length > 0);
    assert.ok(utility.limitations.length > 0);
  }
  assert.equal(new Set(utilities.map(({ stages }) => stages[1].label)).size, utilities.length);
});

test('registry owns the exact utility metadata contract', () => {
  assert.deepEqual(listUtilities().map((utility) => ({
    key: utility.key,
    name: utility.name,
    icon: utility.icon,
    findingType: utility.findingType,
    availability: utility.availability,
    source: utility.source,
    analyticalMethod: utility.analyticalMethod,
    aiAssistance: utility.aiAssistance,
    stageLabels: utility.stages.map(({ label }) => label),
    outputs: utility.outputs,
    limitations: utility.limitations,
  })), EXPECTED_METADATA);
});

test('listed rule bounds are isolated across utilities', () => {
  const utilities = listUtilities();
  utilities[0].alertPolicy.fields.evaluationWindowDays.min = 99;

  assert.equal(utilities[1].alertPolicy.fields.evaluationWindowDays.min, 1);
  assert.equal(utilities[2].alertPolicy.fields.evaluationWindowDays.min, 1);
  assert.equal(getUtility('patterns').alertPolicy.fields.evaluationWindowDays.min, 1);
});

test('definitions are recursively immutable and list results cannot mutate the registry', () => {
  const hotspot = getUtility('hotspots');
  assert.equal(Object.isFrozen(hotspot), true);
  assert.equal(Object.isFrozen(hotspot.stages), true);
  assert.equal(Object.isFrozen(hotspot.stages[0]), true);
  assert.equal(Object.isFrozen(hotspot.alertPolicy.fields.minimumCases), true);
  assert.equal(Object.isFrozen(hotspot.aiAssistance), true);
  assert.equal(Object.isFrozen(hotspot.aiAssistance.governance), true);

  const listed = listUtilities();
  listed[0].name = 'Changed';
  listed[0].stages[0].label = 'Changed';
  listed[0].aiAssistance.method = 'Changed';
  listed[0].aiAssistance.governance.humanReviewRequired = false;
  assert.notEqual(getUtility('patterns').name, 'Changed');
  assert.notEqual(getUtility('patterns').stages[0].label, 'Changed');
  assert.equal(getUtility('patterns').aiAssistance.method, 'EXPLAINABLE_MULTI_SIGNAL_FUSION');
  assert.equal(getUtility('patterns').aiAssistance.governance.humanReviewRequired, true);
  assert.equal(getUtility('unknown'), undefined);
});

test('available utilities explain AI assistance as a governed signal requiring human review', () => {
  const utilities = listUtilities();
  const available = utilities.filter(({ availability }) => availability === 'AVAILABLE');

  assert.deepEqual(available.map(({ aiAssistance }) => [aiAssistance.method, aiAssistance.engineVersion]), [
    ['EXPLAINABLE_MULTI_SIGNAL_FUSION', '1.0.0'],
    ['HAVERSINE_DBSCAN', '1.0.0'],
    ['MEDIAN_MAD', '1.0.0'],
  ]);
  for (const { aiAssistance } of available) {
    assert.deepEqual(aiAssistance.governance, {
      machineGeneratedSignal: true,
      humanGovernedDelivery: true,
      humanReviewRequired: true,
    });
    assert.match(aiAssistance.explanation, /human review is required/i);
    assert.ok(aiAssistance.explanation.split(/(?<=[.!?])\s+/).length >= 2);
    assert.ok(aiAssistance.explanation.split(/(?<=[.!?])\s+/).length <= 3);
  }
  assert.match(getUtility('anomalies').aiAssistance.explanation, /SEASONAL_MEDIAN_MAD.*only when a seasonal period is configured/);
  assert.equal(getUtility('area-attention').aiAssistance, undefined);
});

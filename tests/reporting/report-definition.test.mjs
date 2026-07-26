import assert from 'node:assert/strict';
import test from 'node:test';

import {
  REPORT_SOURCES,
  getReportSource,
} from '../../src/backend/reporting/semantic-sources.mjs';
import { normalizeReportDefinition } from '../../src/backend/reporting/report-definition.mjs';

test('semantic registry exposes exactly eight governed intelligence sources', () => {
  assert.deepEqual(Object.keys(REPORT_SOURCES), [
    'brief', 'patterns', 'hotspots', 'anomalies', 'areaRisk', 'districtContext', 'alerts', 'stationCases',
  ]);
  for (const source of Object.values(REPORT_SOURCES)) {
    assert.match(source.service, /^[a-z][A-Za-z]+$/);
    assert.ok(Object.isFrozen(source));
    assert.ok(Object.isFrozen(source.fields));
    assert.equal('table' in source, false);
    assert.equal('query' in source, false);
  }
  assert.throws(() => getReportSource('SRC_CaseMaster'), /invalid report source/i);
});

test('station case reports expose only the governed analytical allowlist', () => {
  const source = getReportSource('stationCases');
  assert.equal(source.service, 'listStationCasesForAnalytics');
  assert.deepEqual(Object.keys(source.fields), [
    'caseId', 'caseNumber', 'unitId', 'unitName', 'status', 'registeredAt', 'incidentAt',
    'majorHead', 'minorHead', 'ageDays', 'ageingBucket', 'isOpen', 'recordCount',
  ]);
  assert.deepEqual(source.visualizations, ['number', 'table', 'bar', 'line', 'pie', 'funnel']);
  assert.deepEqual(source.fields.ageDays.aggregates, ['avg', 'min', 'max']);
  assert.deepEqual(source.fields.recordCount.aggregates, ['sum', 'count']);
  for (const field of ['caseId', 'caseNumber', 'unitId', 'unitName', 'status', 'registeredAt',
    'incidentAt', 'majorHead', 'minorHead', 'ageingBucket', 'isOpen']) {
    assert.equal(source.fields[field].dimension, true, field);
  }

  for (const rawField of ['BriefFacts', 'ComplainantName', 'accused', 'syntheticData']) {
    assert.throws(() => normalizeReportDefinition({
      name: 'Unsafe station cases', sourceKey: 'stationCases', dimensions: [rawField],
    }, source), /unknown field/i);
  }
});

test('alert reports expose a truthful row count measure for active alert totals', () => {
  const source = getReportSource('alerts');
  assert.deepEqual(source.fields.recordCount.aggregates, ['sum', 'count']);
  const definition = normalizeReportDefinition({
    name: 'Active alerts', sourceKey: 'alerts',
    measures: [{ field: 'recordCount', aggregate: 'sum' }],
    filters: [{ field: 'state', operator: 'in', value: ['GENERATED', 'ASSIGNED', 'ACKNOWLEDGED', 'CONCLUDED'] }],
    visualization: { type: 'number' },
  }, source);
  assert.deepEqual(definition.measures, [{ field: 'recordCount', aggregate: 'sum' }]);
});

test('semantic aggregate allowlists are deeply immutable', () => {
  const source = getReportSource('stationCases');
  const aggregates = source.fields.recordCount.aggregates;
  try {
    assert.throws(() => aggregates.push('avg'), TypeError);
  } finally {
    if (aggregates.at(-1) === 'avg') aggregates.pop();
  }
  assert.equal(Object.isFrozen(aggregates), true);
  assert.throws(() => normalizeReportDefinition({
    name: 'Unsafe average', sourceKey: 'stationCases',
    measures: [{ field: 'recordCount', aggregate: 'avg' }],
  }, source), /aggregate/i);
});

test('validates report filter operators and values against semantic field types', () => {
  const source = getReportSource('stationCases');
  const validFilters = [
    { field: 'isOpen', operator: 'eq', value: true },
    { field: 'ageDays', operator: 'gte', value: 7 },
    { field: 'registeredAt', operator: 'between', value: ['2026-07-01', '2026-07-31T23:59:59Z'] },
    { field: 'status', operator: 'in', value: ['Under Investigation', 'Chargesheet Filed'] },
  ];
  assert.deepEqual(normalizeReportDefinition({
    name: 'Typed filters', sourceKey: 'stationCases', filters: validFilters,
  }, source).filters, validFilters);

  for (const filter of [
    { field: 'isOpen', operator: 'gte', value: true },
    { field: 'isOpen', operator: 'eq', value: 1 },
    { field: 'ageDays', operator: 'eq', value: '7' },
    { field: 'ageDays', operator: 'between', value: [1] },
    { field: 'ageDays', operator: 'between', value: [1, '30'] },
    { field: 'registeredAt', operator: 'lte', value: 'not-a-date' },
    { field: 'registeredAt', operator: 'eq', value: '2026-02-30' },
    { field: 'registeredAt', operator: 'between', value: ['2026-07-01', false] },
    { field: 'status', operator: 'between', value: ['A', 'Z'] },
    { field: 'status', operator: 'in', value: [] },
    { field: 'status', operator: 'in', value: ['Open', 2] },
    { field: 'status', operator: 'in', value: Array.from({ length: 101 }, () => 'Open') },
    { field: 'status', operator: 'eq', value: ['Open'] },
  ]) assert.throws(() => normalizeReportDefinition({
    name: 'Invalid typed filter', sourceKey: 'stationCases', filters: [filter],
  }, source), /filter/i);
});

test('normalizes a bounded anomaly trend from governed fields', () => {
  const definition = normalizeReportDefinition({
    name: 'District anomaly trend',
    sourceKey: 'anomalies',
    dimensions: ['unitId', 'period'],
    measures: [{ field: 'observed', aggregate: 'sum' }],
    filters: [{ field: 'severity', operator: 'gte', value: 0.5 }],
    sort: [{ field: 'period', direction: 'asc' }],
    visualization: { type: 'line' },
    limit: 100,
  }, getReportSource('anomalies'));

  assert.equal(definition.sourceKey, 'anomalies');
  assert.equal(definition.limit, 100);
  assert.deepEqual(definition.dimensions, ['unitId', 'period']);
  assert.deepEqual(definition.sort, [{ field: 'period', direction: 'asc' }]);
  assert.equal(definition.visualization.type, 'line');
});

test('allows sorting by a declared aggregate output only', () => {
  const source = getReportSource('anomalies');
  const definition = normalizeReportDefinition({
    name: 'Largest anomaly', sourceKey: 'anomalies',
    dimensions: ['unitId'], measures: [{ field: 'observed', aggregate: 'sum' }],
    sort: [{ field: 'observed_sum', direction: 'desc' }],
  }, source);

  assert.deepEqual(definition.sort, [{ field: 'observed_sum', direction: 'desc' }]);
  assert.throws(() => normalizeReportDefinition({
    name: 'Invalid aggregate sort', sourceKey: 'anomalies',
    measures: [{ field: 'observed', aggregate: 'sum' }],
    sort: [{ field: 'observed_avg', direction: 'desc' }],
  }, source), /sort field/i);
});

test('rejects raw storage access, unknown fields and unsupported report operations', () => {
  const source = getReportSource('anomalies');
  assert.throws(
    () => normalizeReportDefinition({ name: 'Raw', sourceKey: 'SRC_CaseMaster' }, source),
    /source/i,
  );
  assert.throws(
    () => normalizeReportDefinition({ name: 'Partial', sourceKey: 'list' }, source),
    /source/i,
  );
  assert.throws(
    () => normalizeReportDefinition({ name: 'Raw', sourceKey: 'anomalies', zcql: 'SELECT *' }, source),
    /unexpected field/i,
  );
  assert.throws(
    () => normalizeReportDefinition({ name: 'Bad', sourceKey: 'anomalies', dimensions: ['CrimeNo'] }, source),
    /unknown field/i,
  );
  assert.throws(
    () => normalizeReportDefinition({ name: 'Bad', sourceKey: 'anomalies', measures: [{ field: 'observed', aggregate: 'median' }] }, source),
    /aggregate/i,
  );
  assert.throws(
    () => normalizeReportDefinition({ name: 'Bad', sourceKey: 'anomalies', visualization: { type: 'network' } }, source),
    /visualization/i,
  );
});

test('rejects duplicate dimensions and unbounded limits', () => {
  const source = getReportSource('hotspots');
  assert.throws(
    () => normalizeReportDefinition({ name: 'Bad', sourceKey: 'hotspots', dimensions: ['areaId', 'areaId'] }, source),
    /duplicate/i,
  );
  assert.throws(
    () => normalizeReportDefinition({ name: 'Bad', sourceKey: 'hotspots', limit: 201 }, source),
    /limit/i,
  );
});

test('map reports require exactly one governed map view reference', () => {
  const source = getReportSource('hotspots');
  const definition = normalizeReportDefinition({
    name: 'Current hotspot posture', sourceKey: 'hotspots',
    visualization: { type: 'map', mapViewId: 'MAP-1' },
  }, source);

  assert.deepEqual(definition.visualization, { type: 'map', mapViewId: 'MAP-1' });
  for (const visualization of [
    { type: 'map' },
    { type: 'map', mapViewId: 'not valid' },
    { type: 'map', mapViewId: 'MAP-1', inlineStyleUrl: 'https://private.invalid/style.json' },
    { type: 'map', mapViewId: 'MAP-1', sourceUrl: 'pmtiles://private-object' },
    { type: 'bar', mapViewId: 'MAP-1' },
  ]) {
    assert.throws(() => normalizeReportDefinition({
      name: 'Unsafe map', sourceKey: 'hotspots', visualization,
    }, source), /visualization|map view/i);
  }
});

test('map reports reject transforms that would be silently ignored', () => {
  const source = getReportSource('hotspots');
  for (const transform of [
    { dimensions: ['unitId'] },
    { measures: [{ field: 'caseCount', aggregate: 'sum' }] },
    { filters: [{ field: 'unitId', operator: 'eq', value: '999' }] },
    { sort: [{ field: 'unitId', direction: 'asc' }] },
  ]) assert.throws(() => normalizeReportDefinition({
    name: 'Misleading district map', sourceKey: 'hotspots',
    visualization: { type: 'map', mapViewId: 'MAP-1' }, ...transform,
  }, source), /map.*transform|visualization|sort/i);
});

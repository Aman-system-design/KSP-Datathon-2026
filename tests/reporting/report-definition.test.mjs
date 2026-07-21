import assert from 'node:assert/strict';
import test from 'node:test';

import {
  REPORT_SOURCES,
  getReportSource,
} from '../../src/backend/reporting/semantic-sources.mjs';
import { normalizeReportDefinition } from '../../src/backend/reporting/report-definition.mjs';

test('semantic registry exposes exactly seven governed intelligence sources', () => {
  assert.deepEqual(Object.keys(REPORT_SOURCES), [
    'brief', 'patterns', 'hotspots', 'anomalies', 'areaRisk', 'districtContext', 'alerts',
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

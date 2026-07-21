import assert from 'node:assert/strict';
import test from 'node:test';

import { executeReportDefinition } from '../../src/backend/reporting/report-execution.mjs';

test('report execution filters, groups, aggregates, sorts and limits governed rows', () => {
  const result = executeReportDefinition({
    dimensions: ['unitId'], measures: [{ field: 'observed', aggregate: 'sum' }],
    filters: [{ field: 'severity', operator: 'gte', value: 0.5 }],
    sort: [{ field: 'observed_sum', direction: 'desc' }], limit: 1,
  }, [
    { unitId: 101, observed: 4, severity: 0.8 },
    { unitId: 101, observed: 6, severity: 0.7 },
    { unitId: 102, observed: 20, severity: 0.2 },
  ]);
  assert.deepEqual(result, [{ unitId: 101, observed_sum: 10 }]);
});

test('report execution calculates count and average without mutating source rows', () => {
  const rows = [{ type: 'A', value: 2 }, { type: 'A', value: 4 }];
  const result = executeReportDefinition({
    dimensions: ['type'], measures: [
      { field: 'value', aggregate: 'avg' }, { field: 'value', aggregate: 'count' },
    ], filters: [], sort: [], limit: 100,
  }, rows);
  assert.deepEqual(result, [{ type: 'A', value_avg: 3, value_count: 2 }]);
  assert.deepEqual(rows, [{ type: 'A', value: 2 }, { type: 'A', value: 4 }]);
});

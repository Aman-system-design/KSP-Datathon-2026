import { expect, test } from 'vitest';

import { adaptReportRows } from '../report-preview-adapters.js';

test('adapts chart rows using the declared dimension and measure', () => {
  const result = adaptReportRows(
    [{ district: 'Bengaluru Urban', cases_count: 42, ignored: 999 }],
    { dimensions: ['district'], measures: [{ field: 'cases', aggregate: 'count' }] },
  );

  expect(result).toEqual([{ label: 'Bengaluru Urban', value: 42, row: expect.any(Object) }]);
});

test('does not guess a numeric value when a measure is not declared', () => {
  expect(adaptReportRows([{ district: 'Mysuru', ignored: 999 }], { dimensions: ['district'], measures: [] }))
    .toEqual([{ label: 'Mysuru', value: null, row: expect.any(Object) }]);
});

test('only removes a Synthetic prefix for explicitly demonstration data', () => {
  const rows = [{ category: 'Synthetic Biology Fraud', cases_count: 3 }];
  const definition = { dimensions: ['category'], measures: [{ field: 'cases', aggregate: 'count' }] };
  expect(adaptReportRows(rows, definition)[0].label).toBe('Synthetic Biology Fraud');
  expect(adaptReportRows(rows, definition, { demonstration: true })[0].label).toBe('Biology Fraud');
});

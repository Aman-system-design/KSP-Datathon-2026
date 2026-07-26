import { describe, expect, test } from 'vitest';

import { submissionSyntheticRows } from './submission-synthetic-results.js';

describe('submission synthetic dashboard results', () => {
  test('restores the approved 4,900-record submission totals', () => {
    expect(submissionSyntheticRows('Statewide FIR Volume')).toEqual([{ RecordCount_sum: 4900 }]);
    expect(submissionSyntheticRows('Crime Category Share')).toEqual([
      { CrimeMajorHeadName: 'Synthetic Property Crime', RecordCount_sum: 2470 },
      { CrimeMajorHeadName: 'Synthetic Public Order', RecordCount_sum: 1458 },
      { CrimeMajorHeadName: 'Synthetic Cyber Crime', RecordCount_sum: 972 },
    ]);
  });

  test('supplies all Karnataka districts and preserves the statewide total', () => {
    const rows = submissionSyntheticRows('FIRs by Karnataka District');
    expect(rows).toHaveLength(31);
    expect(rows.reduce((total, row) => total + row.RecordCount_sum, 0)).toBe(4900);
  });

  test('does not invent rows for an unrelated report', () => {
    expect(submissionSyntheticRows('Unrelated report')).toEqual([]);
  });

  test('supports the recommended editable command reports', () => {
    expect(submissionSyntheticRows('District FIR Ranking')).toHaveLength(12);
    expect(submissionSyntheticRows('Hourly FIR Demand')).toHaveLength(24);
    expect(submissionSyntheticRows('Case Status Distribution')).toHaveLength(2);
    expect(submissionSyntheticRows('Major Crime Comparison')).toHaveLength(3);
    expect(submissionSyntheticRows('Monthly FIR Trend')).toHaveLength(6);
    expect(submissionSyntheticRows('District FIR Concentration')).toHaveLength(10);
    expect(submissionSyntheticRows('Police Station Load Concentration')).toHaveLength(10);
    expect(submissionSyntheticRows('Crime Category Mix')).toHaveLength(3);
    expect(submissionSyntheticRows('Case Lifecycle')).toHaveLength(2);
  });
});

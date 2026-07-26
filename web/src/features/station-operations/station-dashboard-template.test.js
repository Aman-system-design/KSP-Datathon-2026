import { describe, expect, test } from 'vitest';

import { STATION_LAYOUT, STATION_REPORTS } from './station-dashboard-template.js';

const approvedFields = {
  alerts: new Set(['state', 'recordCount']),
  stationCases: new Set([
    'caseId', 'caseNumber', 'unitId', 'unitName', 'status', 'registeredAt', 'incidentAt',
    'majorHead', 'minorHead', 'ageDays', 'ageingBucket', 'isOpen', 'recordCount',
  ]),
};

function overlaps(left, right) {
  return left.column < right.column + right.width
    && left.column + left.width > right.column
    && left.row < right.row + right.height
    && left.row + left.height > right.row;
}

describe('station dashboard template', () => {
  test('declares exactly nine governed report definitions without seeded results', () => {
    expect(STATION_REPORTS).toHaveLength(9);
    expect(STATION_REPORTS.map(report => report.name)).toEqual([
      'Open Cases', '60+ Day Cases', 'Cases Registered by Period', 'Active Alerts',
      'Case Ageing', 'Case Lifecycle', 'Crime Category', 'Registered Case Trend',
      'Open Case Register',
    ]);
    expect(STATION_REPORTS.map(report => report.sourceKey)).toEqual([
      'stationCases', 'stationCases', 'stationCases', 'alerts', 'stationCases',
      'stationCases', 'stationCases', 'stationCases', 'stationCases',
    ]);
    for (const report of STATION_REPORTS) {
      expect(report).not.toHaveProperty('data');
      expect(report).not.toHaveProperty('result');
      expect(report).not.toHaveProperty('preview');
      expect(JSON.stringify(report)).not.toMatch(/synthetic|seeded/i);
    }
  });

  test('uses truthful approved dimensions, measures, and lifecycle filters', () => {
    for (const report of STATION_REPORTS) {
      const fields = [
        ...(report.dimensions ?? []),
        ...(report.measures ?? []).map(measure => measure.field),
        ...(report.filters ?? []).map(filter => filter.field),
      ];
      expect(fields.every(field => approvedFields[report.sourceKey].has(field))).toBe(true);
    }
    expect(STATION_REPORTS[0]).toMatchObject({
      filters: [{ field: 'isOpen', operator: 'eq', value: true }],
      measures: [{ field: 'recordCount', aggregate: 'sum' }],
      visualization: { type: 'number' },
    });
    expect(STATION_REPORTS[1].filters).toEqual([
      { field: 'isOpen', operator: 'eq', value: true },
      { field: 'ageingBucket', operator: 'eq', value: '60+ days' },
    ]);
    expect(STATION_REPORTS[2]).toMatchObject({
      dimensions: ['registeredAt'], visualization: { type: 'table' }, filters: [],
    });
    expect(STATION_REPORTS[3].filters).toEqual([
      { field: 'state', operator: 'in', value: ['GENERATED', 'ASSIGNED', 'ACKNOWLEDGED', 'CONCLUDED'] },
    ]);
    expect(STATION_REPORTS[4]).toMatchObject({
      dimensions: ['ageingBucket'],
      filters: [{ field: 'isOpen', operator: 'eq', value: true }],
      visualization: { type: 'bar' },
    });
    expect(STATION_REPORTS[5]).toMatchObject({ dimensions: ['status'], filters: [], visualization: { type: 'funnel' } });
    expect(STATION_REPORTS[7]).toMatchObject({ dimensions: ['registeredAt'], visualization: { type: 'line' } });
    expect(STATION_REPORTS[8]).toMatchObject({ visualization: { type: 'table' }, filters: [{ field: 'isOpen', operator: 'eq', value: true }] });
  });

  test('places every report within a non-overlapping twelve-column layout', () => {
    expect(STATION_LAYOUT).toHaveLength(STATION_REPORTS.length);
    for (const placement of STATION_LAYOUT) {
      expect(Number.isInteger(placement.column)).toBe(true);
      expect(Number.isInteger(placement.row)).toBe(true);
      expect(Number.isInteger(placement.width)).toBe(true);
      expect(Number.isInteger(placement.height)).toBe(true);
      expect(placement.column).toBeGreaterThanOrEqual(1);
      expect(placement.row).toBeGreaterThanOrEqual(1);
      expect(placement.width).toBeGreaterThanOrEqual(1);
      expect(placement.height).toBeGreaterThanOrEqual(1);
      expect(placement.column + placement.width - 1).toBeLessThanOrEqual(12);
    }
    for (let left = 0; left < STATION_LAYOUT.length; left += 1) {
      for (let right = left + 1; right < STATION_LAYOUT.length; right += 1) {
        expect(overlaps(STATION_LAYOUT[left], STATION_LAYOUT[right]), `${left} overlaps ${right}`).toBe(false);
      }
    }
    expect(STATION_LAYOUT[4].width).toBeGreaterThanOrEqual(6);
    expect(STATION_LAYOUT[8].height).toBeGreaterThanOrEqual(4);
  });
});

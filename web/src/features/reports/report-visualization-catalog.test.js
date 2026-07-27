import { describe, expect, test } from 'vitest';
import { chartCompatibility, REPORT_VISUALIZATIONS } from './report-visualization-catalog.js';

const source = {
  visualizations: ['table', 'bar', 'map'],
  fields: {
    district: { type: 'string', dimension: true },
    count: { type: 'number', aggregates: ['sum'] },
    latitude: { type: 'number' },
  },
};

describe('report visualization catalogue', () => {
  test('lists every approved builder choice in stable order', () => {
    expect(REPORT_VISUALIZATIONS.map(item => item.type)).toEqual([
      'table', 'number', 'bar', 'line', 'pie', 'funnel', 'map',
    ]);
    expect(REPORT_VISUALIZATIONS.at(-1).label).toBe('Karnataka Map');
  });

  test('requires server approval before a chart can be saved or run', () => {
    expect(chartCompatibility({ source, type: 'bar' })).toEqual({ compatible: true, reason: '' });
    expect(chartCompatibility({ source, type: 'pie' })).toEqual({
      compatible: false,
      reason: 'This governed source does not support Pie reports.',
    });
  });

  test('reports missing numeric and geographic requirements clearly', () => {
    expect(chartCompatibility({ source: { ...source, visualizations: ['number'], fields: {} }, type: 'number' }).reason)
      .toBe('KPI Number requires a numeric measure.');
    expect(chartCompatibility({ source: { ...source, visualizations: ['map'], fields: {} }, type: 'map' }).reason)
      .toBe('Karnataka Map requires an approved geographic source.');
  });
});

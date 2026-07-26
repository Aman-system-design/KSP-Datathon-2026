import { describe, expect, test } from 'vitest';

import { RECOMMENDED_COMMAND_REPORTS, STATE_INTELLIGENCE_REPORTS } from './state-intelligence-template.js';

describe('state intelligence dashboard template', () => {
  test('prioritises change, concentration, category mix, and lifecycle insight', () => {
    expect(STATE_INTELLIGENCE_REPORTS.map(report => report.name)).toEqual([
      'FIRs by Karnataka District',
      'Monthly FIR Trend',
      'District FIR Concentration',
      'Police Station Load Concentration',
      'Crime Category Mix',
      'Case Lifecycle',
    ]);
    expect(STATE_INTELLIGENCE_REPORTS.some(report => report.name === 'Statewide FIR Volume')).toBe(false);
  });

  test('keeps 24-hour demand available as an optional editable report', () => {
    expect(RECOMMENDED_COMMAND_REPORTS.map(report => report.name)).toContain('24-Hour Crime Pattern');
  });

  test('uses the governed FIR dimensions for each insight', () => {
    expect(STATE_INTELLIGENCE_REPORTS.find(report => report.name === 'Monthly FIR Trend')?.dimensions).toEqual(['IncidentMonth']);
    expect(STATE_INTELLIGENCE_REPORTS.find(report => report.name === 'District FIR Concentration')?.dimensions).toEqual(['DistrictName']);
    expect(STATE_INTELLIGENCE_REPORTS.find(report => report.name === 'Police Station Load Concentration')?.dimensions).toEqual(['PoliceStationName']);
  });
});

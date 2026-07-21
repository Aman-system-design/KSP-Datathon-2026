import assert from 'node:assert/strict';
import test from 'node:test';

import { projectReportRows } from '../../src/backend/reporting/report-execution.mjs';

const meta = { scopeUnitId: 101, observationPeriod: { to: '2026-07-01T00:00:00Z' } };

test('projects governed read envelopes into the published semantic fields', () => {
  assert.deepEqual(projectReportRows('hotspots', {
    data: { items: [{ id: 'H-1', centroid: { latitude: 12.9, longitude: 77.5 }, magnitude: 6, confidence: 0.9 }] }, meta,
  }), [{ areaId: 'H-1', unitId: 101, latitude: 12.9, longitude: 77.5, caseCount: 6, severity: 0.9, period: '2026-07-01T00:00:00Z' }]);

  assert.deepEqual(projectReportRows('anomalies', {
    data: { items: [{ id: 'A-1', method: 'MEDIAN_MAD', observed: 8, expected: 2, confidence: 1 }] }, meta,
  }), [{ anomalyId: 'A-1', unitId: 101, signalType: 'MEDIAN_MAD', observed: 8, expected: 2, severity: 1, period: '2026-07-01T00:00:00Z' }]);

  assert.deepEqual(projectReportRows('alerts', {
    data: { items: [{ id: 'ALT-1', type: 'PATTERN', status: 'GENERATED', scopeUnitId: 101, severity: 0.8, createdAt: '2026-07-01T00:00:00Z' }] },
  }), [{ alertId: 'ALT-1', alertType: 'PATTERN', state: 'GENERATED', unitId: 101, severity: 0.8, createdAt: '2026-07-01T00:00:00Z' }]);
});

test('flattens command metrics and district indicators into report rows', () => {
  assert.deepEqual(projectReportRows('brief', {
    data: { activeCaseCount: 50, patternCount: 1, hotspotCount: 2, anomalyCount: 3 }, meta,
  }), [
    { unitId: 101, metric: 'activeCaseCount', value: 50, period: '2026-07-01T00:00:00Z' },
    { unitId: 101, metric: 'patternCount', value: 1, period: '2026-07-01T00:00:00Z' },
    { unitId: 101, metric: 'hotspotCount', value: 2, period: '2026-07-01T00:00:00Z' },
    { unitId: 101, metric: 'anomalyCount', value: 3, period: '2026-07-01T00:00:00Z' },
  ]);
  assert.deepEqual(projectReportRows('districtContext', {
    data: { items: [{ unitId: 101, period: '2026-Q2', indicators: { urbanizationIndex: 0.82 } }] }, meta,
  }), [{ unitId: 101, indicator: 'urbanizationIndex', value: 0.82, period: '2026-Q2' }]);
});

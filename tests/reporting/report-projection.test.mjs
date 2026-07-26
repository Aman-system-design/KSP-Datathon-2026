import assert from 'node:assert/strict';
import test from 'node:test';

import { projectReportRows } from '../../src/backend/reporting/report-execution.mjs';
import { normalizeReportDefinition } from '../../src/backend/reporting/report-definition.mjs';
import { getReportSource } from '../../src/backend/reporting/semantic-sources.mjs';

const meta = { scopeUnitId: 101, observationPeriod: { to: '2026-07-01T00:00:00Z' } };

test('projects governed read envelopes into the published semantic fields', () => {
  assert.deepEqual(projectReportRows('hotspots', {
    data: { items: [{ id: 'H-1', centroid: { latitude: 12.9, longitude: 77.5 }, magnitude: 6, confidence: 0.9 }] }, meta,
  }), [{ areaId: 'H-1', unitId: '101', latitude: 12.9, longitude: 77.5, caseCount: 6, severity: 0.9, period: '2026-07-01T00:00:00Z' }]);

  assert.deepEqual(projectReportRows('anomalies', {
    data: { items: [{ id: 'A-1', method: 'MEDIAN_MAD', observed: 8, expected: 2, confidence: 1 }] }, meta,
  }), [{ anomalyId: 'A-1', unitId: '101', signalType: 'MEDIAN_MAD', observed: 8, expected: 2, severity: 1, period: '2026-07-01T00:00:00Z' }]);

  assert.deepEqual(projectReportRows('alerts', {
    data: { items: [{ id: 'ALT-1', type: 'PATTERN', status: 'GENERATED', scopeUnitId: 101, severity: 0.8, createdAt: '2026-07-01T00:00:00Z' }] },
  }), [{ alertId: 'ALT-1', alertType: 'PATTERN', state: 'GENERATED', unitId: '101', severity: 0.8, createdAt: '2026-07-01T00:00:00Z', recordCount: 1 }]);
});

test('flattens command metrics and district indicators into report rows', () => {
  assert.deepEqual(projectReportRows('brief', {
    data: { activeCaseCount: 50, patternCount: 1, hotspotCount: 2, anomalyCount: 3 }, meta,
  }), [
    { unitId: '101', metric: 'activeCaseCount', value: 50, period: '2026-07-01T00:00:00Z' },
    { unitId: '101', metric: 'patternCount', value: 1, period: '2026-07-01T00:00:00Z' },
    { unitId: '101', metric: 'hotspotCount', value: 2, period: '2026-07-01T00:00:00Z' },
    { unitId: '101', metric: 'anomalyCount', value: 3, period: '2026-07-01T00:00:00Z' },
  ]);
  assert.deepEqual(projectReportRows('districtContext', {
    data: { items: [{ unitId: 101, period: '2026-Q2', indicators: { urbanizationIndex: 0.82 } }] }, meta,
  }), [{ unitId: '101', indicator: 'urbanizationIndex', value: 0.82, period: '2026-Q2' }]);
});

test('projects station cases through a mutation-safe analytical allowlist', () => {
  const source = {
    caseId: 'CASE-1', caseNumber: '01/2026', unitId: 1001, unitName: 'Central Station',
    status: 'Under Investigation', registeredAt: '2026-07-20T00:00:00Z',
    incidentAt: '2026-07-19T22:00:00Z', majorHead: 'Theft', minorHead: 'Vehicle Theft',
    ageDays: 6, ageingBucket: '0–7 days', isOpen: true, recordCount: 999,
    syntheticData: true, BriefFacts: 'restricted narrative', ComplainantName: 'restricted person',
  };
  const snapshot = structuredClone(source);

  assert.deepEqual(projectReportRows('stationCases', { data: { items: [source] } }), [{
    caseId: 'CASE-1', caseNumber: '01/2026', unitId: 1001, unitName: 'Central Station',
    status: 'Under Investigation', registeredAt: '2026-07-20T00:00:00Z',
    incidentAt: '2026-07-19T22:00:00Z', majorHead: 'Theft', minorHead: 'Vehicle Theft',
    ageDays: 6, ageingBucket: '0–7 days', isOpen: true, recordCount: 1,
  }]);
  assert.deepEqual(source, snapshot);
});

test('all semantic projections match their declared types and accept typed filters', () => {
  const fixtures = [
    ['brief', { data: { activeCaseCount: 2 }, meta }, 'unitId'],
    ['patterns', { data: { items: [{ id: 'P-1', method: 'LINK', evidenceCaseIds: ['C-1'], confidence: 0.8 }] }, meta }, 'unitId'],
    ['hotspots', { data: { items: [{ id: 'H-1', centroid: { latitude: 12.9, longitude: 77.5 }, magnitude: 2, confidence: 0.7 }] }, meta }, 'unitId'],
    ['anomalies', { data: { items: [{ id: 'A-1', method: 'MAD', observed: 4, expected: 2, confidence: 0.9 }] }, meta }, 'unitId'],
    ['areaRisk', { data: { areaId: 'AREA-1', scope: 'DISTRICT', score: 0.6 }, meta }, 'unitId'],
    ['districtContext', { data: { items: [{ unitId: 101, period: '2026-Q2', indicators: { urbanizationIndex: 0.82 } }] }, meta }, 'period'],
    ['alerts', { data: { items: [{ id: 'ALT-1', type: 'PATTERN', status: 'GENERATED', scopeUnitId: 101, severity: 0.8, createdAt: '2026-07-01T00:00:00Z' }] } }, 'unitId'],
    ['stationCases', { data: { items: [{
      caseId: 'C-1', caseNumber: '1/2026', unitId: 1001, unitName: 'Central Station',
      status: 'Under Investigation', registeredAt: '2026-07-20T00:00:00Z',
      incidentAt: '2026-07-19T00:00:00Z', majorHead: 'Property', minorHead: 'Theft',
      ageDays: 6, ageingBucket: '0–7 days', isOpen: true,
    }] } }, 'isOpen'],
  ];
  const valid = (type, value) => {
    if (type === 'number') return typeof value === 'number' && Number.isFinite(value);
    if (type === 'boolean') return typeof value === 'boolean';
    if (type === 'date') return typeof value === 'string' && Number.isFinite(Date.parse(value));
    return typeof value === 'string';
  };

  for (const [sourceKey, envelope, filterField] of fixtures) {
    const source = getReportSource(sourceKey);
    const [row] = projectReportRows(sourceKey, envelope);
    for (const [field, definition] of Object.entries(source.fields)) {
      assert.equal(valid(definition.type, row[field]), true, `${sourceKey}.${field} must be ${definition.type}`);
    }
    assert.doesNotThrow(() => normalizeReportDefinition({
      name: `${sourceKey} typed filter`, sourceKey,
      filters: [{ field: filterField, operator: 'eq', value: row[filterField] }],
    }, source));
  }
});

import assert from 'node:assert/strict';
import test from 'node:test';

import { identityCandidatePairs, patternCandidatePairs, spatialCandidatePairs } from '@ksp/intelligence-core/candidates';

test('spatial candidates exclude distant points without losing neighbours across a cell boundary', () => {
  const features = [
    { caseId: 'A', latitude: 12.97159, longitude: 77.59459, eligible: true },
    { caseId: 'B', latitude: 12.97160, longitude: 77.60790, eligible: true },
    { caseId: 'C', latitude: 13.08270, longitude: 80.27070, eligible: true },
  ];
  const result = spatialCandidatePairs(features, { radiusKm: 1.5 });
  assert.deepEqual(result.pairs.map(pair => pair.map(row => row.caseId)), [['A', 'B']]);
  assert.deepEqual(result.diagnostics, { eligibleCount: 3, fullPairCount: 3, candidatePairCount: 1 });
});

test('identity candidates compare only matching authoritative or normalized keys', () => {
  const appearances = [
    { appearanceId: 'A1', personId: 'P7', name: 'Synthetic One' },
    { appearanceId: 'A2', personId: 'P7', name: 'Different Alias' },
    { appearanceId: 'A3', personId: null, name: '  SYNTHETIC One  ' },
    { appearanceId: 'A4', personId: 'P9', name: 'Unrelated' },
  ];
  const result = identityCandidatePairs(appearances);
  assert.deepEqual(result.pairs.map(pair => pair.map(row => row.appearanceId)), [['A1', 'A2'], ['A1', 'A3']]);
  assert.deepEqual(result.diagnostics, { eligibleCount: 4, fullPairCount: 6, candidatePairCount: 2 });
});

test('candidate indexes stay empty for unrelated records', () => {
  const points = Array.from({ length: 100 }, (_, index) => ({
    caseId: `C-${index}`, latitude: 5 + index, longitude: 10, eligible: true,
  }));
  const people = Array.from({ length: 100 }, (_, index) => ({
    appearanceId: `A-${index}`, personId: `P-${index}`, name: `Synthetic ${index}`,
  }));
  assert.equal(spatialCandidatePairs(points, { radiusKm: 1 }).diagnostics.candidatePairCount, 0);
  assert.equal(identityCandidatePairs(people).diagnostics.candidatePairCount, 0);
});

test('common crime labels alone never create a quadratic Pattern Fusion bucket', () => {
  const features = Array.from({ length: 1000 }, (_, index) => ({
    caseId: `C-${index}`, eligible: true, crimeMajor: 'THEFT',
    latitude: -70 + Math.floor(index / 72) * 10, longitude: -177.5 + (index % 72) * 5,
    incidentAt: '2026-01-01T00:00:00.000Z', acts: [], sections: [], accused: [],
  }));
  const result = patternCandidatePairs(features, { maximumDays: 180, spatialRadiusKm: 50 });
  assert.equal(result.diagnostics.fullPairCount, 499500);
  assert.equal(result.diagnostics.candidatePairCount, 0);
});

test('spatial pattern candidates are partitioned by the observation window', () => {
  const features = [
    { caseId: 'OLD', latitude: 12.97, longitude: 77.59, incidentAt: '2020-01-01T00:00:00.000Z', eligible: true },
    { caseId: 'NEW', latitude: 12.97, longitude: 77.59, incidentAt: '2026-01-01T00:00:00.000Z', eligible: true },
  ];
  const result = spatialCandidatePairs(features, { radiusKm: 50, maximumDays: 180 });
  assert.equal(result.diagnostics.candidatePairCount, 0);
});

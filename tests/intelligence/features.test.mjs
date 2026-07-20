import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCaseFeature } from '@ksp/intelligence-core/features';

test('builds cyclic, categorical and quality features without sensitive demographics', () => {
  const feature = buildCaseFeature({
    caseId: 'CASE-1', districtId: 'D1', stationId: 'S1', crimeMajor: 'PROPERTY', crimeMinor: 'BURGLARY', gravity: 4,
    incidentAt: '2026-06-02T21:00:00+05:30', latitude: 12.97, longitude: 77.59, acts: ['BNS'], sections: ['305'],
    accused: [], briefFacts: 'Synthetic test record: rear-window entry.', synthetic: true,
    quality: { coordinatesValid: true, relationshipResolved: true, completeness: 0.9 },
  }, '1.0.0', new Date('2026-07-01T00:00:00Z'));
  assert.equal(feature.timeBand, 'EVENING');
  assert.equal(feature.featureVersion, '1.0.0');
  assert.equal(feature.eligible, true);
  assert.equal('caste' in feature, false);
  assert.ok(Number.isFinite(feature.hourSin));
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildCaseFeatures } from '@ksp/intelligence-core/features';
import { patternCandidatePairs } from '@ksp/intelligence-core/candidates';
import { discoverPatterns } from '@ksp/intelligence-core/pattern-fusion';

const input = JSON.parse(fs.readFileSync('fixtures/intelligence/demo-input.json', 'utf8'));
const truth = JSON.parse(fs.readFileSync('fixtures/intelligence/demo-truth.json', 'utf8'));

test('discovers cross-district pattern from evidence features', () => {
  const features = buildCaseFeatures(input.cases, '1.0.0', new Date(input.asOf));
  const { patterns, diagnostics } = discoverPatterns(features, { threshold: 0.65, minimumCases: 4, minimumEvidenceFamilies: 3 });
  const match = patterns.find(pattern => truth.pattern.caseIds.every(id => pattern.evidenceCaseIds.includes(id)));
  assert.ok(match);
  assert.ok(match.districtIds.length >= 2);
  assert.ok(match.componentSummary.text > 0);
  assert.ok(diagnostics.candidatePairCount < diagnostics.fullPairCount);
});

test('pattern output never claims guilt', () => {
  const features = buildCaseFeatures(input.cases, '1.0.0', new Date(input.asOf));
  const { patterns } = discoverPatterns(features, { threshold: 0.65, minimumCases: 4, minimumEvidenceFamilies: 3 });
  assert.ok(patterns.every(pattern => pattern.status === 'REQUIRES_HUMAN_VERIFICATION'));
});

test('network evidence nominates a pair outside the spatial block', () => {
  const features = [
    {
      caseId: 'A', eligible: true, latitude: 12.9, longitude: 77.5,
      incidentAt: '2026-01-01T00:00:00.000Z', crimeMajor: 'THEFT', acts: [], sections: [],
      accused: [{ personId: 'P7' }],
    },
    {
      caseId: 'B', eligible: true, latitude: 28.6, longitude: 77.2,
      incidentAt: '2026-01-02T00:00:00.000Z', crimeMajor: 'FRAUD', acts: [], sections: [],
      accused: [{ personId: 'P7' }],
    },
  ];
  const result = patternCandidatePairs(features, { maximumDays: 180, spatialRadiusKm: 50 });
  assert.deepEqual(result.pairs.map(pair => pair.map(row => row.caseId)), [['A', 'B']]);
});

test('bounded Pattern Fusion rejects parameters outside its proven candidate contract', () => {
  const features = buildCaseFeatures(input.cases, '1.0.0', new Date(input.asOf));
  assert.throws(() => discoverPatterns(features, {
    threshold: 0.64, minimumCases: 4, minimumEvidenceFamilies: 3,
  }), /bounded candidate contract/u);
  assert.throws(() => discoverPatterns(features, {
    threshold: 0.65, minimumCases: 4, minimumEvidenceFamilies: 2,
  }), /bounded candidate contract/u);
});

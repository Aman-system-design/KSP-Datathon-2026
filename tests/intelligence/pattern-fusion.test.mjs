import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildCaseFeatures } from '@ksp/intelligence-core/features';
import { discoverPatterns } from '@ksp/intelligence-core/pattern-fusion';

const input = JSON.parse(fs.readFileSync('fixtures/intelligence/demo-input.json', 'utf8'));
const truth = JSON.parse(fs.readFileSync('fixtures/intelligence/demo-truth.json', 'utf8'));

test('discovers cross-district pattern from evidence features', () => {
  const features = buildCaseFeatures(input.cases, '1.0.0', new Date(input.asOf));
  const patterns = discoverPatterns(features, { threshold: 0.65, minimumCases: 4, minimumEvidenceFamilies: 3 });
  const match = patterns.find(pattern => truth.pattern.caseIds.every(id => pattern.evidenceCaseIds.includes(id)));
  assert.ok(match);
  assert.ok(match.districtIds.length >= 2);
  assert.ok(match.componentSummary.text > 0);
});

test('pattern output never claims guilt', () => {
  const features = buildCaseFeatures(input.cases, '1.0.0', new Date(input.asOf));
  const patterns = discoverPatterns(features, { threshold: 0.65, minimumCases: 4, minimumEvidenceFamilies: 3 });
  assert.ok(patterns.every(pattern => pattern.status === 'REQUIRES_HUMAN_VERIFICATION'));
});

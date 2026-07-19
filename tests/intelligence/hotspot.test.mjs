import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildCaseFeatures } from '../../src/intelligence/features.mjs';
import { detectHotspots } from '../../src/intelligence/hotspot.mjs';

const input = JSON.parse(fs.readFileSync('fixtures/intelligence/demo-input.json', 'utf8'));
const truth = JSON.parse(fs.readFileSync('fixtures/intelligence/demo-truth.json', 'utf8'));

test('detects planted hotspot and excludes spatial noise', () => {
  const features = buildCaseFeatures(input.cases, '1.0.0', new Date(input.asOf));
  const results = detectHotspots(features, { radiusKm: 1.5, minCases: 5, runId: 'RUN-HOT-1' });
  assert.ok(results.some(result => truth.hotspot.caseIds.every(id => result.evidenceCaseIds.includes(id))));
  assert.ok(results.every(result => result.method === 'HAVERSINE_DBSCAN'));
});

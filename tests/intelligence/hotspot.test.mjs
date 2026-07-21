import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildCaseFeatures } from '@ksp/intelligence-core/features';
import { detectHotspots } from '@ksp/intelligence-core/hotspot';

const input = JSON.parse(fs.readFileSync('fixtures/intelligence/demo-input.json', 'utf8'));
const truth = JSON.parse(fs.readFileSync('fixtures/intelligence/demo-truth.json', 'utf8'));

test('detects planted hotspot and excludes spatial noise', () => {
  const features = buildCaseFeatures(input.cases, '1.0.0', new Date(input.asOf));
  const { findings, diagnostics } = detectHotspots(features, { radiusKm: 1.5, minCases: 5, runId: 'RUN-HOT-1' });
  assert.ok(findings.some(result => truth.hotspot.caseIds.every(id => result.evidenceCaseIds.includes(id))));
  assert.ok(findings.every(result => result.method === 'HAVERSINE_DBSCAN'));
  assert.ok(diagnostics.candidatePairCount < diagnostics.fullPairCount);
});

test('hotspots exclude records outside the active observation window', () => {
  const features = Array.from({ length: 5 }, (_, index) => ({
    caseId: `OLD-${index}`, eligible: true, ageDays: 1000,
    latitude: 12.9716, longitude: 77.5946, completeness: 1,
  }));
  const result = detectHotspots(features, {
    radiusKm: 1.5, minCases: 5, runId: 'RUN-RECENT', maximumAgeDays: 180,
  });
  assert.equal(result.findings.length, 0);
  assert.equal(result.diagnostics.eligibleCount, 0);
});

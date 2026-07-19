import test from 'node:test';
import assert from 'node:assert/strict';
import { createAnalysisRun, createFinding, assertFindingEvidence } from '../../src/intelligence/contracts.mjs';
import { median, mad, haversineKm, clamp01 } from '../../src/intelligence/math.mjs';

test('analysis run and finding expose versioned evidence', () => {
  const run = createAnalysisRun({ id: 'RUN-1', type: 'HOTSPOT', method: 'HAVERSINE_DBSCAN', version: '1.0.0', observedFrom: '2026-06-01', observedTo: '2026-06-30' });
  const finding = createFinding({ id: 'HOT-1', run, evidenceCaseIds: ['CASE-1'], confidence: 0.8, limitations: ['SYNTHETIC_DATA'] });
  assert.equal(assertFindingEvidence(finding), true);
  assert.equal(finding.runId, 'RUN-1');
});

test('math utilities are deterministic', () => {
  assert.equal(median([9, 1, 5]), 5);
  assert.equal(mad([1, 1, 2, 2, 4]), 1);
  assert.equal(clamp01(2), 1);
  assert.ok(haversineKm(12.9716, 77.5946, 12.9717, 77.5947) < 0.1);
});

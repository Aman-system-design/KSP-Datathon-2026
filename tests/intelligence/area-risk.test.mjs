import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateAreaRisk } from '../../src/intelligence/area-risk.mjs';

test('returns exact component contributions', () => {
  const result = calculateAreaRisk({ frequency: 80, severity: 60, recency: 70, trend: 50, anomaly: 90, hotspot: 100, completeness: 0.9 });
  assert.equal(result.score, 74);
  assert.equal(result.components.frequency.contribution, 20);
  assert.equal(result.scope, 'AREA_TIME_ONLY');
});

test('withholds low-completeness score', () => {
  const result = calculateAreaRisk({ frequency: 80, severity: 60, recency: 70, trend: 50, anomaly: 90, hotspot: 100, completeness: 0.5 });
  assert.equal(result.status, 'WITHHELD');
});

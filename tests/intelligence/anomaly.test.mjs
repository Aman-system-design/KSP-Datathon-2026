import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { detectAnomaly } from '../../src/intelligence/anomaly.mjs';

const input = JSON.parse(fs.readFileSync('fixtures/intelligence/demo-input.json', 'utf8'));

test('flags the planted spike with expected baseline', () => {
  const series = input.weeklySeries.find(row => row.seriesId === 'SERIES-ANOMALY');
  const result = detectAnomaly(series);
  assert.equal(result.isAnomaly, true);
  assert.ok(result.observed > result.expectedUpper);
});

test('does not promote the seasonal negative control', () => {
  const series = input.weeklySeries.find(row => row.seriesId === 'SERIES-SEASONAL');
  assert.equal(detectAnomaly(series).isAnomaly, false);
});

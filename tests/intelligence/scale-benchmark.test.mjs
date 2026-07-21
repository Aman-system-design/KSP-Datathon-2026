import assert from 'node:assert/strict';
import test from 'node:test';

import { benchmarkScale, generateBenchmarkFeatures } from '../../scripts/intelligence/benchmark-scale.mjs';

test('benchmark generator is deterministic and plants one known pattern', () => {
  const left = generateBenchmarkFeatures({ count: 1000, seed: 20260721 });
  const right = generateBenchmarkFeatures({ count: 1000, seed: 20260721 });
  assert.deepEqual(left, right);
  assert.equal(left.length, 1000);
  assert.deepEqual(left.slice(0, 6).map(row => row.caseId), [
    'BENCH-PATTERN-1', 'BENCH-PATTERN-2', 'BENCH-PATTERN-3',
    'BENCH-PATTERN-4', 'BENCH-PATTERN-5', 'BENCH-PATTERN-6',
  ]);
});

test('1K benchmark preserves the planted pattern and reduces candidate comparisons', () => {
  const result = benchmarkScale({ count: 1000, seed: 20260721 });
  assert.equal(result.count, 1000);
  assert.equal(result.plantedPatternFound, true);
  assert.ok(result.patternCandidates < result.fullPairCount);
  assert.ok(result.elapsedMs >= 0);
  assert.ok(result.heapUsedBytes > 0);
});

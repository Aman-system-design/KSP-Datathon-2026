import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';

test('demo command writes a passing evaluation report', () => {
  const result = spawnSync(process.execPath, ['scripts/intelligence/run-demo.mjs'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(fs.readFileSync('artifacts/intelligence/demo-report.json', 'utf8'));
  assert.equal(report.evaluation.pass, true);
});

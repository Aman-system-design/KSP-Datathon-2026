import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { runIntelligencePipeline } from '../../src/intelligence/pipeline.mjs';

const input = JSON.parse(fs.readFileSync('fixtures/intelligence/demo-input.json', 'utf8'));

test('pipeline emits versioned findings from inputs alone', () => {
  const output = runIntelligencePipeline(input);
  assert.equal(output.analysisRuns.length, 4);
  assert.ok(output.analysisRuns.every(run => run.version === '1.0.0'));
  assert.ok(output.hotspots.length > 0);
  assert.ok(output.hotspots.every(row => output.analysisRuns.some(run => run.id === row.runId)));
  assert.ok(output.anomalies.some(row => row.isAnomaly));
  assert.ok(output.patterns.length > 0);
  assert.ok(output.network.edges.length > 0);
  assert.ok(output.identityResolutions.some(row => row.status === 'CONFIRMED'));
  assert.equal(output.areaRisk.status, 'CALCULATED');
  assert.equal(JSON.stringify(output).includes('demo-truth'), false);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { evaluatePipeline, runIntelligencePipeline } from '@ksp/intelligence-core';

const input = JSON.parse(fs.readFileSync('fixtures/intelligence/demo-input.json', 'utf8'));
const truth = JSON.parse(fs.readFileSync('fixtures/intelligence/demo-truth.json', 'utf8'));

test('passes positive and negative intelligence controls', () => {
  const report = evaluatePipeline(runIntelligencePipeline(input), truth);
  assert.equal(report.pass, true);
  assert.equal(report.gates.seasonalNegativeControl, true);
  assert.equal(report.gates.crossDistrictPattern, true);
  assert.equal(report.gates.evidenceLineage, true);
  assert.equal(report.gates.coAccusedNetwork, true);
  assert.equal(report.metrics.patternPrecision, 1);
  assert.equal(report.metrics.patternRecall, 1);
});

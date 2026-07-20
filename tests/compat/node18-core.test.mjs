import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  evaluatePipeline,
  runIntelligencePipeline,
} from '../../packages/intelligence-core/index.mjs';
import { toIntelligenceInput } from '../../src/ingestion/to-intelligence-input.mjs';
import { validateSourceSeed } from '../../src/ingestion/validate-source-seed.mjs';
import { generateSourceSeed } from '../../src/synthetic/source-seed.mjs';

const truth = JSON.parse(await readFile(
  new URL('../../fixtures/intelligence/demo-truth.json', import.meta.url),
  'utf8',
));

test('shared core produces the verified report from PDF-aligned records', () => {
  const accepted = validateSourceSeed(generateSourceSeed(20260720)).accepted;
  const output = runIntelligencePipeline(toIntelligenceInput(accepted));
  const report = evaluatePipeline(output, truth);

  assert.equal(report.pass, true);
  assert.equal(report.gates.crossDistrictPattern, true);
  assert.equal(report.gates.falseNameNotConfirmed, true);
  assert.equal(report.gates.seasonalNegativeControl, true);
});

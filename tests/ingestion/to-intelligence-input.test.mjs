import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { evaluatePipeline, runIntelligencePipeline } from '@ksp/intelligence-core';
import { toIntelligenceInput } from '../../src/ingestion/to-intelligence-input.mjs';
import { validateSourceSeed } from '../../src/ingestion/validate-source-seed.mjs';
import { generateSourceSeed } from '../../src/synthetic/source-seed.mjs';

const truth = JSON.parse(await readFile(
  new URL('../../fixtures/intelligence/demo-truth.json', import.meta.url),
  'utf8',
));

test('accepted PDF records adapt into the complete 50-case intelligence contract', () => {
  const validation = validateSourceSeed(generateSourceSeed(20260720));
  const input = toIntelligenceInput(validation.accepted);

  assert.equal(input.cases.length, 50);
  assert.equal(input.cases[0].caseId, 'CASE-001');
  assert.equal(input.cases[49].caseId, 'CASE-050');
  for (const row of input.cases) {
    for (const field of [
      'caseId', 'districtId', 'stationId', 'crimeMajor', 'crimeMinor', 'gravity',
      'incidentAt', 'latitude', 'longitude', 'acts', 'sections', 'accused', 'briefFacts',
    ]) assert.notEqual(row[field], undefined, `${row.caseId} missing ${field}`);
    assert.equal(row.synthetic, true);
    assert.equal(row.quality.coordinatesValid, true);
    assert.equal(row.quality.relationshipResolved, true);
  }
});

test('the source bridge preserves planted positive and negative controls', () => {
  const accepted = validateSourceSeed(generateSourceSeed(20260720)).accepted;
  const report = evaluatePipeline(runIntelligencePipeline(toIntelligenceInput(accepted)), truth);
  assert.equal(report.pass, true);
  assert.equal(report.gates.crossDistrictPattern, true);
  assert.equal(report.gates.repeatIdentity, true);
  assert.equal(report.gates.falseNameNotConfirmed, true);
  assert.equal(report.gates.seasonalNegativeControl, true);
});

test('adapter joins identifiers, never person names or hidden truth', async () => {
  const source = await readFile(
    new URL('../../src/ingestion/to-intelligence-input.mjs', import.meta.url),
    'utf8',
  );
  assert.doesNotMatch(source, /demo-truth|VictimName|AccusedName\s*===|ComplainantName/);
});

test('adapter never treats within-case PersonID as canonical identity', () => {
  const accepted = validateSourceSeed(generateSourceSeed(20260720)).accepted;
  const input = toIntelligenceInput(accepted);
  const appearances = input.cases.flatMap(row => row.accused);
  assert.equal(appearances.some(row => /^A\d+$/u.test(row.personId)), false);
  assert.equal(appearances.every(row => /^A\d+$/u.test(row.sourcePersonOrder)), true);
  assert.equal(appearances.every(row => row.identityEvidenceLabel === 'SYNTHETIC_AUTHORITY'), true);
});

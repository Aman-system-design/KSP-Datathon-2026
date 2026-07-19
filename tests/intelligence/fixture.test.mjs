import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const input = JSON.parse(fs.readFileSync('fixtures/intelligence/demo-input.json', 'utf8'));
const truth = JSON.parse(fs.readFileSync('fixtures/intelligence/demo-truth.json', 'utf8'));

test('fixture contains only synthetic canonical cases', () => {
  assert.equal(input.schemaVersion, '1.0.0');
  assert.equal(input.cases.length, 50);
  assert.equal(new Set(input.cases.map(row => row.caseId)).size, 50);
  assert.ok(input.cases.every(row => row.synthetic === true));
  assert.ok(input.cases.every(row => row.quality.relationshipResolved === true));
});

test('hidden truth defines positive and negative controls', () => {
  assert.equal(truth.fixtureVersion, input.fixtureVersion);
  assert.ok(truth.pattern.caseIds.length >= 4);
  assert.ok(truth.hotspot.caseIds.length >= 5);
  assert.ok(truth.seasonalNegativeControl.seriesId);
  assert.notEqual(truth.repeatIdentity.personId, truth.falseNameMatch.personId);
  assert.ok(truth.coAccusedNetwork.caseIds.length >= 2);
  assert.ok(input.cases.some(row => row.accused.length > 1));
});

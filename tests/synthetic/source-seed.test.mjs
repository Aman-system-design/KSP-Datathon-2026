import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { generateSourceSeed } from '../../src/synthetic/source-seed.mjs';

const contract = JSON.parse(await readFile(
  new URL('../../schema/catalyst/pdf-contract.json', import.meta.url),
  'utf8',
));

test('seed exposes exactly the 26 fragmented PDF entities and columns', () => {
  const seed = generateSourceSeed(20260720);
  assert.deepEqual(Object.keys(seed.tables), Object.keys(contract.tables));

  for (const [tableName, rows] of Object.entries(seed.tables)) {
    assert.ok(rows.length > 0, `${tableName} must not be an empty demo extract`);
    for (const row of rows) {
      assert.deepEqual(Object.keys(row), contract.tables[tableName], `${tableName} columns drifted`);
      assert.equal(Object.keys(row).some((name) => name === 'ROWID' || name.endsWith('Ref')), false);
      for (const column of contract.tables[tableName]) {
        assert.notEqual(row[column], undefined, `${tableName}.${column} is undefined`);
      }
    }
  }
});

test('seed contains 50 unique cases and resolves every case child', () => {
  const { tables } = generateSourceSeed(20260720);
  assert.equal(tables.CaseMaster.length, 50);
  assert.equal(new Set(tables.CaseMaster.map(({ CaseMasterID }) => CaseMasterID)).size, 50);
  assert.equal(new Set(tables.CaseMaster.map(({ CrimeNo }) => CrimeNo)).size, 50);

  const caseIds = new Set(tables.CaseMaster.map(({ CaseMasterID }) => CaseMasterID));
  for (const [tableName, rows] of Object.entries(tables)) {
    if (!contract.tables[tableName].includes('CaseMasterID') || tableName === 'CaseMaster') continue;
    for (const row of rows) {
      assert.ok(caseIds.has(row.CaseMasterID), `${tableName} has orphan CaseMasterID`);
    }
  }
});

test('person-facing names and narratives are visibly synthetic', () => {
  const { tables } = generateSourceSeed(20260720);
  const personNameFields = [
    ['ComplainantDetails', 'ComplainantName'], ['Victim', 'VictimName'],
    ['Accused', 'AccusedName'], ['Employee', 'FirstName'],
  ];
  for (const [table, field] of personNameFields) {
    for (const row of tables[table]) assert.match(row[field], /^Synthetic\b/i);
  }
  for (const row of tables.CaseMaster) assert.match(row.BriefFacts, /^Synthetic\b/i);
});

test('seed is deterministic and maps the canonical 50 cases', () => {
  const first = generateSourceSeed(20260720);
  const second = generateSourceSeed(20260720);
  assert.deepEqual(first, second);
  assert.equal(first.canonicalCaseMap['200000001'], 'CASE-001');
  assert.equal(first.canonicalCaseMap['200000050'], 'CASE-050');
  assert.deepEqual(
    Object.keys(first.canonicalCaseMap).map(Number),
    Array.from({ length: 50 }, (_, index) => 200000001 + index),
  );
});

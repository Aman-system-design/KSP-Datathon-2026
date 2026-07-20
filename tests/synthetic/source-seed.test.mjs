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

test('all FIR identifiers implement the PDF station-scoped format', () => {
  const { tables } = generateSourceSeed(20260720);
  const districtByStation = new Map(tables.Unit.map(row => [row.UnitID, row.DistrictID]));
  const scopedSerials = new Map();
  for (const row of tables.CaseMaster) {
    assert.match(row.CrimeNo, /^\d{18}$/u);
    assert.match(row.CaseNo, /^\d{9}$/u);
    assert.equal(row.CaseNo, row.CrimeNo.slice(-9));
    assert.equal(row.CrimeNo.slice(0, 1), String(row.CaseCategoryID));
    assert.equal(row.CrimeNo.slice(1, 5), String(districtByStation.get(row.PoliceStationID)).padStart(4, '0'));
    assert.equal(row.CrimeNo.slice(5, 9), String(row.PoliceStationID).padStart(4, '0'));
    assert.equal(row.CrimeNo.slice(9, 13), row.CrimeRegisteredDate.slice(0, 4));
    const scope = row.CrimeNo.slice(0, 13);
    const serial = Number(row.CrimeNo.slice(13));
    scopedSerials.set(scope, [...(scopedSerials.get(scope) ?? []), serial]);
  }
  for (const serials of scopedSerials.values()) {
    assert.deepEqual([...serials].sort((left, right) => left - right), Array.from({ length: serials.length }, (_, index) => index + 1));
  }
});

test('PDF enums, accused ordering, assignments and local chronology are preserved', () => {
  const { tables } = generateSourceSeed(20260720);
  assert.deepEqual(new Set(tables.ChargesheetDetails.map(row => row.cstype)), new Set(['A']));
  assert.equal(tables.Victim.every(row => ['0', '1'].includes(row.VictimPolice)), true);
  assert.deepEqual(tables.CaseCategory.map(row => row.LookupValue), ['FIR']);
  assert.equal(tables.UnitType.every(row => ['City', 'District', 'State'].includes(row.CityDistState)), true);

  const accusedByCase = new Map();
  for (const row of tables.Accused) accusedByCase.set(row.CaseMasterID, [...(accusedByCase.get(row.CaseMasterID) ?? []), row]);
  for (const rows of accusedByCase.values()) {
    assert.deepEqual(rows.map(row => row.PersonID), rows.map((_, index) => `A${index + 1}`));
  }

  const employeeById = new Map(tables.Employee.map(row => [row.EmployeeID, row]));
  for (const row of tables.CaseMaster) {
    assert.equal(employeeById.get(row.PolicePersonID).UnitID, row.PoliceStationID);
    assert.match(row.IncidentFromDate, /\+05:30$/u);
    assert.match(row.IncidentToDate, /\+05:30$/u);
    assert.match(row.InfoReceivedPSDate, /\+05:30$/u);
    assert.equal(Date.parse(row.IncidentFromDate) <= Date.parse(row.IncidentToDate), true);
    assert.equal(Date.parse(row.IncidentToDate) <= Date.parse(row.InfoReceivedPSDate), true);
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

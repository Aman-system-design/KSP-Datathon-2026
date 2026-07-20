import assert from 'node:assert/strict';
import test from 'node:test';

import { validateSourceSeed } from '../../src/ingestion/validate-source-seed.mjs';
import { generateSourceSeed } from '../../src/synthetic/source-seed.mjs';

const mutate = callback => {
  const seed = structuredClone(generateSourceSeed(20260720));
  callback(seed);
  return validateSourceSeed(seed);
};

test('clean fragmented seed reconciles with zero rejects', () => {
  const result = validateSourceSeed(generateSourceSeed(20260720));
  assert.deepEqual(result.reconciliation, {
    sourceRows: 411, acceptedRows: 411, rejectedRows: 0, balanced: true,
  });
  assert.equal(result.accepted.CaseMaster.length, 50);
});

const semanticMutations = [
  ['PDF-CASE-CRIME-NO', seed => { seed.tables.CaseMaster[0].CrimeNo = 'SYN-INVALID'; }],
  ['PDF-CASE-CASE-NO', seed => { seed.tables.CaseMaster[0].CaseNo = '202699999'; }],
  ['PDF-CASE-CHRONOLOGY', seed => { seed.tables.CaseMaster[0].InfoReceivedPSDate = '2026-06-02T20:00:00+05:30'; }],
  ['PDF-CASE-BUSINESS-ID', seed => { seed.tables.CaseMaster[0].CaseMasterID = -1; }],
  ['PDF-ACCUSED-ORDER', seed => { seed.tables.Accused[0].PersonID = 'PERSON-007'; }],
  ['PDF-VICTIM-POLICE', seed => { seed.tables.Victim[0].VictimPolice = 'N'; }],
  ['PDF-CS-TYPE', seed => { seed.tables.ChargesheetDetails[0].cstype = 'SYNTHETIC_FINAL'; }],
  ['PDF-UNIT-HIERARCHY', seed => { seed.tables.Unit[0].ParentUnit = seed.tables.Unit[1].UnitID; }],
  ['PDF-EMPLOYEE-SEMANTICS', seed => { seed.tables.Employee[0].DistrictID = 103; }],
  ['PDF-COURT-SEMANTICS', seed => { seed.tables.Court[0].StateID = 30; }],
  ['PDF-CASE-LEGAL-SEMANTICS', seed => { seed.tables.ActSectionAssociation[0].ActID = 999; }],
  ['PDF-ACT-SEMANTICS', seed => { seed.tables.Act[0].ShortName = ''; }],
  ['PDF-CRIME-SUBHEAD-SEMANTICS', seed => { seed.tables.CrimeSubHead[0].CrimeHeadID = 999; }],
  ['PDF-DESIGNATION-SEMANTICS', seed => { seed.tables.Designation[0].SortOrder = 0; }],
  ['PDF-ARREST-SEMANTICS', seed => { seed.tables.ArrestSurrender[0].IsAccused = 7; }],
  ['PDF-CASE-CATEGORY-SEMANTICS', seed => { seed.tables.CaseCategory[0].LookupValue = 'Synthetic Category'; }],
];

for (const [ruleId, mutateSeed] of semanticMutations) {
  test(`rejects ${ruleId}`, () => {
    const result = mutate(mutateSeed);
    assert.equal(result.rejected.some(row => row.reasonCode === ruleId), true);
    assert.equal(result.reconciliation.balanced, true);
  });
}

test('duplicate CaseMasterID is rejected', () => {
  const result = mutate(seed => {
    seed.tables.CaseMaster[1].CaseMasterID = seed.tables.CaseMaster[0].CaseMasterID;
  });
  assert.ok(result.rejected.some(({ reasonCode }) => reasonCode === 'DUPLICATE_BUSINESS_ID'));
});

test('orphan accused relationship is rejected', () => {
  const result = mutate(seed => { seed.tables.Accused[0].CaseMasterID = 999999999; });
  assert.ok(result.rejected.some(({ table, reasonCode }) => (
    table === 'Accused' && reasonCode === 'ORPHAN_CASE'
  )));
});

test('invalid coordinates and incident date range are rejected', () => {
  const invalidCoordinate = mutate(seed => { seed.tables.CaseMaster[0].latitude = 120; });
  assert.ok(invalidCoordinate.rejected.some(({ reasonCode }) => reasonCode === 'INVALID_COORDINATE'));

  const invalidRange = mutate(seed => {
    seed.tables.CaseMaster[0].IncidentToDate = '2020-01-01T00:00:00Z';
  });
  assert.ok(invalidRange.rejected.some(({ reasonCode }) => reasonCode === 'INVALID_INCIDENT_RANGE'));
});

test('non-synthetic provenance and missing business ID are rejected', () => {
  const provenance = mutate(seed => { seed.syntheticData = false; });
  assert.ok(provenance.rejected.some(({ reasonCode }) => reasonCode === 'NON_SYNTHETIC_PROVENANCE'));

  const missingId = mutate(seed => { seed.tables.Accused[0].AccusedMasterID = null; });
  assert.ok(missingId.rejected.some(({ reasonCode }) => reasonCode === 'MISSING_BUSINESS_ID'));
});

test('reject records are redacted and reconciliation always balances', () => {
  const result = mutate(seed => { seed.tables.Accused[0].CaseMasterID = 999999999; });
  const rejected = result.rejected.find(({ table }) => table === 'Accused');
  assert.deepEqual(Object.keys(rejected), ['table', 'sourceKey', 'reasonCode', 'rowHash']);
  assert.match(rejected.rowHash, /^[a-f0-9]{64}$/);
  assert.equal(JSON.stringify(rejected).includes('Synthetic Person'), false);
  assert.equal(result.accepted.Accused.some(({ CaseMasterID }) => CaseMasterID === 999999999), false);
  assert.equal(result.reconciliation.balanced, true);
  assert.equal(
    result.reconciliation.sourceRows,
    result.reconciliation.acceptedRows + result.reconciliation.rejectedRows,
  );
});

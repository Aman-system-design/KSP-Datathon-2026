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
  assert.equal(result.rejected.length, 0);
  assert.equal(result.reconciliation.balanced, true);
  assert.equal(result.reconciliation.sourceRows, result.reconciliation.acceptedRows);
  assert.equal(result.accepted.CaseMaster.length, 50);
});

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

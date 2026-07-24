import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { generateSourceSeed } from '../../src/synthetic/source-seed.mjs';
import { validateSourceSeed } from '../../src/ingestion/validate-source-seed.mjs';

const contract = JSON.parse(await readFile(
  new URL('../../schema/catalyst/pdf-contract.json', import.meta.url),
  'utf8',
));

const options = Object.freeze({ seed: 20260724, caseCount: 5200, profile: 'statewide' });

test('statewide seed contains 5,200 FIRs across all 31 Karnataka districts', () => {
  const seed = generateSourceSeed(options);

  assert.equal(seed.fixtureVersion, 'pdf-aligned-statewide-2.0.0');
  assert.equal(seed.tables.CaseMaster.length, 5200);
  assert.equal(seed.tables.District.length, 31);
  const districtByStation = new Map(seed.tables.Unit.map(row => [row.UnitID, row.DistrictID]));
  assert.equal(new Set(seed.tables.CaseMaster.map(row => districtByStation.get(row.PoliceStationID))).size, 31);
  assert.equal(new Set(seed.tables.CaseMaster.map(row => row.CrimeNo)).size, 5200);
  assert.equal(new Set(seed.tables.CaseMaster.map(row => row.CaseMasterID)).size, 5200);
});

test('statewide seed keeps the exact 26-entity PDF contract and valid relationships', () => {
  const seed = generateSourceSeed(options);
  assert.deepEqual(Object.keys(seed.tables), Object.keys(contract.tables));

  for (const [tableName, rows] of Object.entries(seed.tables)) {
    assert.ok(rows.length > 0, `${tableName} must contain rows`);
    for (const row of rows) {
      assert.deepEqual(Object.keys(row), contract.tables[tableName], `${tableName} columns drifted`);
    }
  }

  const validation = validateSourceSeed(seed);
  assert.equal(validation.reconciliation.rejectedRows, 0);
  assert.equal(validation.reconciliation.balanced, true);
});

test('statewide generation is deterministic and every location is in Karnataka bounds', () => {
  const first = generateSourceSeed(options);
  const second = generateSourceSeed(options);
  assert.deepEqual(first, second);

  for (const row of first.tables.CaseMaster) {
    assert.ok(row.latitude >= 11.5 && row.latitude <= 18.6, `latitude ${row.latitude} is outside Karnataka`);
    assert.ok(row.longitude >= 74 && row.longitude <= 78.7, `longitude ${row.longitude} is outside Karnataka`);
    assert.match(row.CrimeNo, /^\d{18}$/u);
    assert.equal(row.CaseNo, row.CrimeNo.slice(-9));
  }
});

test('statewide dataset is distributed across time, offence and operational scenarios', () => {
  const { tables, truth } = generateSourceSeed(options);
  const years = new Set(tables.CaseMaster.map(row => row.IncidentFromDate.slice(0, 4)));
  const vehicleTheft = tables.CaseMaster.filter(row => row.CrimeMinorHeadID === 12);
  const cyber = tables.CaseMaster.filter(row => row.CrimeMajorHeadID === 2);
  const night = tables.CaseMaster.filter(row => {
    const hour = Number(row.IncidentFromDate.slice(11, 13));
    return hour >= 20 || hour < 5;
  });

  assert.ok(years.size >= 2);
  assert.ok(vehicleTheft.length >= 900);
  assert.ok(cyber.length >= 700);
  assert.ok(night.length >= 1000);
  assert.ok(truth.hotspots.length >= 6);
  assert.ok(truth.patterns.length >= 4);
  assert.ok(truth.anomalies.length >= 4);
  assert.ok(truth.negativeControls.length >= 3);
});

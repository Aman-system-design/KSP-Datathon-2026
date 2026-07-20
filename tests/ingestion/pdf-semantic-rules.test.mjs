import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const semanticContractUrl = new URL('../../schema/catalyst/pdf-semantic-contract.json', import.meta.url);
const pdfContractUrl = new URL('../../schema/catalyst/pdf-contract.json', import.meta.url);
const semanticRulesUrl = new URL('../../src/ingestion/pdf-semantic-rules.mjs', import.meta.url);

test('semantic contract covers every PDF entity with stable rule identifiers', async () => {
  assert.equal(existsSync(semanticContractUrl), true, 'semantic contract must exist');
  const [semantic, pdf] = await Promise.all([
    readFile(semanticContractUrl, 'utf8').then(JSON.parse),
    readFile(pdfContractUrl, 'utf8').then(JSON.parse),
  ]);
  assert.deepEqual(Object.keys(semantic.entities), Object.keys(pdf.tables));
  const rules = Object.values(semantic.entities).flatMap(({ rules }) => rules);
  assert.equal(rules.length >= 26, true);
  assert.equal(new Set(rules.map(({ id }) => id)).size, rules.length);
  assert.equal(rules.every(({ id, page }) => /^PDF-[A-Z0-9-]+$/u.test(id) && Number.isInteger(page)), true);
});

test('crime identity follows the documented 18-digit and nine-digit formats', async () => {
  assert.equal(existsSync(semanticRulesUrl), true, 'semantic rule module must exist');
  const { buildCrimeIdentity } = await import('../../src/ingestion/pdf-semantic-rules.mjs');
  assert.deepEqual(buildCrimeIdentity({
    categoryCode: 1, districtId: 101, stationId: 1001, year: 2026, serial: 1,
  }), {
    CrimeNo: '101011001202600001',
    CaseNo: '202600001',
  });
  assert.throws(() => buildCrimeIdentity({
    categoryCode: 10, districtId: 101, stationId: 1001, year: 2026, serial: 1,
  }), /categoryCode/u);
});

test('Karnataka DateTime formatting preserves the represented instant', async () => {
  assert.equal(existsSync(semanticRulesUrl), true, 'semantic rule module must exist');
  const { formatKarnatakaDateTime } = await import('../../src/ingestion/pdf-semantic-rules.mjs');
  assert.equal(formatKarnatakaDateTime('2026-06-02T15:31:00.000Z'), '2026-06-02T21:01:00+05:30');
  assert.equal(formatKarnatakaDateTime('2026-06-02T21:01:00+05:30'), '2026-06-02T21:01:00+05:30');
  assert.throws(() => formatKarnatakaDateTime('not-a-date'), /DateTime/u);
});

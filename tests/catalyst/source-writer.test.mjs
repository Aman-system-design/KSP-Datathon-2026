import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  createSourceProjector, sourceBusinessKey,
} from '../../scripts/catalyst/source-row-projector.mjs';
import { createCatalystSourceWriter } from '../../src/backend/repository/catalyst/source-writer.mjs';
import { validateSourceSeed } from '../../src/ingestion/validate-source-seed.mjs';
import { generateSourceSeed } from '../../src/synthetic/source-seed.mjs';

const manifest = JSON.parse(readFileSync(new URL('../../schema/catalyst/source-schema.json', import.meta.url), 'utf8'));
const validation = validateSourceSeed(generateSourceSeed(20260720));

test('projects all 26 entities with exact PDF columns and synthetic batch provenance', () => {
  const projector = createSourceProjector({ manifest });
  const projections = projector.projectBatch({
    batchKey: 'KSP-DEMO-20260720-V1', batchRowId: '9000001', accepted: validation.accepted,
  });
  assert.equal(projections.length, 26);

  for (const projection of projections) {
    const table = manifest.tables.find(item => item.name === projection.tableName);
    const expectedPdf = table.columns.filter(column => column.origin === 'PDF').map(column => column.name).sort();
    for (const record of projection.records) {
      const actualPdf = Object.keys(record.row).filter(column => expectedPdf.includes(column)).sort();
      assert.deepEqual(actualPdf, expectedPdf, projection.sourceName);
      assert.equal(record.row.SourceBatchRef, '9000001');
      assert.equal(record.row.IsSynthetic, true);
      assert.equal(record.row.ValidationStatus, 'ACCEPTED');
      assert.equal(record.row.SourceSchemaVersion, manifest.schemaVersion);
      assert.match(record.row.SourceRecordHash, /^[a-f0-9]{64}$/);
      assert.equal(Object.hasOwn(record.row, 'ROWID'), false);
    }
  }
  const victim = projections.find(projection => projection.sourceName === 'Victim').records[0].row;
  assert.equal(typeof victim.VictimPolice, 'string');
  assert.match(victim.VictimPolice, /^[YN]$/);
});

test('projects Date and DateTime values in Catalyst Data Store formats', () => {
  const projections = createSourceProjector({ manifest }).projectBatch({
    batchKey: 'KSP-DEMO-20260720-V1', batchRowId: '9000001', accepted: validation.accepted,
  });
  for (const projection of projections) {
    const table = manifest.tables.find(item => item.name === projection.tableName);
    for (const column of table.columns.filter(item => ['date', 'datetime'].includes(item.type))) {
      for (const record of projection.records) {
        const value = record.row[column.name];
        if (value === null || value === undefined) continue;
        assert.match(value, column.type === 'date'
          ? /^\d{4}-\d{2}-\d{2}$/
          : /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/,
        `${projection.tableName}.${column.name}`);
      }
    }
  }
});

test('relationship references use parent business keys and real Catalyst ROWIDs, never names', () => {
  const projector = createSourceProjector({ manifest });
  const parentTable = manifest.tables.find(table => table.name === 'SRC_CaseMaster');
  const parentRow = validation.accepted.CaseMaster[0];
  const parentKey = sourceBusinessKey(parentTable, parentRow);
  const keyMap = new Map([[`SRC_CaseMaster:${parentKey}`, 'CATALYST-ROW-777']]);
  const child = validation.accepted.ComplainantDetails[0];
  const [projection] = projector.projectBatch({
    batchKey: 'KSP-DEMO-20260720-V1', batchRowId: '9000001',
    accepted: { ComplainantDetails: [{ ...child, ComplainantName: parentRow.BriefFacts }] }, keyMap,
  });
  assert.equal(projection.records[0].row.CaseMasterRef, 'CATALYST-ROW-777');
  assert.equal(Object.values(projection.records[0].row).includes(parentRow.BriefFacts), true, 'name/narrative remains data, not a join key');
  assert.throws(() => projector.projectBatch({
    batchKey: 'KSP-DEMO-20260720-V1', accepted: { CaseMaster: [parentRow] },
  }), /batch.*ROWID/i);
});

function fakeDataStore() {
  const operations = [];
  const rows = new Map();
  let rowId = 10000;
  const table = name => ({
    async insertRow(record) {
      operations.push({ kind: 'insertRow', table: name, records: [structuredClone(record)] });
      const stored = { ...structuredClone(record), ROWID: String(++rowId) };
      const current = rows.get(name) ?? [];
      current.push(stored); rows.set(name, current);
      return stored;
    },
    async insertRows(records) {
      operations.push({ kind: 'insertRows', table: name, records: structuredClone(records) });
      assert.ok(records.length <= 200, 'Catalyst write batch exceeds 200');
      const stored = records.map(record => ({ ...structuredClone(record), ROWID: String(++rowId) }));
      const current = rows.get(name) ?? [];
      current.push(...stored); rows.set(name, current);
      return stored;
    },
    async updateRow(record) {
      operations.push({ kind: 'updateRow', table: name, records: [structuredClone(record)] });
      const current = rows.get(name) ?? [];
      const index = current.findIndex(row => String(row.ROWID) === String(record.ROWID));
      if (index >= 0) current[index] = structuredClone(record);
      return record;
    },
  });
  return { table, operations, rows };
}

test('writes parents first in bounded batches, maps returned ROWIDs and replays idempotently', async () => {
  const datastore = fakeDataStore();
  let completed;
  const writer = createCatalystSourceWriter({
    datastore, manifest,
    clock: () => '2026-07-20T15:00:00.000Z',
    idFactory: prefix => `${prefix}-FIXED-${datastore.operations.length}`,
    findBatch: async batchKey => completed?.batchKey === batchKey ? completed : undefined,
    loadValidatedSource: async () => completed.result,
    onCompleted: value => { completed = value; },
  });
  const input = {
    batchKey: 'KSP-DEMO-20260720-V1', source: generateSourceSeed(20260720), ...validation,
  };
  const first = await writer.persistValidatedSource(input);
  const writeCount = datastore.operations.length;
  const second = await writer.persistValidatedSource(input);
  assert.deepEqual(second, first);
  assert.equal(datastore.operations.length, writeCount, 'replay must not insert duplicate rows');

  const initialBatchWrite = datastore.operations.find(operation => operation.kind === 'insertRow'
    && operation.table === 'TRN_IngestionBatch').records[0];
  assert.equal(initialBatchWrite.StartedAt, '2026-07-20 15:00:00');
  assert.equal(Object.hasOwn(initialBatchWrite, 'CompletedAt'), false);

  const sourceWrites = datastore.operations.filter(operation => operation.table.startsWith('SRC_'));
  assert.equal(new Set(sourceWrites.map(operation => operation.table)).size, 26);
  assert.equal(Math.max(...sourceWrites.map(operation => operation.records.length)) <= 200, true);
  const batchRow = datastore.rows.get('TRN_IngestionBatch')[0];
  assert.equal(batchRow.CompletedAt, '2026-07-20 15:00:00');
  assert.ok(sourceWrites.every(operation => operation.records.every(row => row.SourceBatchRef === batchRow.ROWID)));
  const child = datastore.rows.get('SRC_ComplainantDetails')[0];
  assert.match(child.CaseMasterRef, /^\d+$/);
  assert.notEqual(child.CaseMasterRef, child.ComplainantName);
  const unitRows = datastore.rows.get('SRC_Unit');
  assert.equal(unitRows.filter(row => row.ParentUnit !== null).every(row => /^\d+$/.test(row.ParentUnitRef)), true);
  assert.equal(datastore.rows.get('TRN_SourceKeyMap').length, validation.reconciliation.acceptedRows);
});

test('persists only redacted reject metadata and never rejected payloads', async () => {
  const datastore = fakeDataStore();
  const writer = createCatalystSourceWriter({
    datastore, manifest, clock: () => '2026-07-20T15:00:00.000Z',
    idFactory: prefix => `${prefix}-${datastore.operations.length}`,
    findBatch: async () => undefined, loadValidatedSource: async () => undefined,
  });
  await writer.persistValidatedSource({
    batchKey: 'KSP-REJECT-1', source: { syntheticData: true, fixtureVersion: 'x' },
    accepted: {}, rejected: [{ table: 'Accused', sourceKey: 'private-name', reasonCode: 'ORPHAN_CASE', rowHash: 'a'.repeat(64), raw: { AccusedName: 'Must Not Persist' } }],
    reconciliation: { sourceRows: 1, acceptedRows: 0, rejectedRows: 1, balanced: true },
  });
  const serialized = JSON.stringify(datastore.rows.get('TRN_RejectedRecord'));
  assert.doesNotMatch(serialized, /Must Not Persist|private-name/);
  assert.match(serialized, /ORPHAN_CASE/);
  assert.equal(datastore.rows.get('TRN_RejectedRecord')[0].RejectedAt, '2026-07-20 15:00:00');
});

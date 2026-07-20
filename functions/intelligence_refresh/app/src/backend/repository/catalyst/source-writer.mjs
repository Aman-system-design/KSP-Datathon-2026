import { createHash } from 'node:crypto';

import { createSourceProjector } from '../../../../scripts/catalyst/source-row-projector.mjs';

const clone = value => value === undefined ? undefined : structuredClone(value);
const chunks = (rows, size = 200) => Array.from({ length: Math.ceil(rows.length / size) }, (_, index) => rows.slice(index * size, (index + 1) * size));
const manifestHash = manifest => createHash('sha256').update(JSON.stringify(manifest)).digest('hex');
const catalystDateTime = value => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new TypeError('Catalyst DateTime value is invalid.');
  return date.toISOString().slice(0, 19).replace('T', ' ');
};

function insertedRows(response) {
  const rows = Array.isArray(response) ? response : response?.data;
  if (!Array.isArray(rows)) throw new Error('Catalyst insertRows response is invalid.');
  if (rows.some(row => row?.ROWID === undefined || row?.ROWID === null)) throw new Error('Catalyst insertRows response is missing ROWID.');
  return rows;
}

function insertedRow(response) {
  const row = response?.data && !Array.isArray(response.data) ? response.data : response;
  if (!row || row.ROWID === undefined || row.ROWID === null) throw new Error('Catalyst insertRow response is missing ROWID.');
  return row;
}

export function createCatalystSourceWriter({
  datastore, manifest, findBatch, loadValidatedSource, onCompleted = () => {},
  clock = () => new Date().toISOString(), idFactory,
}) {
  if (!datastore || typeof datastore.table !== 'function') throw new TypeError('Catalyst Data Store is required.');
  if (typeof findBatch !== 'function' || typeof loadValidatedSource !== 'function') throw new TypeError('Batch readers are required.');
  if (typeof idFactory !== 'function') throw new TypeError('idFactory is required.');
  const projector = createSourceProjector({ manifest });

  async function persistValidatedSource({ batchKey, source, accepted, rejected = [], reconciliation }) {
    if (!/^[A-Za-z0-9:_-]{1,36}$/u.test(batchKey ?? '')) throw new TypeError('batchKey is invalid.');
    if (source?.syntheticData !== true || manifest.syntheticOnly !== true) throw new Error('Only synthetic source data is permitted.');
    if (!reconciliation?.balanced || reconciliation.sourceRows !== reconciliation.acceptedRows + reconciliation.rejectedRows) {
      throw new Error('Source reconciliation is not balanced.');
    }
    const existing = await findBatch(batchKey);
    if (existing) {
      const stored = await loadValidatedSource(batchKey);
      if (!stored) throw new Error('Existing source batch is not readable.');
      return clone(stored);
    }

    const sourceTableCount = Object.keys(source?.tables ?? accepted ?? {}).length;
    const startedAt = catalystDateTime(clock());
    const batch = insertedRow(await datastore.table('TRN_IngestionBatch').insertRow({
      BatchID: batchKey,
      SchemaVersion: manifest.schemaVersion,
      ManifestHash: manifestHash(manifest),
      Status: 'LOADING',
      SourceFileCount: sourceTableCount,
      SourceRowCount: reconciliation.sourceRows,
      AcceptedRowCount: reconciliation.acceptedRows,
      WarningRowCount: 0,
      RejectedRowCount: reconciliation.rejectedRows,
      StartedAt: startedAt,
      IsSynthetic: true,
    }));

    const keyMap = new Map();
    const mappingRows = [];
    const ordered = manifest.tables
      .filter(table => table.zone === 'SOURCE' && Object.hasOwn(accepted ?? {}, table.sourceName))
      .sort((left, right) => left.loadOrder - right.loadOrder || (left.name < right.name ? -1 : 1));
    for (const table of ordered) {
      const storedByBusinessKey = new Map();
      const [projection] = projector.projectBatch({
        batchKey, batchRowId: batch.ROWID, accepted: { [table.sourceName]: accepted[table.sourceName] }, keyMap,
      });
      for (const recordChunk of chunks(projection.records)) {
        if (recordChunk.length === 0) continue;
        const stored = insertedRows(await datastore.table(table.name).insertRows(recordChunk.map(record => record.row)));
        if (stored.length !== recordChunk.length) throw new Error(`Catalyst inserted an unexpected row count for ${table.name}.`);
        for (let index = 0; index < stored.length; index += 1) {
          const record = recordChunk[index];
          const rowId = String(stored[index].ROWID);
          keyMap.set(`${table.name}:${record.businessKey}`, rowId);
          storedByBusinessKey.set(record.businessKey, stored[index]);
          mappingRows.push({
            MappingID: idFactory('SOURCE-MAP'), BatchRef: String(batch.ROWID),
            SourceEntity: table.sourceName, SourceBusinessKey: record.businessKey,
            CatalystTable: table.name, CatalystROWID: rowId,
            SourceRecordHash: record.row.SourceRecordHash, MappingStatus: 'ACTIVE', IsSynthetic: true,
          });
        }
      }
      const selfReferences = table.columns
        .filter(column => column.type === 'foreign_key' && column.parentTable === table.name)
        .map(column => column.name);
      if (selfReferences.length > 0) {
        const [resolved] = projector.projectBatch({
          batchKey, batchRowId: batch.ROWID, accepted: { [table.sourceName]: accepted[table.sourceName] }, keyMap,
        });
        for (const record of resolved.records) {
          const references = Object.fromEntries(selfReferences
            .filter(name => record.row[name] !== undefined)
            .map(name => [name, record.row[name]]));
          if (Object.keys(references).length === 0) continue;
          const stored = storedByBusinessKey.get(record.businessKey);
          const updated = await datastore.table(table.name).updateRow({ ...stored, ...references });
          storedByBusinessKey.set(record.businessKey, updated);
        }
      }
    }

    for (const rowChunk of chunks(mappingRows)) {
      if (rowChunk.length > 0) insertedRows(await datastore.table('TRN_SourceKeyMap').insertRows(rowChunk));
    }

    const redactedRejects = rejected.map((reject, index) => ({
      RejectedRecordID: idFactory('SOURCE-REJECT'), BatchRef: String(batch.ROWID),
      SourceFileName: `synthetic://${batchKey}/${reject.table}.json`, SourceRowNumber: index + 1,
      SourceEntity: String(reject.table).slice(0, 64), ReasonCode: String(reject.reasonCode).slice(0, 64),
      ReasonDetail: 'Rejected by deterministic source validation.', PayloadObjectPath: null,
      RejectedAt: catalystDateTime(clock()), IsSynthetic: true,
    }));
    for (const rowChunk of chunks(redactedRejects)) {
      if (rowChunk.length > 0) insertedRows(await datastore.table('TRN_RejectedRecord').insertRows(rowChunk));
    }

    const completedAt = catalystDateTime(clock());
    await datastore.table('TRN_IngestionBatch').updateRow({
      ...batch, Status: 'COMPLETED', CompletedAt: completedAt,
    });
    const result = Object.freeze({
      batchKey, accepted: clone(accepted), rejected: clone(redactedRejects),
      reconciliation: clone(reconciliation), syntheticData: true,
    });
    onCompleted({ batchKey, result: clone(result), batchRowId: String(batch.ROWID) });
    return result;
  }

  return Object.freeze({ persistValidatedSource });
}

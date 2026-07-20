import { readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const sourceManifest = JSON.parse(readFileSync(
  new URL('../../schema/catalyst/source-schema.json', import.meta.url),
  'utf8',
));

const APPROVED_PROJECT = '43492000000013049';
const APPROVED_BATCH = 'KSP-DEMO-20260720-V1';
const identifier = /^\d+$/u;
const batchKeyPattern = /^[A-Za-z0-9:_-]{1,36}$/u;

function assertBoundary({ projectId, environment, batchKey, batchRowId }) {
  if (String(projectId) !== APPROVED_PROJECT) throw new Error('Approved project is required.');
  if (environment !== 'Development') throw new Error('Only Development is allowed.');
  if (!batchKeyPattern.test(batchKey ?? '') || batchKey !== APPROVED_BATCH) throw new Error('Approved batchKey is required.');
  if (!identifier.test(String(batchRowId))) throw new Error('Numeric batchRowId is required.');
}

const countSource = (table, batchRowId) => (
  `SELECT COUNT(ROWID) FROM ${table} WHERE SourceBatchRef = ${batchRowId} AND IsSynthetic = true;`
);
const deleteSource = (table, batchRowId) => (
  `DELETE FROM ${table} WHERE SourceBatchRef = ${batchRowId} AND IsSynthetic = true;`
);

export function generateResetRunbook(input) {
  assertBoundary(input);
  const { projectId, environment, batchKey, batchRowId } = input;
  const sourceTables = sourceManifest.tables
    .filter(table => table.zone === 'SOURCE')
    .sort((left, right) => right.loadOrder - left.loadOrder || right.name.localeCompare(left.name));
  const inspect = sourceTables.map(table => countSource(table.name, batchRowId));
  const deletes = sourceTables.map(table => deleteSource(table.name, batchRowId));
  const verify = sourceTables.map(table => countSource(table.name, batchRowId));

  return [
    '# Catalyst Development synthetic batch reset',
    '',
    `Project: ${projectId}`,
    `Environment: ${environment}`,
    `Batch: ${batchKey}`,
    `Batch ROWID: ${batchRowId}`,
    '',
    '## READ-ONLY DRY RUN',
    '',
    `SELECT ROWID, BatchID, Status, SourceRowCount, AcceptedRowCount, RejectedRowCount, IsSynthetic FROM TRN_IngestionBatch WHERE ROWID = ${batchRowId} AND BatchID = '${batchKey}' AND IsSynthetic = true;`,
    ...inspect,
    `SELECT COUNT(ROWID) FROM TRN_SourceKeyMap WHERE BatchRef = ${batchRowId} AND IsSynthetic = true;`,
    `SELECT COUNT(ROWID) FROM TRN_RejectedRecord WHERE BatchRef = ${batchRowId} AND IsSynthetic = true;`,
    `SELECT COUNT(ROWID) FROM INT_AnalysisRun WHERE BatchKey = '${batchKey}' AND SyntheticData = true;`,
    '',
    'Stop if the batch row is not unique, any row is not synthetic, source totals do not reconcile, or INT_AnalysisRun is nonzero.',
    '',
    '## DELETE ONLY AFTER EXPLICIT APPROVAL',
    '',
    ...deletes,
    `DELETE FROM TRN_SourceKeyMap WHERE BatchRef = ${batchRowId} AND IsSynthetic = true;`,
    `DELETE FROM TRN_RejectedRecord WHERE BatchRef = ${batchRowId} AND IsSynthetic = true;`,
    `DELETE FROM TRN_IngestionBatch WHERE ROWID = ${batchRowId} AND BatchID = '${batchKey}' AND IsSynthetic = true;`,
    '',
    '## ZERO-ROW VERIFICATION',
    '',
    ...verify,
    `SELECT COUNT(ROWID) FROM TRN_SourceKeyMap WHERE BatchRef = ${batchRowId} AND IsSynthetic = true;`,
    `SELECT COUNT(ROWID) FROM TRN_RejectedRecord WHERE BatchRef = ${batchRowId} AND IsSynthetic = true;`,
    `SELECT COUNT(ROWID) FROM TRN_IngestionBatch WHERE ROWID = ${batchRowId} AND BatchID = '${batchKey}' AND IsSynthetic = true;`,
    '',
  ].join('\n');
}

const invoked = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (invoked && import.meta.url === pathToFileURL(invoked).href) {
  process.stdout.write(generateResetRunbook({
    projectId: APPROVED_PROJECT,
    environment: 'Development',
    batchKey: APPROVED_BATCH,
    batchRowId: process.argv[2] ?? '',
  }));
}

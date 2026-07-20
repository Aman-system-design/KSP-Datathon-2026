import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import test from 'node:test';

const moduleUrl = new URL('../../scripts/catalyst/generate-development-batch-reset-runbook.mjs', import.meta.url);

test('reset runbook is exact-batch, reverse-order and Development-only', async () => {
  assert.equal(existsSync(moduleUrl), true, 'reset runbook generator must exist');
  const { generateResetRunbook } = await import(moduleUrl);
  const text = generateResetRunbook({
    projectId: '43492000000013049', environment: 'Development',
    batchKey: 'KSP-DEMO-20260720-V1', batchRowId: '43492000000075002',
  });
  assert.match(text, /READ-ONLY DRY RUN/u);
  assert.match(text, /IsSynthetic = true/u);
  assert.equal(text.includes('TRUNCATE'), false);
  assert.equal(text.includes('Production'), false);
  assert.ok(text.indexOf('DELETE FROM SRC_ChargesheetDetails') < text.indexOf('DELETE FROM SRC_CaseMaster'));
  assert.ok(text.indexOf('DELETE FROM SRC_CaseMaster') < text.indexOf('DELETE FROM TRN_IngestionBatch'));
  assert.match(text, /BatchID = 'KSP-DEMO-20260720-V1'/u);
  assert.match(text, /ROWID = 43492000000075002/u);
});

test('reset runbook rejects every environment, project and identifier outside the approved boundary', async () => {
  assert.equal(existsSync(moduleUrl), true, 'reset runbook generator must exist');
  const { generateResetRunbook } = await import(moduleUrl);
  const valid = {
    projectId: '43492000000013049', environment: 'Development',
    batchKey: 'KSP-DEMO-20260720-V1', batchRowId: '43492000000075002',
  };
  assert.throws(() => generateResetRunbook({ ...valid, environment: 'Prod' }), /Development/u);
  assert.throws(() => generateResetRunbook({ ...valid, projectId: '1' }), /project/u);
  assert.throws(() => generateResetRunbook({ ...valid, batchKey: "x' OR 1=1" }), /batchKey/u);
  assert.throws(() => generateResetRunbook({ ...valid, batchRowId: '*' }), /batchRowId/u);
});

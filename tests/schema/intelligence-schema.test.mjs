import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { validateIntelligenceSchema } from '../../scripts/schema/validate-intelligence-schema.mjs';

const schema = JSON.parse(await readFile(
  new URL('../../schema/catalyst/intelligence-schema.json', import.meta.url),
  'utf8',
));

const expectedTables = [
  'CFG_UserAccess',
  'TRN_CaseFeature', 'TRN_LocationFeature', 'TRN_PersonResolution', 'TRN_DistrictContext',
  'INT_AnalysisRun', 'INT_Hotspot', 'INT_Anomaly', 'INT_Pattern', 'INT_AreaRisk',
  'INT_NetworkNode', 'INT_NetworkEdge', 'INT_RepeatOffenderSignal', 'INT_FindingEvidence',
  'WF_Alert', 'WF_Command', 'WF_AlertEvidence', 'WF_Assignment', 'WF_AnalystConclusion',
  'WF_Outcome', 'WF_AuditEvent',
];

test('manifest defines the exact production-shaped 21-table backend boundary', () => {
  assert.deepEqual(schema.tables.map(({ name }) => name), expectedTables);
  assert.deepEqual(validateIntelligenceSchema(schema), []);
});

test('access and command tables preserve identity and idempotency boundaries', () => {
  const access = schema.tables.find(({ name }) => name === 'CFG_UserAccess');
  assert.equal(access.businessId, 'AccessProfileID');
  assert.ok(access.columns.some(({ name, unique }) => name === 'CatalystUserID' && unique));

  const command = schema.tables.find(({ name }) => name === 'WF_Command');
  for (const field of [
    'CommandID', 'IdempotencyKeyHash', 'RequestHash', 'AlertRef',
    'ExpectedAlertState', 'ExpectedAlertVersion', 'TargetAlertState',
    'Status', 'ResponseJSON', 'CreatedAt', 'CompletedAt',
  ]) assert.ok(command.columns.some(({ name }) => name === field), `WF_Command missing ${field}`);
  assert.equal(schema.tables.some(table => table.columns.some(({ name }) => name === 'IdempotencyKey')), false);
});

test('run publication and workflow consistency are explicit', () => {
  const run = schema.tables.find(({ name }) => name === 'INT_AnalysisRun');
  for (const field of ['BatchKey', 'Operation', 'ReconciliationJSON', 'RunGroupID', 'AnalysisType', 'RunTypeKey', 'PublishStatus', 'PublishedAt']) {
    assert.ok(run.columns.some(({ name }) => name === field), `INT_AnalysisRun missing ${field}`);
  }
  assert.equal(run.columns.find(({ name }) => name === 'RunTypeKey').unique, true);

  const alert = schema.tables.find(({ name }) => name === 'WF_Alert');
  assert.ok(alert.columns.some(({ name }) => name === 'AlertVersion'));
  assert.ok(alert.columns.some(({ name, parentTable }) => name === 'LastCommandRef' && parentTable === 'WF_Command'));

  for (const tableName of ['WF_Assignment', 'WF_AnalystConclusion', 'WF_Outcome']) {
    const table = schema.tables.find(({ name }) => name === tableName);
    assert.ok(table.columns.some(({ name, mandatory }) => name === 'CommandRef' && mandatory));
  }

  const assignment = schema.tables.find(({ name }) => name === 'WF_Assignment');
  for (const field of ['AuthorizedUnitIDsJSON', 'AuthorizedCaseIDsJSON', 'EvidenceAccessLevel']) {
    assert.ok(assignment.columns.some(({ name }) => name === field));
  }

  const audit = schema.tables.find(({ name }) => name === 'WF_AuditEvent');
  for (const field of ['CommandRef', 'StreamID', 'StreamSequence', 'HashAlgorithm', 'HashKeyVersion']) {
    assert.ok(audit.columns.some(({ name }) => name === field));
  }
  assert.equal(audit.columns.find(({ name }) => name === 'CommandRef').mandatory, false);
});

test('every table exposes a unique application id and synthetic marker', () => {
  for (const table of schema.tables) {
    const id = table.columns.find(({ name }) => name === table.businessId);
    assert.ok(id, `${table.name} missing businessId column`);
    assert.equal(id.mandatory, true);
    assert.equal(id.unique, true);

    const synthetic = table.columns.find(({ name }) => name === 'SyntheticData');
    assert.deepEqual(
      { type: synthetic?.type, mandatory: synthetic?.mandatory, default: synthetic?.default },
      { type: 'boolean', mandatory: true, default: true },
    );
  }
});

test('foreign keys are safe and point inside the manifest', () => {
  const names = new Set(schema.tables.map(({ name }) => name));
  for (const table of schema.tables) {
    for (const column of table.columns.filter(({ type }) => type === 'foreign_key')) {
      assert.ok(names.has(column.parentTable), `${table.name}.${column.name} has unknown parent`);
      assert.equal(column.onDelete, 'NULL');
    }
  }
});

test('area risk is explainable, time-bound, and never person-level', () => {
  const table = schema.tables.find(({ name }) => name === 'INT_AreaRisk');
  const names = table.columns.map(({ name }) => name);
  for (const required of [
    'AreaType', 'AreaID', 'PeriodStart', 'PeriodEnd', 'Score', 'ComponentsJSON',
    'MethodVersion', 'Limitation',
  ]) {
    assert.ok(names.includes(required), `INT_AreaRisk missing ${required}`);
  }
  assert.equal(names.some((name) => /person|accused|offender/i.test(name)), false);
});

test('validator rejects unsafe mutations', () => {
  const unknownParent = structuredClone(schema);
  unknownParent.tables[1].columns.push({
    name: 'BrokenRef', type: 'foreign_key', parentTable: 'Missing', mandatory: false,
    onDelete: 'CASCADE',
  });
  assert.match(validateIntelligenceSchema(unknownParent).join('\n'), /parent Missing does not exist/);
  assert.match(validateIntelligenceSchema(unknownParent).join('\n'), /onDelete NULL/);

  const personRisk = structuredClone(schema);
  personRisk.tables.find(({ name }) => name === 'INT_AreaRisk').columns.push({
    name: 'PersonID', type: 'varchar', maxLength: 64, mandatory: false, unique: false,
    indexed: true, pii: true,
  });
  assert.match(validateIntelligenceSchema(personRisk).join('\n'), /must not contain person-level/);
});

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { validateIntelligenceSchema } from '../../scripts/schema/validate-intelligence-schema.mjs';

const schema = JSON.parse(await readFile(
  new URL('../../schema/catalyst/intelligence-schema.json', import.meta.url),
  'utf8',
));

const expectedTables = [
  'TRN_CaseFeature', 'TRN_LocationFeature', 'TRN_PersonResolution', 'TRN_DistrictContext',
  'INT_AnalysisRun', 'INT_Hotspot', 'INT_Anomaly', 'INT_Pattern', 'INT_AreaRisk',
  'INT_NetworkNode', 'INT_NetworkEdge', 'INT_RepeatOffenderSignal', 'INT_FindingEvidence',
  'WF_Alert', 'WF_AlertEvidence', 'WF_Assignment', 'WF_AnalystConclusion', 'WF_Outcome',
  'WF_AuditEvent',
];

test('manifest defines the exact lean 19-table intelligence boundary', () => {
  assert.deepEqual(schema.tables.map(({ name }) => name), expectedTables);
  assert.deepEqual(validateIntelligenceSchema(schema), []);
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

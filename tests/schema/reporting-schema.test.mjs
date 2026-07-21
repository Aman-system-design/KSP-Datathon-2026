import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const schema = JSON.parse(await readFile(
  new URL('../../schema/catalyst/intelligence-schema.json', import.meta.url),
  'utf8',
));

const byName = new Map(schema.tables.map((table) => [table.name, table]));

test('reporting and alert collaboration tables preserve ownership and relationships', () => {
  const expected = [
    'CFG_ReportDefinition', 'CFG_Dashboard', 'CFG_DashboardItem',
    'CFG_ContentShare', 'CFG_UserPreference', 'WF_AlertNote', 'WF_Escalation',
  ];
  assert.deepEqual(expected.filter((name) => !byName.has(name)), []);

  assert.equal(
    byName.get('CFG_DashboardItem').columns.find(({ name }) => name === 'DashboardRef').parentTable,
    'CFG_Dashboard',
  );
  assert.equal(
    byName.get('CFG_DashboardItem').columns.find(({ name }) => name === 'ReportRef').parentTable,
    'CFG_ReportDefinition',
  );
  assert.equal(
    byName.get('WF_AlertNote').columns.find(({ name }) => name === 'AlertRef').parentTable,
    'WF_Alert',
  );
  assert.equal(
    byName.get('WF_Escalation').columns.find(({ name }) => name === 'AlertRef').parentTable,
    'WF_Alert',
  );
});

test('reporting definitions are versioned, synthetic, and authorization-oriented', () => {
  for (const tableName of ['CFG_ReportDefinition', 'CFG_Dashboard']) {
    const fields = byName.get(tableName).columns;
    assert.ok(fields.some(({ name }) => name === 'OwnerUserID'));
    assert.ok(fields.some(({ name }) => name === 'Version'));
    assert.ok(fields.some(({ name }) => name === 'SyntheticData'));
  }

  const shareFields = byName.get('CFG_ContentShare').columns.map(({ name }) => name);
  for (const target of ['TargetUserID', 'TargetRole', 'TargetUnitID']) {
    assert.ok(shareFields.includes(target));
  }

  for (const tableName of ['WF_AlertNote', 'WF_Escalation']) {
    const commandRef = byName.get(tableName).columns.find(({ name }) => name === 'CommandRef');
    assert.deepEqual(
      { parentTable: commandRef.parentTable, mandatory: commandRef.mandatory },
      { parentTable: 'WF_Command', mandatory: true },
    );
  }
});

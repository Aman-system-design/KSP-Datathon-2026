import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const catalystTypes = {
  bigint: 'BigInt', boolean: 'Boolean', date: 'Date', datetime: 'DateTime',
  double: 'Double', foreign_key: 'Foreign Key', int: 'Int', text: 'Text', varchar: 'Var Char',
};
const show = (value) => {
  if (value === undefined || value === null || value === '') return '-';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
};
const sortedTables = schema => [...schema.tables].sort(
  (left, right) => left.loadOrder - right.loadOrder || left.name.localeCompare(right.name),
);

export function generateIntelligenceRunbook(schema) {
  const tables = sortedTables(schema);
  const lines = [
    '# Catalyst Intelligence and Workflow Tables Runbook',
    '',
    `**Manifest version:** ${schema.schemaVersion}`,
    '',
    `**Project ID:** ${schema.projectId}`,
    '',
    `**Environment:** ${schema.environment}`,
    '',
    '> **Development only.** Do not create these tables in Production and do not load real police data. The MVP dataset is synthetic.',
    '',
    'This document is generated only from `schema/catalyst/intelligence-schema.json`. Edit the manifest and regenerate; never hand-edit table definitions here.',
    '',
    '## Phase A - Create tables and native columns',
    '',
    'Create tables in the order below. Catalyst creates `ROWID`, `CREATORID`, `CREATEDTIME`, and `MODIFIEDTIME`; do not add them manually.',
    '',
  ];

  for (const table of tables) {
    const native = table.columns.filter(({ type }) => type !== 'foreign_key');
    lines.push(
      `## Create table: ${table.name}`,
      '',
      `- Zone: ${table.zone}`,
      `- Load order: ${table.loadOrder}`,
      `- Application business ID: \`${table.businessId}\``,
      '',
      '| Order | Column | Origin | Catalyst type | Max length | Minimum | Mandatory | Unique | Search index | PII/ePHI | Default |',
      '|---:|---|---|---|---:|---:|---|---|---|---|---|',
      ...native.map((column, index) => (
        `| ${index + 1} | \`${column.name}\` | ${column.origin} | ${catalystTypes[column.type]} | ${show(column.maxLength)} | ${show(column.minimum)} | ${show(column.mandatory)} | ${show(column.unique ?? false)} | ${show(column.indexed ?? false)} | ${show(column.pii)} | ${show(column.default)} |`
      )),
      '',
    );
  }

  const relationships = tables.flatMap(table => table.columns
    .filter(({ type }) => type === 'foreign_key')
    .map(column => ({ table, column })));
  lines.push(
    '## Phase B - Add Foreign Key columns',
    '',
    'Add these after all Phase A tables exist. For every row below select the parent `ROWID` and **On Delete = Null**. Never select Cascade.',
    '',
    '| Order | Child table | Column | Parent table | Mandatory | On delete |',
    '|---:|---|---|---|---|---|',
    ...relationships.map(({ table, column }, index) => (
      `| ${index + 1} | \`${table.name}\` | \`${column.name}\` | \`${column.parentTable}\` | ${show(column.mandatory)} | ${column.onDelete} |`
    )),
    '',
    '## Post-creation verification checklist',
    '',
    `- [ ] Confirm all ${tables.length} application tables exist in Catalyst Development.`,
    '- [ ] Confirm each native column matches type, length, Mandatory, Unique, Search index, and PII/ePHI settings above.',
    '- [ ] Confirm every Foreign Key points to parent `ROWID` with On Delete = Null.',
    '- [ ] Confirm `INT_AreaRisk` contains no person, accused, or offender field.',
    '- [ ] Confirm every table contains mandatory `SyntheticData` with default `true`.',
    '- [ ] Create a Catalyst IaC export and compare it with the manifest before loading records.',
    '- [ ] Run `npm.cmd run intelligence-schema:validate` and the complete test suite.',
    '',
    '| Table | Expected columns | Catalyst table ID | Observed columns | Verified by | Verified at | Evidence path |',
    '|---|---:|---|---:|---|---|---|',
    ...tables.map(table => `| \`${table.name}\` | ${table.columns.length} |  |  |  |  |  |`),
  );

  return `${lines.join('\n')}\n`;
}

async function runCli() {
  const schema = JSON.parse(await readFile(
    new URL('../../schema/catalyst/intelligence-schema.json', import.meta.url),
    'utf8',
  ));
  const outputIndex = process.argv.indexOf('--output');
  const output = outputIndex >= 0
    ? resolve(process.argv[outputIndex + 1])
    : resolve('docs/runbooks/catalyst-intelligence-tables.md');
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, generateIntelligenceRunbook(schema), 'utf8');
  console.log(`PASS: wrote deterministic Catalyst intelligence runbook to ${output}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runCli();
}

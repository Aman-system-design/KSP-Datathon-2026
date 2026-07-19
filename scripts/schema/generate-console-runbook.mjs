import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { effectiveColumns } from './validate-schema.mjs';

const catalystTypes = {
  bigint: 'BigInt',
  boolean: 'Boolean',
  date: 'Date',
  datetime: 'DateTime',
  double: 'Double',
  foreign_key: 'Foreign Key',
  int: 'Int',
  text: 'Text',
  varchar: 'Var Char',
};

const show = (value) => {
  if (value === undefined || value === null || value === '') return '-';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
};

const sortedTables = (schema) => [...schema.tables]
  .sort((left, right) => left.loadOrder - right.loadOrder
    || left.name.localeCompare(right.name));

function nativeColumnRow(column, index) {
  return `| ${index + 1} | \`${column.name}\` | ${catalystTypes[column.type]} | ${show(column.maxLength)} | ${show(column.mandatory)} | ${show(column.unique ?? false)} | ${show(column.indexed ?? false)} | ${show(column.pii)} | ${show(column.default)} |`;
}

function relationshipRow(table, column, index) {
  return `| ${index + 1} | \`${table.name}\` | \`${column.name}\` | \`${column.parentTable}\` | ${show(column.mandatory)} | ${column.onDelete} |`;
}

export function generateRunbook(schema) {
  const tables = sortedTables(schema);
  const lines = [
    '# Catalyst Data Store Creation Runbook',
    '',
    `**Manifest version:** ${schema.schemaVersion}`,
    '',
    `**Project ID:** ${schema.projectId}`,
    '',
    `**Environment:** ${schema.environment}`,
    '',
    '> Create only in Development. Do not load real police data. All MVP data is synthetic.',
    '',
    '## Phase A - Create tables and native columns',
    '',
    'Create tables in the order shown. Catalyst automatically adds ROWID, CREATORID, CREATEDTIME, and MODIFIEDTIME; do not recreate them.',
    '',
  ];

  for (const table of tables) {
    const nativeColumns = effectiveColumns(schema, table)
      .filter(({ type }) => type !== 'foreign_key');
    lines.push(
      `## Create table: ${table.name}`,
      '',
      `- Zone: ${table.zone}`,
      `- Load order: ${table.loadOrder}`,
      `- PDF source: ${table.sourceName ?? 'Not PDF-defined'}`,
      '',
      '| Order | Column | Catalyst type | Max length | Mandatory | Unique | Search index | PII/ePHI | Default |',
      '|---:|---|---|---:|---|---|---|---|---|',
      ...nativeColumns.map(nativeColumnRow),
      '',
    );
  }

  lines.push(
    '## Phase B - Add Catalyst Foreign Key columns',
    '',
    'Add these only after every table in Phase A exists. Select the exact parent and use On Delete = Null. Never select Cascade.',
    '',
    '| Order | Child table | Reference column | Parent table | Mandatory | On delete |',
    '|---:|---|---|---|---|---|',
  );

  const relationships = tables.flatMap((table) => effectiveColumns(schema, table)
    .filter(({ type }) => type === 'foreign_key')
    .map((column) => ({ table, column })));
  lines.push(...relationships.map(({ table, column }, index) => relationshipRow(table, column, index)));

  lines.push(
    '',
    '## Phase C - Verification record',
    '',
    '| Table | Expected manifest columns | Catalyst table ID | Observed manifest columns | Verified by | Verified at | Evidence path |',
    '|---|---:|---|---:|---|---|---|',
    ...tables.map((table) => `| \`${table.name}\` | ${effectiveColumns(schema, table).length} |  |  |  |  |  |`),
    '',
    'Verification is complete only when the Catalyst IaC export comparison passes. Do not infer correctness from the console table count alone.',
  );

  return `${lines.join('\n')}\n`;
}

async function runCli() {
  const root = new URL('../../', import.meta.url);
  const schema = JSON.parse(await readFile(
    new URL('schema/catalyst/source-schema.json', root),
    'utf8',
  ));
  const outputArgument = process.argv.indexOf('--output');
  const output = outputArgument >= 0
    ? resolve(process.argv[outputArgument + 1])
    : resolve('docs/runbooks/catalyst-datastore-creation.md');
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, generateRunbook(schema), 'utf8');
  console.log(`PASS: wrote deterministic Catalyst runbook to ${output}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runCli();
}

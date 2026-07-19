import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { effectiveColumns } from './validate-schema.mjs';

const normalizeType = (type) => type === 'foreign_key' ? 'foreign key' : type;
const show = (value) => value === undefined ? '<missing>' : JSON.stringify(value);

function compareProperty(differences, label, property, expected, actual) {
  if (actual !== expected) {
    differences.push(`${label} ${property}: expected ${show(expected)}, found ${show(actual)}`);
  }
}

export function compareCatalystExport(schema, template) {
  const differences = [];
  const components = template?.components?.Datastore ?? [];
  const actualTables = components.filter(({ type }) => type === 'table');
  const actualColumns = components.filter(({ type }) => type === 'column');
  const expectedTableNames = new Set(schema.tables.map(({ name }) => name));
  const actualTableNames = actualTables.map(({ properties, name }) => properties?.table_name ?? name);

  for (const tableName of [...expectedTableNames].sort()) {
    const matches = actualTableNames.filter((name) => name === tableName).length;
    if (matches === 0) differences.push(`missing table ${tableName}`);
    if (matches > 1) differences.push(`duplicate table ${tableName}`);
  }
  for (const tableName of [...new Set(actualTableNames)].sort()) {
    if (!expectedTableNames.has(tableName)) differences.push(`unexpected table ${tableName}`);
  }

  const expectedColumnKeys = new Set();
  for (const table of schema.tables) {
    for (const column of effectiveColumns(schema, table)) {
      const key = `${table.name}.${column.name}`;
      expectedColumnKeys.add(key);
      const matches = actualColumns.filter(({ properties }) =>
        properties?.table_name === table.name
        && properties?.column_name === column.name);
      if (matches.length === 0) {
        differences.push(`missing column ${key}`);
        continue;
      }
      if (matches.length > 1) {
        differences.push(`duplicate column ${key}`);
        continue;
      }

      const properties = matches[0].properties;
      compareProperty(differences, key, 'data_type', normalizeType(column.type), properties.data_type);
      compareProperty(differences, key, 'is_unique', column.unique ?? false, properties.is_unique);
      compareProperty(differences, key, 'is_mandatory', column.mandatory, properties.is_mandatory);
      compareProperty(
        differences,
        key,
        'search_index_enabled',
        column.indexed ?? false,
        properties.search_index_enabled,
      );
      compareProperty(differences, key, 'audit_consent', column.pii ?? false, properties.audit_consent);

      if (column.type === 'varchar') {
        compareProperty(differences, key, 'max_length', column.maxLength, properties.max_length);
      }
      if (column.default !== undefined) {
        compareProperty(differences, key, 'default_value', String(column.default), properties.default_value);
      }
      if (column.type === 'foreign_key') {
        compareProperty(differences, key, 'parent_table', column.parentTable, properties.parent_table);
        compareProperty(differences, key, 'parent_column', 'ROWID', properties.parent_column);
        compareProperty(
          differences,
          key,
          'constraint_type',
          'ON-DELETE-SET-NULL',
          properties.constraint_type,
        );
      }
    }
  }

  for (const { properties } of actualColumns) {
    const key = `${properties?.table_name}.${properties?.column_name}`;
    if (!expectedColumnKeys.has(key)) differences.push(`unexpected column ${key}`);
  }

  return [...new Set(differences)].sort();
}

async function runCli() {
  const exportPath = process.argv[2];
  if (!exportPath) {
    console.error('Usage: npm run schema:compare -- <project-template.json>');
    process.exitCode = 1;
    return;
  }

  const root = new URL('../../', import.meta.url);
  const schema = JSON.parse(await readFile(
    new URL('schema/catalyst/source-schema.json', root),
    'utf8',
  ));
  const template = JSON.parse(await readFile(exportPath, 'utf8'));
  const differences = compareCatalystExport(schema, template);

  if (differences.length > 0) {
    for (const difference of differences) console.error(`FAIL: ${difference}`);
    process.exitCode = 1;
    return;
  }

  console.log('PASS: Catalyst Development schema matches source-schema.json.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runCli();
}

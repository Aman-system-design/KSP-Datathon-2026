import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const catalystNamePattern = /^[A-Za-z][A-Za-z0-9_]*$/;
const allowedTypes = new Set([
  'bigint',
  'boolean',
  'date',
  'datetime',
  'double',
  'foreign_key',
  'int',
  'text',
  'varchar',
]);

export function effectiveColumns(schema, table) {
  return table.includeStandardSourceColumns
    ? [...schema.standardSourceColumns, ...table.columns]
    : [...table.columns];
}

export function validateSchema(schema, pdfContract) {
  const errors = [];
  const tables = Array.isArray(schema?.tables) ? schema.tables : [];
  const tableNames = tables.map(({ name }) => name);
  const knownTables = new Set(tableNames);
  const sourceTables = tables.filter(({ zone }) => zone === 'SOURCE');

  if (tables.length !== 29) {
    errors.push(`expected 29 tables, found ${tables.length}`);
  }
  if (sourceTables.length !== 26) {
    errors.push(`expected 26 SOURCE tables, found ${sourceTables.length}`);
  }

  const duplicateTables = tableNames.filter((name, index) => tableNames.indexOf(name) !== index);
  for (const name of new Set(duplicateTables)) {
    errors.push(`duplicate table name: ${name}`);
  }

  for (const table of tables) {
    if (!catalystNamePattern.test(table.name ?? '')) {
      errors.push(`illegal Catalyst table name: ${table.name}`);
    }
    if (!schema.zones?.includes(table.zone)) {
      errors.push(`${table.name} uses unsupported zone ${table.zone}`);
    }
    if (!Number.isInteger(table.loadOrder) || table.loadOrder < 1) {
      errors.push(`${table.name} must declare a positive integer loadOrder`);
    }

    const columns = effectiveColumns(schema, table);
    const columnNames = columns.map(({ name }) => name);
    const duplicates = columnNames.filter((name, index) => columnNames.indexOf(name) !== index);
    for (const name of new Set(duplicates)) {
      errors.push(`${table.name} has duplicate column ${name}`);
    }

    for (const column of columns) {
      const label = `${table.name}.${column.name}`;
      if (!catalystNamePattern.test(column.name ?? '')) {
        errors.push(`${label} has an illegal Catalyst column name`);
      }
      if (!allowedTypes.has(column.type)) {
        errors.push(`${label} uses unsupported type ${column.type}`);
      }
      if (typeof column.mandatory !== 'boolean') {
        errors.push(`${label} must declare mandatory`);
      }
      if (!column.origin) {
        errors.push(`${label} must declare origin`);
      }
      if (column.type !== 'foreign_key' && typeof column.pii !== 'boolean') {
        errors.push(`${label} must declare pii`);
      }
      if (column.type === 'varchar'
        && (!Number.isInteger(column.maxLength) || column.maxLength < 1 || column.maxLength > 255)) {
        errors.push(`${label} must use varchar maxLength between 1 and 255`);
      }
      if (column.type === 'foreign_key') {
        if (!knownTables.has(column.parentTable)) {
          errors.push(`${label} parent ${column.parentTable} does not exist`);
        }
        if (column.onDelete !== 'NULL') {
          errors.push(`${label} must use onDelete NULL`);
        }
      }
    }

    for (const key of table.logicalUnique ?? []) {
      for (const columnName of key) {
        if (!columnNames.includes(columnName)) {
          errors.push(`${table.name} logicalUnique references missing column ${columnName}`);
        }
      }
    }
  }

  const sourceNames = sourceTables.map(({ sourceName }) => sourceName);
  for (const [pdfName, pdfColumns] of Object.entries(pdfContract?.tables ?? {})) {
    const matches = sourceTables.filter(({ sourceName }) => sourceName === pdfName);
    if (matches.length !== 1) {
      errors.push(`${pdfName} must map to exactly one SOURCE table; found ${matches.length}`);
      continue;
    }
    const originalColumns = matches[0].columns
      .filter(({ origin }) => origin === 'PDF')
      .map(({ name }) => name);
    if (JSON.stringify(originalColumns) !== JSON.stringify(pdfColumns)) {
      errors.push(`${matches[0].name} PDF columns differ from ${pdfName}`);
    }
    if (matches[0].includeStandardSourceColumns !== true) {
      errors.push(`${matches[0].name} must include standard source columns`);
    }
  }

  for (const sourceName of sourceNames) {
    if (!Object.hasOwn(pdfContract?.tables ?? {}, sourceName)) {
      errors.push(`SOURCE mapping ${sourceName} is not defined by the PDF contract`);
    }
  }

  const syntheticMarker = schema.standardSourceColumns
    ?.find(({ name }) => name === 'IsSynthetic');
  if (syntheticMarker?.type !== 'boolean'
    || syntheticMarker?.mandatory !== true
    || syntheticMarker?.default !== true) {
    errors.push('standard IsSynthetic column must be mandatory boolean with default true');
  }

  return [...new Set(errors)].sort();
}

async function runCli() {
  const root = new URL('../../', import.meta.url);
  const schema = JSON.parse(await readFile(
    new URL('schema/catalyst/source-schema.json', root),
    'utf8',
  ));
  const pdfContract = JSON.parse(await readFile(
    new URL('schema/catalyst/pdf-contract.json', root),
    'utf8',
  ));
  const errors = validateSchema(schema, pdfContract);

  if (errors.length > 0) {
    for (const error of errors) {
      console.error(`FAIL: ${error}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log('PASS: 29 Catalyst tables, 26 PDF mappings, and all relationships are valid.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runCli();
}

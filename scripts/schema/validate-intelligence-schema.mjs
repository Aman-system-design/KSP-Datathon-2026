import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const expectedTables = [
  'TRN_CaseFeature', 'TRN_LocationFeature', 'TRN_PersonResolution', 'TRN_DistrictContext',
  'INT_AnalysisRun', 'INT_Hotspot', 'INT_Anomaly', 'INT_Pattern', 'INT_AreaRisk',
  'INT_NetworkNode', 'INT_NetworkEdge', 'INT_RepeatOffenderSignal', 'INT_FindingEvidence',
  'WF_Alert', 'WF_AlertEvidence', 'WF_Assignment', 'WF_AnalystConclusion', 'WF_Outcome',
  'WF_AuditEvent',
];
const allowedTypes = new Set([
  'bigint', 'boolean', 'date', 'datetime', 'double', 'foreign_key', 'int', 'text', 'varchar',
]);
const namePattern = /^[A-Za-z][A-Za-z0-9_]*$/;

export function validateIntelligenceSchema(schema) {
  const errors = [];
  const tables = Array.isArray(schema?.tables) ? schema.tables : [];
  const names = tables.map(({ name }) => name);
  const known = new Set(names);

  if (JSON.stringify(names) !== JSON.stringify(expectedTables)) {
    errors.push('manifest must define the exact ordered 19-table intelligence boundary');
  }

  for (const duplicate of new Set(names.filter((name, index) => names.indexOf(name) !== index))) {
    errors.push(`duplicate table name: ${duplicate}`);
  }

  for (const table of tables) {
    if (!namePattern.test(table.name ?? '')) errors.push(`illegal table name: ${table.name}`);
    if (!['TRANSFORMATION', 'INTELLIGENCE', 'WORKFLOW'].includes(table.zone)) {
      errors.push(`${table.name} has unsupported zone ${table.zone}`);
    }
    if (!Number.isInteger(table.loadOrder) || table.loadOrder < 1) {
      errors.push(`${table.name} must declare positive loadOrder`);
    }

    const columns = Array.isArray(table.columns) ? table.columns : [];
    const columnNames = columns.map(({ name }) => name);
    for (const duplicate of new Set(
      columnNames.filter((name, index) => columnNames.indexOf(name) !== index),
    )) {
      errors.push(`${table.name} has duplicate column ${duplicate}`);
    }

    const id = columns.find(({ name }) => name === table.businessId);
    if (!table.businessId || !id) errors.push(`${table.name} is missing its business ID`);
    if (id && (id.mandatory !== true || id.unique !== true)) {
      errors.push(`${table.name}.${table.businessId} must be mandatory and unique`);
    }

    const synthetic = columns.find(({ name }) => name === 'SyntheticData');
    if (synthetic?.type !== 'boolean' || synthetic?.mandatory !== true || synthetic?.default !== true) {
      errors.push(`${table.name}.SyntheticData must be mandatory boolean default true`);
    }

    for (const column of columns) {
      const label = `${table.name}.${column.name}`;
      if (!namePattern.test(column.name ?? '')) errors.push(`${label} has illegal name`);
      if (!allowedTypes.has(column.type)) errors.push(`${label} has unsupported type ${column.type}`);
      if (typeof column.mandatory !== 'boolean') errors.push(`${label} must declare mandatory`);
      if (!column.origin) errors.push(`${label} must declare origin`);
      if (column.type !== 'foreign_key' && typeof column.pii !== 'boolean') {
        errors.push(`${label} must declare pii`);
      }
      if (column.type === 'varchar'
        && (!Number.isInteger(column.maxLength) || column.maxLength < 1 || column.maxLength > 255)) {
        errors.push(`${label} must use varchar maxLength 1..255`);
      }
      if (column.type === 'foreign_key') {
        if (!known.has(column.parentTable)) {
          errors.push(`${label} parent ${column.parentTable} does not exist`);
        }
        if (column.onDelete !== 'NULL') errors.push(`${label} must use onDelete NULL`);
      }
    }
  }

  const areaRisk = tables.find(({ name }) => name === 'INT_AreaRisk');
  const riskNames = areaRisk?.columns?.map(({ name }) => name) ?? [];
  for (const required of [
    'AreaType', 'AreaID', 'PeriodStart', 'PeriodEnd', 'Score', 'ComponentsJSON',
    'MethodVersion', 'Limitation',
  ]) {
    if (!riskNames.includes(required)) errors.push(`INT_AreaRisk missing ${required}`);
  }
  if (riskNames.some((name) => /person|accused|offender/i.test(name))) {
    errors.push('INT_AreaRisk must not contain person-level fields');
  }

  for (const table of tables.filter(({ name }) => /^INT_(?!AnalysisRun)/.test(name))) {
    const columnNames = new Set(table.columns.map(({ name }) => name));
    if (!columnNames.has('AnalysisRunRef')) errors.push(`${table.name} missing AnalysisRunRef`);
  }

  return [...new Set(errors)].sort();
}

async function runCli() {
  const schema = JSON.parse(await readFile(
    new URL('../../schema/catalyst/intelligence-schema.json', import.meta.url),
    'utf8',
  ));
  const errors = validateIntelligenceSchema(schema);
  if (errors.length) {
    errors.forEach((error) => console.error(`FAIL: ${error}`));
    process.exitCode = 1;
    return;
  }
  console.log('PASS: 19 Catalyst intelligence/workflow tables are valid.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runCli();
}

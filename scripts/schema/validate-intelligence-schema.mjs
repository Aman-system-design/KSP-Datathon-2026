import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const expectedTables = [
  'CFG_UserAccess', 'CFG_ReportDefinition', 'CFG_Dashboard', 'CFG_DashboardItem',
  'CFG_ContentShare', 'CFG_UserPreference', 'CFG_MapView', 'CFG_MapViewVersion',
  'OPS_IntelligenceRunRequest',
  'TRN_CaseFeature', 'TRN_LocationFeature', 'TRN_PersonResolution', 'TRN_DistrictContext',
  'INT_AnalysisRun', 'INT_Hotspot', 'INT_Anomaly', 'INT_Pattern', 'INT_AreaRisk',
  'INT_NetworkNode', 'INT_NetworkEdge', 'INT_RepeatOffenderSignal', 'INT_FindingEvidence',
  'WF_Alert', 'WF_Command', 'WF_AlertEvidence', 'WF_Assignment', 'WF_AnalystConclusion',
  'WF_Outcome', 'WF_AuditEvent', 'WF_AlertNote', 'WF_Escalation',
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
    errors.push('manifest must define the exact ordered 31-table backend boundary');
  }

  for (const duplicate of new Set(names.filter((name, index) => names.indexOf(name) !== index))) {
    errors.push(`duplicate table name: ${duplicate}`);
  }

  for (const table of tables) {
    if (!namePattern.test(table.name ?? '')) errors.push(`illegal table name: ${table.name}`);
    if (!['CONFIGURATION', 'OPERATIONS', 'TRANSFORMATION', 'INTELLIGENCE', 'WORKFLOW'].includes(table.zone)) {
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

  const requireColumns = (tableName, required) => {
    const columns = tables.find(({ name }) => name === tableName)?.columns ?? [];
    const columnNames = new Set(columns.map(({ name }) => name));
    for (const name of required) {
      if (!columnNames.has(name)) errors.push(`${tableName} missing ${name}`);
    }
    return columns;
  };

  const accessColumns = requireColumns('CFG_UserAccess', [
    'AccessProfileID', 'CatalystUserID', 'EmployeeID', 'DefaultRole', 'ScopeUnitID',
    'DemoPersonaAllowed', 'PermissionVersion', 'Active', 'SyntheticData',
  ]);
  const catalystUserId = accessColumns.find(({ name }) => name === 'CatalystUserID');
  if (catalystUserId && catalystUserId.unique !== true) {
    errors.push('CFG_UserAccess.CatalystUserID must be unique');
  }

  const mapViewColumns = requireColumns('CFG_MapView', [
    'MapViewID', 'OrganizationID', 'Name', 'OwnerEmployeeID', 'Visibility',
    'CurrentVersion', 'Status', 'CreatedAt', 'UpdatedAt', 'SyntheticData',
  ]);
  for (const name of ['OrganizationID', 'OwnerEmployeeID', 'Visibility']) {
    if (mapViewColumns.find(column => column.name === name)?.indexed !== true) {
      errors.push(`CFG_MapView.${name} must be indexed`);
    }
  }
  const currentVersion = mapViewColumns.find(({ name }) => name === 'CurrentVersion');
  if (currentVersion && (currentVersion.type !== 'int' || currentVersion.minimum !== 1 || currentVersion.mandatory !== true)) {
    errors.push('CFG_MapView.CurrentVersion must be an int with minimum 1');
  }
  const mapViewId = mapViewColumns.find(({ name }) => name === 'MapViewID');
  if (mapViewId && (mapViewId.unique !== true || mapViewId.indexed !== true)) {
    errors.push('CFG_MapView.MapViewID must be unique and indexed');
  }
  const mapVersionColumns = requireColumns('CFG_MapViewVersion', [
    'MapViewVersionKey', 'MapViewRef', 'MapViewID', 'OrganizationID', 'Version',
    'DefinitionJSON', 'DefinitionHash', 'PublishedAt', 'CreatedByEmployeeID',
    'CreatedAt', 'SyntheticData',
  ]);
  const mapViewRef = mapVersionColumns.find(({ name }) => name === 'MapViewRef');
  if (mapViewRef && (mapViewRef.parentTable !== 'CFG_MapView' || mapViewRef.mandatory !== true)) {
    errors.push('CFG_MapViewVersion.MapViewRef must be a mandatory CFG_MapView lookup');
  }
  const definitionHash = mapVersionColumns.find(({ name }) => name === 'DefinitionHash');
  if (definitionHash && (definitionHash.type !== 'varchar' || definitionHash.maxLength !== 64 || definitionHash.mandatory !== true)) {
    errors.push('CFG_MapViewVersion.DefinitionHash must be a 64-character varchar');
  }
  const versionNumber = mapVersionColumns.find(({ name }) => name === 'Version');
  if (versionNumber && (versionNumber.type !== 'int' || versionNumber.minimum !== 1 || versionNumber.mandatory !== true)) {
    errors.push('CFG_MapViewVersion.Version must be an int with minimum 1');
  }
  const definitionJson = mapVersionColumns.find(({ name }) => name === 'DefinitionJSON');
  if (definitionJson && (definitionJson.type !== 'text' || definitionJson.mandatory !== true)) {
    errors.push('CFG_MapViewVersion.DefinitionJSON must be large text');
  }
  const publishedAt = mapVersionColumns.find(({ name }) => name === 'PublishedAt');
  if (publishedAt && (publishedAt.type !== 'datetime' || publishedAt.mandatory !== false)) {
    errors.push('CFG_MapViewVersion.PublishedAt must be an optional datetime');
  }
  for (const name of ['MapViewID', 'OrganizationID']) {
    if (mapVersionColumns.find(column => column.name === name)?.indexed !== true) {
      errors.push(`CFG_MapViewVersion.${name} must be indexed`);
    }
  }
  const mapVersionKey = mapVersionColumns.find(({ name }) => name === 'MapViewVersionKey');
  if (mapVersionKey && (mapVersionKey.unique !== true || mapVersionKey.indexed !== true)) {
    errors.push('CFG_MapViewVersion.MapViewVersionKey must be unique and indexed');
  }

  requireColumns('WF_Command', [
    'CommandID', 'IdempotencyKeyHash', 'RequestHash', 'AlertRef',
    'ActorCatalystUserID', 'EffectiveRole', 'CommandType', 'ExpectedAlertState',
    'ExpectedAlertVersion', 'TargetAlertState', 'Status', 'ResponseJSON', 'ErrorCode',
    'CreatedAt', 'CompletedAt', 'SyntheticData',
  ]);
  if (tables.some(table => table.columns.some(({ name }) => name === 'IdempotencyKey'))) {
    errors.push('raw IdempotencyKey must never be persisted');
  }

  requireColumns('OPS_IntelligenceRunRequest', [
    'RunRequestID', 'IdempotencyKeyHash', 'RequestHash', 'BatchKey', 'Operation',
    'RequestedBy', 'Status', 'CatalystJobID', 'Attempt', 'RequestedAt', 'StartedAt',
    'CompletedAt', 'UpdatedAt', 'FailedPhase', 'FailureCode', 'CurrentRunGroupID',
    'SyntheticData',
  ]);

  const runColumns = requireColumns('INT_AnalysisRun', [
    'RunGroupID', 'AnalysisType', 'RunTypeKey', 'PublishStatus', 'PublishedAt',
  ]);
  const runTypeKey = runColumns.find(({ name }) => name === 'RunTypeKey');
  if (runTypeKey && runTypeKey.unique !== true) {
    errors.push('INT_AnalysisRun.RunTypeKey must be unique');
  }

  requireColumns('WF_Alert', ['AlertVersion', 'LastCommandRef']);
  for (const tableName of ['WF_Assignment', 'WF_AnalystConclusion', 'WF_Outcome']) {
    const columns = requireColumns(tableName, ['CommandRef']);
    const commandRef = columns.find(({ name }) => name === 'CommandRef');
    if (commandRef && commandRef.mandatory !== true) {
      errors.push(`${tableName}.CommandRef must be mandatory`);
    }
  }
  requireColumns('WF_Assignment', [
    'AuthorizedUnitIDsJSON', 'AuthorizedCaseIDsJSON', 'EvidenceAccessLevel',
  ]);
  const auditColumns = requireColumns('WF_AuditEvent', [
    'CommandRef', 'StreamID', 'StreamSequence', 'HashAlgorithm', 'HashKeyVersion',
  ]);
  const auditCommand = auditColumns.find(({ name }) => name === 'CommandRef');
  if (auditCommand && auditCommand.mandatory !== false) {
    errors.push('WF_AuditEvent.CommandRef must be optional for non-workflow events');
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
  console.log('PASS: 31 Catalyst backend tables are valid.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runCli();
}

import { createHash } from 'node:crypto';

const RELATIONSHIP_OVERRIDES = Object.freeze({
  'SRC_CaseMaster.PolicePersonRef': [['PolicePersonID'], ['EmployeeID']],
  'SRC_CaseMaster.PoliceStationRef': [['PoliceStationID'], ['UnitID']],
  'SRC_CaseMaster.CrimeMajorHeadRef': [['CrimeMajorHeadID'], ['CrimeHeadID']],
  'SRC_CaseMaster.CrimeMinorHeadRef': [['CrimeMinorHeadID'], ['CrimeSubHeadID']],
  'SRC_ArrestSurrender.ArrestSurrenderStateRef': [['ArrestSurrenderStateId'], ['StateID']],
  'SRC_ArrestSurrender.ArrestSurrenderDistrictRef': [['ArrestSurrenderDistrictId'], ['DistrictID']],
  'SRC_ArrestSurrender.PoliceStationRef': [['PoliceStationID'], ['UnitID']],
  'SRC_ArrestSurrender.IORef': [['IOID'], ['EmployeeID']],
  'SRC_ArrestSurrender.AccusedMasterRef': [['AccusedMasterID'], ['AccusedMasterID']],
  'SRC_Unit.UnitTypeRef': [['TypeID'], ['UnitTypeID']],
  'SRC_Unit.ParentUnitRef': [['ParentUnit'], ['UnitID']],
  'SRC_Employee.UnitRef': [['UnitID'], ['UnitID']],
  'SRC_ChargesheetDetails.PolicePersonRef': [['PolicePersonID'], ['EmployeeID']],
  'SRC_CrimeHeadActSection.SectionRef': [['ActCode', 'SectionCode'], ['ActCode', 'SectionCode']],
  'SRC_Section.ActRef': [['ActCode'], ['ActCode']],
  'SRC_CrimeHeadActSection.ActRef': [['ActCode'], ['ActCode']],
});

const hasValue = value => value !== null && value !== undefined && value !== '';
const stableObject = value => Object.fromEntries(Object.entries(value).sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0));
const hash = value => createHash('sha256').update(JSON.stringify(stableObject(value))).digest('hex');

function catalystTemporalValue(column, value) {
  if (!hasValue(value) || !['date', 'datetime'].includes(column.type)) return structuredClone(value);
  const match = String(value).match(/^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}:\d{2}:\d{2}))?/u);
  if (!match || (column.type === 'datetime' && !match[2])) throw new TypeError(`Invalid ${column.type} value for ${column.name}.`);
  return column.type === 'date' ? match[1] : `${match[1]} ${match[2]}`;
}

function businessColumns(table) {
  const unique = table.columns.filter(column => column.origin === 'PDF' && column.unique).map(column => column.name);
  if (unique.length > 0) return [unique[0]];
  if (Array.isArray(table.logicalUnique?.[0]) && table.logicalUnique[0].length > 0) return table.logicalUnique[0];
  throw new Error(`No business key is declared for ${table.name}.`);
}

export function sourceBusinessKey(table, row, columns = businessColumns(table)) {
  const values = columns.map(column => row[column]);
  if (!values.every(hasValue)) throw new Error(`Missing business key for ${table.name}.`);
  return values.map(String).join('|');
}

function relationshipColumns(table, foreignKey, parent) {
  const override = RELATIONSHIP_OVERRIDES[`${table.name}.${foreignKey.name}`];
  if (override) return override;
  const parentColumns = businessColumns(parent);
  if (parentColumns.every(column => table.columns.some(candidate => candidate.name === column))) {
    return [parentColumns, parentColumns];
  }
  const inferred = `${foreignKey.name.slice(0, -3)}ID`;
  return table.columns.some(column => column.name === inferred) && parentColumns.length === 1
    ? [[inferred], parentColumns]
    : null;
}

export function createSourceProjector({ manifest }) {
  if (!manifest?.syntheticOnly || !Array.isArray(manifest.tables)) throw new TypeError('Synthetic source manifest is required.');
  const sourceTables = manifest.tables.filter(table => table.zone === 'SOURCE' && table.sourceName);
  const tableByName = new Map(manifest.tables.map(table => [table.name, table]));

  function projectTable({ table, rows, batchKey, batchRowId, keyMap }) {
    if (!hasValue(batchRowId)) throw new Error('Catalyst batch ROWID is required.');
    const pdfColumns = table.columns.filter(column => column.origin === 'PDF');
    return {
      tableName: table.name,
      sourceName: table.sourceName,
      loadOrder: table.loadOrder,
      records: rows.map((sourceRow, index) => {
        const rawPdf = Object.fromEntries(pdfColumns.map(column => [column.name, structuredClone(sourceRow[column.name])]));
        const pdf = Object.fromEntries(pdfColumns.map(column => [column.name, catalystTemporalValue(column, sourceRow[column.name])]));
        const row = {
          ...pdf,
          SourceBatchRef: String(batchRowId),
          SourceFileName: `synthetic://${batchKey}/${table.sourceName}.json`,
          SourceRowNumber: index + 1,
          SourceSchemaVersion: manifest.schemaVersion,
          IsSynthetic: true,
          SourceRecordHash: hash(rawPdf),
          ValidationStatus: 'ACCEPTED',
        };
        for (const foreignKey of table.columns.filter(column => column.type === 'foreign_key')) {
          const parent = tableByName.get(foreignKey.parentTable);
          const columns = parent && relationshipColumns(table, foreignKey, parent);
          if (!columns) {
            if (foreignKey.mandatory) throw new Error(`Unresolved mandatory relationship ${table.name}.${foreignKey.name}.`);
            continue;
          }
          const [sourceColumns, parentColumns] = columns;
          const values = sourceColumns.map(column => sourceRow[column]);
          if (!values.every(hasValue)) continue;
          const parentKey = values.map(String).join('|');
          const rowId = keyMap.get(`${parent.name}:${parentKey}`);
          if (rowId) row[foreignKey.name] = String(rowId);
          else if (foreignKey.mandatory) throw new Error(`Unresolved mandatory parent ${parent.name}:${parentKey}.`);
        }
        return { businessKey: sourceBusinessKey(table, sourceRow), row };
      }),
    };
  }

  return Object.freeze({
    projectBatch({ batchKey, batchRowId, accepted, keyMap = new Map() }) {
      if (typeof batchKey !== 'string' || !batchKey) throw new TypeError('batchKey is required.');
      return sourceTables
        .filter(table => Object.hasOwn(accepted ?? {}, table.sourceName))
        .sort((left, right) => left.loadOrder - right.loadOrder || (left.name < right.name ? -1 : 1))
        .map(table => projectTable({ table, rows: accepted[table.sourceName] ?? [], batchKey, batchRowId, keyMap }));
    },
  });
}

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateSchema } from '../../scripts/schema/validate-schema.mjs';
import { generateRunbook } from '../../scripts/schema/generate-console-runbook.mjs';
import { compareCatalystExport } from '../../scripts/schema/compare-catalyst-export.mjs';

const root = new URL('../../', import.meta.url);
const loadJson = async (path) => JSON.parse(await readFile(new URL(path, root), 'utf8'));

const expectedPdfTables = [
  'CaseMaster',
  'ComplainantDetails',
  'ActSectionAssociation',
  'Victim',
  'Accused',
  'ArrestSurrender',
  'Act',
  'Section',
  'CrimeHeadActSection',
  'CrimeHead',
  'CrimeSubHead',
  'CasteMaster',
  'ReligionMaster',
  'OccupationMaster',
  'CaseStatusMaster',
  'Court',
  'District',
  'State',
  'Unit',
  'UnitType',
  'Rank',
  'Designation',
  'Employee',
  'CaseCategory',
  'GravityOffence',
  'ChargesheetDetails',
];

test('schema manifest and PDF contract exist', async () => {
  const paths = [
    new URL('schema/catalyst/source-schema.json', root),
    new URL('schema/catalyst/pdf-contract.json', root),
  ];

  for (const path of paths) {
    const content = await readFile(path, 'utf8');
    assert.ok(content.length > 0, `${path.pathname} must not be empty`);
  }
});

test('PDF contract contains exactly the 26 defined tables', async () => {
  const contract = JSON.parse(await readFile(
    new URL('schema/catalyst/pdf-contract.json', root),
    'utf8',
  ));

  assert.deepEqual(Object.keys(contract.tables), expectedPdfTables);
});

test('every PDF table maps to one SRC table with unchanged source columns', async () => {
  const pdf = await loadJson('schema/catalyst/pdf-contract.json');
  const schema = await loadJson('schema/catalyst/source-schema.json');
  const sourceTables = schema.tables.filter(({ zone }) => zone === 'SOURCE');

  assert.equal(sourceTables.length, 26);
  for (const [pdfName, pdfColumns] of Object.entries(pdf.tables)) {
    const table = sourceTables.find(({ sourceName }) => sourceName === pdfName);
    assert.ok(table, `missing SRC mapping for ${pdfName}`);
    const originalNames = table.columns
      .filter(({ origin }) => origin === 'PDF')
      .map(({ name }) => name);
    assert.deepEqual(originalNames, pdfColumns, `${pdfName} source columns changed`);
  }
});

test('MVP source tables enforce synthetic provenance', async () => {
  const schema = await loadJson('schema/catalyst/source-schema.json');
  const standardMarker = schema.standardSourceColumns
    .find(({ name }) => name === 'IsSynthetic');

  for (const table of schema.tables.filter(({ zone }) => zone === 'SOURCE')) {
    assert.equal(table.includeStandardSourceColumns, true);
    assert.deepEqual(
      {
        type: standardMarker?.type,
        mandatory: standardMarker?.mandatory,
        default: standardMarker?.default,
      },
      { type: 'boolean', mandatory: true, default: true },
    );
  }
});

test('schema contains no individual future-crime prediction field', async () => {
  const schemaText = await readFile(
    new URL('schema/catalyst/source-schema.json', root),
    'utf8',
  );

  assert.doesNotMatch(schemaText, /recidivism|futureCrime|personRiskScore/i);
});

test('valid schema has no validation errors', async () => {
  const schema = await loadJson('schema/catalyst/source-schema.json');
  const pdf = await loadJson('schema/catalyst/pdf-contract.json');

  assert.deepEqual(validateSchema(schema, pdf), []);
});

test('validator reports duplicate and illegal table names', async () => {
  const schema = await loadJson('schema/catalyst/source-schema.json');
  const pdf = await loadJson('schema/catalyst/pdf-contract.json');
  const invalid = structuredClone(schema);
  invalid.tables[1].name = invalid.tables[0].name;
  invalid.tables[2].name = '9 invalid table';

  const errors = validateSchema(invalid, pdf);
  assert.ok(errors.some((error) => error.includes('duplicate table')));
  assert.ok(errors.some((error) => error.includes('illegal Catalyst table name')));
});

test('validator reports a missing PDF column', async () => {
  const schema = await loadJson('schema/catalyst/source-schema.json');
  const pdf = await loadJson('schema/catalyst/pdf-contract.json');
  const invalid = structuredClone(schema);
  const caseTable = invalid.tables.find(({ name }) => name === 'SRC_CaseMaster');
  caseTable.columns = caseTable.columns.filter(({ name }) => name !== 'CrimeNo');

  assert.ok(validateSchema(invalid, pdf)
    .some((error) => error.includes('SRC_CaseMaster PDF columns differ')));
});

test('validator reports invalid foreign-key parent and cascade deletion', async () => {
  const schema = await loadJson('schema/catalyst/source-schema.json');
  const pdf = await loadJson('schema/catalyst/pdf-contract.json');
  const invalid = structuredClone(schema);
  const reference = invalid.tables
    .find(({ name }) => name === 'SRC_Accused')
    .columns.find(({ name }) => name === 'CaseMasterRef');
  reference.parentTable = 'SRC_Missing';
  reference.onDelete = 'CASCADE';

  const errors = validateSchema(invalid, pdf);
  assert.ok(errors.some((error) => error.includes('parent SRC_Missing does not exist')));
  assert.ok(errors.some((error) => error.includes('must use onDelete NULL')));
});

test('validator reports missing PII classification', async () => {
  const schema = await loadJson('schema/catalyst/source-schema.json');
  const pdf = await loadJson('schema/catalyst/pdf-contract.json');
  const invalid = structuredClone(schema);
  delete invalid.tables
    .find(({ name }) => name === 'SRC_Victim')
    .columns.find(({ name }) => name === 'VictimName').pii;

  assert.ok(validateSchema(invalid, pdf)
    .some((error) => error.includes('SRC_Victim.VictimName must declare pii')));
});

test('console runbook is deterministic and covers every effective column', async () => {
  const schema = await loadJson('schema/catalyst/source-schema.json');
  const first = generateRunbook(schema);
  const second = generateRunbook(structuredClone(schema));

  assert.equal(first, second);
  assert.ok(!first.endsWith('\n\n'), 'runbook must contain exactly one final newline');
  assert.equal((first.match(/^## Create table:/gm) ?? []).length, 29);
  for (const table of schema.tables) {
    assert.match(first, new RegExp(`^## Create table: ${table.name}$`, 'm'));
    const effective = table.includeStandardSourceColumns
      ? [...schema.standardSourceColumns, ...table.columns]
      : table.columns;
    for (const column of effective) {
      assert.ok(first.includes(`\`${column.name}\``), `${table.name}.${column.name} missing`);
    }
  }
});

function buildCatalystTemplate(schema) {
  const datastore = [];
  for (const table of schema.tables) {
    datastore.push({
      type: 'table',
      name: table.name,
      properties: { table_name: table.name },
      dependsOn: [],
    });
    const columns = table.includeStandardSourceColumns
      ? [...schema.standardSourceColumns, ...table.columns]
      : table.columns;
    for (const column of columns) {
      datastore.push({
        type: 'column',
        name: `${table.name}-${column.name}`,
        properties: {
          audit_consent: column.pii ?? false,
          column_name: column.name,
          data_type: column.type === 'foreign_key' ? 'foreign key' : column.type,
          is_unique: column.unique ?? false,
          is_mandatory: column.mandatory,
          search_index_enabled: column.indexed ?? false,
          table_name: table.name,
          max_length: column.type === 'varchar' ? column.maxLength : undefined,
          default_value: column.default === undefined ? undefined : String(column.default),
          parent_table: column.parentTable,
          parent_column: column.type === 'foreign_key' ? 'ROWID' : undefined,
          constraint_type: column.type === 'foreign_key' ? 'ON-DELETE-SET-NULL' : undefined,
        },
        dependsOn: [],
      });
    }
  }
  return { components: { Datastore: datastore } };
}

test('Catalyst export comparer accepts an exact manifest projection', async () => {
  const schema = await loadJson('schema/catalyst/source-schema.json');
  assert.deepEqual(compareCatalystExport(schema, buildCatalystTemplate(schema)), []);
});

test('Catalyst export comparer reports missing and unexpected tables', async () => {
  const schema = await loadJson('schema/catalyst/source-schema.json');
  const template = buildCatalystTemplate(schema);
  template.components.Datastore = template.components.Datastore
    .filter(({ name }) => name !== 'SRC_Act');
  template.components.Datastore.push({
    type: 'table',
    name: 'UnexpectedTable',
    properties: { table_name: 'UnexpectedTable' },
  });

  const differences = compareCatalystExport(schema, template);
  assert.ok(differences.some((item) => item.includes('missing table SRC_Act')));
  assert.ok(differences.some((item) => item.includes('unexpected table UnexpectedTable')));
});

test('Catalyst export comparer reports column and constraint differences', async () => {
  const schema = await loadJson('schema/catalyst/source-schema.json');
  const template = buildCatalystTemplate(schema);
  const victimName = template.components.Datastore.find(
    ({ name }) => name === 'SRC_Victim-VictimName',
  );
  victimName.properties.data_type = 'text';
  victimName.properties.is_mandatory = false;
  victimName.properties.search_index_enabled = false;
  victimName.properties.audit_consent = false;
  victimName.properties.max_length = 12;
  const victimTableIndex = template.components.Datastore.findIndex(
    ({ name }) => name === 'SRC_Victim-VictimPolice',
  );
  template.components.Datastore.splice(victimTableIndex, 1);

  const differences = compareCatalystExport(schema, template);
  assert.ok(differences.some((item) => item.includes('missing column SRC_Victim.VictimPolice')));
  assert.ok(differences.some((item) => item.includes('SRC_Victim.VictimName data_type')));
  assert.ok(differences.some((item) => item.includes('SRC_Victim.VictimName is_mandatory')));
  assert.ok(differences.some((item) => item.includes('SRC_Victim.VictimName search_index_enabled')));
  assert.ok(differences.some((item) => item.includes('SRC_Victim.VictimName audit_consent')));
  assert.ok(differences.some((item) => item.includes('SRC_Victim.VictimName max_length')));
});

test('Catalyst export comparer reports wrong Foreign Key metadata', async () => {
  const schema = await loadJson('schema/catalyst/source-schema.json');
  const template = buildCatalystTemplate(schema);
  const caseReference = template.components.Datastore.find(
    ({ name }) => name === 'SRC_Accused-CaseMasterRef',
  );
  caseReference.properties.parent_table = 'SRC_State';
  caseReference.properties.parent_column = 'CREATORID';
  caseReference.properties.constraint_type = 'ON-DELETE-CASCADE';

  const differences = compareCatalystExport(schema, template);
  assert.ok(differences.some((item) => item.includes('SRC_Accused.CaseMasterRef parent_table')));
  assert.ok(differences.some((item) => item.includes('SRC_Accused.CaseMasterRef parent_column')));
  assert.ok(differences.some((item) => item.includes('SRC_Accused.CaseMasterRef constraint_type')));
});

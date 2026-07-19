import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateSchema } from '../../scripts/schema/validate-schema.mjs';
import { generateRunbook } from '../../scripts/schema/generate-console-runbook.mjs';

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

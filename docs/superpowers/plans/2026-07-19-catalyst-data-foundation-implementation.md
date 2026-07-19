# Catalyst Data Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create and verify the PDF-aligned FIR source schema and ingestion controls in the existing Catalyst Development project without losing original KSP-style identifiers.

**Architecture:** Git stores one machine-readable schema manifest as the authority for 26 PDF-defined `SRC_` tables and three `TRN_` ingestion-control tables. Local tests validate PDF fidelity, Catalyst constraints, relationship references, privacy settings and load order. Because Catalyst does not expose schema-creation APIs for an existing project, the tested manifest drives console creation, and an exported Catalyst project template is compared back to the manifest.

**Tech Stack:** Node.js 24, built-in `node:test`, JSON schema manifest, Catalyst CLI 1.27, Catalyst Data Store, Catalyst console browser automation

---

## Scope boundary

This plan creates:

- all 26 PDF-defined `SRC_` tables;
- original PDF columns;
- standard ingestion metadata columns;
- Catalyst `*Ref` Foreign Key columns;
- `TRN_IngestionBatch`, `TRN_RejectedRecord`, and `TRN_SourceKeyMap`;
- local validation, console runbook generation, Catalyst export inspection and challenge-alignment evidence.

This plan does not load FIR records, generate synthetic data, create intelligence/workflow tables, enable API Gateway, or deploy to Production.

## File structure

| File | Responsibility |
|---|---|
| `package.json` | Local schema validation/test commands; no runtime dependencies |
| `schema/catalyst/source-schema.json` | Authoritative table, column, reference, constraint and load-order manifest |
| `schema/catalyst/pdf-contract.json` | Immutable inventory of the 26 PDF tables and original columns |
| `scripts/schema/validate-schema.mjs` | Structural and Catalyst-rule validation |
| `scripts/schema/generate-console-runbook.mjs` | Deterministic table/column creation checklist from the manifest |
| `scripts/schema/compare-catalyst-export.mjs` | Compare Catalyst IaC export metadata with the manifest |
| `tests/schema/source-schema.test.mjs` | Automated fidelity, relationship, privacy and safety tests |
| `docs/runbooks/catalyst-datastore-creation.md` | Generated console creation/load-order runbook |
| `artifacts/catalyst-schema-export/` | Ignored location for extracted IaC export used during verification |
| `.gitignore` | Exclude local Catalyst linkage, exports, temporary files and credentials |

### Task 1: Establish the executable schema workspace

**Files:**
- Create: `package.json`
- Create: `.gitignore`
- Create: `tests/schema/source-schema.test.mjs`

- [ ] **Step 1: Write the failing workspace test**

Create `tests/schema/source-schema.test.mjs` with the first contract:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../../', import.meta.url);

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
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```powershell
node --test tests/schema/source-schema.test.mjs
```

Expected: FAIL with `ENOENT` for `schema/catalyst/source-schema.json`.

- [ ] **Step 3: Add project commands and ignore local state**

Create `package.json`:

```json
{
  "name": "ksp-crime-decision-intelligence",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test",
    "schema:validate": "node scripts/schema/validate-schema.mjs",
    "schema:runbook": "node scripts/schema/generate-console-runbook.mjs",
    "schema:compare": "node scripts/schema/compare-catalyst-export.mjs"
  },
  "engines": {
    "node": ">=24"
  }
}
```

Create `.gitignore`:

```gitignore
.catalystrc
node_modules/
tmp/
artifacts/catalyst-schema-export/
*.log
.env
.env.*
!.env.example
```

- [ ] **Step 4: Re-run the test and retain the expected failure**

Run `npm test`.

Expected: the same `ENOENT` failure; the manifest is intentionally created in Task 2.

- [ ] **Step 5: Commit the red test and workspace configuration**

```powershell
git add package.json .gitignore tests/schema/source-schema.test.mjs
git commit -m "test: define Catalyst schema workspace contract"
```

### Task 2: Encode the immutable PDF contract

**Files:**
- Create: `schema/catalyst/pdf-contract.json`
- Modify: `tests/schema/source-schema.test.mjs`

- [ ] **Step 1: Extend the test to require all 26 PDF tables**

Add:

```js
const expectedPdfTables = [
  'CaseMaster', 'ComplainantDetails', 'ActSectionAssociation', 'Victim',
  'Accused', 'ArrestSurrender', 'Act', 'Section', 'CrimeHeadActSection',
  'CrimeHead', 'CrimeSubHead', 'CasteMaster', 'ReligionMaster',
  'OccupationMaster', 'CaseStatusMaster', 'Court', 'District', 'State',
  'Unit', 'UnitType', 'Rank', 'Designation', 'Employee', 'CaseCategory',
  'GravityOffence', 'ChargesheetDetails'
];

test('PDF contract contains exactly the 26 defined tables', async () => {
  const contract = JSON.parse(await readFile(
    new URL('schema/catalyst/pdf-contract.json', root), 'utf8'
  ));
  assert.deepEqual(Object.keys(contract.tables), expectedPdfTables);
});
```

- [ ] **Step 2: Run and verify the test fails**

Run `npm test`.

Expected: FAIL because `pdf-contract.json` does not exist.

- [ ] **Step 3: Create the exact PDF contract**

Create `schema/catalyst/pdf-contract.json`. Use the table names and column arrays from Section 5 of `docs/superpowers/specs/2026-07-19-catalyst-physical-data-architecture-design.md`, preserving spelling and order. The top level must be:

```json
{
  "contractVersion": "police-fir-er-diagram-2026-06-10",
  "sourceDocument": "Police_FIR_ER_Diagram.pdf",
  "definedTableCount": 26,
  "undefinedReferences": ["Inv_OccuranceTime", "inv_arrestsurrenderaccused"],
  "tables": {
    "CaseMaster": ["CaseMasterID", "CrimeNo", "CaseNo", "CrimeRegisteredDate", "PolicePersonID", "PoliceStationID", "CaseCategoryID", "GravityOffenceID", "CrimeMajorHeadID", "CrimeMinorHeadID", "CaseStatusID", "CourtID", "IncidentFromDate", "IncidentToDate", "InfoReceivedPSDate", "latitude", "longitude", "BriefFacts"],
    "ComplainantDetails": ["ComplainantID", "CaseMasterID", "ComplainantName", "AgeYear", "OccupationID", "ReligionID", "CasteID", "GenderID"],
    "ActSectionAssociation": ["CaseMasterID", "ActID", "SectionID", "ActOrderID", "SectionOrderID"],
    "Victim": ["VictimMasterID", "CaseMasterID", "VictimName", "AgeYear", "GenderID", "VictimPolice"],
    "Accused": ["AccusedMasterID", "CaseMasterID", "AccusedName", "AgeYear", "GenderID", "PersonID"],
    "ArrestSurrender": ["ArrestSurrenderID", "CaseMasterID", "ArrestSurrenderTypeID", "ArrestSurrenderDate", "ArrestSurrenderStateId", "ArrestSurrenderDistrictId", "PoliceStationID", "IOID", "CourtID", "AccusedMasterID", "IsAccused", "IsComplainantAccused"],
    "Act": ["ActCode", "ActDescription", "ShortName", "Active"],
    "Section": ["ActCode", "SectionCode", "SectionDescription", "Active"],
    "CrimeHeadActSection": ["CrimeHeadID", "ActCode", "SectionCode"],
    "CrimeHead": ["CrimeHeadID", "CrimeGroupName", "Active"],
    "CrimeSubHead": ["CrimeSubHeadID", "CrimeHeadID", "CrimeHeadName", "SeqID"],
    "CasteMaster": ["caste_master_id", "caste_master_name"],
    "ReligionMaster": ["ReligionID", "ReligionName"],
    "OccupationMaster": ["OccupationID", "OccupationName"],
    "CaseStatusMaster": ["CaseStatusID", "CaseStatusName"],
    "Court": ["CourtID", "CourtName", "DistrictID", "StateID", "Active"],
    "District": ["DistrictID", "DistrictName", "StateID", "Active"],
    "State": ["StateID", "StateName", "NationalityID", "Active"],
    "Unit": ["UnitID", "UnitName", "TypeID", "ParentUnit", "NationalityID", "StateID", "DistrictID", "Active"],
    "UnitType": ["UnitTypeID", "UnitTypeName", "CityDistState", "Hierarchy", "Active"],
    "Rank": ["RankID", "RankName", "Hierarchy", "Active"],
    "Designation": ["DesignationID", "DesignationName", "Active", "SortOrder"],
    "Employee": ["EmployeeID", "DistrictID", "UnitID", "RankID", "DesignationID", "KGID", "FirstName", "EmployeeDOB", "GenderID", "BloodGroupID", "PhysicallyChallenged", "AppointmentDate"],
    "CaseCategory": ["CaseCategoryID", "LookupValue"],
    "GravityOffence": ["GravityOffenceID", "LookupValue"],
    "ChargesheetDetails": ["CSID", "CaseMasterID", "csdate", "cstype", "PolicePersonID"]
  }
}
```

- [ ] **Step 4: Run the tests**

Run `npm test`.

Expected: only the original manifest-existence test remains failing.

- [ ] **Step 5: Commit**

```powershell
git add schema/catalyst/pdf-contract.json tests/schema/source-schema.test.mjs
git commit -m "docs: encode immutable FIR PDF schema contract"
```

### Task 3: Build the Catalyst source-schema manifest

**Files:**
- Create: `schema/catalyst/source-schema.json`
- Modify: `tests/schema/source-schema.test.mjs`

- [ ] **Step 1: Add failing fidelity and safety tests**

Add tests that assert:

```js
const loadJson = async (path) => JSON.parse(await readFile(new URL(path, root), 'utf8'));

test('every PDF table maps to one SRC table with unchanged source columns', async () => {
  const pdf = await loadJson('schema/catalyst/pdf-contract.json');
  const schema = await loadJson('schema/catalyst/source-schema.json');
  const sourceTables = schema.tables.filter(({ zone }) => zone === 'SOURCE');
  assert.equal(sourceTables.length, 26);
  for (const [pdfName, pdfColumns] of Object.entries(pdf.tables)) {
    const table = sourceTables.find(({ sourceName }) => sourceName === pdfName);
    assert.ok(table, `missing SRC mapping for ${pdfName}`);
    const originalNames = table.columns.filter(({ origin }) => origin === 'PDF').map(({ name }) => name);
    assert.deepEqual(originalNames, pdfColumns, `${pdfName} source columns changed`);
  }
});

test('MVP tables enforce synthetic provenance', async () => {
  const schema = await loadJson('schema/catalyst/source-schema.json');
  for (const table of schema.tables.filter(({ zone }) => zone === 'SOURCE')) {
    const marker = table.columns.find(({ name }) => name === 'IsSynthetic');
    assert.deepEqual(
      { type: marker?.type, mandatory: marker?.mandatory, default: marker?.default },
      { type: 'boolean', mandatory: true, default: true }
    );
  }
});

test('risk architecture contains no individual prediction field', async () => {
  const schemaText = await readFile(new URL('schema/catalyst/source-schema.json', root), 'utf8');
  assert.doesNotMatch(schemaText, /recidivism|futureCrime|personRiskScore/i);
});
```

- [ ] **Step 2: Run and verify failure**

Run `npm test`.

Expected: FAIL because `source-schema.json` does not exist.

- [ ] **Step 3: Create the manifest header and policies**

Use this exact top-level shape:

```json
{
  "schemaVersion": "1.0.0",
  "projectId": "43492000000013049",
  "environment": "Development",
  "syntheticOnly": true,
  "defaultOnDelete": "NULL",
  "zones": ["SOURCE", "TRANSFORMATION"],
  "tables": []
}
```

For each of the 26 source mappings, define:

```json
{
  "name": "SRC_CaseMaster",
  "sourceName": "CaseMaster",
  "zone": "SOURCE",
  "loadOrder": 17,
  "columns": [
    { "name": "CaseMasterID", "origin": "PDF", "type": "int", "mandatory": true, "unique": true, "indexed": true, "pii": false },
    { "name": "CrimeNo", "origin": "PDF", "type": "varchar", "maxLength": 32, "mandatory": true, "unique": true, "indexed": true, "pii": false },
    { "name": "CaseNo", "origin": "PDF", "type": "varchar", "maxLength": 16, "mandatory": true, "unique": false, "indexed": true, "pii": false }
  ]
}
```

Encode all PDF columns using these deterministic rules:

- source PKs shown in the PDF: `mandatory=true`, `unique=true`, `indexed=true`;
- source FK/business IDs: `int`, indexed, not unique;
- names: `varchar(150)`, `pii=true` for complainant/victim/accused/employee names;
- descriptions and lookup values: `varchar(255)`;
- codes/identifiers (`CrimeNo`, `CaseNo`, `KGID`, `PersonID`, `ActCode`, `SectionCode`): `varchar`, indexed, with lengths 32, 16, 32, 32, 32 and 32 respectively;
- dates/timestamps: `date` or `datetime` exactly as the PDF specifies;
- `BriefFacts`: `text`, `pii=true`, not indexed;
- latitude/longitude: `double`, not indexed;
- PDF `BIT`: `boolean`;
- `cstype`: `varchar(1)`;
- age, hierarchy, sequence and order fields: `int`;
- preserve the PDF field spelling, including lowercase `latitude`, `longitude`, `csdate`, `cstype`, `caste_master_id`, and `caste_master_name`.

Add these columns to every source table with `origin="SYSTEM"`:

```json
[
  { "name": "SourceBatchRef", "origin": "SYSTEM", "type": "foreign_key", "parentTable": "TRN_IngestionBatch", "mandatory": true, "onDelete": "NULL" },
  { "name": "SourceFileName", "origin": "SYSTEM", "type": "varchar", "maxLength": 255, "mandatory": true, "indexed": false, "pii": false },
  { "name": "SourceRowNumber", "origin": "SYSTEM", "type": "int", "mandatory": true, "indexed": false, "pii": false },
  { "name": "SourceSchemaVersion", "origin": "SYSTEM", "type": "varchar", "maxLength": 32, "mandatory": true, "indexed": true, "pii": false },
  { "name": "IsSynthetic", "origin": "SYSTEM", "type": "boolean", "mandatory": true, "default": true, "indexed": true, "pii": false },
  { "name": "SourceRecordHash", "origin": "SYSTEM", "type": "varchar", "maxLength": 64, "mandatory": true, "unique": false, "indexed": true, "pii": false },
  { "name": "ValidationStatus", "origin": "SYSTEM", "type": "varchar", "maxLength": 16, "mandatory": true, "default": "ACCEPTED", "indexed": true, "pii": false }
]
```

Add every `*Ref` relation listed in Section 7 of the approved physical-data design. Each uses `type="foreign_key"`, the named `parentTable`, `mandatory=false`, and `onDelete="NULL"`. Do not create Foreign Keys to the missing gender, blood group, nationality or arrest-type lookup tables.

- [ ] **Step 4: Add the three control tables**

Define:

```json
{
  "name": "TRN_IngestionBatch",
  "zone": "TRANSFORMATION",
  "loadOrder": 1,
  "columns": [
    { "name": "BatchID", "type": "varchar", "maxLength": 36, "mandatory": true, "unique": true, "indexed": true },
    { "name": "SchemaVersion", "type": "varchar", "maxLength": 32, "mandatory": true, "indexed": true },
    { "name": "ManifestHash", "type": "varchar", "maxLength": 64, "mandatory": true, "indexed": true },
    { "name": "Status", "type": "varchar", "maxLength": 16, "mandatory": true, "indexed": true },
    { "name": "SourceFileCount", "type": "int", "mandatory": true },
    { "name": "SourceRowCount", "type": "int", "mandatory": true },
    { "name": "AcceptedRowCount", "type": "int", "mandatory": true },
    { "name": "WarningRowCount", "type": "int", "mandatory": true },
    { "name": "RejectedRowCount", "type": "int", "mandatory": true },
    { "name": "StartedAt", "type": "datetime", "mandatory": true },
    { "name": "CompletedAt", "type": "datetime", "mandatory": false },
    { "name": "IsSynthetic", "type": "boolean", "mandatory": true, "default": true, "indexed": true }
  ]
}
```

`TRN_RejectedRecord` contains `RejectedRecordID varchar(36) unique`, `BatchRef foreign_key`, `SourceFileName varchar(255)`, `SourceRowNumber int`, `SourceEntity varchar(64)`, `ReasonCode varchar(64)`, `ReasonDetail varchar(255)`, `PayloadObjectPath varchar(255)`, `RejectedAt datetime`, and mandatory `IsSynthetic boolean=true`.

`TRN_SourceKeyMap` contains `MappingID varchar(36) unique`, `BatchRef foreign_key`, `SourceEntity varchar(64)`, `SourceBusinessKey varchar(255)`, `CatalystTable varchar(64)`, `CatalystROWID bigint`, `SourceRecordHash varchar(64)`, `MappingStatus varchar(16)`, and mandatory `IsSynthetic boolean=true`. Enforce logical uniqueness in validation for `(SourceEntity, SourceBusinessKey)` because Catalyst provides single-column uniqueness only.

- [ ] **Step 5: Run tests and commit**

Run `npm test`.

Expected: all current tests PASS.

```powershell
git add schema/catalyst/source-schema.json tests/schema/source-schema.test.mjs
git commit -m "feat: define Catalyst FIR source schema manifest"
```

### Task 4: Implement strict manifest validation

**Files:**
- Create: `scripts/schema/validate-schema.mjs`
- Modify: `tests/schema/source-schema.test.mjs`

- [ ] **Step 1: Add failing validator tests**

Test exported `validateSchema(schema, pdfContract)` using mutated copies for duplicate table names, missing PDF columns, invalid parent tables, illegal Catalyst names, missing PII flags and `cascade` deletion.

```js
test('all foreign-key parents exist and source deletion never cascades', async () => {
  const schema = await loadJson('schema/catalyst/source-schema.json');
  const names = new Set(schema.tables.map(({ name }) => name));
  for (const table of schema.tables) {
    for (const column of table.columns.filter(({ type }) => type === 'foreign_key')) {
      assert.ok(names.has(column.parentTable), `${table.name}.${column.name} parent missing`);
      assert.equal(column.onDelete, 'NULL', `${table.name}.${column.name} must preserve auditability`);
    }
  }
});
```

- [ ] **Step 2: Run and verify the new mutation tests fail**

Expected: FAIL because the validator module is absent.

- [ ] **Step 3: Implement validator and CLI**

The validator must return all errors rather than stopping at the first. The CLI prints each error and exits 1, or prints this exact success line and exits 0:

```text
PASS: 29 Catalyst tables, 26 PDF mappings, and all relationships are valid.
```

- [ ] **Step 4: Run verification**

```powershell
npm test
npm run schema:validate
```

Expected: all tests PASS and the exact 29-table success line appears.

- [ ] **Step 5: Commit**

```powershell
git add scripts/schema/validate-schema.mjs tests/schema/source-schema.test.mjs
git commit -m "test: enforce Catalyst schema integrity"
```

### Task 5: Generate the deterministic console runbook

**Files:**
- Create: `scripts/schema/generate-console-runbook.mjs`
- Create: `docs/runbooks/catalyst-datastore-creation.md`
- Modify: `tests/schema/source-schema.test.mjs`

- [ ] **Step 1: Write a failing deterministic-output test**

Run the generator twice in a temporary directory and assert byte-for-byte equality. Assert that the runbook contains 29 `Create table` headings and that every manifest column appears under its table.

- [ ] **Step 2: Run and verify failure**

Expected: FAIL because the generator does not exist.

- [ ] **Step 3: Implement the generator**

Sort by `loadOrder`, then table name. For each table emit:

```markdown
## Create table: TRN_IngestionBatch

| Order | Column | Catalyst type | Mandatory | Unique | Search index | PII | Default | Parent | On delete |
|---:|---|---|---|---|---|---|---|---|---|
```

Foreign-key columns must appear only after their parent table's creation step. End the runbook with a checklist that records table ID, observed column count, operator, timestamp and evidence screenshot/export path.

- [ ] **Step 4: Generate and verify**

```powershell
npm run schema:runbook
npm test
```

Expected: runbook generated; all tests PASS.

- [ ] **Step 5: Commit**

```powershell
git add scripts/schema/generate-console-runbook.mjs docs/runbooks/catalyst-datastore-creation.md tests/schema/source-schema.test.mjs
git commit -m "docs: generate Catalyst Data Store creation runbook"
```

### Task 6: Create the schema in Catalyst Development

**Files:**
- Modify: Catalyst Development Data Store only
- Evidence: `artifacts/catalyst-schema-export/`

- [ ] **Step 1: Confirm safety preconditions**

Run:

```powershell
catalyst.cmd whoami
npm run schema:validate
git status --short
```

Expected account: `aman.tech@zohomail.in`. Expected environment in `.catalystrc`: `Development`. Schema validation must PASS. Stop if any existing table name conflicts with the manifest.

- [ ] **Step 2: Create tables without relationship columns**

Using the current Catalyst console and generated runbook, create tables in load order. Create native columns first, excluding `foreign_key` columns. Record each Catalyst table ID.

- [ ] **Step 3: Create Foreign Key columns**

After all parent tables exist, add every `foreign_key` column with the exact parent and `On Delete = Null`. Do not use Cascade.

- [ ] **Step 4: Verify console counts immediately**

Expected: 29 application tables. For each table, compare the console column list against the runbook. Catalyst's four default columns are additional and must not be counted as manifest columns.

- [ ] **Step 5: Stop on any mismatch**

Do not rename or delete an unexpected table without explicit user approval. Record the mismatch, export current metadata, and correct the manifest or console only after identifying which is authoritative.

### Task 7: Compare the Catalyst export with Git authority

**Files:**
- Create: `scripts/schema/compare-catalyst-export.mjs`
- Modify: `tests/schema/source-schema.test.mjs`
- Evidence: extracted Catalyst `project-template.json`

- [ ] **Step 1: Write failing comparison tests**

Fixtures must cover missing table, missing column, wrong type, wrong mandatory/unique/index/PII setting, wrong FK parent and unexpected extra table. The comparer returns a sorted difference list.

- [ ] **Step 2: Run and verify failure**

Expected: FAIL because the comparer does not exist.

- [ ] **Step 3: Implement comparison**

Parse the `components.Datastore` entries from Catalyst's `project-template.json`. Normalize Catalyst type names and ignore its four default columns. Print either all differences and exit 1 or:

```text
PASS: Catalyst Development schema matches source-schema.json.
```

- [ ] **Step 4: Export the existing project configuration**

Use `catalyst.cmd iac:export` from the linked project. Extract the resulting ZIP under `artifacts/catalyst-schema-export/`. Do not commit the ZIP or extracted files.

- [ ] **Step 5: Compare and test**

```powershell
npm test
npm run schema:compare -- artifacts/catalyst-schema-export/project-template.json
```

Expected: all tests PASS and exact Catalyst comparison PASS line.

- [ ] **Step 6: Commit the comparer**

```powershell
git add scripts/schema/compare-catalyst-export.mjs tests/schema/source-schema.test.mjs
git commit -m "test: verify deployed Catalyst Data Store schema"
```

### Task 8: Run the challenge-alignment and completion gates

**Files:**
- Create: `docs/reviews/2026-07-19-catalyst-data-foundation.md`
- Modify: `docs/PROJECT_MEMORY.md`

- [ ] **Step 1: Run complete verification**

```powershell
npm test
npm run schema:validate
npm run schema:runbook
npm run schema:compare -- artifacts/catalyst-schema-export/project-template.json
powershell.exe -NoProfile -ExecutionPolicy Bypass -File skills/reviewing-challenge-alignment/scripts/check-required-files.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File skills/reviewing-challenge-alignment/tests/test-skill-contract.ps1
git diff --check
```

Expected: every command exits 0. No completion claim is permitted otherwise.

- [ ] **Step 2: Apply the alignment review contract**

Use `skills/reviewing-challenge-alignment/references/output-template.md` exactly. Require PASS for PDF fidelity, synthetic labels, observable rejected records, Catalyst-native services, authorization foundations and evidence drilldown. A WARN or FAIL blocks push and any production deployment.

- [ ] **Step 3: Record the verified state**

Update project memory with the 29 created Development tables, manifest version, export comparison result and the fact that no records or production resources were created.

- [ ] **Step 4: Commit documentation evidence**

```powershell
git add docs/reviews/2026-07-19-catalyst-data-foundation.md docs/PROJECT_MEMORY.md
git commit -m "docs: record verified Catalyst data foundation"
```

- [ ] **Step 5: Do not push automatically**

Show the user the commits, alignment verdict, test evidence and current `git status`. Push only after explicit user approval.

## Plan self-review

- Spec coverage: covers PDF preservation, Catalyst `ROWID` references, ingestion controls, validation, rejection observability, synthetic labels, cost-conscious non-duplication, creation order and verification.
- Scope: limited to the source data foundation; synthetic records, analytics and application features are separate implementation plans.
- Placeholder scan: no implementation placeholders are permitted.
- Type consistency: the manifest is the single source consumed by validator, runbook and export comparer.
- Safety: Development only; no table deletion, production deployment, API Gateway change, or real-person data.

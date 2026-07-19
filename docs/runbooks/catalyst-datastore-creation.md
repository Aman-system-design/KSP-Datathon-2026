# Catalyst Data Store Creation Runbook

**Manifest version:** 1.0.0

**Project ID:** 43492000000013049

**Environment:** Development

> Create only in Development. Do not load real police data. All MVP data is synthetic.

## Phase A - Create tables and native columns

Create tables in the order shown. Catalyst automatically adds ROWID, CREATORID, CREATEDTIME, and MODIFIEDTIME; do not recreate them.

## Create table: TRN_IngestionBatch

- Zone: TRANSFORMATION
- Load order: 1
- PDF source: Not PDF-defined

| Order | Column | Catalyst type | Max length | Mandatory | Unique | Search index | PII/ePHI | Default |
|---:|---|---|---:|---|---|---|---|---|
| 1 | `BatchID` | Var Char | 36 | Yes | Yes | Yes | No | - |
| 2 | `SchemaVersion` | Var Char | 32 | Yes | No | Yes | No | - |
| 3 | `ManifestHash` | Var Char | 64 | Yes | No | Yes | No | - |
| 4 | `Status` | Var Char | 16 | Yes | No | Yes | No | - |
| 5 | `SourceFileCount` | Int | - | Yes | No | No | No | - |
| 6 | `SourceRowCount` | Int | - | Yes | No | No | No | - |
| 7 | `AcceptedRowCount` | Int | - | Yes | No | No | No | - |
| 8 | `WarningRowCount` | Int | - | Yes | No | No | No | - |
| 9 | `RejectedRowCount` | Int | - | Yes | No | No | No | - |
| 10 | `StartedAt` | DateTime | - | Yes | No | Yes | No | - |
| 11 | `CompletedAt` | DateTime | - | No | No | No | No | - |
| 12 | `IsSynthetic` | Boolean | - | Yes | No | Yes | No | Yes |

## Create table: TRN_RejectedRecord

- Zone: TRANSFORMATION
- Load order: 2
- PDF source: Not PDF-defined

| Order | Column | Catalyst type | Max length | Mandatory | Unique | Search index | PII/ePHI | Default |
|---:|---|---|---:|---|---|---|---|---|
| 1 | `RejectedRecordID` | Var Char | 36 | Yes | Yes | Yes | No | - |
| 2 | `SourceFileName` | Var Char | 255 | Yes | No | No | No | - |
| 3 | `SourceRowNumber` | Int | - | Yes | No | No | No | - |
| 4 | `SourceEntity` | Var Char | 64 | Yes | No | Yes | No | - |
| 5 | `ReasonCode` | Var Char | 64 | Yes | No | Yes | No | - |
| 6 | `ReasonDetail` | Var Char | 255 | Yes | No | No | No | - |
| 7 | `PayloadObjectPath` | Var Char | 255 | No | No | No | No | - |
| 8 | `RejectedAt` | DateTime | - | Yes | No | Yes | No | - |
| 9 | `IsSynthetic` | Boolean | - | Yes | No | Yes | No | Yes |

## Create table: TRN_SourceKeyMap

- Zone: TRANSFORMATION
- Load order: 2
- PDF source: Not PDF-defined

| Order | Column | Catalyst type | Max length | Mandatory | Unique | Search index | PII/ePHI | Default |
|---:|---|---|---:|---|---|---|---|---|
| 1 | `MappingID` | Var Char | 36 | Yes | Yes | Yes | No | - |
| 2 | `SourceEntity` | Var Char | 64 | Yes | No | Yes | No | - |
| 3 | `SourceBusinessKey` | Var Char | 255 | Yes | No | Yes | No | - |
| 4 | `CatalystTable` | Var Char | 64 | Yes | No | Yes | No | - |
| 5 | `CatalystROWID` | BigInt | - | Yes | No | Yes | No | - |
| 6 | `SourceRecordHash` | Var Char | 64 | Yes | No | Yes | No | - |
| 7 | `MappingStatus` | Var Char | 16 | Yes | No | Yes | No | - |
| 8 | `IsSynthetic` | Boolean | - | Yes | No | Yes | No | Yes |

## Create table: SRC_Act

- Zone: SOURCE
- Load order: 10
- PDF source: Act

| Order | Column | Catalyst type | Max length | Mandatory | Unique | Search index | PII/ePHI | Default |
|---:|---|---|---:|---|---|---|---|---|
| 1 | `SourceFileName` | Var Char | 255 | Yes | No | No | No | - |
| 2 | `SourceRowNumber` | Int | - | Yes | No | No | No | - |
| 3 | `SourceSchemaVersion` | Var Char | 32 | Yes | No | Yes | No | - |
| 4 | `IsSynthetic` | Boolean | - | Yes | No | Yes | No | Yes |
| 5 | `SourceRecordHash` | Var Char | 64 | Yes | No | Yes | No | - |
| 6 | `ValidationStatus` | Var Char | 16 | Yes | No | Yes | No | ACCEPTED |
| 7 | `ActCode` | Var Char | 32 | Yes | Yes | Yes | No | - |
| 8 | `ActDescription` | Var Char | 255 | Yes | No | No | No | - |
| 9 | `ShortName` | Var Char | 64 | Yes | No | Yes | No | - |
| 10 | `Active` | Boolean | - | Yes | No | Yes | No | - |

## Create table: SRC_CaseCategory

- Zone: SOURCE
- Load order: 10
- PDF source: CaseCategory

| Order | Column | Catalyst type | Max length | Mandatory | Unique | Search index | PII/ePHI | Default |
|---:|---|---|---:|---|---|---|---|---|
| 1 | `SourceFileName` | Var Char | 255 | Yes | No | No | No | - |
| 2 | `SourceRowNumber` | Int | - | Yes | No | No | No | - |
| 3 | `SourceSchemaVersion` | Var Char | 32 | Yes | No | Yes | No | - |
| 4 | `IsSynthetic` | Boolean | - | Yes | No | Yes | No | Yes |
| 5 | `SourceRecordHash` | Var Char | 64 | Yes | No | Yes | No | - |
| 6 | `ValidationStatus` | Var Char | 16 | Yes | No | Yes | No | ACCEPTED |
| 7 | `CaseCategoryID` | Int | - | Yes | Yes | Yes | No | - |
| 8 | `LookupValue` | Var Char | 255 | Yes | No | Yes | No | - |

## Create table: SRC_CaseStatusMaster

- Zone: SOURCE
- Load order: 10
- PDF source: CaseStatusMaster

| Order | Column | Catalyst type | Max length | Mandatory | Unique | Search index | PII/ePHI | Default |
|---:|---|---|---:|---|---|---|---|---|
| 1 | `SourceFileName` | Var Char | 255 | Yes | No | No | No | - |
| 2 | `SourceRowNumber` | Int | - | Yes | No | No | No | - |
| 3 | `SourceSchemaVersion` | Var Char | 32 | Yes | No | Yes | No | - |
| 4 | `IsSynthetic` | Boolean | - | Yes | No | Yes | No | Yes |
| 5 | `SourceRecordHash` | Var Char | 64 | Yes | No | Yes | No | - |
| 6 | `ValidationStatus` | Var Char | 16 | Yes | No | Yes | No | ACCEPTED |
| 7 | `CaseStatusID` | Int | - | Yes | Yes | Yes | No | - |
| 8 | `CaseStatusName` | Var Char | 150 | Yes | No | Yes | No | - |

## Create table: SRC_CasteMaster

- Zone: SOURCE
- Load order: 10
- PDF source: CasteMaster

| Order | Column | Catalyst type | Max length | Mandatory | Unique | Search index | PII/ePHI | Default |
|---:|---|---|---:|---|---|---|---|---|
| 1 | `SourceFileName` | Var Char | 255 | Yes | No | No | No | - |
| 2 | `SourceRowNumber` | Int | - | Yes | No | No | No | - |
| 3 | `SourceSchemaVersion` | Var Char | 32 | Yes | No | Yes | No | - |
| 4 | `IsSynthetic` | Boolean | - | Yes | No | Yes | No | Yes |
| 5 | `SourceRecordHash` | Var Char | 64 | Yes | No | Yes | No | - |
| 6 | `ValidationStatus` | Var Char | 16 | Yes | No | Yes | No | ACCEPTED |
| 7 | `caste_master_id` | Int | - | Yes | Yes | Yes | No | - |
| 8 | `caste_master_name` | Var Char | 150 | Yes | No | Yes | No | - |

## Create table: SRC_CrimeHead

- Zone: SOURCE
- Load order: 10
- PDF source: CrimeHead

| Order | Column | Catalyst type | Max length | Mandatory | Unique | Search index | PII/ePHI | Default |
|---:|---|---|---:|---|---|---|---|---|
| 1 | `SourceFileName` | Var Char | 255 | Yes | No | No | No | - |
| 2 | `SourceRowNumber` | Int | - | Yes | No | No | No | - |
| 3 | `SourceSchemaVersion` | Var Char | 32 | Yes | No | Yes | No | - |
| 4 | `IsSynthetic` | Boolean | - | Yes | No | Yes | No | Yes |
| 5 | `SourceRecordHash` | Var Char | 64 | Yes | No | Yes | No | - |
| 6 | `ValidationStatus` | Var Char | 16 | Yes | No | Yes | No | ACCEPTED |
| 7 | `CrimeHeadID` | Int | - | Yes | Yes | Yes | No | - |
| 8 | `CrimeGroupName` | Var Char | 150 | Yes | No | Yes | No | - |
| 9 | `Active` | Boolean | - | Yes | No | Yes | No | - |

## Create table: SRC_Designation

- Zone: SOURCE
- Load order: 10
- PDF source: Designation

| Order | Column | Catalyst type | Max length | Mandatory | Unique | Search index | PII/ePHI | Default |
|---:|---|---|---:|---|---|---|---|---|
| 1 | `SourceFileName` | Var Char | 255 | Yes | No | No | No | - |
| 2 | `SourceRowNumber` | Int | - | Yes | No | No | No | - |
| 3 | `SourceSchemaVersion` | Var Char | 32 | Yes | No | Yes | No | - |
| 4 | `IsSynthetic` | Boolean | - | Yes | No | Yes | No | Yes |
| 5 | `SourceRecordHash` | Var Char | 64 | Yes | No | Yes | No | - |
| 6 | `ValidationStatus` | Var Char | 16 | Yes | No | Yes | No | ACCEPTED |
| 7 | `DesignationID` | Int | - | Yes | Yes | Yes | No | - |
| 8 | `DesignationName` | Var Char | 150 | Yes | No | Yes | No | - |
| 9 | `Active` | Boolean | - | Yes | No | Yes | No | - |
| 10 | `SortOrder` | Int | - | No | No | No | No | - |

## Create table: SRC_GravityOffence

- Zone: SOURCE
- Load order: 10
- PDF source: GravityOffence

| Order | Column | Catalyst type | Max length | Mandatory | Unique | Search index | PII/ePHI | Default |
|---:|---|---|---:|---|---|---|---|---|
| 1 | `SourceFileName` | Var Char | 255 | Yes | No | No | No | - |
| 2 | `SourceRowNumber` | Int | - | Yes | No | No | No | - |
| 3 | `SourceSchemaVersion` | Var Char | 32 | Yes | No | Yes | No | - |
| 4 | `IsSynthetic` | Boolean | - | Yes | No | Yes | No | Yes |
| 5 | `SourceRecordHash` | Var Char | 64 | Yes | No | Yes | No | - |
| 6 | `ValidationStatus` | Var Char | 16 | Yes | No | Yes | No | ACCEPTED |
| 7 | `GravityOffenceID` | Int | - | Yes | Yes | Yes | No | - |
| 8 | `LookupValue` | Var Char | 255 | Yes | No | Yes | No | - |

## Create table: SRC_OccupationMaster

- Zone: SOURCE
- Load order: 10
- PDF source: OccupationMaster

| Order | Column | Catalyst type | Max length | Mandatory | Unique | Search index | PII/ePHI | Default |
|---:|---|---|---:|---|---|---|---|---|
| 1 | `SourceFileName` | Var Char | 255 | Yes | No | No | No | - |
| 2 | `SourceRowNumber` | Int | - | Yes | No | No | No | - |
| 3 | `SourceSchemaVersion` | Var Char | 32 | Yes | No | Yes | No | - |
| 4 | `IsSynthetic` | Boolean | - | Yes | No | Yes | No | Yes |
| 5 | `SourceRecordHash` | Var Char | 64 | Yes | No | Yes | No | - |
| 6 | `ValidationStatus` | Var Char | 16 | Yes | No | Yes | No | ACCEPTED |
| 7 | `OccupationID` | Int | - | Yes | Yes | Yes | No | - |
| 8 | `OccupationName` | Var Char | 150 | Yes | No | Yes | No | - |

## Create table: SRC_Rank

- Zone: SOURCE
- Load order: 10
- PDF source: Rank

| Order | Column | Catalyst type | Max length | Mandatory | Unique | Search index | PII/ePHI | Default |
|---:|---|---|---:|---|---|---|---|---|
| 1 | `SourceFileName` | Var Char | 255 | Yes | No | No | No | - |
| 2 | `SourceRowNumber` | Int | - | Yes | No | No | No | - |
| 3 | `SourceSchemaVersion` | Var Char | 32 | Yes | No | Yes | No | - |
| 4 | `IsSynthetic` | Boolean | - | Yes | No | Yes | No | Yes |
| 5 | `SourceRecordHash` | Var Char | 64 | Yes | No | Yes | No | - |
| 6 | `ValidationStatus` | Var Char | 16 | Yes | No | Yes | No | ACCEPTED |
| 7 | `RankID` | Int | - | Yes | Yes | Yes | No | - |
| 8 | `RankName` | Var Char | 150 | Yes | No | Yes | No | - |
| 9 | `Hierarchy` | Int | - | Yes | No | Yes | No | - |
| 10 | `Active` | Boolean | - | Yes | No | Yes | No | - |

## Create table: SRC_ReligionMaster

- Zone: SOURCE
- Load order: 10
- PDF source: ReligionMaster

| Order | Column | Catalyst type | Max length | Mandatory | Unique | Search index | PII/ePHI | Default |
|---:|---|---|---:|---|---|---|---|---|
| 1 | `SourceFileName` | Var Char | 255 | Yes | No | No | No | - |
| 2 | `SourceRowNumber` | Int | - | Yes | No | No | No | - |
| 3 | `SourceSchemaVersion` | Var Char | 32 | Yes | No | Yes | No | - |
| 4 | `IsSynthetic` | Boolean | - | Yes | No | Yes | No | Yes |
| 5 | `SourceRecordHash` | Var Char | 64 | Yes | No | Yes | No | - |
| 6 | `ValidationStatus` | Var Char | 16 | Yes | No | Yes | No | ACCEPTED |
| 7 | `ReligionID` | Int | - | Yes | Yes | Yes | No | - |
| 8 | `ReligionName` | Var Char | 150 | Yes | No | Yes | No | - |

## Create table: SRC_State

- Zone: SOURCE
- Load order: 10
- PDF source: State

| Order | Column | Catalyst type | Max length | Mandatory | Unique | Search index | PII/ePHI | Default |
|---:|---|---|---:|---|---|---|---|---|
| 1 | `SourceFileName` | Var Char | 255 | Yes | No | No | No | - |
| 2 | `SourceRowNumber` | Int | - | Yes | No | No | No | - |
| 3 | `SourceSchemaVersion` | Var Char | 32 | Yes | No | Yes | No | - |
| 4 | `IsSynthetic` | Boolean | - | Yes | No | Yes | No | Yes |
| 5 | `SourceRecordHash` | Var Char | 64 | Yes | No | Yes | No | - |
| 6 | `ValidationStatus` | Var Char | 16 | Yes | No | Yes | No | ACCEPTED |
| 7 | `StateID` | Int | - | Yes | Yes | Yes | No | - |
| 8 | `StateName` | Var Char | 150 | Yes | No | Yes | No | - |
| 9 | `NationalityID` | Int | - | No | No | Yes | No | - |
| 10 | `Active` | Boolean | - | Yes | No | Yes | No | - |

## Create table: SRC_UnitType

- Zone: SOURCE
- Load order: 10
- PDF source: UnitType

| Order | Column | Catalyst type | Max length | Mandatory | Unique | Search index | PII/ePHI | Default |
|---:|---|---|---:|---|---|---|---|---|
| 1 | `SourceFileName` | Var Char | 255 | Yes | No | No | No | - |
| 2 | `SourceRowNumber` | Int | - | Yes | No | No | No | - |
| 3 | `SourceSchemaVersion` | Var Char | 32 | Yes | No | Yes | No | - |
| 4 | `IsSynthetic` | Boolean | - | Yes | No | Yes | No | Yes |
| 5 | `SourceRecordHash` | Var Char | 64 | Yes | No | Yes | No | - |
| 6 | `ValidationStatus` | Var Char | 16 | Yes | No | Yes | No | ACCEPTED |
| 7 | `UnitTypeID` | Int | - | Yes | Yes | Yes | No | - |
| 8 | `UnitTypeName` | Var Char | 150 | Yes | No | Yes | No | - |
| 9 | `CityDistState` | Var Char | 32 | No | No | Yes | No | - |
| 10 | `Hierarchy` | Int | - | Yes | No | Yes | No | - |
| 11 | `Active` | Boolean | - | Yes | No | Yes | No | - |

## Create table: SRC_CrimeSubHead

- Zone: SOURCE
- Load order: 20
- PDF source: CrimeSubHead

| Order | Column | Catalyst type | Max length | Mandatory | Unique | Search index | PII/ePHI | Default |
|---:|---|---|---:|---|---|---|---|---|
| 1 | `SourceFileName` | Var Char | 255 | Yes | No | No | No | - |
| 2 | `SourceRowNumber` | Int | - | Yes | No | No | No | - |
| 3 | `SourceSchemaVersion` | Var Char | 32 | Yes | No | Yes | No | - |
| 4 | `IsSynthetic` | Boolean | - | Yes | No | Yes | No | Yes |
| 5 | `SourceRecordHash` | Var Char | 64 | Yes | No | Yes | No | - |
| 6 | `ValidationStatus` | Var Char | 16 | Yes | No | Yes | No | ACCEPTED |
| 7 | `CrimeSubHeadID` | Int | - | Yes | Yes | Yes | No | - |
| 8 | `CrimeHeadID` | Int | - | Yes | No | Yes | No | - |
| 9 | `CrimeHeadName` | Var Char | 150 | Yes | No | Yes | No | - |
| 10 | `SeqID` | Int | - | No | No | No | No | - |

## Create table: SRC_District

- Zone: SOURCE
- Load order: 20
- PDF source: District

| Order | Column | Catalyst type | Max length | Mandatory | Unique | Search index | PII/ePHI | Default |
|---:|---|---|---:|---|---|---|---|---|
| 1 | `SourceFileName` | Var Char | 255 | Yes | No | No | No | - |
| 2 | `SourceRowNumber` | Int | - | Yes | No | No | No | - |
| 3 | `SourceSchemaVersion` | Var Char | 32 | Yes | No | Yes | No | - |
| 4 | `IsSynthetic` | Boolean | - | Yes | No | Yes | No | Yes |
| 5 | `SourceRecordHash` | Var Char | 64 | Yes | No | Yes | No | - |
| 6 | `ValidationStatus` | Var Char | 16 | Yes | No | Yes | No | ACCEPTED |
| 7 | `DistrictID` | Int | - | Yes | Yes | Yes | No | - |
| 8 | `DistrictName` | Var Char | 150 | Yes | No | Yes | No | - |
| 9 | `StateID` | Int | - | Yes | No | Yes | No | - |
| 10 | `Active` | Boolean | - | Yes | No | Yes | No | - |

## Create table: SRC_Section

- Zone: SOURCE
- Load order: 20
- PDF source: Section

| Order | Column | Catalyst type | Max length | Mandatory | Unique | Search index | PII/ePHI | Default |
|---:|---|---|---:|---|---|---|---|---|
| 1 | `SourceFileName` | Var Char | 255 | Yes | No | No | No | - |
| 2 | `SourceRowNumber` | Int | - | Yes | No | No | No | - |
| 3 | `SourceSchemaVersion` | Var Char | 32 | Yes | No | Yes | No | - |
| 4 | `IsSynthetic` | Boolean | - | Yes | No | Yes | No | Yes |
| 5 | `SourceRecordHash` | Var Char | 64 | Yes | No | Yes | No | - |
| 6 | `ValidationStatus` | Var Char | 16 | Yes | No | Yes | No | ACCEPTED |
| 7 | `ActCode` | Var Char | 32 | Yes | No | Yes | No | - |
| 8 | `SectionCode` | Var Char | 32 | Yes | No | Yes | No | - |
| 9 | `SectionDescription` | Var Char | 255 | Yes | No | No | No | - |
| 10 | `Active` | Boolean | - | Yes | No | Yes | No | - |

## Create table: SRC_Court

- Zone: SOURCE
- Load order: 30
- PDF source: Court

| Order | Column | Catalyst type | Max length | Mandatory | Unique | Search index | PII/ePHI | Default |
|---:|---|---|---:|---|---|---|---|---|
| 1 | `SourceFileName` | Var Char | 255 | Yes | No | No | No | - |
| 2 | `SourceRowNumber` | Int | - | Yes | No | No | No | - |
| 3 | `SourceSchemaVersion` | Var Char | 32 | Yes | No | Yes | No | - |
| 4 | `IsSynthetic` | Boolean | - | Yes | No | Yes | No | Yes |
| 5 | `SourceRecordHash` | Var Char | 64 | Yes | No | Yes | No | - |
| 6 | `ValidationStatus` | Var Char | 16 | Yes | No | Yes | No | ACCEPTED |
| 7 | `CourtID` | Int | - | Yes | Yes | Yes | No | - |
| 8 | `CourtName` | Var Char | 150 | Yes | No | Yes | No | - |
| 9 | `DistrictID` | Int | - | Yes | No | Yes | No | - |
| 10 | `StateID` | Int | - | Yes | No | Yes | No | - |
| 11 | `Active` | Boolean | - | Yes | No | Yes | No | - |

## Create table: SRC_CrimeHeadActSection

- Zone: SOURCE
- Load order: 30
- PDF source: CrimeHeadActSection

| Order | Column | Catalyst type | Max length | Mandatory | Unique | Search index | PII/ePHI | Default |
|---:|---|---|---:|---|---|---|---|---|
| 1 | `SourceFileName` | Var Char | 255 | Yes | No | No | No | - |
| 2 | `SourceRowNumber` | Int | - | Yes | No | No | No | - |
| 3 | `SourceSchemaVersion` | Var Char | 32 | Yes | No | Yes | No | - |
| 4 | `IsSynthetic` | Boolean | - | Yes | No | Yes | No | Yes |
| 5 | `SourceRecordHash` | Var Char | 64 | Yes | No | Yes | No | - |
| 6 | `ValidationStatus` | Var Char | 16 | Yes | No | Yes | No | ACCEPTED |
| 7 | `CrimeHeadID` | Int | - | Yes | No | Yes | No | - |
| 8 | `ActCode` | Var Char | 32 | Yes | No | Yes | No | - |
| 9 | `SectionCode` | Var Char | 32 | Yes | No | Yes | No | - |

## Create table: SRC_Unit

- Zone: SOURCE
- Load order: 30
- PDF source: Unit

| Order | Column | Catalyst type | Max length | Mandatory | Unique | Search index | PII/ePHI | Default |
|---:|---|---|---:|---|---|---|---|---|
| 1 | `SourceFileName` | Var Char | 255 | Yes | No | No | No | - |
| 2 | `SourceRowNumber` | Int | - | Yes | No | No | No | - |
| 3 | `SourceSchemaVersion` | Var Char | 32 | Yes | No | Yes | No | - |
| 4 | `IsSynthetic` | Boolean | - | Yes | No | Yes | No | Yes |
| 5 | `SourceRecordHash` | Var Char | 64 | Yes | No | Yes | No | - |
| 6 | `ValidationStatus` | Var Char | 16 | Yes | No | Yes | No | ACCEPTED |
| 7 | `UnitID` | Int | - | Yes | Yes | Yes | No | - |
| 8 | `UnitName` | Var Char | 150 | Yes | No | Yes | No | - |
| 9 | `TypeID` | Int | - | Yes | No | Yes | No | - |
| 10 | `ParentUnit` | Int | - | No | No | Yes | No | - |
| 11 | `NationalityID` | Int | - | No | No | Yes | No | - |
| 12 | `StateID` | Int | - | Yes | No | Yes | No | - |
| 13 | `DistrictID` | Int | - | No | No | Yes | No | - |
| 14 | `Active` | Boolean | - | Yes | No | Yes | No | - |

## Create table: SRC_Employee

- Zone: SOURCE
- Load order: 40
- PDF source: Employee

| Order | Column | Catalyst type | Max length | Mandatory | Unique | Search index | PII/ePHI | Default |
|---:|---|---|---:|---|---|---|---|---|
| 1 | `SourceFileName` | Var Char | 255 | Yes | No | No | No | - |
| 2 | `SourceRowNumber` | Int | - | Yes | No | No | No | - |
| 3 | `SourceSchemaVersion` | Var Char | 32 | Yes | No | Yes | No | - |
| 4 | `IsSynthetic` | Boolean | - | Yes | No | Yes | No | Yes |
| 5 | `SourceRecordHash` | Var Char | 64 | Yes | No | Yes | No | - |
| 6 | `ValidationStatus` | Var Char | 16 | Yes | No | Yes | No | ACCEPTED |
| 7 | `EmployeeID` | Int | - | Yes | Yes | Yes | No | - |
| 8 | `DistrictID` | Int | - | Yes | No | Yes | No | - |
| 9 | `UnitID` | Int | - | Yes | No | Yes | No | - |
| 10 | `RankID` | Int | - | Yes | No | Yes | No | - |
| 11 | `DesignationID` | Int | - | Yes | No | Yes | No | - |
| 12 | `KGID` | Var Char | 32 | Yes | Yes | Yes | Yes | - |
| 13 | `FirstName` | Var Char | 150 | Yes | No | Yes | Yes | - |
| 14 | `EmployeeDOB` | Date | - | No | No | No | Yes | - |
| 15 | `GenderID` | Int | - | No | No | Yes | Yes | - |
| 16 | `BloodGroupID` | Int | - | No | No | No | Yes | - |
| 17 | `PhysicallyChallenged` | Boolean | - | No | No | No | Yes | - |
| 18 | `AppointmentDate` | Date | - | No | No | No | Yes | - |

## Create table: SRC_CaseMaster

- Zone: SOURCE
- Load order: 50
- PDF source: CaseMaster

| Order | Column | Catalyst type | Max length | Mandatory | Unique | Search index | PII/ePHI | Default |
|---:|---|---|---:|---|---|---|---|---|
| 1 | `SourceFileName` | Var Char | 255 | Yes | No | No | No | - |
| 2 | `SourceRowNumber` | Int | - | Yes | No | No | No | - |
| 3 | `SourceSchemaVersion` | Var Char | 32 | Yes | No | Yes | No | - |
| 4 | `IsSynthetic` | Boolean | - | Yes | No | Yes | No | Yes |
| 5 | `SourceRecordHash` | Var Char | 64 | Yes | No | Yes | No | - |
| 6 | `ValidationStatus` | Var Char | 16 | Yes | No | Yes | No | ACCEPTED |
| 7 | `CaseMasterID` | Int | - | Yes | Yes | Yes | No | - |
| 8 | `CrimeNo` | Var Char | 32 | Yes | Yes | Yes | No | - |
| 9 | `CaseNo` | Var Char | 16 | Yes | No | Yes | No | - |
| 10 | `CrimeRegisteredDate` | Date | - | Yes | No | Yes | No | - |
| 11 | `PolicePersonID` | Int | - | No | No | Yes | No | - |
| 12 | `PoliceStationID` | Int | - | Yes | No | Yes | No | - |
| 13 | `CaseCategoryID` | Int | - | Yes | No | Yes | No | - |
| 14 | `GravityOffenceID` | Int | - | No | No | Yes | No | - |
| 15 | `CrimeMajorHeadID` | Int | - | Yes | No | Yes | No | - |
| 16 | `CrimeMinorHeadID` | Int | - | Yes | No | Yes | No | - |
| 17 | `CaseStatusID` | Int | - | Yes | No | Yes | No | - |
| 18 | `CourtID` | Int | - | No | No | Yes | No | - |
| 19 | `IncidentFromDate` | DateTime | - | Yes | No | Yes | No | - |
| 20 | `IncidentToDate` | DateTime | - | Yes | No | Yes | No | - |
| 21 | `InfoReceivedPSDate` | DateTime | - | Yes | No | Yes | No | - |
| 22 | `latitude` | Double | - | No | No | No | No | - |
| 23 | `longitude` | Double | - | No | No | No | No | - |
| 24 | `BriefFacts` | Text | - | No | No | No | Yes | - |

## Create table: SRC_Accused

- Zone: SOURCE
- Load order: 60
- PDF source: Accused

| Order | Column | Catalyst type | Max length | Mandatory | Unique | Search index | PII/ePHI | Default |
|---:|---|---|---:|---|---|---|---|---|
| 1 | `SourceFileName` | Var Char | 255 | Yes | No | No | No | - |
| 2 | `SourceRowNumber` | Int | - | Yes | No | No | No | - |
| 3 | `SourceSchemaVersion` | Var Char | 32 | Yes | No | Yes | No | - |
| 4 | `IsSynthetic` | Boolean | - | Yes | No | Yes | No | Yes |
| 5 | `SourceRecordHash` | Var Char | 64 | Yes | No | Yes | No | - |
| 6 | `ValidationStatus` | Var Char | 16 | Yes | No | Yes | No | ACCEPTED |
| 7 | `AccusedMasterID` | Int | - | Yes | Yes | Yes | No | - |
| 8 | `CaseMasterID` | Int | - | Yes | No | Yes | No | - |
| 9 | `AccusedName` | Var Char | 150 | Yes | No | Yes | Yes | - |
| 10 | `AgeYear` | Int | - | No | No | No | Yes | - |
| 11 | `GenderID` | Int | - | No | No | Yes | Yes | - |
| 12 | `PersonID` | Var Char | 32 | No | No | Yes | Yes | - |

## Create table: SRC_ActSectionAssociation

- Zone: SOURCE
- Load order: 60
- PDF source: ActSectionAssociation

| Order | Column | Catalyst type | Max length | Mandatory | Unique | Search index | PII/ePHI | Default |
|---:|---|---|---:|---|---|---|---|---|
| 1 | `SourceFileName` | Var Char | 255 | Yes | No | No | No | - |
| 2 | `SourceRowNumber` | Int | - | Yes | No | No | No | - |
| 3 | `SourceSchemaVersion` | Var Char | 32 | Yes | No | Yes | No | - |
| 4 | `IsSynthetic` | Boolean | - | Yes | No | Yes | No | Yes |
| 5 | `SourceRecordHash` | Var Char | 64 | Yes | No | Yes | No | - |
| 6 | `ValidationStatus` | Var Char | 16 | Yes | No | Yes | No | ACCEPTED |
| 7 | `CaseMasterID` | Int | - | Yes | No | Yes | No | - |
| 8 | `ActID` | Int | - | Yes | No | Yes | No | - |
| 9 | `SectionID` | Int | - | Yes | No | Yes | No | - |
| 10 | `ActOrderID` | Int | - | No | No | No | No | - |
| 11 | `SectionOrderID` | Int | - | No | No | No | No | - |

## Create table: SRC_ChargesheetDetails

- Zone: SOURCE
- Load order: 60
- PDF source: ChargesheetDetails

| Order | Column | Catalyst type | Max length | Mandatory | Unique | Search index | PII/ePHI | Default |
|---:|---|---|---:|---|---|---|---|---|
| 1 | `SourceFileName` | Var Char | 255 | Yes | No | No | No | - |
| 2 | `SourceRowNumber` | Int | - | Yes | No | No | No | - |
| 3 | `SourceSchemaVersion` | Var Char | 32 | Yes | No | Yes | No | - |
| 4 | `IsSynthetic` | Boolean | - | Yes | No | Yes | No | Yes |
| 5 | `SourceRecordHash` | Var Char | 64 | Yes | No | Yes | No | - |
| 6 | `ValidationStatus` | Var Char | 16 | Yes | No | Yes | No | ACCEPTED |
| 7 | `CSID` | Int | - | Yes | Yes | Yes | No | - |
| 8 | `CaseMasterID` | Int | - | Yes | No | Yes | No | - |
| 9 | `csdate` | DateTime | - | No | No | Yes | No | - |
| 10 | `cstype` | Var Char | 1 | No | No | Yes | No | - |
| 11 | `PolicePersonID` | Int | - | No | No | Yes | No | - |

## Create table: SRC_ComplainantDetails

- Zone: SOURCE
- Load order: 60
- PDF source: ComplainantDetails

| Order | Column | Catalyst type | Max length | Mandatory | Unique | Search index | PII/ePHI | Default |
|---:|---|---|---:|---|---|---|---|---|
| 1 | `SourceFileName` | Var Char | 255 | Yes | No | No | No | - |
| 2 | `SourceRowNumber` | Int | - | Yes | No | No | No | - |
| 3 | `SourceSchemaVersion` | Var Char | 32 | Yes | No | Yes | No | - |
| 4 | `IsSynthetic` | Boolean | - | Yes | No | Yes | No | Yes |
| 5 | `SourceRecordHash` | Var Char | 64 | Yes | No | Yes | No | - |
| 6 | `ValidationStatus` | Var Char | 16 | Yes | No | Yes | No | ACCEPTED |
| 7 | `ComplainantID` | Int | - | Yes | Yes | Yes | No | - |
| 8 | `CaseMasterID` | Int | - | Yes | No | Yes | No | - |
| 9 | `ComplainantName` | Var Char | 150 | Yes | No | Yes | Yes | - |
| 10 | `AgeYear` | Int | - | No | No | No | Yes | - |
| 11 | `OccupationID` | Int | - | No | No | Yes | Yes | - |
| 12 | `ReligionID` | Int | - | No | No | Yes | Yes | - |
| 13 | `CasteID` | Int | - | No | No | Yes | Yes | - |
| 14 | `GenderID` | Int | - | No | No | Yes | Yes | - |

## Create table: SRC_Victim

- Zone: SOURCE
- Load order: 60
- PDF source: Victim

| Order | Column | Catalyst type | Max length | Mandatory | Unique | Search index | PII/ePHI | Default |
|---:|---|---|---:|---|---|---|---|---|
| 1 | `SourceFileName` | Var Char | 255 | Yes | No | No | No | - |
| 2 | `SourceRowNumber` | Int | - | Yes | No | No | No | - |
| 3 | `SourceSchemaVersion` | Var Char | 32 | Yes | No | Yes | No | - |
| 4 | `IsSynthetic` | Boolean | - | Yes | No | Yes | No | Yes |
| 5 | `SourceRecordHash` | Var Char | 64 | Yes | No | Yes | No | - |
| 6 | `ValidationStatus` | Var Char | 16 | Yes | No | Yes | No | ACCEPTED |
| 7 | `VictimMasterID` | Int | - | Yes | Yes | Yes | No | - |
| 8 | `CaseMasterID` | Int | - | Yes | No | Yes | No | - |
| 9 | `VictimName` | Var Char | 150 | Yes | No | Yes | Yes | - |
| 10 | `AgeYear` | Int | - | No | No | No | Yes | - |
| 11 | `GenderID` | Int | - | No | No | Yes | Yes | - |
| 12 | `VictimPolice` | Var Char | 1 | No | No | No | No | - |

## Create table: SRC_ArrestSurrender

- Zone: SOURCE
- Load order: 70
- PDF source: ArrestSurrender

| Order | Column | Catalyst type | Max length | Mandatory | Unique | Search index | PII/ePHI | Default |
|---:|---|---|---:|---|---|---|---|---|
| 1 | `SourceFileName` | Var Char | 255 | Yes | No | No | No | - |
| 2 | `SourceRowNumber` | Int | - | Yes | No | No | No | - |
| 3 | `SourceSchemaVersion` | Var Char | 32 | Yes | No | Yes | No | - |
| 4 | `IsSynthetic` | Boolean | - | Yes | No | Yes | No | Yes |
| 5 | `SourceRecordHash` | Var Char | 64 | Yes | No | Yes | No | - |
| 6 | `ValidationStatus` | Var Char | 16 | Yes | No | Yes | No | ACCEPTED |
| 7 | `ArrestSurrenderID` | Int | - | Yes | Yes | Yes | No | - |
| 8 | `CaseMasterID` | Int | - | Yes | No | Yes | No | - |
| 9 | `ArrestSurrenderTypeID` | Int | - | No | No | Yes | No | - |
| 10 | `ArrestSurrenderDate` | Date | - | Yes | No | Yes | No | - |
| 11 | `ArrestSurrenderStateId` | Int | - | No | No | Yes | No | - |
| 12 | `ArrestSurrenderDistrictId` | Int | - | No | No | Yes | No | - |
| 13 | `PoliceStationID` | Int | - | No | No | Yes | No | - |
| 14 | `IOID` | Int | - | No | No | Yes | No | - |
| 15 | `CourtID` | Int | - | No | No | Yes | No | - |
| 16 | `AccusedMasterID` | Int | - | No | No | Yes | No | - |
| 17 | `IsAccused` | Boolean | - | No | No | No | No | - |
| 18 | `IsComplainantAccused` | Boolean | - | No | No | No | No | - |

## Phase B - Add Catalyst Foreign Key columns

Add these only after every table in Phase A exists. Select the exact parent and use On Delete = Null. Never select Cascade.

| Order | Child table | Reference column | Parent table | Mandatory | On delete |
|---:|---|---|---|---|---|
| 1 | `TRN_RejectedRecord` | `BatchRef` | `TRN_IngestionBatch` | Yes | NULL |
| 2 | `TRN_SourceKeyMap` | `BatchRef` | `TRN_IngestionBatch` | Yes | NULL |
| 3 | `SRC_Act` | `SourceBatchRef` | `TRN_IngestionBatch` | Yes | NULL |
| 4 | `SRC_CaseCategory` | `SourceBatchRef` | `TRN_IngestionBatch` | Yes | NULL |
| 5 | `SRC_CaseStatusMaster` | `SourceBatchRef` | `TRN_IngestionBatch` | Yes | NULL |
| 6 | `SRC_CasteMaster` | `SourceBatchRef` | `TRN_IngestionBatch` | Yes | NULL |
| 7 | `SRC_CrimeHead` | `SourceBatchRef` | `TRN_IngestionBatch` | Yes | NULL |
| 8 | `SRC_Designation` | `SourceBatchRef` | `TRN_IngestionBatch` | Yes | NULL |
| 9 | `SRC_GravityOffence` | `SourceBatchRef` | `TRN_IngestionBatch` | Yes | NULL |
| 10 | `SRC_OccupationMaster` | `SourceBatchRef` | `TRN_IngestionBatch` | Yes | NULL |
| 11 | `SRC_Rank` | `SourceBatchRef` | `TRN_IngestionBatch` | Yes | NULL |
| 12 | `SRC_ReligionMaster` | `SourceBatchRef` | `TRN_IngestionBatch` | Yes | NULL |
| 13 | `SRC_State` | `SourceBatchRef` | `TRN_IngestionBatch` | Yes | NULL |
| 14 | `SRC_UnitType` | `SourceBatchRef` | `TRN_IngestionBatch` | Yes | NULL |
| 15 | `SRC_CrimeSubHead` | `SourceBatchRef` | `TRN_IngestionBatch` | Yes | NULL |
| 16 | `SRC_CrimeSubHead` | `CrimeHeadRef` | `SRC_CrimeHead` | No | NULL |
| 17 | `SRC_District` | `SourceBatchRef` | `TRN_IngestionBatch` | Yes | NULL |
| 18 | `SRC_District` | `StateRef` | `SRC_State` | No | NULL |
| 19 | `SRC_Section` | `SourceBatchRef` | `TRN_IngestionBatch` | Yes | NULL |
| 20 | `SRC_Section` | `ActRef` | `SRC_Act` | No | NULL |
| 21 | `SRC_Court` | `SourceBatchRef` | `TRN_IngestionBatch` | Yes | NULL |
| 22 | `SRC_Court` | `DistrictRef` | `SRC_District` | No | NULL |
| 23 | `SRC_Court` | `StateRef` | `SRC_State` | No | NULL |
| 24 | `SRC_CrimeHeadActSection` | `SourceBatchRef` | `TRN_IngestionBatch` | Yes | NULL |
| 25 | `SRC_CrimeHeadActSection` | `CrimeHeadRef` | `SRC_CrimeHead` | No | NULL |
| 26 | `SRC_CrimeHeadActSection` | `ActRef` | `SRC_Act` | No | NULL |
| 27 | `SRC_CrimeHeadActSection` | `SectionRef` | `SRC_Section` | No | NULL |
| 28 | `SRC_Unit` | `SourceBatchRef` | `TRN_IngestionBatch` | Yes | NULL |
| 29 | `SRC_Unit` | `UnitTypeRef` | `SRC_UnitType` | No | NULL |
| 30 | `SRC_Unit` | `ParentUnitRef` | `SRC_Unit` | No | NULL |
| 31 | `SRC_Unit` | `StateRef` | `SRC_State` | No | NULL |
| 32 | `SRC_Unit` | `DistrictRef` | `SRC_District` | No | NULL |
| 33 | `SRC_Employee` | `SourceBatchRef` | `TRN_IngestionBatch` | Yes | NULL |
| 34 | `SRC_Employee` | `DistrictRef` | `SRC_District` | No | NULL |
| 35 | `SRC_Employee` | `UnitRef` | `SRC_Unit` | No | NULL |
| 36 | `SRC_Employee` | `RankRef` | `SRC_Rank` | No | NULL |
| 37 | `SRC_Employee` | `DesignationRef` | `SRC_Designation` | No | NULL |
| 38 | `SRC_CaseMaster` | `SourceBatchRef` | `TRN_IngestionBatch` | Yes | NULL |
| 39 | `SRC_CaseMaster` | `PolicePersonRef` | `SRC_Employee` | No | NULL |
| 40 | `SRC_CaseMaster` | `PoliceStationRef` | `SRC_Unit` | No | NULL |
| 41 | `SRC_CaseMaster` | `CaseCategoryRef` | `SRC_CaseCategory` | No | NULL |
| 42 | `SRC_CaseMaster` | `GravityOffenceRef` | `SRC_GravityOffence` | No | NULL |
| 43 | `SRC_CaseMaster` | `CrimeMajorHeadRef` | `SRC_CrimeHead` | No | NULL |
| 44 | `SRC_CaseMaster` | `CrimeMinorHeadRef` | `SRC_CrimeSubHead` | No | NULL |
| 45 | `SRC_CaseMaster` | `CaseStatusRef` | `SRC_CaseStatusMaster` | No | NULL |
| 46 | `SRC_CaseMaster` | `CourtRef` | `SRC_Court` | No | NULL |
| 47 | `SRC_Accused` | `SourceBatchRef` | `TRN_IngestionBatch` | Yes | NULL |
| 48 | `SRC_Accused` | `CaseMasterRef` | `SRC_CaseMaster` | No | NULL |
| 49 | `SRC_ActSectionAssociation` | `SourceBatchRef` | `TRN_IngestionBatch` | Yes | NULL |
| 50 | `SRC_ActSectionAssociation` | `CaseMasterRef` | `SRC_CaseMaster` | No | NULL |
| 51 | `SRC_ActSectionAssociation` | `ActRef` | `SRC_Act` | No | NULL |
| 52 | `SRC_ActSectionAssociation` | `SectionRef` | `SRC_Section` | No | NULL |
| 53 | `SRC_ChargesheetDetails` | `SourceBatchRef` | `TRN_IngestionBatch` | Yes | NULL |
| 54 | `SRC_ChargesheetDetails` | `CaseMasterRef` | `SRC_CaseMaster` | No | NULL |
| 55 | `SRC_ChargesheetDetails` | `PolicePersonRef` | `SRC_Employee` | No | NULL |
| 56 | `SRC_ComplainantDetails` | `SourceBatchRef` | `TRN_IngestionBatch` | Yes | NULL |
| 57 | `SRC_ComplainantDetails` | `CaseMasterRef` | `SRC_CaseMaster` | No | NULL |
| 58 | `SRC_ComplainantDetails` | `OccupationRef` | `SRC_OccupationMaster` | No | NULL |
| 59 | `SRC_ComplainantDetails` | `ReligionRef` | `SRC_ReligionMaster` | No | NULL |
| 60 | `SRC_ComplainantDetails` | `CasteRef` | `SRC_CasteMaster` | No | NULL |
| 61 | `SRC_Victim` | `SourceBatchRef` | `TRN_IngestionBatch` | Yes | NULL |
| 62 | `SRC_Victim` | `CaseMasterRef` | `SRC_CaseMaster` | No | NULL |
| 63 | `SRC_ArrestSurrender` | `SourceBatchRef` | `TRN_IngestionBatch` | Yes | NULL |
| 64 | `SRC_ArrestSurrender` | `CaseMasterRef` | `SRC_CaseMaster` | No | NULL |
| 65 | `SRC_ArrestSurrender` | `ArrestSurrenderStateRef` | `SRC_State` | No | NULL |
| 66 | `SRC_ArrestSurrender` | `ArrestSurrenderDistrictRef` | `SRC_District` | No | NULL |
| 67 | `SRC_ArrestSurrender` | `PoliceStationRef` | `SRC_Unit` | No | NULL |
| 68 | `SRC_ArrestSurrender` | `IORef` | `SRC_Employee` | No | NULL |
| 69 | `SRC_ArrestSurrender` | `CourtRef` | `SRC_Court` | No | NULL |
| 70 | `SRC_ArrestSurrender` | `AccusedMasterRef` | `SRC_Accused` | No | NULL |

## Phase C - Verification record

| Table | Expected manifest columns | Catalyst table ID | Observed manifest columns | Verified by | Verified at | Evidence path |
|---|---:|---|---:|---|---|---|
| `TRN_IngestionBatch` | 12 |  |  |  |  |  |
| `TRN_RejectedRecord` | 10 |  |  |  |  |  |
| `TRN_SourceKeyMap` | 9 |  |  |  |  |  |
| `SRC_Act` | 11 |  |  |  |  |  |
| `SRC_CaseCategory` | 9 |  |  |  |  |  |
| `SRC_CaseStatusMaster` | 9 |  |  |  |  |  |
| `SRC_CasteMaster` | 9 |  |  |  |  |  |
| `SRC_CrimeHead` | 10 |  |  |  |  |  |
| `SRC_Designation` | 11 |  |  |  |  |  |
| `SRC_GravityOffence` | 9 |  |  |  |  |  |
| `SRC_OccupationMaster` | 9 |  |  |  |  |  |
| `SRC_Rank` | 11 |  |  |  |  |  |
| `SRC_ReligionMaster` | 9 |  |  |  |  |  |
| `SRC_State` | 11 |  |  |  |  |  |
| `SRC_UnitType` | 12 |  |  |  |  |  |
| `SRC_CrimeSubHead` | 12 |  |  |  |  |  |
| `SRC_District` | 12 |  |  |  |  |  |
| `SRC_Section` | 12 |  |  |  |  |  |
| `SRC_Court` | 14 |  |  |  |  |  |
| `SRC_CrimeHeadActSection` | 13 |  |  |  |  |  |
| `SRC_Unit` | 19 |  |  |  |  |  |
| `SRC_Employee` | 23 |  |  |  |  |  |
| `SRC_CaseMaster` | 33 |  |  |  |  |  |
| `SRC_Accused` | 14 |  |  |  |  |  |
| `SRC_ActSectionAssociation` | 15 |  |  |  |  |  |
| `SRC_ChargesheetDetails` | 14 |  |  |  |  |  |
| `SRC_ComplainantDetails` | 19 |  |  |  |  |  |
| `SRC_Victim` | 14 |  |  |  |  |  |
| `SRC_ArrestSurrender` | 26 |  |  |  |  |  |

Verification is complete only when the Catalyst IaC export comparison passes. Do not infer correctness from the console table count alone.

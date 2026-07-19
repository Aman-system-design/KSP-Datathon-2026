# Catalyst Physical Data Architecture Design

**Project:** KSP Datathon 2026 - Challenge 02

**Status:** Approved architecture; physical tables not yet created

**Source reference:** `Police_FIR_ER_Diagram.pdf`

**Deployment target:** Catalyst by Zoho, India data centre

## 1. Purpose

This design converts the supplied FIR schema into a Catalyst-native relational implementation without silently changing the KSP-shaped source data.

It must satisfy two needs at the same time:

1. Preserve every table and column shown in the PDF so that imported records remain traceable to their source structure.
2. Make relationships, validation, analytics, evidence drilldowns, and workflow reliable inside Catalyst.

The PDF is treated as a source-schema reference, not as a complete or internally consistent production specification.

## 2. Approved architecture

```text
RAW LANDING - Catalyst Stratus
Original synthetic CSV extracts, manifests and checksums
        |
        v
SOURCE ZONE - Catalyst Data Store: SRC_*
PDF-aligned columns, original business IDs and Catalyst relationship references
        |
        v
TRANSFORMATION ZONE - Catalyst Data Store: TRN_*
Validation, key mapping and compact reusable analytical features
        |
        v
INTELLIGENCE ZONE - Catalyst Data Store: INT_*
Versioned hotspots, anomalies, patterns, networks and area-risk results
        |
        v
WORKFLOW ZONE - Catalyst Data Store: WF_*
Alerts, evidence, assignments, conclusions, outcomes and audit events
```

These are logical zones inside one Catalyst project and one Data Store component. Separate Catalyst projects are not required for the MVP.

## 3. Non-negotiable schema-preservation rule

- Every PDF-defined table is represented by one `SRC_` table.
- Every PDF-defined column retains its original name and business meaning.
- Source business IDs remain visible and are never replaced by Catalyst-generated values.
- Catalyst automatically supplies `ROWID`, `CREATORID`, `CREATEDTIME`, and `MODIFIEDTIME`.
- A PDF foreign-key column remains present with its supplied name and source value.
- A separate `*Ref` column stores the Catalyst Foreign Key value when a relationship must be enforced.
- `*Ref` values point to the parent record's Catalyst `ROWID`.
- Source records are append/import controlled. Analytics and workflow processes must not overwrite them.
- Corrections, normalized values and derived features belong in `TRN_*`, never in the original source columns.
- Every record and output carries a synthetic-data marker for the MVP.

Example:

| Column | Purpose |
|---|---|
| `CaseMasterID` | Original KSP-style case identifier from the PDF schema |
| `CaseMasterRef` | Catalyst Foreign Key pointing to `SRC_CaseMaster.ROWID` |

## 4. Type-conversion rules

| PDF type | Catalyst type | Rule |
|---|---|---|
| `INT` | Int | Preserve source numeric identifier/value |
| `VARCHAR` | Var Char | Maximum length set table-by-table; identifiers retain leading zeroes where applicable |
| `NVARCHAR(MAX)` | Text | Used for `BriefFacts`; access restricted and synthetic-only in MVP |
| `CHAR` | Var Char | Constrain permitted values during validation |
| `DATE` | Date | ISO date during import |
| `DATETIME` | DateTime | Normalize to the agreed project timezone and retain source value in landing files |
| `DECIMAL` | Double | Latitude/longitude range validated before acceptance |
| `BIT` | Boolean | Normalize approved source representations to true/false |
| Relationship | Foreign Key | Store parent `ROWID` in the companion `*Ref` column |

## 5. PDF-aligned source-table catalogue

The following catalogue is the authoritative MVP inventory. Columns are listed in PDF order. Catalyst default columns and the standard metadata columns in Section 6 are additional.

| Catalyst table | PDF columns |
|---|---|
| `SRC_CaseMaster` | `CaseMasterID`, `CrimeNo`, `CaseNo`, `CrimeRegisteredDate`, `PolicePersonID`, `PoliceStationID`, `CaseCategoryID`, `GravityOffenceID`, `CrimeMajorHeadID`, `CrimeMinorHeadID`, `CaseStatusID`, `CourtID`, `IncidentFromDate`, `IncidentToDate`, `InfoReceivedPSDate`, `latitude`, `longitude`, `BriefFacts` |
| `SRC_ComplainantDetails` | `ComplainantID`, `CaseMasterID`, `ComplainantName`, `AgeYear`, `OccupationID`, `ReligionID`, `CasteID`, `GenderID` |
| `SRC_ActSectionAssociation` | `CaseMasterID`, `ActID`, `SectionID`, `ActOrderID`, `SectionOrderID` |
| `SRC_Victim` | `VictimMasterID`, `CaseMasterID`, `VictimName`, `AgeYear`, `GenderID`, `VictimPolice` |
| `SRC_Accused` | `AccusedMasterID`, `CaseMasterID`, `AccusedName`, `AgeYear`, `GenderID`, `PersonID` |
| `SRC_ArrestSurrender` | `ArrestSurrenderID`, `CaseMasterID`, `ArrestSurrenderTypeID`, `ArrestSurrenderDate`, `ArrestSurrenderStateId`, `ArrestSurrenderDistrictId`, `PoliceStationID`, `IOID`, `CourtID`, `AccusedMasterID`, `IsAccused`, `IsComplainantAccused` |
| `SRC_Act` | `ActCode`, `ActDescription`, `ShortName`, `Active` |
| `SRC_Section` | `ActCode`, `SectionCode`, `SectionDescription`, `Active` |
| `SRC_CrimeHeadActSection` | `CrimeHeadID`, `ActCode`, `SectionCode` |
| `SRC_CrimeHead` | `CrimeHeadID`, `CrimeGroupName`, `Active` |
| `SRC_CrimeSubHead` | `CrimeSubHeadID`, `CrimeHeadID`, `CrimeHeadName`, `SeqID` |
| `SRC_CasteMaster` | `caste_master_id`, `caste_master_name` |
| `SRC_ReligionMaster` | `ReligionID`, `ReligionName` |
| `SRC_OccupationMaster` | `OccupationID`, `OccupationName` |
| `SRC_CaseStatusMaster` | `CaseStatusID`, `CaseStatusName` |
| `SRC_Court` | `CourtID`, `CourtName`, `DistrictID`, `StateID`, `Active` |
| `SRC_District` | `DistrictID`, `DistrictName`, `StateID`, `Active` |
| `SRC_State` | `StateID`, `StateName`, `NationalityID`, `Active` |
| `SRC_Unit` | `UnitID`, `UnitName`, `TypeID`, `ParentUnit`, `NationalityID`, `StateID`, `DistrictID`, `Active` |
| `SRC_UnitType` | `UnitTypeID`, `UnitTypeName`, `CityDistState`, `Hierarchy`, `Active` |
| `SRC_Rank` | `RankID`, `RankName`, `Hierarchy`, `Active` |
| `SRC_Designation` | `DesignationID`, `DesignationName`, `Active`, `SortOrder` |
| `SRC_Employee` | `EmployeeID`, `DistrictID`, `UnitID`, `RankID`, `DesignationID`, `KGID`, `FirstName`, `EmployeeDOB`, `GenderID`, `BloodGroupID`, `PhysicallyChallenged`, `AppointmentDate` |
| `SRC_CaseCategory` | `CaseCategoryID`, `LookupValue` |
| `SRC_GravityOffence` | `GravityOffenceID`, `LookupValue` |
| `SRC_ChargesheetDetails` | `CSID`, `CaseMasterID`, `csdate`, `cstype`, `PolicePersonID` |

### Referenced but undefined PDF entity

The relationship matrix mentions `Inv_OccuranceTime`, but the PDF supplies no table definition. It will not be invented as a `SRC_` table. The occurrence fields already defined in `CaseMaster` remain authoritative for the MVP. The missing entity is recorded for KSP confirmation.

The matrix also mentions `inv_arrestsurrenderaccused`, while the table definition places `AccusedMasterID` directly in `ArrestSurrender`. The source column is preserved, and the many-to-many interpretation is represented in `TRN_ArrestSurrenderAccused` until KSP confirms the actual production structure.

## 6. Standard source metadata

Every `SRC_` table adds these MVP metadata columns:

| Column | Catalyst type | Purpose |
|---|---|---|
| `SourceBatchRef` | Foreign Key | Import batch that created the row |
| `SourceFileName` | Var Char | Original synthetic extract name |
| `SourceRowNumber` | Int | Row position for reconciliation |
| `SourceSchemaVersion` | Var Char | Version of the import contract |
| `IsSynthetic` | Boolean | Mandatory and true for every hackathon record |
| `SourceRecordHash` | Var Char | Idempotency/change-detection hash |
| `ValidationStatus` | Var Char | `ACCEPTED` or `WARNING`; rejected rows remain outside analytical source tables |

Rejected records are stored in the ingestion/rejection structure, not inserted into analytical source tables.

## 7. Catalyst relationship-reference catalogue

Original PDF key columns remain unchanged. These companion columns enforce navigable relationships.

| Child table | Original source column | Catalyst reference column | Parent table |
|---|---|---|---|
| `SRC_CaseMaster` | `PolicePersonID` | `PolicePersonRef` | `SRC_Employee` |
| `SRC_CaseMaster` | `PoliceStationID` | `PoliceStationRef` | `SRC_Unit` |
| `SRC_CaseMaster` | `CaseCategoryID` | `CaseCategoryRef` | `SRC_CaseCategory` |
| `SRC_CaseMaster` | `GravityOffenceID` | `GravityOffenceRef` | `SRC_GravityOffence` |
| `SRC_CaseMaster` | `CrimeMajorHeadID` | `CrimeMajorHeadRef` | `SRC_CrimeHead` |
| `SRC_CaseMaster` | `CrimeMinorHeadID` | `CrimeMinorHeadRef` | `SRC_CrimeSubHead` |
| `SRC_CaseMaster` | `CaseStatusID` | `CaseStatusRef` | `SRC_CaseStatusMaster` |
| `SRC_CaseMaster` | `CourtID` | `CourtRef` | `SRC_Court` |
| `SRC_ComplainantDetails` | `CaseMasterID` | `CaseMasterRef` | `SRC_CaseMaster` |
| `SRC_ComplainantDetails` | `OccupationID` | `OccupationRef` | `SRC_OccupationMaster` |
| `SRC_ComplainantDetails` | `ReligionID` | `ReligionRef` | `SRC_ReligionMaster` |
| `SRC_ComplainantDetails` | `CasteID` | `CasteRef` | `SRC_CasteMaster` |
| `SRC_Victim` | `CaseMasterID` | `CaseMasterRef` | `SRC_CaseMaster` |
| `SRC_Accused` | `CaseMasterID` | `CaseMasterRef` | `SRC_CaseMaster` |
| `SRC_ActSectionAssociation` | `CaseMasterID` | `CaseMasterRef` | `SRC_CaseMaster` |
| `SRC_ActSectionAssociation` | `ActID` | `ActRef` | `SRC_Act` |
| `SRC_ActSectionAssociation` | `SectionID` | `SectionRef` | `SRC_Section` |
| `SRC_ArrestSurrender` | `CaseMasterID` | `CaseMasterRef` | `SRC_CaseMaster` |
| `SRC_ArrestSurrender` | `ArrestSurrenderStateId` | `ArrestSurrenderStateRef` | `SRC_State` |
| `SRC_ArrestSurrender` | `ArrestSurrenderDistrictId` | `ArrestSurrenderDistrictRef` | `SRC_District` |
| `SRC_ArrestSurrender` | `PoliceStationID` | `PoliceStationRef` | `SRC_Unit` |
| `SRC_ArrestSurrender` | `IOID` | `IORef` | `SRC_Employee` |
| `SRC_ArrestSurrender` | `CourtID` | `CourtRef` | `SRC_Court` |
| `SRC_ArrestSurrender` | `AccusedMasterID` | `AccusedMasterRef` | `SRC_Accused` |
| `SRC_Section` | `ActCode` | `ActRef` | `SRC_Act` |
| `SRC_CrimeHeadActSection` | `CrimeHeadID` | `CrimeHeadRef` | `SRC_CrimeHead` |
| `SRC_CrimeHeadActSection` | `ActCode` | `ActRef` | `SRC_Act` |
| `SRC_CrimeHeadActSection` | `SectionCode` | `SectionRef` | `SRC_Section` |
| `SRC_CrimeSubHead` | `CrimeHeadID` | `CrimeHeadRef` | `SRC_CrimeHead` |
| `SRC_Court` | `DistrictID` | `DistrictRef` | `SRC_District` |
| `SRC_Court` | `StateID` | `StateRef` | `SRC_State` |
| `SRC_District` | `StateID` | `StateRef` | `SRC_State` |
| `SRC_Unit` | `TypeID` | `UnitTypeRef` | `SRC_UnitType` |
| `SRC_Unit` | `ParentUnit` | `ParentUnitRef` | `SRC_Unit` |
| `SRC_Unit` | `StateID` | `StateRef` | `SRC_State` |
| `SRC_Unit` | `DistrictID` | `DistrictRef` | `SRC_District` |
| `SRC_Employee` | `DistrictID` | `DistrictRef` | `SRC_District` |
| `SRC_Employee` | `UnitID` | `UnitRef` | `SRC_Unit` |
| `SRC_Employee` | `RankID` | `RankRef` | `SRC_Rank` |
| `SRC_Employee` | `DesignationID` | `DesignationRef` | `SRC_Designation` |
| `SRC_ChargesheetDetails` | `CaseMasterID` | `CaseMasterRef` | `SRC_CaseMaster` |
| `SRC_ChargesheetDetails` | `PolicePersonID` | `PolicePersonRef` | `SRC_Employee` |

Lookup references for `GenderID`, `BloodGroupID`, `NationalityID`, and `ArrestSurrenderTypeID` remain source values until KSP supplies their authoritative tables. The MVP may use clearly marked synthetic lookup tables, but they must not be described as PDF-defined entities.

## 8. Source uniqueness and validation

| Table | MVP source uniqueness rule |
|---|---|
| `SRC_CaseMaster` | `CaseMasterID`; also test documented `CrimeNo` scope and preserve `CaseNo` as text |
| `SRC_Accused` | `AccusedMasterID` |
| `SRC_Victim` | `VictimMasterID` |
| `SRC_ComplainantDetails` | `ComplainantID` |
| `SRC_ArrestSurrender` | `ArrestSurrenderID` |
| `SRC_Act` | `ActCode` |
| `SRC_Section` | composite logical key `(ActCode, SectionCode)` |
| Master/lookup tables | Supplied ID/code column |
| `SRC_ActSectionAssociation` | logical combination of case, act, section and display-order values |
| `SRC_CrimeHeadActSection` | logical combination `(CrimeHeadID, ActCode, SectionCode)` |

Mandatory validation includes:

- required business IDs;
- duplicate natural/business keys;
- unresolved parent keys;
- valid incident date order;
- registration and information timestamps consistent with the planted scenario;
- latitude `-90..90` and longitude `-180..180`;
- allowed boolean and case-report codes;
- active/inactive master handling;
- source counts, accepted counts, warning counts, rejected counts and hashes;
- prominent `IsSynthetic = true` enforcement.

No rejected row contributes to a hotspot, anomaly, network or risk result.

## 9. Lean transformation tables

Transformation tables do not reproduce the complete FIR schema.

| Table | Grain and purpose |
|---|---|
| `TRN_IngestionBatch` | One row per staged import; manifest, schema version, counts, checksum, watermark, status and timestamps |
| `TRN_RejectedRecord` | One row per rejected input row; batch, file, row, entity, reason code and redacted payload reference |
| `TRN_SourceKeyMap` | Source entity/key to Catalyst table/`ROWID` mapping used to populate `*Ref` columns |
| `TRN_ArrestSurrenderAccused` | One row per arrest/surrender-to-accused link; preserves the PDF matrix's many-to-many possibility |
| `TRN_CaseFeature` | One row per accepted case per feature version; recency, severity, time band, category and trend-ready values |
| `TRN_LocationFeature` | One row per accepted case location per feature version; normalized coordinates, grid/cell, quality and boundary references |
| `TRN_PersonResolution` | Candidate cross-case accused identity links with method, confidence, evidence, status and human reviewer; never a future-crime score |
| `TRN_DistrictContext` | One row per district-period-variable; aggregate source, value, missingness and synthetic/public-data label |

`TRN_PersonResolution` distinguishes `CANDIDATE`, `CONFIRMED`, and `REJECTED`. Name similarity alone cannot create a confirmed identity.

## 10. Intelligence tables

| Table | Grain and required evidence |
|---|---|
| `INT_AnalysisRun` | One analytical execution with method/model version, parameters, observation window and status |
| `INT_Hotspot` | Area/time/category cluster with baseline, magnitude, severity, confidence and limitation |
| `INT_Anomaly` | Unit/category/time deviation with observed value, expected range and baseline |
| `INT_Pattern` | Cross-case or cross-district pattern with features, similarity basis and limitations |
| `INT_AreaRisk` | Geographic area-period score with component contributions; never an individual score |
| `INT_NetworkNode` | Versioned case/person/unit/location/legal node used in an evidence network |
| `INT_NetworkEdge` | Evidence-labelled relationship between nodes with source case/link and confidence |
| `INT_RepeatOffenderSignal` | Cross-case repeated-identity signal based on confirmed or visibly provisional resolution |

Every result links to `INT_AnalysisRun` and to its supporting cases or aggregate observations. Results retain the original model output even after analysts add conclusions.

## 11. Workflow and audit tables

| Table | Purpose |
|---|---|
| `WF_Alert` | Human-facing alert created from one or more intelligence findings; status, severity, geographic scope and limitation |
| `WF_AlertEvidence` | Links an alert to findings, cases and stored metrics with evidence classification |
| `WF_Assignment` | Assignment, acknowledgement, due date, escalation and completion history |
| `WF_AnalystConclusion` | Separate analyst hypothesis/conclusion; never overwrites the original finding |
| `WF_Outcome` | Action taken, result and feedback suitable for later evaluation |
| `WF_AuditEvent` | Append-only access, decision, export, status and configuration events |

Authorization is derived from designation responsibilities, rank hierarchy, assigned unit hierarchy and explicit permissions. Rank alone never grants access.

## 12. Load and refresh order

1. Upload original synthetic extracts and manifest to Stratus.
2. Create `TRN_IngestionBatch` and validate file-level controls.
3. Load independent masters: state, types, rank, designation, categories, gravity, statuses, acts and other lookups.
4. Load district, unit hierarchy, court, employee, crime head/sub-head and section structures.
5. Load `SRC_CaseMaster` after all available parents resolve.
6. Load complainants, victims, accused, legal associations, arrests and chargesheets.
7. Populate `TRN_ArrestSurrenderAccused` and compact features.
8. Run intelligence jobs and store versioned outputs.
9. Create alerts only from successfully completed analytical runs.
10. Reconcile source, accepted, rejected and transformed counts before marking the batch complete.

Imports must be idempotent. A retry may not create duplicate source records or duplicate alerts.

## 13. Synthetic-data design requirements

The seed data must include both planted positive scenarios and negative controls:

- a genuine emerging spatial hotspot;
- a seasonal increase that must not be mislabelled as an anomaly;
- a cross-district modus-operandi pattern;
- a confirmed synthetic repeat identity and a similar-name false match;
- a co-accused network with evidence-linked cases;
- an area-risk change with visible contributing factors;
- missing and invalid coordinates;
- orphan foreign keys and duplicate source rows for rejection testing;
- district-context correlations with explicit non-causal caveats;
- at least one alert that is reviewed and rejected by an analyst.

Names and identifiers must be fictional and must not imitate identifiable people. All UI, exports and generated briefs must display a synthetic-data label.

## 14. Billing and storage controls

- Development remains the working environment until deployment approval.
- Store original extract files once in Stratus; do not reproduce file payloads in rejection tables.
- Do not create full transformed copies of all source tables.
- Persist only reusable features, versioned findings and workflow evidence.
- Refresh incrementally using source hashes and watermarks.
- Avoid recomputing unchanged cases.
- Define retention for obsolete intermediate feature versions after demo reproducibility needs are met.
- Monitor Data Store storage, selects, inserts and updates before production promotion.
- Set a production budget and usage alerts before any production data load.

## 15. Error handling and observability

- File failure: batch remains `FAILED`; no partial batch becomes analytically active.
- Row failure: row is quarantined with a reason; accepted rows may proceed only after reconciliation policy passes.
- Parent-key failure: relationship remains unresolved and the row is rejected or warned according to the entity contract.
- Transformation failure: source remains intact; the feature version is marked failed.
- Analytical failure: no alert is created from the failed run.
- Retry: use batch ID, source key and record hash for idempotency.
- Every stage records start time, end time, counts, version and error summary.

## 16. Verification and acceptance

Before table creation, verify the schema catalogue against all nine PDF pages. After creation, automated metadata checks must confirm:

- all 26 PDF-defined tables exist under their `SRC_` mappings;
- all PDF-defined columns exist with compatible Catalyst types;
- every approved companion relationship points to the intended parent table;
- business IDs remain present and unique where specified;
- source records cannot be modified by analytics jobs;
- rejected rows do not enter intelligence results;
- synthetic labels are mandatory;
- planted positive patterns are detected;
- negative controls are not promoted as confirmed findings;
- every intelligence result exposes evidence, version, observation window and limitation;
- authorization tests enforce geographic and case scope;
- audit history is append-only.

## 17. Challenge 02 traceability

| Requirement | Data-architecture support |
|---|---|
| CH02-01 Fragmented records | Separate PDF-aligned extracts, batches, validation, rejection and linking |
| CH02-02 Actionable intelligence | Versioned findings connected to alerts, assignments and outcomes |
| CH02-03 Dashboards/maps | Case, unit, location and intelligence tables support role-aware views |
| CH02-04 Hotspots | `TRN_LocationFeature`, `INT_AnalysisRun`, `INT_Hotspot` |
| CH02-05 District drilldowns | State/district/unit hierarchy and evidence references |
| CH02-06 Trends/anomalies | `TRN_CaseFeature`, `INT_Anomaly` |
| CH02-07 Network analysis | resolved case/person links plus `INT_NetworkNode/Edge` |
| CH02-08 Repeat offenders | auditable person resolution plus `INT_RepeatOffenderSignal` |
| CH02-09 Socio-economic correlation | aggregate `TRN_DistrictContext` with source and caveat fields |
| CH02-10 Area risk | geographic-only `INT_AreaRisk` with component contributions |
| CH02-11 Pattern detection | versioned `INT_Pattern` with evidence and limitations |

## 18. Explicit exclusions

- No prediction that a named person will commit a future offence.
- No caste, religion or personal socio-economic input to risk scoring.
- No automatic conclusion of guilt or criminal association.
- No full duplicate transformed database.
- No direct public connection to a KSP operational database.
- No invention of undefined PDF entities as though they were confirmed production tables.
- No production deployment or real-data ingestion under this design approval alone.

## 19. Decisions requiring KSP confirmation before production

The unresolved production questions are maintained in `docs/KSP DEVELOPMENT TEAM FYI.md`. They include authoritative types and keys, missing lookups, arrest cardinality, occurrence structure, identity resolution, unit hierarchy, permissions, integration, retention and model governance.

## 20. Implementation gate

The next implementation plan must specify the exact Catalyst column type, maximum length, mandatory/unique/search-index setting, PII setting and delete behavior for every column. Table creation begins only after that plan is reviewed against this specification and the challenge-alignment skill returns an allowable verdict.

# Catalyst Intelligence and Workflow Tables Runbook

**Manifest version:** 1.0.0

**Project ID:** 43492000000013049

**Environment:** Development

> **Development only.** Do not create these tables in Production and do not load real police data. The MVP dataset is synthetic.

This document is generated only from `schema/catalyst/intelligence-schema.json`. Edit the manifest and regenerate; never hand-edit table definitions here.

## Phase A - Create tables and native columns

Create tables in the order below. Catalyst creates `ROWID`, `CREATORID`, `CREATEDTIME`, and `MODIFIEDTIME`; do not add them manually.

## Create table: TRN_CaseFeature

- Zone: TRANSFORMATION
- Load order: 10
- Application business ID: `CaseFeatureID`

| Order | Column | Origin | Catalyst type | Max length | Mandatory | Unique | Search index | PII/ePHI | Default |
|---:|---|---|---|---:|---|---|---|---|---|
| 1 | `CaseFeatureID` | SYSTEM | Var Char | 64 | Yes | Yes | Yes | No | - |
| 2 | `SourceCaseMasterID` | SOURCE | BigInt | - | Yes | No | Yes | No | - |
| 3 | `CrimeTypeCode` | DERIVED | Var Char | 64 | Yes | No | Yes | No | - |
| 4 | `TimeFeaturesJSON` | DERIVED | Text | - | Yes | No | No | No | - |
| 5 | `LegalFeaturesJSON` | DERIVED | Text | - | Yes | No | No | No | - |
| 6 | `ModusOperandiTagsJSON` | DERIVED | Text | - | Yes | No | No | No | - |
| 7 | `QualityScore` | DERIVED | Double | - | Yes | No | No | No | - |
| 8 | `FeatureVersion` | SYSTEM | Var Char | 32 | Yes | No | Yes | No | - |
| 9 | `SyntheticData` | SYSTEM | Boolean | - | Yes | No | No | No | Yes |

## Create table: TRN_DistrictContext

- Zone: TRANSFORMATION
- Load order: 10
- Application business ID: `DistrictContextID`

| Order | Column | Origin | Catalyst type | Max length | Mandatory | Unique | Search index | PII/ePHI | Default |
|---:|---|---|---|---:|---|---|---|---|---|
| 1 | `DistrictContextID` | SYSTEM | Var Char | 64 | Yes | Yes | Yes | No | - |
| 2 | `UnitID` | SOURCE | BigInt | - | Yes | No | Yes | No | - |
| 3 | `PeriodStart` | SOURCE | Date | - | Yes | No | No | No | - |
| 4 | `PeriodEnd` | SOURCE | Date | - | Yes | No | No | No | - |
| 5 | `IndicatorsJSON` | SOURCE | Text | - | Yes | No | No | No | - |
| 6 | `SourceLabel` | SOURCE | Var Char | 128 | Yes | No | No | No | - |
| 7 | `ContextVersion` | SYSTEM | Var Char | 32 | Yes | No | Yes | No | - |
| 8 | `Limitation` | SYSTEM | Text | - | Yes | No | No | No | - |
| 9 | `SyntheticData` | SYSTEM | Boolean | - | Yes | No | No | No | Yes |

## Create table: TRN_LocationFeature

- Zone: TRANSFORMATION
- Load order: 10
- Application business ID: `LocationFeatureID`

| Order | Column | Origin | Catalyst type | Max length | Mandatory | Unique | Search index | PII/ePHI | Default |
|---:|---|---|---|---:|---|---|---|---|---|
| 1 | `LocationFeatureID` | SYSTEM | Var Char | 64 | Yes | Yes | Yes | No | - |
| 2 | `SourceCaseMasterID` | SOURCE | BigInt | - | Yes | No | Yes | No | - |
| 3 | `Latitude` | SOURCE | Double | - | Yes | No | No | No | - |
| 4 | `Longitude` | SOURCE | Double | - | Yes | No | No | No | - |
| 5 | `AreaType` | DERIVED | Var Char | 32 | Yes | No | Yes | No | - |
| 6 | `AreaID` | DERIVED | Var Char | 64 | Yes | No | Yes | No | - |
| 7 | `FeatureVersion` | SYSTEM | Var Char | 32 | Yes | No | Yes | No | - |
| 8 | `SyntheticData` | SYSTEM | Boolean | - | Yes | No | No | No | Yes |

## Create table: TRN_PersonResolution

- Zone: TRANSFORMATION
- Load order: 10
- Application business ID: `PersonResolutionID`

| Order | Column | Origin | Catalyst type | Max length | Mandatory | Unique | Search index | PII/ePHI | Default |
|---:|---|---|---|---:|---|---|---|---|---|
| 1 | `PersonResolutionID` | SYSTEM | Var Char | 64 | Yes | Yes | Yes | No | - |
| 2 | `SourceAccusedID` | SOURCE | BigInt | - | Yes | No | Yes | Yes | - |
| 3 | `CanonicalPersonKey` | DERIVED | Var Char | 128 | No | No | Yes | Yes | - |
| 4 | `ResolutionStatus` | DERIVED | Var Char | 32 | Yes | No | Yes | No | - |
| 5 | `Confidence` | DERIVED | Double | - | Yes | No | No | No | - |
| 6 | `EvidenceJSON` | DERIVED | Text | - | Yes | No | No | Yes | - |
| 7 | `MethodVersion` | SYSTEM | Var Char | 32 | Yes | No | Yes | No | - |
| 8 | `SyntheticData` | SYSTEM | Boolean | - | Yes | No | No | No | Yes |

## Create table: INT_AnalysisRun

- Zone: INTELLIGENCE
- Load order: 20
- Application business ID: `AnalysisRunID`

| Order | Column | Origin | Catalyst type | Max length | Mandatory | Unique | Search index | PII/ePHI | Default |
|---:|---|---|---|---:|---|---|---|---|---|
| 1 | `AnalysisRunID` | SYSTEM | Var Char | 64 | Yes | Yes | Yes | No | - |
| 2 | `Status` | SYSTEM | Var Char | 24 | Yes | No | Yes | No | - |
| 3 | `ObservationStart` | SYSTEM | DateTime | - | Yes | No | No | No | - |
| 4 | `ObservationEnd` | SYSTEM | DateTime | - | Yes | No | No | No | - |
| 5 | `EngineVersion` | SYSTEM | Var Char | 32 | Yes | No | Yes | No | - |
| 6 | `MethodVersion` | SYSTEM | Var Char | 32 | Yes | No | Yes | No | - |
| 7 | `InputManifestHash` | SYSTEM | Var Char | 64 | Yes | No | Yes | No | - |
| 8 | `CompletedAt` | SYSTEM | DateTime | - | No | No | No | No | - |
| 9 | `SyntheticData` | SYSTEM | Boolean | - | Yes | No | No | No | Yes |

## Create table: INT_Anomaly

- Zone: INTELLIGENCE
- Load order: 30
- Application business ID: `AnomalyID`

| Order | Column | Origin | Catalyst type | Max length | Mandatory | Unique | Search index | PII/ePHI | Default |
|---:|---|---|---|---:|---|---|---|---|---|
| 1 | `AnomalyID` | SYSTEM | Var Char | 64 | Yes | Yes | Yes | No | - |
| 2 | `AreaID` | DERIVED | Var Char | 64 | Yes | No | Yes | No | - |
| 3 | `SignalType` | DERIVED | Var Char | 64 | Yes | No | Yes | No | - |
| 4 | `ObservedValue` | DERIVED | Double | - | Yes | No | No | No | - |
| 5 | `BaselineValue` | DERIVED | Double | - | Yes | No | No | No | - |
| 6 | `Severity` | DERIVED | Double | - | Yes | No | No | No | - |
| 7 | `MethodVersion` | SYSTEM | Var Char | 32 | Yes | No | Yes | No | - |
| 8 | `Limitation` | SYSTEM | Text | - | Yes | No | No | No | - |
| 9 | `SyntheticData` | SYSTEM | Boolean | - | Yes | No | No | No | Yes |

## Create table: INT_AreaRisk

- Zone: INTELLIGENCE
- Load order: 30
- Application business ID: `AreaRiskID`

| Order | Column | Origin | Catalyst type | Max length | Mandatory | Unique | Search index | PII/ePHI | Default |
|---:|---|---|---|---:|---|---|---|---|---|
| 1 | `AreaRiskID` | SYSTEM | Var Char | 64 | Yes | Yes | Yes | No | - |
| 2 | `AreaType` | DERIVED | Var Char | 32 | Yes | No | Yes | No | - |
| 3 | `AreaID` | DERIVED | Var Char | 64 | Yes | No | Yes | No | - |
| 4 | `PeriodStart` | DERIVED | DateTime | - | Yes | No | No | No | - |
| 5 | `PeriodEnd` | DERIVED | DateTime | - | Yes | No | No | No | - |
| 6 | `Score` | DERIVED | Double | - | Yes | No | No | No | - |
| 7 | `Completeness` | DERIVED | Double | - | Yes | No | No | No | - |
| 8 | `ComponentsJSON` | DERIVED | Text | - | Yes | No | No | No | - |
| 9 | `MethodVersion` | SYSTEM | Var Char | 32 | Yes | No | Yes | No | - |
| 10 | `Limitation` | SYSTEM | Text | - | Yes | No | No | No | - |
| 11 | `SyntheticData` | SYSTEM | Boolean | - | Yes | No | No | No | Yes |

## Create table: INT_Hotspot

- Zone: INTELLIGENCE
- Load order: 30
- Application business ID: `HotspotID`

| Order | Column | Origin | Catalyst type | Max length | Mandatory | Unique | Search index | PII/ePHI | Default |
|---:|---|---|---|---:|---|---|---|---|---|
| 1 | `HotspotID` | SYSTEM | Var Char | 64 | Yes | Yes | Yes | No | - |
| 2 | `AreaID` | DERIVED | Var Char | 64 | Yes | No | Yes | No | - |
| 3 | `CentroidLatitude` | DERIVED | Double | - | Yes | No | No | No | - |
| 4 | `CentroidLongitude` | DERIVED | Double | - | Yes | No | No | No | - |
| 5 | `CaseCount` | DERIVED | Int | - | Yes | No | No | No | - |
| 6 | `Severity` | DERIVED | Double | - | Yes | No | No | No | - |
| 7 | `MethodVersion` | SYSTEM | Var Char | 32 | Yes | No | Yes | No | - |
| 8 | `Limitation` | SYSTEM | Text | - | Yes | No | No | No | - |
| 9 | `SyntheticData` | SYSTEM | Boolean | - | Yes | No | No | No | Yes |

## Create table: INT_NetworkNode

- Zone: INTELLIGENCE
- Load order: 30
- Application business ID: `NetworkNodeID`

| Order | Column | Origin | Catalyst type | Max length | Mandatory | Unique | Search index | PII/ePHI | Default |
|---:|---|---|---|---:|---|---|---|---|---|
| 1 | `NetworkNodeID` | SYSTEM | Var Char | 64 | Yes | Yes | Yes | No | - |
| 2 | `NodeType` | DERIVED | Var Char | 32 | Yes | No | Yes | No | - |
| 3 | `SourceEntity` | SOURCE | Var Char | 64 | Yes | No | Yes | No | - |
| 4 | `SourceBusinessID` | SOURCE | Var Char | 128 | Yes | No | Yes | Yes | - |
| 5 | `EvidenceLabel` | SYSTEM | Var Char | 32 | Yes | No | Yes | No | - |
| 6 | `MethodVersion` | SYSTEM | Var Char | 32 | Yes | No | Yes | No | - |
| 7 | `SyntheticData` | SYSTEM | Boolean | - | Yes | No | No | No | Yes |

## Create table: INT_Pattern

- Zone: INTELLIGENCE
- Load order: 30
- Application business ID: `PatternID`

| Order | Column | Origin | Catalyst type | Max length | Mandatory | Unique | Search index | PII/ePHI | Default |
|---:|---|---|---|---:|---|---|---|---|---|
| 1 | `PatternID` | SYSTEM | Var Char | 64 | Yes | Yes | Yes | No | - |
| 2 | `PatternType` | DERIVED | Var Char | 64 | Yes | No | Yes | No | - |
| 3 | `Title` | DERIVED | Var Char | 255 | Yes | No | No | No | - |
| 4 | `Confidence` | DERIVED | Double | - | Yes | No | No | No | - |
| 5 | `SignalComponentsJSON` | DERIVED | Text | - | Yes | No | No | No | - |
| 6 | `Recommendation` | DERIVED | Text | - | Yes | No | No | No | - |
| 7 | `MethodVersion` | SYSTEM | Var Char | 32 | Yes | No | Yes | No | - |
| 8 | `Limitation` | SYSTEM | Text | - | Yes | No | No | No | - |
| 9 | `SyntheticData` | SYSTEM | Boolean | - | Yes | No | No | No | Yes |

## Create table: INT_RepeatOffenderSignal

- Zone: INTELLIGENCE
- Load order: 30
- Application business ID: `RepeatSignalID`

| Order | Column | Origin | Catalyst type | Max length | Mandatory | Unique | Search index | PII/ePHI | Default |
|---:|---|---|---|---:|---|---|---|---|---|
| 1 | `RepeatSignalID` | SYSTEM | Var Char | 64 | Yes | Yes | Yes | No | - |
| 2 | `CanonicalPersonKey` | DERIVED | Var Char | 128 | Yes | No | Yes | Yes | - |
| 3 | `ResolutionStatus` | DERIVED | Var Char | 32 | Yes | No | Yes | No | - |
| 4 | `CaseCount` | DERIVED | Int | - | Yes | No | No | No | - |
| 5 | `Confidence` | DERIVED | Double | - | Yes | No | No | No | - |
| 6 | `EvidenceJSON` | DERIVED | Text | - | Yes | No | No | Yes | - |
| 7 | `MethodVersion` | SYSTEM | Var Char | 32 | Yes | No | Yes | No | - |
| 8 | `Limitation` | SYSTEM | Text | - | Yes | No | No | No | - |
| 9 | `SyntheticData` | SYSTEM | Boolean | - | Yes | No | No | No | Yes |

## Create table: INT_NetworkEdge

- Zone: INTELLIGENCE
- Load order: 31
- Application business ID: `NetworkEdgeID`

| Order | Column | Origin | Catalyst type | Max length | Mandatory | Unique | Search index | PII/ePHI | Default |
|---:|---|---|---|---:|---|---|---|---|---|
| 1 | `NetworkEdgeID` | SYSTEM | Var Char | 64 | Yes | Yes | Yes | No | - |
| 2 | `EdgeType` | DERIVED | Var Char | 32 | Yes | No | Yes | No | - |
| 3 | `EvidenceLabel` | SYSTEM | Var Char | 32 | Yes | No | Yes | No | - |
| 4 | `Weight` | DERIVED | Double | - | Yes | No | No | No | - |
| 5 | `MethodVersion` | SYSTEM | Var Char | 32 | Yes | No | Yes | No | - |
| 6 | `Limitation` | SYSTEM | Text | - | Yes | No | No | No | - |
| 7 | `SyntheticData` | SYSTEM | Boolean | - | Yes | No | No | No | Yes |

## Create table: INT_FindingEvidence

- Zone: INTELLIGENCE
- Load order: 32
- Application business ID: `FindingEvidenceID`

| Order | Column | Origin | Catalyst type | Max length | Mandatory | Unique | Search index | PII/ePHI | Default |
|---:|---|---|---|---:|---|---|---|---|---|
| 1 | `FindingEvidenceID` | SYSTEM | Var Char | 64 | Yes | Yes | Yes | No | - |
| 2 | `FindingType` | SYSTEM | Var Char | 32 | Yes | No | Yes | No | - |
| 3 | `FindingBusinessID` | SYSTEM | Var Char | 64 | Yes | No | Yes | No | - |
| 4 | `SourceEntity` | SOURCE | Var Char | 64 | Yes | No | Yes | No | - |
| 5 | `SourceBusinessID` | SOURCE | Var Char | 128 | Yes | No | Yes | Yes | - |
| 6 | `EvidenceLabel` | SYSTEM | Var Char | 32 | Yes | No | Yes | No | - |
| 7 | `EvidenceSummary` | SYSTEM | Text | - | Yes | No | No | Yes | - |
| 8 | `MethodVersion` | SYSTEM | Var Char | 32 | Yes | No | Yes | No | - |
| 9 | `SyntheticData` | SYSTEM | Boolean | - | Yes | No | No | No | Yes |

## Create table: WF_Alert

- Zone: WORKFLOW
- Load order: 40
- Application business ID: `AlertID`

| Order | Column | Origin | Catalyst type | Max length | Mandatory | Unique | Search index | PII/ePHI | Default |
|---:|---|---|---|---:|---|---|---|---|---|
| 1 | `AlertID` | SYSTEM | Var Char | 64 | Yes | Yes | Yes | No | - |
| 2 | `FindingType` | SYSTEM | Var Char | 32 | Yes | No | Yes | No | - |
| 3 | `FindingBusinessID` | SYSTEM | Var Char | 64 | Yes | No | Yes | No | - |
| 4 | `ScopeUnitID` | SOURCE | BigInt | - | Yes | No | Yes | No | - |
| 5 | `Status` | WORKFLOW | Var Char | 24 | Yes | No | Yes | No | - |
| 6 | `Severity` | DERIVED | Double | - | Yes | No | No | No | - |
| 7 | `OriginalFindingJSON` | SYSTEM | Text | - | Yes | No | No | Yes | - |
| 8 | `MethodVersion` | SYSTEM | Var Char | 32 | Yes | No | Yes | No | - |
| 9 | `CreatedAt` | SYSTEM | DateTime | - | Yes | No | No | No | - |
| 10 | `SyntheticData` | SYSTEM | Boolean | - | Yes | No | No | No | Yes |

## Create table: WF_AlertEvidence

- Zone: WORKFLOW
- Load order: 41
- Application business ID: `AlertEvidenceID`

| Order | Column | Origin | Catalyst type | Max length | Mandatory | Unique | Search index | PII/ePHI | Default |
|---:|---|---|---|---:|---|---|---|---|---|
| 1 | `AlertEvidenceID` | SYSTEM | Var Char | 64 | Yes | Yes | Yes | No | - |
| 2 | `EvidenceOrder` | SYSTEM | Int | - | Yes | No | No | No | - |
| 3 | `SyntheticData` | SYSTEM | Boolean | - | Yes | No | No | No | Yes |

## Create table: WF_AnalystConclusion

- Zone: WORKFLOW
- Load order: 42
- Application business ID: `ConclusionID`

| Order | Column | Origin | Catalyst type | Max length | Mandatory | Unique | Search index | PII/ePHI | Default |
|---:|---|---|---|---:|---|---|---|---|---|
| 1 | `ConclusionID` | SYSTEM | Var Char | 64 | Yes | Yes | Yes | No | - |
| 2 | `AnalystEmployeeID` | WORKFLOW | BigInt | - | Yes | No | Yes | Yes | - |
| 3 | `ConclusionCode` | WORKFLOW | Var Char | 32 | Yes | No | Yes | No | - |
| 4 | `ConclusionText` | WORKFLOW | Text | - | Yes | No | No | Yes | - |
| 5 | `EvidencePackPath` | WORKFLOW | Var Char | 255 | No | No | No | Yes | - |
| 6 | `CreatedAt` | SYSTEM | DateTime | - | Yes | No | No | No | - |
| 7 | `SyntheticData` | SYSTEM | Boolean | - | Yes | No | No | No | Yes |

## Create table: WF_Assignment

- Zone: WORKFLOW
- Load order: 42
- Application business ID: `AssignmentID`

| Order | Column | Origin | Catalyst type | Max length | Mandatory | Unique | Search index | PII/ePHI | Default |
|---:|---|---|---|---:|---|---|---|---|---|
| 1 | `AssignmentID` | SYSTEM | Var Char | 64 | Yes | Yes | Yes | No | - |
| 2 | `AssignedUnitID` | WORKFLOW | BigInt | - | Yes | No | Yes | No | - |
| 3 | `AssignedEmployeeID` | WORKFLOW | BigInt | - | No | No | Yes | Yes | - |
| 4 | `AssignedByEmployeeID` | WORKFLOW | BigInt | - | Yes | No | Yes | Yes | - |
| 5 | `Reason` | WORKFLOW | Text | - | Yes | No | No | No | - |
| 6 | `AssignedAt` | SYSTEM | DateTime | - | Yes | No | No | No | - |
| 7 | `SyntheticData` | SYSTEM | Boolean | - | Yes | No | No | No | Yes |

## Create table: WF_Outcome

- Zone: WORKFLOW
- Load order: 42
- Application business ID: `OutcomeID`

| Order | Column | Origin | Catalyst type | Max length | Mandatory | Unique | Search index | PII/ePHI | Default |
|---:|---|---|---|---:|---|---|---|---|---|
| 1 | `OutcomeID` | SYSTEM | Var Char | 64 | Yes | Yes | Yes | No | - |
| 2 | `RecordedByEmployeeID` | WORKFLOW | BigInt | - | Yes | No | Yes | Yes | - |
| 3 | `OutcomeCode` | WORKFLOW | Var Char | 32 | Yes | No | Yes | No | - |
| 4 | `OutcomeText` | WORKFLOW | Text | - | Yes | No | No | Yes | - |
| 5 | `RecordedAt` | SYSTEM | DateTime | - | Yes | No | No | No | - |
| 6 | `SyntheticData` | SYSTEM | Boolean | - | Yes | No | No | No | Yes |

## Create table: WF_AuditEvent

- Zone: WORKFLOW
- Load order: 43
- Application business ID: `AuditEventID`

| Order | Column | Origin | Catalyst type | Max length | Mandatory | Unique | Search index | PII/ePHI | Default |
|---:|---|---|---|---:|---|---|---|---|---|
| 1 | `AuditEventID` | SYSTEM | Var Char | 64 | Yes | Yes | Yes | No | - |
| 2 | `ActorEmployeeID` | WORKFLOW | BigInt | - | No | No | Yes | Yes | - |
| 3 | `ActorType` | WORKFLOW | Var Char | 24 | Yes | No | Yes | No | - |
| 4 | `EventType` | WORKFLOW | Var Char | 64 | Yes | No | Yes | No | - |
| 5 | `EntityType` | WORKFLOW | Var Char | 64 | Yes | No | Yes | No | - |
| 6 | `EntityBusinessID` | WORKFLOW | Var Char | 64 | Yes | No | Yes | No | - |
| 7 | `EventPayloadJSON` | WORKFLOW | Text | - | Yes | No | No | Yes | - |
| 8 | `PreviousEventHash` | SYSTEM | Var Char | 64 | No | No | Yes | No | - |
| 9 | `EventHash` | SYSTEM | Var Char | 64 | Yes | Yes | Yes | No | - |
| 10 | `OccurredAt` | SYSTEM | DateTime | - | Yes | No | No | No | - |
| 11 | `SyntheticData` | SYSTEM | Boolean | - | Yes | No | No | No | Yes |

## Phase B - Add Foreign Key columns

Add these after all Phase A tables exist. For every row below select the parent `ROWID` and **On Delete = Null**. Never select Cascade.

| Order | Child table | Column | Parent table | Mandatory | On delete |
|---:|---|---|---|---|---|
| 1 | `INT_Anomaly` | `AnalysisRunRef` | `INT_AnalysisRun` | Yes | NULL |
| 2 | `INT_AreaRisk` | `AnalysisRunRef` | `INT_AnalysisRun` | Yes | NULL |
| 3 | `INT_Hotspot` | `AnalysisRunRef` | `INT_AnalysisRun` | Yes | NULL |
| 4 | `INT_NetworkNode` | `AnalysisRunRef` | `INT_AnalysisRun` | Yes | NULL |
| 5 | `INT_Pattern` | `AnalysisRunRef` | `INT_AnalysisRun` | Yes | NULL |
| 6 | `INT_RepeatOffenderSignal` | `AnalysisRunRef` | `INT_AnalysisRun` | Yes | NULL |
| 7 | `INT_NetworkEdge` | `AnalysisRunRef` | `INT_AnalysisRun` | Yes | NULL |
| 8 | `INT_NetworkEdge` | `FromNodeRef` | `INT_NetworkNode` | Yes | NULL |
| 9 | `INT_NetworkEdge` | `ToNodeRef` | `INT_NetworkNode` | Yes | NULL |
| 10 | `INT_FindingEvidence` | `AnalysisRunRef` | `INT_AnalysisRun` | Yes | NULL |
| 11 | `WF_Alert` | `AnalysisRunRef` | `INT_AnalysisRun` | Yes | NULL |
| 12 | `WF_AlertEvidence` | `AlertRef` | `WF_Alert` | Yes | NULL |
| 13 | `WF_AlertEvidence` | `FindingEvidenceRef` | `INT_FindingEvidence` | Yes | NULL |
| 14 | `WF_AnalystConclusion` | `AlertRef` | `WF_Alert` | Yes | NULL |
| 15 | `WF_Assignment` | `AlertRef` | `WF_Alert` | Yes | NULL |
| 16 | `WF_Outcome` | `AlertRef` | `WF_Alert` | Yes | NULL |
| 17 | `WF_AuditEvent` | `AlertRef` | `WF_Alert` | No | NULL |

## Post-creation verification checklist

- [ ] Confirm all 19 application tables exist in Catalyst Development.
- [ ] Confirm each native column matches type, length, Mandatory, Unique, Search index, and PII/ePHI settings above.
- [ ] Confirm every Foreign Key points to parent `ROWID` with On Delete = Null.
- [ ] Confirm `INT_AreaRisk` contains no person, accused, or offender field.
- [ ] Confirm every table contains mandatory `SyntheticData` with default `true`.
- [ ] Create a Catalyst IaC export and compare it with the manifest before loading records.
- [ ] Run `npm.cmd run intelligence-schema:validate` and the complete test suite.

| Table | Expected columns | Catalyst table ID | Observed columns | Verified by | Verified at | Evidence path |
|---|---:|---|---:|---|---|---|
| `TRN_CaseFeature` | 9 |  |  |  |  |  |
| `TRN_DistrictContext` | 9 |  |  |  |  |  |
| `TRN_LocationFeature` | 8 |  |  |  |  |  |
| `TRN_PersonResolution` | 8 |  |  |  |  |  |
| `INT_AnalysisRun` | 9 |  |  |  |  |  |
| `INT_Anomaly` | 10 |  |  |  |  |  |
| `INT_AreaRisk` | 12 |  |  |  |  |  |
| `INT_Hotspot` | 10 |  |  |  |  |  |
| `INT_NetworkNode` | 8 |  |  |  |  |  |
| `INT_Pattern` | 10 |  |  |  |  |  |
| `INT_RepeatOffenderSignal` | 10 |  |  |  |  |  |
| `INT_NetworkEdge` | 10 |  |  |  |  |  |
| `INT_FindingEvidence` | 10 |  |  |  |  |  |
| `WF_Alert` | 11 |  |  |  |  |  |
| `WF_AlertEvidence` | 5 |  |  |  |  |  |
| `WF_AnalystConclusion` | 8 |  |  |  |  |  |
| `WF_Assignment` | 8 |  |  |  |  |  |
| `WF_Outcome` | 7 |  |  |  |  |  |
| `WF_AuditEvent` | 12 |  |  |  |  |  |

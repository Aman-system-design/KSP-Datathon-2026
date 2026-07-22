# Catalyst Intelligence and Workflow Tables Runbook

**Manifest version:** 1.0.0

**Project ID:** 43492000000013049

**Environment:** Development

> **Development only.** Do not create these tables in Production and do not load real police data. The MVP dataset is synthetic.

This document is generated only from `schema/catalyst/intelligence-schema.json`. Edit the manifest and regenerate; never hand-edit table definitions here.

## Phase A - Create tables and native columns

Create tables in the order below. Catalyst creates `ROWID`, `CREATORID`, `CREATEDTIME`, and `MODIFIEDTIME`; do not add them manually.

## Create table: CFG_UserAccess

- Zone: CONFIGURATION
- Load order: 1
- Application business ID: `AccessProfileID`

| Order | Column | Origin | Catalyst type | Max length | Minimum | Mandatory | Unique | Search index | PII/ePHI | Default |
|---:|---|---|---|---:|---:|---|---|---|---|---|
| 1 | `AccessProfileID` | SYSTEM | Var Char | 64 | - | Yes | Yes | Yes | No | - |
| 2 | `CatalystUserID` | AUTHENTICATION | Var Char | 128 | - | Yes | Yes | Yes | Yes | - |
| 3 | `EmployeeID` | SOURCE | BigInt | - | - | No | No | Yes | Yes | - |
| 4 | `DefaultRole` | CONFIGURATION | Var Char | 48 | - | Yes | No | Yes | No | - |
| 5 | `ScopeUnitID` | SOURCE | BigInt | - | - | Yes | No | Yes | No | - |
| 6 | `DemoPersonaAllowed` | CONFIGURATION | Boolean | - | - | Yes | No | No | No | No |
| 7 | `PermissionVersion` | CONFIGURATION | Var Char | 32 | - | Yes | No | Yes | No | - |
| 8 | `Active` | CONFIGURATION | Boolean | - | - | Yes | No | No | No | Yes |
| 9 | `SyntheticData` | SYSTEM | Boolean | - | - | Yes | No | No | No | Yes |

## Create table: CFG_Dashboard

- Zone: CONFIGURATION
- Load order: 2
- Application business ID: `DashboardID`

| Order | Column | Origin | Catalyst type | Max length | Minimum | Mandatory | Unique | Search index | PII/ePHI | Default |
|---:|---|---|---|---:|---:|---|---|---|---|---|
| 1 | `DashboardID` | SYSTEM | Var Char | 64 | - | Yes | Yes | Yes | No | - |
| 2 | `Name` | CONFIGURATION | Var Char | 128 | - | Yes | No | Yes | No | - |
| 3 | `Description` | CONFIGURATION | Text | - | - | No | No | No | No | - |
| 4 | `OwnerUserID` | AUTHENTICATION | Var Char | 128 | - | Yes | No | Yes | Yes | - |
| 5 | `Visibility` | AUTHORIZATION | Var Char | 24 | - | Yes | No | Yes | No | - |
| 6 | `DefaultRole` | AUTHORIZATION | Var Char | 48 | - | No | No | Yes | No | - |
| 7 | `Version` | SYSTEM | Int | - | - | Yes | No | No | No | - |
| 8 | `CreatedAt` | SYSTEM | DateTime | - | - | Yes | No | No | No | - |
| 9 | `UpdatedAt` | SYSTEM | DateTime | - | - | Yes | No | No | No | - |
| 10 | `SyntheticData` | SYSTEM | Boolean | - | - | Yes | No | No | No | Yes |

## Create table: CFG_ReportDefinition

- Zone: CONFIGURATION
- Load order: 2
- Application business ID: `ReportDefinitionID`

| Order | Column | Origin | Catalyst type | Max length | Minimum | Mandatory | Unique | Search index | PII/ePHI | Default |
|---:|---|---|---|---:|---:|---|---|---|---|---|
| 1 | `ReportDefinitionID` | SYSTEM | Var Char | 64 | - | Yes | Yes | Yes | No | - |
| 2 | `Name` | CONFIGURATION | Var Char | 128 | - | Yes | No | Yes | No | - |
| 3 | `Description` | CONFIGURATION | Text | - | - | No | No | No | No | - |
| 4 | `OwnerUserID` | AUTHENTICATION | Var Char | 128 | - | Yes | No | Yes | Yes | - |
| 5 | `SourceKey` | CONFIGURATION | Var Char | 64 | - | Yes | No | Yes | No | - |
| 6 | `DefinitionJSON` | CONFIGURATION | Text | - | - | Yes | No | No | No | - |
| 7 | `Visibility` | AUTHORIZATION | Var Char | 24 | - | Yes | No | Yes | No | - |
| 8 | `Version` | SYSTEM | Int | - | - | Yes | No | No | No | - |
| 9 | `CreatedAt` | SYSTEM | DateTime | - | - | Yes | No | No | No | - |
| 10 | `UpdatedAt` | SYSTEM | DateTime | - | - | Yes | No | No | No | - |
| 11 | `SyntheticData` | SYSTEM | Boolean | - | - | Yes | No | No | No | Yes |

## Create table: CFG_ContentShare

- Zone: CONFIGURATION
- Load order: 3
- Application business ID: `ContentShareID`

| Order | Column | Origin | Catalyst type | Max length | Minimum | Mandatory | Unique | Search index | PII/ePHI | Default |
|---:|---|---|---|---:|---:|---|---|---|---|---|
| 1 | `ContentShareID` | SYSTEM | Var Char | 64 | - | Yes | Yes | Yes | No | - |
| 2 | `ContentType` | CONFIGURATION | Var Char | 24 | - | Yes | No | Yes | No | - |
| 3 | `ContentBusinessID` | CONFIGURATION | Var Char | 64 | - | Yes | No | Yes | No | - |
| 4 | `TargetUserID` | AUTHORIZATION | Var Char | 128 | - | No | No | Yes | Yes | - |
| 5 | `TargetRole` | AUTHORIZATION | Var Char | 48 | - | No | No | Yes | No | - |
| 6 | `TargetUnitID` | AUTHORIZATION | BigInt | - | - | No | No | Yes | No | - |
| 7 | `Permission` | AUTHORIZATION | Var Char | 24 | - | Yes | No | Yes | No | - |
| 8 | `SharedByUserID` | AUTHENTICATION | Var Char | 128 | - | Yes | No | Yes | Yes | - |
| 9 | `CreatedAt` | SYSTEM | DateTime | - | - | Yes | No | No | No | - |
| 10 | `SyntheticData` | SYSTEM | Boolean | - | - | Yes | No | No | No | Yes |

## Create table: CFG_DashboardItem

- Zone: CONFIGURATION
- Load order: 3
- Application business ID: `DashboardItemID`

| Order | Column | Origin | Catalyst type | Max length | Minimum | Mandatory | Unique | Search index | PII/ePHI | Default |
|---:|---|---|---|---:|---:|---|---|---|---|---|
| 1 | `DashboardItemID` | SYSTEM | Var Char | 64 | - | Yes | Yes | Yes | No | - |
| 2 | `GridColumn` | CONFIGURATION | Int | - | - | Yes | No | No | No | - |
| 3 | `GridRow` | CONFIGURATION | Int | - | - | Yes | No | No | No | - |
| 4 | `GridWidth` | CONFIGURATION | Int | - | - | Yes | No | No | No | - |
| 5 | `GridHeight` | CONFIGURATION | Int | - | - | Yes | No | No | No | - |
| 6 | `DisplayOrder` | CONFIGURATION | Int | - | - | Yes | No | No | No | - |
| 7 | `Version` | SYSTEM | Int | - | - | Yes | No | No | No | - |
| 8 | `SyntheticData` | SYSTEM | Boolean | - | - | Yes | No | No | No | Yes |

## Create table: CFG_MapView

- Zone: CONFIGURATION
- Load order: 3
- Application business ID: `MapViewID`

| Order | Column | Origin | Catalyst type | Max length | Minimum | Mandatory | Unique | Search index | PII/ePHI | Default |
|---:|---|---|---|---:|---:|---|---|---|---|---|
| 1 | `MapViewID` | SYSTEM | Var Char | 64 | - | Yes | Yes | Yes | No | - |
| 2 | `OrganizationID` | AUTHORIZATION | Var Char | 64 | - | Yes | No | Yes | No | - |
| 3 | `Name` | CONFIGURATION | Var Char | 128 | - | Yes | No | Yes | No | - |
| 4 | `OwnerEmployeeID` | AUTHENTICATION | BigInt | - | - | Yes | No | Yes | Yes | - |
| 5 | `Visibility` | AUTHORIZATION | Var Char | 32 | - | Yes | No | Yes | No | - |
| 6 | `CurrentVersion` | SYSTEM | Int | - | 1 | Yes | No | No | No | - |
| 7 | `Status` | SYSTEM | Var Char | 24 | - | Yes | No | Yes | No | - |
| 8 | `CreatedAt` | SYSTEM | DateTime | - | - | Yes | No | No | No | - |
| 9 | `UpdatedAt` | SYSTEM | DateTime | - | - | Yes | No | No | No | - |
| 10 | `SyntheticData` | SYSTEM | Boolean | - | - | Yes | No | No | No | Yes |

## Create table: CFG_UserPreference

- Zone: CONFIGURATION
- Load order: 3
- Application business ID: `UserPreferenceID`

| Order | Column | Origin | Catalyst type | Max length | Minimum | Mandatory | Unique | Search index | PII/ePHI | Default |
|---:|---|---|---|---:|---:|---|---|---|---|---|
| 1 | `UserPreferenceID` | SYSTEM | Var Char | 64 | - | Yes | Yes | Yes | No | - |
| 2 | `CatalystUserID` | AUTHENTICATION | Var Char | 128 | - | Yes | Yes | Yes | Yes | - |
| 3 | `PreferencesJSON` | CONFIGURATION | Text | - | - | Yes | No | No | No | - |
| 4 | `Version` | SYSTEM | Int | - | - | Yes | No | No | No | - |
| 5 | `UpdatedAt` | SYSTEM | DateTime | - | - | Yes | No | No | No | - |
| 6 | `SyntheticData` | SYSTEM | Boolean | - | - | Yes | No | No | No | Yes |

## Create table: CFG_MapViewVersion

- Zone: CONFIGURATION
- Load order: 4
- Application business ID: `MapViewVersionKey`

| Order | Column | Origin | Catalyst type | Max length | Minimum | Mandatory | Unique | Search index | PII/ePHI | Default |
|---:|---|---|---|---:|---:|---|---|---|---|---|
| 1 | `MapViewVersionKey` | SYSTEM | Var Char | 128 | - | Yes | Yes | Yes | No | - |
| 2 | `MapViewID` | SYSTEM | Var Char | 64 | - | Yes | No | Yes | No | - |
| 3 | `OrganizationID` | AUTHORIZATION | Var Char | 64 | - | Yes | No | Yes | No | - |
| 4 | `Version` | SYSTEM | Int | - | 1 | Yes | No | No | No | - |
| 5 | `DefinitionJSON` | CONFIGURATION | Text | - | - | Yes | No | No | No | - |
| 6 | `DefinitionHash` | SYSTEM | Var Char | 64 | - | Yes | No | Yes | No | - |
| 7 | `PublishedAt` | SYSTEM | DateTime | - | - | No | No | No | No | - |
| 8 | `CreatedByEmployeeID` | AUTHENTICATION | BigInt | - | - | Yes | No | Yes | Yes | - |
| 9 | `CreatedAt` | SYSTEM | DateTime | - | - | Yes | No | No | No | - |
| 10 | `SyntheticData` | SYSTEM | Boolean | - | - | Yes | No | No | No | Yes |

## Create table: OPS_IntelligenceRunRequest

- Zone: OPERATIONS
- Load order: 5
- Application business ID: `RunRequestID`

| Order | Column | Origin | Catalyst type | Max length | Minimum | Mandatory | Unique | Search index | PII/ePHI | Default |
|---:|---|---|---|---:|---:|---|---|---|---|---|
| 1 | `RunRequestID` | SYSTEM | Var Char | 64 | - | Yes | Yes | Yes | No | - |
| 2 | `IdempotencyKeyHash` | SYSTEM | Var Char | 64 | - | Yes | Yes | Yes | No | - |
| 3 | `RequestHash` | SYSTEM | Var Char | 64 | - | Yes | No | Yes | No | - |
| 4 | `BatchKey` | SYSTEM | Var Char | 128 | - | Yes | No | Yes | No | - |
| 5 | `Operation` | SYSTEM | Var Char | 32 | - | Yes | No | Yes | No | - |
| 6 | `RequestedBy` | AUTHENTICATION | Var Char | 128 | - | Yes | No | Yes | Yes | - |
| 7 | `Status` | SYSTEM | Var Char | 32 | - | Yes | No | Yes | No | - |
| 8 | `CatalystJobID` | SYSTEM | Var Char | 64 | - | No | No | Yes | No | - |
| 9 | `Attempt` | SYSTEM | Int | - | - | Yes | No | No | No | - |
| 10 | `RequestedAt` | SYSTEM | DateTime | - | - | Yes | No | No | No | - |
| 11 | `StartedAt` | SYSTEM | DateTime | - | - | No | No | No | No | - |
| 12 | `CompletedAt` | SYSTEM | DateTime | - | - | No | No | No | No | - |
| 13 | `UpdatedAt` | SYSTEM | DateTime | - | - | Yes | No | No | No | - |
| 14 | `FailedPhase` | SYSTEM | Var Char | 64 | - | No | No | Yes | No | - |
| 15 | `FailureCode` | SYSTEM | Var Char | 64 | - | No | No | Yes | No | - |
| 16 | `CurrentRunGroupID` | SYSTEM | Var Char | 64 | - | No | No | Yes | No | - |
| 17 | `SyntheticData` | SYSTEM | Boolean | - | - | Yes | No | No | No | Yes |

## Create table: TRN_CaseFeature

- Zone: TRANSFORMATION
- Load order: 10
- Application business ID: `CaseFeatureID`

| Order | Column | Origin | Catalyst type | Max length | Minimum | Mandatory | Unique | Search index | PII/ePHI | Default |
|---:|---|---|---|---:|---:|---|---|---|---|---|
| 1 | `CaseFeatureID` | SYSTEM | Var Char | 64 | - | Yes | Yes | Yes | No | - |
| 2 | `SourceCaseMasterID` | SOURCE | BigInt | - | - | Yes | No | Yes | No | - |
| 3 | `CrimeTypeCode` | DERIVED | Var Char | 64 | - | Yes | No | Yes | No | - |
| 4 | `TimeFeaturesJSON` | DERIVED | Text | - | - | Yes | No | No | No | - |
| 5 | `LegalFeaturesJSON` | DERIVED | Text | - | - | Yes | No | No | No | - |
| 6 | `ModusOperandiTagsJSON` | DERIVED | Text | - | - | Yes | No | No | No | - |
| 7 | `QualityScore` | DERIVED | Double | - | - | Yes | No | No | No | - |
| 8 | `FeatureVersion` | SYSTEM | Var Char | 32 | - | Yes | No | Yes | No | - |
| 9 | `SyntheticData` | SYSTEM | Boolean | - | - | Yes | No | No | No | Yes |

## Create table: TRN_DistrictContext

- Zone: TRANSFORMATION
- Load order: 10
- Application business ID: `DistrictContextID`

| Order | Column | Origin | Catalyst type | Max length | Minimum | Mandatory | Unique | Search index | PII/ePHI | Default |
|---:|---|---|---|---:|---:|---|---|---|---|---|
| 1 | `DistrictContextID` | SYSTEM | Var Char | 64 | - | Yes | Yes | Yes | No | - |
| 2 | `UnitID` | SOURCE | BigInt | - | - | Yes | No | Yes | No | - |
| 3 | `PeriodStart` | SOURCE | Date | - | - | Yes | No | No | No | - |
| 4 | `PeriodEnd` | SOURCE | Date | - | - | Yes | No | No | No | - |
| 5 | `IndicatorsJSON` | SOURCE | Text | - | - | Yes | No | No | No | - |
| 6 | `SourceLabel` | SOURCE | Var Char | 128 | - | Yes | No | No | No | - |
| 7 | `ContextVersion` | SYSTEM | Var Char | 32 | - | Yes | No | Yes | No | - |
| 8 | `Limitation` | SYSTEM | Text | - | - | Yes | No | No | No | - |
| 9 | `SyntheticData` | SYSTEM | Boolean | - | - | Yes | No | No | No | Yes |

## Create table: TRN_LocationFeature

- Zone: TRANSFORMATION
- Load order: 10
- Application business ID: `LocationFeatureID`

| Order | Column | Origin | Catalyst type | Max length | Minimum | Mandatory | Unique | Search index | PII/ePHI | Default |
|---:|---|---|---|---:|---:|---|---|---|---|---|
| 1 | `LocationFeatureID` | SYSTEM | Var Char | 64 | - | Yes | Yes | Yes | No | - |
| 2 | `SourceCaseMasterID` | SOURCE | BigInt | - | - | Yes | No | Yes | No | - |
| 3 | `Latitude` | SOURCE | Double | - | - | Yes | No | No | No | - |
| 4 | `Longitude` | SOURCE | Double | - | - | Yes | No | No | No | - |
| 5 | `AreaType` | DERIVED | Var Char | 32 | - | Yes | No | Yes | No | - |
| 6 | `AreaID` | DERIVED | Var Char | 64 | - | Yes | No | Yes | No | - |
| 7 | `FeatureVersion` | SYSTEM | Var Char | 32 | - | Yes | No | Yes | No | - |
| 8 | `SyntheticData` | SYSTEM | Boolean | - | - | Yes | No | No | No | Yes |

## Create table: TRN_PersonResolution

- Zone: TRANSFORMATION
- Load order: 10
- Application business ID: `PersonResolutionID`

| Order | Column | Origin | Catalyst type | Max length | Minimum | Mandatory | Unique | Search index | PII/ePHI | Default |
|---:|---|---|---|---:|---:|---|---|---|---|---|
| 1 | `PersonResolutionID` | SYSTEM | Var Char | 64 | - | Yes | Yes | Yes | No | - |
| 2 | `SourceAccusedID` | SOURCE | BigInt | - | - | Yes | No | Yes | Yes | - |
| 3 | `CanonicalPersonKey` | DERIVED | Var Char | 128 | - | No | No | Yes | Yes | - |
| 4 | `ResolutionStatus` | DERIVED | Var Char | 32 | - | Yes | No | Yes | No | - |
| 5 | `Confidence` | DERIVED | Double | - | - | Yes | No | No | No | - |
| 6 | `EvidenceJSON` | DERIVED | Text | - | - | Yes | No | No | Yes | - |
| 7 | `MethodVersion` | SYSTEM | Var Char | 32 | - | Yes | No | Yes | No | - |
| 8 | `SyntheticData` | SYSTEM | Boolean | - | - | Yes | No | No | No | Yes |

## Create table: INT_AnalysisRun

- Zone: INTELLIGENCE
- Load order: 20
- Application business ID: `AnalysisRunID`

| Order | Column | Origin | Catalyst type | Max length | Minimum | Mandatory | Unique | Search index | PII/ePHI | Default |
|---:|---|---|---|---:|---:|---|---|---|---|---|
| 1 | `AnalysisRunID` | SYSTEM | Var Char | 64 | - | Yes | Yes | Yes | No | - |
| 2 | `BatchKey` | SYSTEM | Var Char | 36 | - | Yes | No | Yes | No | - |
| 3 | `Operation` | SYSTEM | Var Char | 32 | - | Yes | No | Yes | No | - |
| 4 | `ReconciliationJSON` | SYSTEM | Text | - | - | Yes | No | No | No | - |
| 5 | `RunGroupID` | SYSTEM | Var Char | 64 | - | Yes | No | Yes | No | - |
| 6 | `AnalysisType` | SYSTEM | Var Char | 32 | - | Yes | No | Yes | No | - |
| 7 | `RunTypeKey` | SYSTEM | Var Char | 128 | - | Yes | Yes | Yes | No | - |
| 8 | `Status` | SYSTEM | Var Char | 24 | - | Yes | No | Yes | No | - |
| 9 | `PublishStatus` | SYSTEM | Var Char | 24 | - | Yes | No | Yes | No | - |
| 10 | `ObservationStart` | SYSTEM | DateTime | - | - | Yes | No | No | No | - |
| 11 | `ObservationEnd` | SYSTEM | DateTime | - | - | Yes | No | No | No | - |
| 12 | `EngineVersion` | SYSTEM | Var Char | 32 | - | Yes | No | Yes | No | - |
| 13 | `MethodVersion` | SYSTEM | Var Char | 32 | - | Yes | No | Yes | No | - |
| 14 | `InputManifestHash` | SYSTEM | Var Char | 64 | - | Yes | No | Yes | No | - |
| 15 | `CompletedAt` | SYSTEM | DateTime | - | - | No | No | No | No | - |
| 16 | `PublishedAt` | SYSTEM | DateTime | - | - | No | No | No | No | - |
| 17 | `SyntheticData` | SYSTEM | Boolean | - | - | Yes | No | No | No | Yes |

## Create table: INT_Anomaly

- Zone: INTELLIGENCE
- Load order: 30
- Application business ID: `AnomalyID`

| Order | Column | Origin | Catalyst type | Max length | Minimum | Mandatory | Unique | Search index | PII/ePHI | Default |
|---:|---|---|---|---:|---:|---|---|---|---|---|
| 1 | `AnomalyID` | SYSTEM | Var Char | 64 | - | Yes | Yes | Yes | No | - |
| 2 | `AreaID` | DERIVED | Var Char | 64 | - | Yes | No | Yes | No | - |
| 3 | `SignalType` | DERIVED | Var Char | 64 | - | Yes | No | Yes | No | - |
| 4 | `ObservedValue` | DERIVED | Double | - | - | Yes | No | No | No | - |
| 5 | `BaselineValue` | DERIVED | Double | - | - | Yes | No | No | No | - |
| 6 | `Severity` | DERIVED | Double | - | - | Yes | No | No | No | - |
| 7 | `MethodVersion` | SYSTEM | Var Char | 32 | - | Yes | No | Yes | No | - |
| 8 | `Limitation` | SYSTEM | Text | - | - | Yes | No | No | No | - |
| 9 | `SyntheticData` | SYSTEM | Boolean | - | - | Yes | No | No | No | Yes |

## Create table: INT_AreaRisk

- Zone: INTELLIGENCE
- Load order: 30
- Application business ID: `AreaRiskID`

| Order | Column | Origin | Catalyst type | Max length | Minimum | Mandatory | Unique | Search index | PII/ePHI | Default |
|---:|---|---|---|---:|---:|---|---|---|---|---|
| 1 | `AreaRiskID` | SYSTEM | Var Char | 64 | - | Yes | Yes | Yes | No | - |
| 2 | `AreaType` | DERIVED | Var Char | 32 | - | Yes | No | Yes | No | - |
| 3 | `AreaID` | DERIVED | Var Char | 64 | - | Yes | No | Yes | No | - |
| 4 | `PeriodStart` | DERIVED | DateTime | - | - | Yes | No | No | No | - |
| 5 | `PeriodEnd` | DERIVED | DateTime | - | - | Yes | No | No | No | - |
| 6 | `Score` | DERIVED | Double | - | - | Yes | No | No | No | - |
| 7 | `Completeness` | DERIVED | Double | - | - | Yes | No | No | No | - |
| 8 | `ComponentsJSON` | DERIVED | Text | - | - | Yes | No | No | No | - |
| 9 | `MethodVersion` | SYSTEM | Var Char | 32 | - | Yes | No | Yes | No | - |
| 10 | `Limitation` | SYSTEM | Text | - | - | Yes | No | No | No | - |
| 11 | `SyntheticData` | SYSTEM | Boolean | - | - | Yes | No | No | No | Yes |

## Create table: INT_Hotspot

- Zone: INTELLIGENCE
- Load order: 30
- Application business ID: `HotspotID`

| Order | Column | Origin | Catalyst type | Max length | Minimum | Mandatory | Unique | Search index | PII/ePHI | Default |
|---:|---|---|---|---:|---:|---|---|---|---|---|
| 1 | `HotspotID` | SYSTEM | Var Char | 64 | - | Yes | Yes | Yes | No | - |
| 2 | `AreaID` | DERIVED | Var Char | 64 | - | Yes | No | Yes | No | - |
| 3 | `CentroidLatitude` | DERIVED | Double | - | - | Yes | No | No | No | - |
| 4 | `CentroidLongitude` | DERIVED | Double | - | - | Yes | No | No | No | - |
| 5 | `CaseCount` | DERIVED | Int | - | - | Yes | No | No | No | - |
| 6 | `Severity` | DERIVED | Double | - | - | Yes | No | No | No | - |
| 7 | `MethodVersion` | SYSTEM | Var Char | 32 | - | Yes | No | Yes | No | - |
| 8 | `Limitation` | SYSTEM | Text | - | - | Yes | No | No | No | - |
| 9 | `SyntheticData` | SYSTEM | Boolean | - | - | Yes | No | No | No | Yes |

## Create table: INT_NetworkNode

- Zone: INTELLIGENCE
- Load order: 30
- Application business ID: `NetworkNodeID`

| Order | Column | Origin | Catalyst type | Max length | Minimum | Mandatory | Unique | Search index | PII/ePHI | Default |
|---:|---|---|---|---:|---:|---|---|---|---|---|
| 1 | `NetworkNodeID` | SYSTEM | Var Char | 64 | - | Yes | Yes | Yes | No | - |
| 2 | `NodeType` | DERIVED | Var Char | 32 | - | Yes | No | Yes | No | - |
| 3 | `SourceEntity` | SOURCE | Var Char | 64 | - | Yes | No | Yes | No | - |
| 4 | `SourceBusinessID` | SOURCE | Var Char | 128 | - | Yes | No | Yes | Yes | - |
| 5 | `EvidenceLabel` | SYSTEM | Var Char | 32 | - | Yes | No | Yes | No | - |
| 6 | `MethodVersion` | SYSTEM | Var Char | 32 | - | Yes | No | Yes | No | - |
| 7 | `SyntheticData` | SYSTEM | Boolean | - | - | Yes | No | No | No | Yes |

## Create table: INT_Pattern

- Zone: INTELLIGENCE
- Load order: 30
- Application business ID: `PatternID`

| Order | Column | Origin | Catalyst type | Max length | Minimum | Mandatory | Unique | Search index | PII/ePHI | Default |
|---:|---|---|---|---:|---:|---|---|---|---|---|
| 1 | `PatternID` | SYSTEM | Var Char | 64 | - | Yes | Yes | Yes | No | - |
| 2 | `PatternType` | DERIVED | Var Char | 64 | - | Yes | No | Yes | No | - |
| 3 | `Title` | DERIVED | Var Char | 255 | - | Yes | No | No | No | - |
| 4 | `Confidence` | DERIVED | Double | - | - | Yes | No | No | No | - |
| 5 | `SignalComponentsJSON` | DERIVED | Text | - | - | Yes | No | No | No | - |
| 6 | `Recommendation` | DERIVED | Text | - | - | Yes | No | No | No | - |
| 7 | `MethodVersion` | SYSTEM | Var Char | 32 | - | Yes | No | Yes | No | - |
| 8 | `Limitation` | SYSTEM | Text | - | - | Yes | No | No | No | - |
| 9 | `SyntheticData` | SYSTEM | Boolean | - | - | Yes | No | No | No | Yes |

## Create table: INT_RepeatOffenderSignal

- Zone: INTELLIGENCE
- Load order: 30
- Application business ID: `RepeatSignalID`

| Order | Column | Origin | Catalyst type | Max length | Minimum | Mandatory | Unique | Search index | PII/ePHI | Default |
|---:|---|---|---|---:|---:|---|---|---|---|---|
| 1 | `RepeatSignalID` | SYSTEM | Var Char | 64 | - | Yes | Yes | Yes | No | - |
| 2 | `CanonicalPersonKey` | DERIVED | Var Char | 128 | - | Yes | No | Yes | Yes | - |
| 3 | `ResolutionStatus` | DERIVED | Var Char | 32 | - | Yes | No | Yes | No | - |
| 4 | `CaseCount` | DERIVED | Int | - | - | Yes | No | No | No | - |
| 5 | `Confidence` | DERIVED | Double | - | - | Yes | No | No | No | - |
| 6 | `EvidenceJSON` | DERIVED | Text | - | - | Yes | No | No | Yes | - |
| 7 | `MethodVersion` | SYSTEM | Var Char | 32 | - | Yes | No | Yes | No | - |
| 8 | `Limitation` | SYSTEM | Text | - | - | Yes | No | No | No | - |
| 9 | `SyntheticData` | SYSTEM | Boolean | - | - | Yes | No | No | No | Yes |

## Create table: INT_NetworkEdge

- Zone: INTELLIGENCE
- Load order: 31
- Application business ID: `NetworkEdgeID`

| Order | Column | Origin | Catalyst type | Max length | Minimum | Mandatory | Unique | Search index | PII/ePHI | Default |
|---:|---|---|---|---:|---:|---|---|---|---|---|
| 1 | `NetworkEdgeID` | SYSTEM | Var Char | 64 | - | Yes | Yes | Yes | No | - |
| 2 | `EdgeType` | DERIVED | Var Char | 32 | - | Yes | No | Yes | No | - |
| 3 | `EvidenceLabel` | SYSTEM | Var Char | 32 | - | Yes | No | Yes | No | - |
| 4 | `Weight` | DERIVED | Double | - | - | Yes | No | No | No | - |
| 5 | `MethodVersion` | SYSTEM | Var Char | 32 | - | Yes | No | Yes | No | - |
| 6 | `Limitation` | SYSTEM | Text | - | - | Yes | No | No | No | - |
| 7 | `SyntheticData` | SYSTEM | Boolean | - | - | Yes | No | No | No | Yes |

## Create table: INT_FindingEvidence

- Zone: INTELLIGENCE
- Load order: 32
- Application business ID: `FindingEvidenceID`

| Order | Column | Origin | Catalyst type | Max length | Minimum | Mandatory | Unique | Search index | PII/ePHI | Default |
|---:|---|---|---|---:|---:|---|---|---|---|---|
| 1 | `FindingEvidenceID` | SYSTEM | Var Char | 64 | - | Yes | Yes | Yes | No | - |
| 2 | `FindingType` | SYSTEM | Var Char | 32 | - | Yes | No | Yes | No | - |
| 3 | `FindingBusinessID` | SYSTEM | Var Char | 64 | - | Yes | No | Yes | No | - |
| 4 | `SourceEntity` | SOURCE | Var Char | 64 | - | Yes | No | Yes | No | - |
| 5 | `SourceBusinessID` | SOURCE | Var Char | 128 | - | Yes | No | Yes | Yes | - |
| 6 | `EvidenceLabel` | SYSTEM | Var Char | 32 | - | Yes | No | Yes | No | - |
| 7 | `EvidenceSummary` | SYSTEM | Text | - | - | Yes | No | No | Yes | - |
| 8 | `MethodVersion` | SYSTEM | Var Char | 32 | - | Yes | No | Yes | No | - |
| 9 | `SyntheticData` | SYSTEM | Boolean | - | - | Yes | No | No | No | Yes |

## Create table: WF_Alert

- Zone: WORKFLOW
- Load order: 40
- Application business ID: `AlertID`

| Order | Column | Origin | Catalyst type | Max length | Minimum | Mandatory | Unique | Search index | PII/ePHI | Default |
|---:|---|---|---|---:|---:|---|---|---|---|---|
| 1 | `AlertID` | SYSTEM | Var Char | 64 | - | Yes | Yes | Yes | No | - |
| 2 | `FindingType` | SYSTEM | Var Char | 32 | - | Yes | No | Yes | No | - |
| 3 | `FindingBusinessID` | SYSTEM | Var Char | 64 | - | Yes | No | Yes | No | - |
| 4 | `ScopeUnitID` | SOURCE | BigInt | - | - | Yes | No | Yes | No | - |
| 5 | `Status` | WORKFLOW | Var Char | 24 | - | Yes | No | Yes | No | - |
| 6 | `AlertVersion` | WORKFLOW | Int | - | - | Yes | No | No | No | 0 |
| 7 | `Severity` | DERIVED | Double | - | - | Yes | No | No | No | - |
| 8 | `OriginalFindingJSON` | SYSTEM | Text | - | - | Yes | No | No | Yes | - |
| 9 | `MethodVersion` | SYSTEM | Var Char | 32 | - | Yes | No | Yes | No | - |
| 10 | `CreatedAt` | SYSTEM | DateTime | - | - | Yes | No | No | No | - |
| 11 | `SyntheticData` | SYSTEM | Boolean | - | - | Yes | No | No | No | Yes |

## Create table: WF_Command

- Zone: WORKFLOW
- Load order: 41
- Application business ID: `CommandID`

| Order | Column | Origin | Catalyst type | Max length | Minimum | Mandatory | Unique | Search index | PII/ePHI | Default |
|---:|---|---|---|---:|---:|---|---|---|---|---|
| 1 | `CommandID` | SYSTEM | Var Char | 64 | - | Yes | Yes | Yes | No | - |
| 2 | `IdempotencyKeyHash` | SYSTEM | Var Char | 64 | - | Yes | Yes | Yes | No | - |
| 3 | `RequestHash` | SYSTEM | Var Char | 64 | - | Yes | No | Yes | No | - |
| 4 | `ActorCatalystUserID` | AUTHENTICATION | Var Char | 128 | - | Yes | No | Yes | Yes | - |
| 5 | `EffectiveRole` | AUTHORIZATION | Var Char | 48 | - | Yes | No | Yes | No | - |
| 6 | `CommandType` | WORKFLOW | Var Char | 32 | - | Yes | No | Yes | No | - |
| 7 | `ExpectedAlertState` | WORKFLOW | Var Char | 24 | - | Yes | No | No | No | - |
| 8 | `ExpectedAlertVersion` | WORKFLOW | Int | - | - | Yes | No | No | No | - |
| 9 | `TargetAlertState` | WORKFLOW | Var Char | 24 | - | Yes | No | No | No | - |
| 10 | `Status` | WORKFLOW | Var Char | 24 | - | Yes | No | Yes | No | - |
| 11 | `ResponseJSON` | WORKFLOW | Text | - | - | No | No | No | Yes | - |
| 12 | `ErrorCode` | WORKFLOW | Var Char | 64 | - | No | No | Yes | No | - |
| 13 | `CreatedAt` | SYSTEM | DateTime | - | - | Yes | No | No | No | - |
| 14 | `CompletedAt` | SYSTEM | DateTime | - | - | No | No | No | No | - |
| 15 | `SyntheticData` | SYSTEM | Boolean | - | - | Yes | No | No | No | Yes |

## Create table: WF_AlertEvidence

- Zone: WORKFLOW
- Load order: 42
- Application business ID: `AlertEvidenceID`

| Order | Column | Origin | Catalyst type | Max length | Minimum | Mandatory | Unique | Search index | PII/ePHI | Default |
|---:|---|---|---|---:|---:|---|---|---|---|---|
| 1 | `AlertEvidenceID` | SYSTEM | Var Char | 64 | - | Yes | Yes | Yes | No | - |
| 2 | `EvidenceOrder` | SYSTEM | Int | - | - | Yes | No | No | No | - |
| 3 | `SyntheticData` | SYSTEM | Boolean | - | - | Yes | No | No | No | Yes |

## Create table: WF_AnalystConclusion

- Zone: WORKFLOW
- Load order: 42
- Application business ID: `ConclusionID`

| Order | Column | Origin | Catalyst type | Max length | Minimum | Mandatory | Unique | Search index | PII/ePHI | Default |
|---:|---|---|---|---:|---:|---|---|---|---|---|
| 1 | `ConclusionID` | SYSTEM | Var Char | 64 | - | Yes | Yes | Yes | No | - |
| 2 | `AnalystEmployeeID` | WORKFLOW | BigInt | - | - | Yes | No | Yes | Yes | - |
| 3 | `ConclusionCode` | WORKFLOW | Var Char | 32 | - | Yes | No | Yes | No | - |
| 4 | `ConclusionText` | WORKFLOW | Text | - | - | Yes | No | No | Yes | - |
| 5 | `EvidencePackPath` | WORKFLOW | Var Char | 255 | - | No | No | No | Yes | - |
| 6 | `CreatedAt` | SYSTEM | DateTime | - | - | Yes | No | No | No | - |
| 7 | `SyntheticData` | SYSTEM | Boolean | - | - | Yes | No | No | No | Yes |

## Create table: WF_Assignment

- Zone: WORKFLOW
- Load order: 42
- Application business ID: `AssignmentID`

| Order | Column | Origin | Catalyst type | Max length | Minimum | Mandatory | Unique | Search index | PII/ePHI | Default |
|---:|---|---|---|---:|---:|---|---|---|---|---|
| 1 | `AssignmentID` | SYSTEM | Var Char | 64 | - | Yes | Yes | Yes | No | - |
| 2 | `AssignedUnitID` | WORKFLOW | BigInt | - | - | Yes | No | Yes | No | - |
| 3 | `AssignedEmployeeID` | WORKFLOW | BigInt | - | - | No | No | Yes | Yes | - |
| 4 | `AssignedByEmployeeID` | WORKFLOW | BigInt | - | - | Yes | No | Yes | Yes | - |
| 5 | `Reason` | WORKFLOW | Text | - | - | Yes | No | No | No | - |
| 6 | `AuthorizedUnitIDsJSON` | AUTHORIZATION | Text | - | - | Yes | No | No | No | - |
| 7 | `AuthorizedCaseIDsJSON` | AUTHORIZATION | Text | - | - | Yes | No | No | Yes | - |
| 8 | `EvidenceAccessLevel` | AUTHORIZATION | Var Char | 32 | - | Yes | No | Yes | No | - |
| 9 | `AssignedAt` | SYSTEM | DateTime | - | - | Yes | No | No | No | - |
| 10 | `SyntheticData` | SYSTEM | Boolean | - | - | Yes | No | No | No | Yes |

## Create table: WF_Outcome

- Zone: WORKFLOW
- Load order: 42
- Application business ID: `OutcomeID`

| Order | Column | Origin | Catalyst type | Max length | Minimum | Mandatory | Unique | Search index | PII/ePHI | Default |
|---:|---|---|---|---:|---:|---|---|---|---|---|
| 1 | `OutcomeID` | SYSTEM | Var Char | 64 | - | Yes | Yes | Yes | No | - |
| 2 | `RecordedByEmployeeID` | WORKFLOW | BigInt | - | - | Yes | No | Yes | Yes | - |
| 3 | `OutcomeCode` | WORKFLOW | Var Char | 32 | - | Yes | No | Yes | No | - |
| 4 | `OutcomeText` | WORKFLOW | Text | - | - | Yes | No | No | Yes | - |
| 5 | `RecordedAt` | SYSTEM | DateTime | - | - | Yes | No | No | No | - |
| 6 | `SyntheticData` | SYSTEM | Boolean | - | - | Yes | No | No | No | Yes |

## Create table: WF_AuditEvent

- Zone: WORKFLOW
- Load order: 43
- Application business ID: `AuditEventID`

| Order | Column | Origin | Catalyst type | Max length | Minimum | Mandatory | Unique | Search index | PII/ePHI | Default |
|---:|---|---|---|---:|---:|---|---|---|---|---|
| 1 | `AuditEventID` | SYSTEM | Var Char | 64 | - | Yes | Yes | Yes | No | - |
| 2 | `ActorEmployeeID` | WORKFLOW | BigInt | - | - | No | No | Yes | Yes | - |
| 3 | `ActorType` | WORKFLOW | Var Char | 24 | - | Yes | No | Yes | No | - |
| 4 | `EventType` | WORKFLOW | Var Char | 64 | - | Yes | No | Yes | No | - |
| 5 | `EntityType` | WORKFLOW | Var Char | 64 | - | Yes | No | Yes | No | - |
| 6 | `EntityBusinessID` | WORKFLOW | Var Char | 64 | - | Yes | No | Yes | No | - |
| 7 | `EventPayloadJSON` | WORKFLOW | Text | - | - | Yes | No | No | Yes | - |
| 8 | `StreamID` | SYSTEM | Var Char | 64 | - | Yes | No | Yes | No | - |
| 9 | `StreamSequence` | SYSTEM | Int | - | - | Yes | No | No | No | - |
| 10 | `HashAlgorithm` | SYSTEM | Var Char | 32 | - | Yes | No | No | No | - |
| 11 | `HashKeyVersion` | SYSTEM | Var Char | 32 | - | Yes | No | Yes | No | - |
| 12 | `PreviousEventHash` | SYSTEM | Var Char | 64 | - | No | No | Yes | No | - |
| 13 | `EventHash` | SYSTEM | Var Char | 64 | - | Yes | Yes | Yes | No | - |
| 14 | `OccurredAt` | SYSTEM | DateTime | - | - | Yes | No | No | No | - |
| 15 | `SyntheticData` | SYSTEM | Boolean | - | - | Yes | No | No | No | Yes |

## Create table: WF_AlertNote

- Zone: WORKFLOW
- Load order: 44
- Application business ID: `AlertNoteID`

| Order | Column | Origin | Catalyst type | Max length | Minimum | Mandatory | Unique | Search index | PII/ePHI | Default |
|---:|---|---|---|---:|---:|---|---|---|---|---|
| 1 | `AlertNoteID` | SYSTEM | Var Char | 64 | - | Yes | Yes | Yes | No | - |
| 2 | `AuthorUserID` | AUTHENTICATION | Var Char | 128 | - | Yes | No | Yes | Yes | - |
| 3 | `NoteText` | WORKFLOW | Text | - | - | Yes | No | No | Yes | - |
| 4 | `CreatedAt` | SYSTEM | DateTime | - | - | Yes | No | No | No | - |
| 5 | `SyntheticData` | SYSTEM | Boolean | - | - | Yes | No | No | No | Yes |

## Create table: WF_Escalation

- Zone: WORKFLOW
- Load order: 44
- Application business ID: `EscalationID`

| Order | Column | Origin | Catalyst type | Max length | Minimum | Mandatory | Unique | Search index | PII/ePHI | Default |
|---:|---|---|---|---:|---:|---|---|---|---|---|
| 1 | `EscalationID` | SYSTEM | Var Char | 64 | - | Yes | Yes | Yes | No | - |
| 2 | `FromUnitID` | AUTHORIZATION | BigInt | - | - | Yes | No | Yes | No | - |
| 3 | `TargetUnitID` | AUTHORIZATION | BigInt | - | - | Yes | No | Yes | No | - |
| 4 | `EscalationPriority` | WORKFLOW | Var Char | 16 | - | Yes | No | Yes | No | - |
| 5 | `Reason` | WORKFLOW | Text | - | - | Yes | No | No | No | - |
| 6 | `EscalatedByUserID` | AUTHENTICATION | Var Char | 128 | - | Yes | No | Yes | Yes | - |
| 7 | `EscalatedAt` | SYSTEM | DateTime | - | - | Yes | No | No | No | - |
| 8 | `SyntheticData` | SYSTEM | Boolean | - | - | Yes | No | No | No | Yes |

## Phase B - Add Foreign Key columns

Add these after all Phase A tables exist. For every row below select the parent `ROWID` and **On Delete = Null**. Never select Cascade.

| Order | Child table | Column | Parent table | Mandatory | On delete |
|---:|---|---|---|---|---|
| 1 | `CFG_DashboardItem` | `DashboardRef` | `CFG_Dashboard` | Yes | NULL |
| 2 | `CFG_DashboardItem` | `ReportRef` | `CFG_ReportDefinition` | Yes | NULL |
| 3 | `CFG_UserPreference` | `LandingDashboardRef` | `CFG_Dashboard` | No | NULL |
| 4 | `CFG_MapViewVersion` | `MapViewRef` | `CFG_MapView` | Yes | NULL |
| 5 | `INT_Anomaly` | `AnalysisRunRef` | `INT_AnalysisRun` | Yes | NULL |
| 6 | `INT_AreaRisk` | `AnalysisRunRef` | `INT_AnalysisRun` | Yes | NULL |
| 7 | `INT_Hotspot` | `AnalysisRunRef` | `INT_AnalysisRun` | Yes | NULL |
| 8 | `INT_NetworkNode` | `AnalysisRunRef` | `INT_AnalysisRun` | Yes | NULL |
| 9 | `INT_Pattern` | `AnalysisRunRef` | `INT_AnalysisRun` | Yes | NULL |
| 10 | `INT_RepeatOffenderSignal` | `AnalysisRunRef` | `INT_AnalysisRun` | Yes | NULL |
| 11 | `INT_NetworkEdge` | `AnalysisRunRef` | `INT_AnalysisRun` | Yes | NULL |
| 12 | `INT_NetworkEdge` | `FromNodeRef` | `INT_NetworkNode` | Yes | NULL |
| 13 | `INT_NetworkEdge` | `ToNodeRef` | `INT_NetworkNode` | Yes | NULL |
| 14 | `INT_FindingEvidence` | `AnalysisRunRef` | `INT_AnalysisRun` | Yes | NULL |
| 15 | `WF_Alert` | `AnalysisRunRef` | `INT_AnalysisRun` | Yes | NULL |
| 16 | `WF_Alert` | `LastCommandRef` | `WF_Command` | No | NULL |
| 17 | `WF_Command` | `AlertRef` | `WF_Alert` | Yes | NULL |
| 18 | `WF_AlertEvidence` | `AlertRef` | `WF_Alert` | Yes | NULL |
| 19 | `WF_AlertEvidence` | `FindingEvidenceRef` | `INT_FindingEvidence` | Yes | NULL |
| 20 | `WF_AnalystConclusion` | `AlertRef` | `WF_Alert` | Yes | NULL |
| 21 | `WF_AnalystConclusion` | `CommandRef` | `WF_Command` | Yes | NULL |
| 22 | `WF_Assignment` | `AlertRef` | `WF_Alert` | Yes | NULL |
| 23 | `WF_Assignment` | `CommandRef` | `WF_Command` | Yes | NULL |
| 24 | `WF_Outcome` | `AlertRef` | `WF_Alert` | Yes | NULL |
| 25 | `WF_Outcome` | `CommandRef` | `WF_Command` | Yes | NULL |
| 26 | `WF_AuditEvent` | `AlertRef` | `WF_Alert` | No | NULL |
| 27 | `WF_AuditEvent` | `CommandRef` | `WF_Command` | No | NULL |
| 28 | `WF_AlertNote` | `AlertRef` | `WF_Alert` | Yes | NULL |
| 29 | `WF_AlertNote` | `CommandRef` | `WF_Command` | Yes | NULL |
| 30 | `WF_Escalation` | `AlertRef` | `WF_Alert` | Yes | NULL |
| 31 | `WF_Escalation` | `CommandRef` | `WF_Command` | Yes | NULL |

## Post-creation verification checklist

- [ ] Confirm all 31 application tables exist in Catalyst Development.
- [ ] Confirm each native column matches type, length, Mandatory, Unique, Search index, and PII/ePHI settings above.
- [ ] Confirm every Foreign Key points to parent `ROWID` with On Delete = Null.
- [ ] Confirm `INT_AreaRisk` contains no person, accused, or offender field.
- [ ] Confirm every table contains mandatory `SyntheticData` with default `true`.
- [ ] Create a Catalyst IaC export and compare it with the manifest before loading records.
- [ ] Run `npm.cmd run intelligence-schema:validate` and the complete test suite.

| Table | Expected columns | Catalyst table ID | Observed columns | Verified by | Verified at | Evidence path |
|---|---:|---|---:|---|---|---|
| `CFG_UserAccess` | 9 |  |  |  |  |  |
| `CFG_Dashboard` | 10 |  |  |  |  |  |
| `CFG_ReportDefinition` | 11 |  |  |  |  |  |
| `CFG_ContentShare` | 10 |  |  |  |  |  |
| `CFG_DashboardItem` | 10 |  |  |  |  |  |
| `CFG_MapView` | 10 |  |  |  |  |  |
| `CFG_UserPreference` | 7 |  |  |  |  |  |
| `CFG_MapViewVersion` | 11 |  |  |  |  |  |
| `OPS_IntelligenceRunRequest` | 17 |  |  |  |  |  |
| `TRN_CaseFeature` | 9 |  |  |  |  |  |
| `TRN_DistrictContext` | 9 |  |  |  |  |  |
| `TRN_LocationFeature` | 8 |  |  |  |  |  |
| `TRN_PersonResolution` | 8 |  |  |  |  |  |
| `INT_AnalysisRun` | 17 |  |  |  |  |  |
| `INT_Anomaly` | 10 |  |  |  |  |  |
| `INT_AreaRisk` | 12 |  |  |  |  |  |
| `INT_Hotspot` | 10 |  |  |  |  |  |
| `INT_NetworkNode` | 8 |  |  |  |  |  |
| `INT_Pattern` | 10 |  |  |  |  |  |
| `INT_RepeatOffenderSignal` | 10 |  |  |  |  |  |
| `INT_NetworkEdge` | 10 |  |  |  |  |  |
| `INT_FindingEvidence` | 10 |  |  |  |  |  |
| `WF_Alert` | 13 |  |  |  |  |  |
| `WF_Command` | 16 |  |  |  |  |  |
| `WF_AlertEvidence` | 5 |  |  |  |  |  |
| `WF_AnalystConclusion` | 9 |  |  |  |  |  |
| `WF_Assignment` | 12 |  |  |  |  |  |
| `WF_Outcome` | 8 |  |  |  |  |  |
| `WF_AuditEvent` | 17 |  |  |  |  |  |
| `WF_AlertNote` | 7 |  |  |  |  |  |
| `WF_Escalation` | 10 |  |  |  |  |  |

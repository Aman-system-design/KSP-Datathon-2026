# KSP Development Team FYI

## Purpose

This is a living handoff document for a future Karnataka State Police technical review. It records gaps, ambiguities, and MVP assumptions that must be validated before this prototype is connected to production systems or real police data.

The prototype uses the supplied `Police_FIR_ER_Diagram.pdf` as its source-schema reference. It does not claim that the PDF is a complete production database specification.

## Table of Contents

1. [Catalyst primary keys versus KSP business IDs](#1-catalyst-primary-keys-versus-ksp-business-ids)
2. [Schema inconsistencies requiring confirmation](#2-schema-inconsistencies-requiring-confirmation)
3. [Referenced lookup data absent from the PDF](#3-referenced-lookup-data-absent-from-the-pdf)
4. [Crime number and case number rules](#4-crime-number-and-case-number-rules)
5. [Person identity and repeat-offender resolution](#5-person-identity-and-repeat-offender-resolution)
6. [Names, PII, and sensitive narrative data](#6-names-pii-and-sensitive-narrative-data)
7. [Location quality and police boundaries](#7-location-quality-and-police-boundaries)
8. [Organizational hierarchy](#8-organizational-hierarchy)
9. [Authentication and authorization](#9-authentication-and-authorization)
10. [Case status, arrest, and chargesheet semantics](#10-case-status-arrest-and-chargesheet-semantics)
11. [Data ingestion and synchronization](#11-data-ingestion-and-synchronization)
12. [Analytics and model validation](#12-analytics-and-model-validation)
13. [Socio-economic context](#13-socio-economic-context)
14. [Text analytics and generated briefs](#14-text-analytics-and-generated-briefs)
15. [Catalyst production differences](#15-catalyst-production-differences)
16. [Synthetic data limitations](#16-synthetic-data-limitations)
17. [Items to obtain from KSP before production integration](#17-items-to-obtain-from-ksp-before-production-integration)
18. [MVP schema-preservation and Catalyst relationship strategy](#18-mvp-schema-preservation-and-catalyst-relationship-strategy)
19. [Document maintenance rule](#document-maintenance-rule)

## 1. Catalyst primary keys versus KSP business IDs

Catalyst Data Store automatically creates `ROWID` as the physical primary key for every record. Catalyst Foreign Key columns refer to this `ROWID`.

The supplied schema defines business identifiers such as:

- `CaseMasterID`
- `AccusedMasterID`
- `DistrictID`
- `UnitID`
- `EmployeeID`

For the MVP, both forms will be retained:

- Catalyst `ROWID` for native relationships and SDK/API operations
- Supplied KSP-style ID as a unique business/import key

KSP team confirmation required:

- Are these source IDs globally unique or only unique within another scope?
- Can any source ID change after record creation?
- Which IDs must be preserved during import and export?
- Are there existing cross-system master identifiers that are absent from the PDF?

## 2. Schema inconsistencies requiring confirmation

### Act and section types

The PDF defines `Act.ActCode` as `VARCHAR`, while `ActSectionAssociation.ActID` is shown as `INT` and described as referencing `Act.ActCode`.

MVP assumption: link the association to the Catalyst Act record and preserve the source Act code as text.

KSP confirmation required: authoritative data type and source-key format for Act and Section.

### Section primary key

The `Section` table does not declare a primary key. A section code may only be unique within an Act.

MVP assumption: treat `(ActCode, SectionCode)` as the source-level natural key while using Catalyst `ROWID` as the physical key.

KSP confirmation required: whether `SectionCode` is globally unique or Act-scoped.

### Arrest-to-accused cardinality

`ArrestSurrender` directly contains `AccusedMasterID`, suggesting one accused per event. The relationship matrix also references `inv_arrestsurrenderaccused`, suggesting a junction that supports multiple accused persons per arrest/surrender event.

MVP assumption: add `ArrestSurrenderAccused` as a junction table and keep one arrest event separate from its accused links.

KSP confirmation required: actual production table, key structure, and cardinality.

### Undefined occurrence table

The relationship matrix references `Inv_OccuranceTime`, but the PDF does not define its columns. `CaseMaster` already contains incident dates, latitude, and longitude.

MVP assumption: retain incident time and location in `CaseMaster` and do not create an undefined duplicate table.

KSP confirmation required: whether an occurrence/location table exists in production and whether one case can contain multiple occurrence locations.

### Chargesheet employee reference

`ChargesheetDetails.PolicePersonID` is described as referencing `employeeMaster.employee ID`, while the supplied table is named `Employee`.

MVP assumption: reference `Employee`.

KSP confirmation required: authoritative table and column name.

### Crime sub-head naming

`CrimeSubHead.CrimeHeadName` appears to store the sub-head name even though the name suggests a major-head value.

MVP assumption: retain the supplied column for compatibility but treat it as the crime sub-head display name.

KSP confirmation required: intended name and whether a migration alias is required.

## 3. Referenced lookup data absent from the PDF

The schema references lookup values without defining all master tables:

- Gender
- Blood group
- Nationality
- Arrest/surrender type
- Potential victim-police indicator values

MVP assumption: create small normalized master tables where relationships are needed and preserve authoritative codes in imports.

KSP confirmation required:

- Official lookup tables and codes
- Active/inactive behavior
- Kannada and English display values
- Historical codes that must remain valid

## 4. Crime number and case number rules

The PDF describes a structured `CrimeNo` and a nine-digit `CaseNo` derived from it.

KSP confirmation required:

- Whether every category uses the documented format
- Handling of migrated and legacy crime numbers
- Zero FIR transfer and renumbering behavior
- Whether a crime number can be corrected
- Uniqueness scope across station, category, and year
- Whether leading zeroes must always be preserved

MVP assumption: store both values as text, never numeric types.

## 5. Person identity and repeat-offender resolution

The supplied `Accused` entity includes name, age, gender, and an `A1/A2/...` sorting value. These fields are not sufficient to reliably establish that two accused records represent the same person across FIRs.

MVP synthetic data will plant controlled repeated identities for demonstration.

Production confirmation required:

- Is there a stable person/criminal identifier outside `AccusedMasterID`?
- How are aliases, spelling variations, and transliteration handled?
- Which identity attributes may legally and operationally be used for entity resolution?
- What confidence and human-verification process is required before linking people?
- How are incorrect identity links corrected and audited?

The MVP must not represent name similarity as confirmed identity.

## 6. Names, PII, and sensitive narrative data

Potentially sensitive columns include:

- Accused, victim, and complainant names
- Employee name, DOB, KGID, gender, blood group, and disability indicator
- `BriefFacts`
- Any identity or contact attributes added later

MVP approach:

- Use fictional synthetic identities only
- Enable Catalyst PII/ePHI validators where applicable
- Keep leadership views aggregated by default
- Require explicit authorization for person-level evidence
- Preserve an audit trail for sensitive access

KSP confirmation required:

- Data classification policy
- Encryption requirements
- Masking/redaction requirements by role
- Retention and deletion rules
- Log-retention requirements
- Whether `BriefFacts` can be processed by ML/LLM services
- Approved de-identification method for analytics and model training

## 7. Location quality and police boundaries

Hotspot and area-risk results depend heavily on location quality.

KSP confirmation required:

- Coordinate system and precision
- Whether coordinates represent incident point, station, landmark, or geocoded address
- Known default/invalid coordinate values
- Accuracy indicator availability
- Authoritative police-station boundary data
- Handling of incidents near station and district boundaries
- Historical boundary changes

MVP approach: use synthetic coordinates inside clearly defined fictional/demo clusters and include invalid-coordinate test records.

## 8. Organizational hierarchy

The supplied `Unit.ParentUnit` and `UnitType` structures allow a flexible hierarchy, but actual district and commissionerate trees may differ.

KSP confirmation required:

- Authoritative unit hierarchy and unit-type codes
- Commissionerate, range, district, division, subdivision, circle, and station relationships
- Special units that do not fit a geographic tree
- Transfers and temporary assignments
- Whether employees may have multiple concurrent scopes
- Effective dates for organizational changes

MVP approach: traverse the configured hierarchy instead of hard-coding a fixed depth.

## 9. Authentication and authorization

MVP authorization is based on:

> Rank hierarchy + designation responsibility + assigned unit hierarchy + explicit platform permission

Rank alone will not grant access.

KSP confirmation required:

- Identity provider and SSO requirements
- Official role and permission matrix
- Case-level and investigation-level exceptions
- Cross-district authorization process
- Temporary access and emergency-access policy
- Approval and revocation workflow
- Required audit events

## 10. Case status, arrest, and chargesheet semantics

KSP confirmation required:

- Complete case-status lifecycle
- Whether status history is available or only current status
- Arrest versus surrender code definitions
- Multiple arrest/re-arrest behavior
- Chargesheet and final-report type codes
- False-case and undetected-case interpretation
- Reopening and appeal behavior

MVP synthetic records will implement a simplified, documented lifecycle and must not be treated as authoritative.

## 11. Data ingestion and synchronization

The challenge describes fragmented records. The MVP will demonstrate separate source extracts being validated and linked.

The supplied PDF does not prove whether KSP databases are on-premises, hosted in a government/state data center, cloud-hosted, or hybrid. Do not represent the hosting model as confirmed until KSP provides the deployment architecture.

### Recommended production integration principle

Catalyst should not open a direct connection to the operational FIR database, and the operational database should not expose a public database port.

Use an outbound-only integration component inside the KSP-controlled network or approved DMZ:

```text
KSP operational DB
        ↓ read-only reporting view / replica
KSP-controlled integration agent
        ↓ validate, minimize, encrypt and package
Outbound HTTPS through approved gateway
        ↓
Catalyst Stratus staging bucket or protected ingestion API
        ↓ validation, reconciliation and quarantine
Catalyst Data Store intelligence copy
```

The integration agent should use a read-only database account and preferably read from a reporting replica or controlled export view rather than the live transactional database.

### Option A: Scheduled encrypted batch transfer

Recommended starting pattern for production hardening:

1. KSP produces incremental CSV or another approved extract inside its network.
2. The integration agent validates counts, schema version, checksums, and required fields.
3. The agent encrypts the package and sends it over outbound HTTPS to Stratus or an approved secure gateway.
4. Catalyst validates and quarantines invalid rows.
5. Catalyst Bulk Write performs insert/update/upsert into Data Store.
6. Reconciliation records source count, accepted count, rejected count, duplicate count, and watermark.

This pattern is easier to audit, retry, and reconcile than direct database access. Catalyst officially supports Data Store bulk write from CSV files staged in Stratus.

### Option B: Near-real-time outbound micro-batches

If KSP later requires lower latency, the on-premises integration component can send changed records in small batches to an authenticated Catalyst ingestion API.

Requirements include:

- source change tracking or CDC approved by KSP;
- monotonic watermark or event identifier;
- idempotency key for safe retries;
- signed/authenticated outbound requests;
- queueing and retry inside the KSP network;
- dead-letter handling;
- acknowledgement and reconciliation;
- strict rate, size, and schema-version controls.

Near-real-time integration should not be selected until operational latency is confirmed as a real requirement.

### Patterns not approved by default

- Publicly exposing SQL Server, Oracle, PostgreSQL, or another database port
- Giving Catalyst broad credentials to the transactional FIR database
- Running unrestricted queries against the live production database
- Copying all columns when the intelligence platform needs only a governed subset
- Sending passwords, OAuth secrets, or encryption keys through source code or chat
- Treating Catalyst Connections as a proven on-premises database tunnel; current public documentation describes API authentication/integration, not a private database-network bridge

### Network and security confirmation required

- Actual KSP hosting model and database technology
- Whether a reporting replica, data warehouse, API, or existing export service is available
- Approved DMZ and outbound gateway pattern
- Allow-listed Catalyst India endpoints
- Mutual TLS, client-certificate, OAuth, or other service-authentication requirement
- Encryption and key-management ownership
- Data-residency and permitted-field rules
- Required security assessment, VAPT, and change approvals
- Whether Zoho offers an approved private-connectivity option for this deployment; no such capability is assumed from the reviewed public documentation

KSP confirmation required:

- Actual integration method: database view, API, file export, CDC, or batch
- Expected record volumes and growth
- Refresh frequency and latency requirement
- Update/delete semantics
- Late-arriving and corrected records
- Source-system ownership for each entity
- Reconciliation and retry requirements
- Production and disaster-recovery environments

## 12. Analytics and model validation

The MVP will demonstrate hotspots, anomalies, repeat-offender/link analysis, district context correlation, area-risk signals, and cross-jurisdiction pattern discovery.

The complete MVP method, evaluation, explanation, safety, and Catalyst-service contract is maintained in `docs/architecture/ai-ml-intelligence-strategy.md`. Its thresholds and weights are synthetic-MVP starting values, not proposed KSP operational policy.

Before production, KSP subject-matter experts must confirm:

- Operational definition of a useful hotspot
- Appropriate geographic and time windows
- Offence-severity weights
- Alert thresholds and escalation rules
- Acceptable false-positive and false-negative trade-offs
- Historical validation periods
- Human-review requirements
- Model monitoring and approval process
- When a model must be suspended or rolled back

No MVP score should be adopted operationally without this validation.

## 13. Socio-economic context

The challenge requests socio-economic crime correlation, but the supplied FIR schema does not contain district-context tables.

MVP approach: create a separate aggregate `DistrictContext` analytics table using clearly sourced public values or clearly labelled synthetic values.

Production safeguards:

- Aggregate analysis only
- No individual targeting
- No caste or religion-based risk scoring
- Correlation never presented as causation
- Source period, missingness, and limitations displayed

KSP confirmation required: approved public datasets and permitted variables.

## 14. Text analytics and generated briefs

`BriefFacts` may support keyword, modus-operandi, similarity, and summary features.

KSP confirmation required:

- Kannada/English language distribution
- Transliteration and mixed-language behavior
- Permitted text-processing services
- Retention of prompts and model outputs
- Redaction requirements
- Human approval required before generated briefs are distributed

MVP rule: generated text must be grounded in stored analytical evidence and must link back to supporting metrics and authorized cases.

## 15. Catalyst production differences

The MVP uses Catalyst Data Store, Functions, Authentication, API Gateway, Slate/Web Client Hosting, and selected jobs/ML services.

Production review must confirm:

- Required Catalyst region and data-residency policy
- Development-to-production promotion procedure
- Payment and quota configuration
- Backup and restore approach
- Observability, alerting, and incident response
- Service limits under expected KSP load
- Network and domain requirements
- Approved secrets-management process
- Penetration testing and security review

API Gateway must only be enabled after all Functions and client routes are defined because enabling it disables Security Rules and can make existing resources inaccessible until APIs are configured.

## 16. Synthetic data limitations

Synthetic data will be created to exercise known analytical behaviors, including positive patterns, negative controls, missing data, and contradictory evidence.

It cannot validate:

- Real-world data quality
- Real offender identity resolution
- Operational alert usefulness
- Production model accuracy
- Real geographic bias
- Actual workload or performance

All screens, exports, and demonstrations must prominently identify the data as synthetic.

## 17. Items to obtain from KSP before production integration

1. Complete current schema and data dictionary
2. Official lookup/code lists
3. Sample de-identified records for every entity
4. Unit hierarchy and boundary datasets
5. Source-volume and refresh estimates
6. Identity and access-control policy
7. Data-classification and retention policy
8. Approved analytics definitions and alert thresholds
9. Model-validation and governance requirements
10. Integration, environment, and deployment architecture
11. Audit, security, backup, and incident-response requirements
12. Named technical and policing subject-matter owners for sign-off

## 18. MVP schema-preservation and Catalyst relationship strategy

The MVP will preserve every table and column defined in `Police_FIR_ER_Diagram.pdf` inside the logical `SRC_` zone. Original identifiers and foreign-key values remain visible under the supplied column names.

Catalyst Data Store uses generated `ROWID` values as physical primary keys, and Catalyst Foreign Key columns contain the parent record's `ROWID`. Therefore, a companion `*Ref` column will be added for each relationship that must be enforced. For example, `CaseMasterID` preserves the KSP-style identifier while `CaseMasterRef` stores the Catalyst relationship.

This is an additive compatibility strategy; it does not silently correct or discard the supplied schema. Known inconsistencies are handled during validation and transformation:

- unresolved or invalid source relationships are quarantined or flagged;
- original source values remain available for reconciliation;
- normalized relationships are stored separately;
- analytics never overwrite source records;
- the transformation layer stores only key mappings and compact reusable features, not a full duplicate FIR database.

The detailed MVP decision is maintained in `docs/superpowers/specs/2026-07-19-catalyst-physical-data-architecture-design.md`.

## Document maintenance rule

Whenever the MVP makes an assumption because the supplied artifact is incomplete, record it here with:

- the observed gap;
- the temporary MVP decision;
- the production risk;
- the question requiring KSP confirmation.

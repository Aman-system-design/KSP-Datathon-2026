# PDF Semantic Data Integrity Design

**Project:** KSP Crime Decision Intelligence Platform  
**Environment:** Catalyst Development, India data centre  
**Source authority:** `Police_FIR_ER_Diagram.pdf`  
**Scope:** All 26 PDF entities and the one authorized synthetic batch  
**Status:** Approved design awaiting implementation plan

## 1. Problem

The current source schema correctly preserves the PDF table names, columns, types, primary identifiers, and Catalyst foreign-key references. The generated values do not consistently preserve the PDF's business semantics. The clearest examples are `CaseMaster.CrimeNo`, `CaseMaster.CaseNo`, mixed-zone incident timestamps, and `ChargesheetDetails.cstype`.

This is a data-integrity defect, not a display defect. The platform must not describe data as PDF-aligned merely because the columns have matching names and types.

## 2. Decision

Add one machine-readable semantic contract covering all documented PDF rules. The generator, validator, automated tests, and Catalyst acceptance checks will consume or verify the same contract.

The platform will distinguish three rule classes:

1. **PDF-required:** explicitly stated by the PDF and enforced without exception.
2. **Safe synthetic assumption:** necessary for demonstration, documented, visibly synthetic, and never represented as a confirmed KSP production rule.
3. **KSP confirmation required:** ambiguous or internally inconsistent PDF statements. These are preserved safely and recorded in `docs/KSP DEVELOPMENT TEAM FYI.md`; code must not silently invent production semantics.

## 3. Rejected approaches

### Generator-only checks

Fast, but imported data could bypass them. This would not protect the future on-premises ingestion path.

### Catalyst constraints only

Catalyst can enforce types, lengths, uniqueness, and foreign keys, but it cannot express all cross-column derivations, scoped serials, chronology, hierarchy, or allowed-value rules.

### Updating the current rows in place

This would rewrite source evidence, invalidate stored hashes and mappings, and hide the failed fixture. The current batch will instead be reset through an explicitly authorized Development-only procedure after a dry run proves its exact scope.

## 4. Semantic contract

Create `schema/catalyst/pdf-semantic-contract.json`. It references the structural definitions in `source-schema.json` rather than duplicating column types.

The contract supports:

- `pattern`, `length`, `allowedValues`, and numeric range rules;
- `derivedFrom` rules for identifiers and dates;
- scoped sequence rules;
- cross-column chronology;
- foreign-business-key and organizational consistency;
- boolean and indicator encodings;
- hierarchy acyclicity;
- explicitly documented assumptions and unresolved ambiguities.

Every contract rule has a stable rule ID, source page, severity, entity, fields, and safe error code. Reject records continue to exclude source payloads and PII.

## 5. Case identity

`CrimeNo` remains a `VARCHAR`, because its leading zeroes are meaningful. It must contain exactly 18 digits:

```text
Case category code (1)
+ DistrictID left-padded to 4 digits
+ PoliceStationID left-padded to 4 digits
+ registration year (4)
+ running serial left-padded to 5 digits
```

The running serial starts at `00001` independently for each `(CaseCategoryID, DistrictID, PoliceStationID, year)` scope.

`CaseNo` remains a `VARCHAR`, contains exactly nine digits, equals `year + five-digit serial`, and must equal the last nine digits of `CrimeNo`.

For the first FIR in category `1`, district `101`, station `1001`, and year `2026`:

```text
CrimeNo = 101011001202600001
CaseNo  = 202600001
```

The `CaseCategory` fixture will use a documented one-digit category and an operational lookup value such as `FIR`; synthetic provenance remains in the mandatory `IsSynthetic` system field rather than corrupting operational codes.

## 6. Time semantics

KSP operational `DATE` and `DATETIME` values represent Karnataka local civil time unless a future source contract supplies an explicit zone.

Synthetic source timestamps will use one consistent `+05:30` offset. Arithmetic will preserve the same offset. The Catalyst persistence projector will convert instants to `Asia/Kolkata` wall-clock values before producing `YYYY-MM-DD HH:MM:SS`.

Rules include:

- `IncidentFromDate <= IncidentToDate <= InfoReceivedPSDate`;
- `CrimeRegisteredDate` is not after `InfoReceivedPSDate` by local calendar semantics;
- `ArrestSurrenderDate` is not before the incident date;
- `ChargesheetDetails.csdate` is not before registration;
- employee birth, appointment, and case dates remain chronologically plausible.

The validator will also check the projected Catalyst values, preventing a valid instant sequence from becoming an invalid stored wall-clock sequence.

## 7. Person and repeat-identity semantics

The PDF describes `Accused.PersonID` as the within-case accused ordering value (`A1`, `A2`, and so on). It must not be used as a cross-case identity key.

The corrected seed will generate `PersonID` independently within each FIR. Confirmed synthetic repeat identity will be represented in the existing transformation/resolution boundary, with a visibly synthetic, versioned authority mapping and evidence label. In a production integration, confirmation requires an authorized KSP identity source that is absent from the PDF. Without that authority, a match remains `POSSIBLE` or `REQUIRES_REVIEW`, never `CONFIRMED`.

This preserves repeat-offender tracking without misrepresenting an accused sorting code as identity evidence.

## 8. Entity rule coverage

| PDF entity | Enforced semantic coverage |
|---|---|
| `CaseMaster` | Primary/business IDs, crime/case number derivation, category/station/district/year consistency, chronology, coordinates, and all parent references |
| `ComplainantDetails` | Unique complainant ID, case reference, plausible age, lookup references, and encoded gender domain |
| `ActSectionAssociation` | Case reference, act/section consistency, positive display orders, and documented PDF type/key ambiguity |
| `Victim` | Unique victim ID, case reference, plausible age, gender domain, and `VictimPolice` encoded as `0` or `1` |
| `Accused` | Unique appearance ID, case reference, plausible age, gender domain, and within-case `A1..An` ordering |
| `ArrestSurrender` | Unique event ID, case/person/unit/court references, allowed type lookup, date ordering, and `0/1` indicators |
| `Act` | Unique non-empty code, descriptions, short name, and active boolean |
| `Section` | Parent act consistency, non-empty section code/description, and active boolean |
| `CrimeHeadActSection` | Valid head, act, and section combination with no duplicate mapping |
| `CrimeHead` | Unique ID, non-empty group name, and active boolean |
| `CrimeSubHead` | Unique ID, valid parent head, non-empty name, and positive sequence |
| `CasteMaster` | Unique ID and non-empty lookup name; never used for individual risk or targeting |
| `ReligionMaster` | Unique ID and non-empty lookup name; never used for individual risk or targeting |
| `OccupationMaster` | Unique ID and non-empty lookup name; only aggregate contextual use is permitted |
| `CaseStatusMaster` | Unique ID and non-empty operational status |
| `Court` | Unique ID, district/state consistency, non-empty name, and active boolean |
| `District` | Unique ID, state reference, non-empty name, and active boolean |
| `State` | Unique ID, non-empty name, nationality assumption, and active boolean |
| `Unit` | Unique ID, type/state/district references, valid self-parent, acyclic hierarchy, non-empty name, and active boolean |
| `UnitType` | Unique ID, non-empty type name, documented City/District/State classification, positive hierarchy, and active boolean |
| `Rank` | Unique ID, non-empty rank name, positive hierarchy, and active boolean |
| `Designation` | Unique ID, non-empty name, positive unique sort order, and active boolean |
| `Employee` | Unique employee/KGID values, consistent district/unit assignment, rank/designation references, date plausibility, and boolean encoding |
| `CaseCategory` | Unique one-digit category ID for the documented CrimeNo format and an operational lookup such as FIR/UDR/PAR/Zero FIR |
| `GravityOffence` | Unique ID and non-empty lookup; example labels are not treated as an exhaustive production enum |
| `ChargesheetDetails` | Unique ID, case/officer references, date ordering, and one-character `A`, `B`, or `C` final-report type |

## 9. Validation behavior

Validation runs before any Data Store write.

- Any PDF-required error rejects the affected row.
- Any error that breaks a required parent or causes batch reconciliation to fail blocks the complete batch.
- Safe synthetic assumptions are included in the manifest and visible in governance output.
- Unresolved KSP questions cannot be promoted to confirmed production behavior.
- Accepted plus rejected rows must equal source rows for every entity and for the complete batch.
- A batch cannot be marked `COMPLETED` unless projected Catalyst values also pass semantic validation.

## 10. Testing

Testing follows red-green-refactor.

1. Add failing positive tests for every rule family and all 26 entities.
2. Add negative mutations for malformed IDs, invalid suffixes, duplicate scoped serials, broken hierarchy, bad enums, invalid indicators, unresolved relationships, and chronology failures.
3. Prove that all 50 FIR identifiers follow the PDF format and that per-scope sequences are deterministic.
4. Prove that the same-name negative identity control is not confirmed and the planted repeat identity uses only the transformation authority mapping.
5. Prove that source-to-Catalyst temporal projection preserves chronology.
6. Run the complete intelligence, schema, repository, bundle, and challenge-alignment suites.

Passing structural-schema tests alone will no longer justify the phrase `PDF-aligned synthetic data`.

## 11. Development data reset

The current batch `KSP-DEMO-20260720-V1` is quarantined and must not drive intelligence publication.

Before mutation, a read-only dry run must prove:

- project `43492000000013049`;
- environment `Development`;
- exact batch key;
- exactly one synthetic batch row;
- expected source and mapping counts;
- every targeted row is synthetic and belongs to the batch;
- current intelligence/workflow row counts for the batch;
- no Production resource is addressed.

After separate explicit approval, cleanup deletes only that batch's synthetic rows in reverse dependency order, verifies zero remaining rows for the batch, and records the action in the deployment ledger. The corrected bundle is then deployed, its Function variables are restored by name without exposing secrets, and the same batch key is submitted once with zero retries.

No broad table truncation, new batch key, automatic retry, cron, or Production deployment is permitted.

## 12. Remote acceptance

The corrected Development load is accepted only when remote evidence proves:

- 26 fragmented source entities;
- 50 valid, unique FIRs;
- 411 reconciled rows or the newly documented deterministic total if the authority mapping is intentionally external to the PDF extracts;
- zero unexpected rejects;
- every `CrimeNo` and `CaseNo` derivation;
- valid chronology after Catalyst persistence;
- working Catalyst `*Ref` relationships;
- seven coherent versioned analysis runs;
- persisted hotspots, anomalies, patterns, area risk, network, repeat signals, evidence, and alerts;
- all records and findings visibly labelled synthetic.

Only after this acceptance may frontend/API work consume the batch.

## 13. Safety and rollback

- No real-person data is introduced.
- Caste, religion, and occupation never contribute to person-level risk.
- Repeat identity is not inferred from name similarity.
- Source errors are never hidden by display formatting.
- Cleanup stops on any count, ownership, environment, or synthetic-marker mismatch.
- Failure after cleanup but before reload leaves an empty, documented Development batch state; rerun uses only the same reviewed artifacts and batch key.

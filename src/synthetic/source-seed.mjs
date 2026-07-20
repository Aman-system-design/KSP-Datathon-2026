import { readFileSync } from 'node:fs';

const canonicalInput = JSON.parse(readFileSync(
  new URL('../../fixtures/intelligence/demo-input.json', import.meta.url),
  'utf8',
));

const districtIds = { 'D-BLR-U': 101, 'D-BLR-R': 102, 'D-MYS': 103 };
const stationIds = { 'PS-001': 1001, 'PS-021': 1021, 'PS-041': 1041 };
const majorIds = { PROPERTY: 1, CYBER: 2, PUBLIC_ORDER: 3 };
const minorIds = { BURGLARY: 11, VEHICLE_THEFT: 12, PAYMENT_FRAUD: 21, NUISANCE: 31 };
const actIds = { BNS: 1, IT_ACT: 2 };
const sectionIds = { '305': 305, '303': 303, '66C': 6603 };

const plusHours = (dateText, hours) => new Date(
  new Date(dateText).getTime() + hours * 60 * 60 * 1000,
).toISOString();
const caseNumber = caseId => Number(caseId.slice(-3));
const accusedMasterId = (appearanceId) => {
  const regular = appearanceId.match(/^APP-(\d{3})$/);
  if (regular) return 410000000 + Number(regular[1]);
  const repeated = appearanceId.match(/^APP-007-([AB])$/);
  if (repeated) return 420007000 + (repeated[1] === 'A' ? 1 : 2);
  const falseMatch = appearanceId.match(/^APP-FALSE-([AB])$/);
  if (falseMatch) return 430000000 + (falseMatch[1] === 'A' ? 1 : 2);
  const network = appearanceId.match(/^APP-NET-(\d{3})$/);
  if (network) return 440000000 + Number(network[1]);
  throw new Error(`unsupported synthetic appearance id ${appearanceId}`);
};

export function generateSourceSeed(seed = 20260720) {
  const cases = canonicalInput.cases.map((row) => ({
    ...row,
    number: caseNumber(row.caseId),
    CaseMasterID: 200000000 + caseNumber(row.caseId),
  }));
  const canonicalCaseMap = Object.fromEntries(
    cases.map(({ CaseMasterID, caseId }) => [String(CaseMasterID), caseId]),
  );

  const accusedRows = cases.flatMap((caseRow) => caseRow.accused.map((person) => ({
    AccusedMasterID: accusedMasterId(person.appearanceId),
    CaseMasterID: caseRow.CaseMasterID,
    AccusedName: person.name,
    AgeYear: person.age,
    GenderID: person.gender === 'F' ? 2 : 1,
    PersonID: person.personId,
  })));
  const firstAccusedByCase = new Map(accusedRows.map((row) => [row.CaseMasterID, row]));

  const tables = {
    CaseMaster: cases.map((row) => ({
      CaseMasterID: row.CaseMasterID,
      CrimeNo: `SYN-KSP-2026-${String(row.number).padStart(4, '0')}`,
      CaseNo: `SYN-${String(row.number).padStart(3, '0')}`,
      CrimeRegisteredDate: row.incidentAt.slice(0, 10),
      PolicePersonID: 9001 + (row.number % 3),
      PoliceStationID: stationIds[row.stationId],
      CaseCategoryID: 1,
      GravityOffenceID: row.gravity,
      CrimeMajorHeadID: majorIds[row.crimeMajor],
      CrimeMinorHeadID: minorIds[row.crimeMinor],
      CaseStatusID: row.number % 3 === 0 ? 2 : 1,
      CourtID: 500 + districtIds[row.districtId] - 100,
      IncidentFromDate: row.incidentAt,
      IncidentToDate: plusHours(row.incidentAt, 1),
      InfoReceivedPSDate: plusHours(row.incidentAt, 2),
      latitude: row.latitude,
      longitude: row.longitude,
      BriefFacts: row.briefFacts,
    })),
    ComplainantDetails: cases.map((row) => ({
      ComplainantID: 300000000 + row.number,
      CaseMasterID: row.CaseMasterID,
      ComplainantName: `Synthetic Complainant ${row.number}`,
      AgeYear: 25 + (row.number % 35),
      OccupationID: 1 + (row.number % 3),
      ReligionID: 1 + (row.number % 2),
      CasteID: 1 + (row.number % 2),
      GenderID: 1 + (row.number % 2),
    })),
    ActSectionAssociation: cases.map((row) => ({
      CaseMasterID: row.CaseMasterID,
      ActID: actIds[row.acts[0]],
      SectionID: sectionIds[row.sections[0]],
      ActOrderID: 1,
      SectionOrderID: 1,
    })),
    Victim: cases.map((row) => ({
      VictimMasterID: 350000000 + row.number,
      CaseMasterID: row.CaseMasterID,
      VictimName: `Synthetic Victim ${row.number}`,
      AgeYear: 18 + (row.number % 55),
      GenderID: 1 + (row.number % 2),
      VictimPolice: 'N',
    })),
    Accused: accusedRows,
    ArrestSurrender: cases.map((row) => {
      const accused = firstAccusedByCase.get(row.CaseMasterID);
      return {
        ArrestSurrenderID: 450000000 + row.number,
        CaseMasterID: row.CaseMasterID,
        ArrestSurrenderTypeID: row.number % 4 === 0 ? 2 : 1,
        ArrestSurrenderDate: plusHours(row.incidentAt, 24),
        ArrestSurrenderStateId: 29,
        ArrestSurrenderDistrictId: districtIds[row.districtId],
        PoliceStationID: stationIds[row.stationId],
        IOID: 9001 + (row.number % 3),
        CourtID: 500 + districtIds[row.districtId] - 100,
        AccusedMasterID: accused.AccusedMasterID,
        IsAccused: true,
        IsComplainantAccused: false,
      };
    }),
    Act: [
      { ActCode: 'BNS', ActDescription: 'Synthetic Bharatiya Nyaya Sanhita test lookup', ShortName: 'BNS', Active: true },
      { ActCode: 'IT_ACT', ActDescription: 'Synthetic Information Technology Act test lookup', ShortName: 'IT Act', Active: true },
    ],
    Section: [
      { ActCode: 'BNS', SectionCode: '305', SectionDescription: 'Synthetic theft section test lookup', Active: true },
      { ActCode: 'BNS', SectionCode: '303', SectionDescription: 'Synthetic vehicle theft section test lookup', Active: true },
      { ActCode: 'IT_ACT', SectionCode: '66C', SectionDescription: 'Synthetic identity misuse section test lookup', Active: true },
    ],
    CrimeHeadActSection: [
      { CrimeHeadID: 1, ActCode: 'BNS', SectionCode: '305' },
      { CrimeHeadID: 1, ActCode: 'BNS', SectionCode: '303' },
      { CrimeHeadID: 2, ActCode: 'IT_ACT', SectionCode: '66C' },
    ],
    CrimeHead: [
      { CrimeHeadID: 1, CrimeGroupName: 'Synthetic Property Crime', Active: true },
      { CrimeHeadID: 2, CrimeGroupName: 'Synthetic Cyber Crime', Active: true },
      { CrimeHeadID: 3, CrimeGroupName: 'Synthetic Public Order', Active: true },
    ],
    CrimeSubHead: [
      { CrimeSubHeadID: 11, CrimeHeadID: 1, CrimeHeadName: 'Synthetic Burglary', SeqID: 1 },
      { CrimeSubHeadID: 12, CrimeHeadID: 1, CrimeHeadName: 'Synthetic Vehicle Theft', SeqID: 2 },
      { CrimeSubHeadID: 21, CrimeHeadID: 2, CrimeHeadName: 'Synthetic Payment Fraud', SeqID: 1 },
      { CrimeSubHeadID: 31, CrimeHeadID: 3, CrimeHeadName: 'Synthetic Nuisance', SeqID: 1 },
    ],
    CasteMaster: [
      { caste_master_id: 1, caste_master_name: 'Synthetic Aggregate Category A' },
      { caste_master_id: 2, caste_master_name: 'Synthetic Aggregate Category B' },
    ],
    ReligionMaster: [
      { ReligionID: 1, ReligionName: 'Synthetic Religion Category A' },
      { ReligionID: 2, ReligionName: 'Synthetic Religion Category B' },
    ],
    OccupationMaster: [
      { OccupationID: 1, OccupationName: 'Synthetic Service Occupation' },
      { OccupationID: 2, OccupationName: 'Synthetic Business Occupation' },
      { OccupationID: 3, OccupationName: 'Synthetic Other Occupation' },
    ],
    CaseStatusMaster: [
      { CaseStatusID: 1, CaseStatusName: 'Synthetic Under Investigation' },
      { CaseStatusID: 2, CaseStatusName: 'Synthetic Chargesheet Filed' },
    ],
    Court: [
      { CourtID: 501, CourtName: 'Synthetic Bengaluru Urban Court', DistrictID: 101, StateID: 29, Active: true },
      { CourtID: 502, CourtName: 'Synthetic Bengaluru Rural Court', DistrictID: 102, StateID: 29, Active: true },
      { CourtID: 503, CourtName: 'Synthetic Mysuru Court', DistrictID: 103, StateID: 29, Active: true },
    ],
    District: [
      { DistrictID: 101, DistrictName: 'Synthetic Bengaluru Urban', StateID: 29, Active: true },
      { DistrictID: 102, DistrictName: 'Synthetic Bengaluru Rural', StateID: 29, Active: true },
      { DistrictID: 103, DistrictName: 'Synthetic Mysuru', StateID: 29, Active: true },
    ],
    State: [
      { StateID: 29, StateName: 'Synthetic Karnataka', NationalityID: 1, Active: true },
    ],
    Unit: [
      { UnitID: 1, UnitName: 'Synthetic State Police HQ', TypeID: 1, ParentUnit: null, NationalityID: 1, StateID: 29, DistrictID: null, Active: true },
      { UnitID: 101, UnitName: 'Synthetic Bengaluru Urban District', TypeID: 2, ParentUnit: 1, NationalityID: 1, StateID: 29, DistrictID: 101, Active: true },
      { UnitID: 102, UnitName: 'Synthetic Bengaluru Rural District', TypeID: 2, ParentUnit: 1, NationalityID: 1, StateID: 29, DistrictID: 102, Active: true },
      { UnitID: 103, UnitName: 'Synthetic Mysuru District', TypeID: 2, ParentUnit: 1, NationalityID: 1, StateID: 29, DistrictID: 103, Active: true },
      { UnitID: 1001, UnitName: 'Synthetic Central Police Station', TypeID: 3, ParentUnit: 101, NationalityID: 1, StateID: 29, DistrictID: 101, Active: true },
      { UnitID: 1021, UnitName: 'Synthetic Rural Police Station', TypeID: 3, ParentUnit: 102, NationalityID: 1, StateID: 29, DistrictID: 102, Active: true },
      { UnitID: 1041, UnitName: 'Synthetic Mysuru Police Station', TypeID: 3, ParentUnit: 103, NationalityID: 1, StateID: 29, DistrictID: 103, Active: true },
    ],
    UnitType: [
      { UnitTypeID: 1, UnitTypeName: 'Synthetic State HQ', CityDistState: 'STATE', Hierarchy: 1, Active: true },
      { UnitTypeID: 2, UnitTypeName: 'Synthetic District', CityDistState: 'DISTRICT', Hierarchy: 2, Active: true },
      { UnitTypeID: 3, UnitTypeName: 'Synthetic Police Station', CityDistState: 'STATION', Hierarchy: 3, Active: true },
    ],
    Rank: [
      { RankID: 1, RankName: 'Director General of Police', Hierarchy: 1, Active: true },
      { RankID: 2, RankName: 'Inspector General of Police', Hierarchy: 2, Active: true },
      { RankID: 3, RankName: 'Superintendent of Police', Hierarchy: 3, Active: true },
      { RankID: 4, RankName: 'Police Inspector', Hierarchy: 4, Active: true },
    ],
    Designation: [
      { DesignationID: 1, DesignationName: 'State Police Chief', Active: true, SortOrder: 1 },
      { DesignationID: 2, DesignationName: 'District Police Chief', Active: true, SortOrder: 2 },
      { DesignationID: 3, DesignationName: 'Station House Officer', Active: true, SortOrder: 3 },
      { DesignationID: 4, DesignationName: 'Crime Analyst', Active: true, SortOrder: 4 },
    ],
    Employee: [
      { EmployeeID: 9001, DistrictID: 101, UnitID: 1001, RankID: 4, DesignationID: 3, KGID: 'SYN-KGID-9001', FirstName: 'Synthetic Officer One', EmployeeDOB: '1985-01-01', GenderID: 1, BloodGroupID: 1, PhysicallyChallenged: false, AppointmentDate: '2010-01-01' },
      { EmployeeID: 9002, DistrictID: 102, UnitID: 1021, RankID: 4, DesignationID: 3, KGID: 'SYN-KGID-9002', FirstName: 'Synthetic Officer Two', EmployeeDOB: '1987-02-02', GenderID: 2, BloodGroupID: 2, PhysicallyChallenged: false, AppointmentDate: '2012-02-02' },
      { EmployeeID: 9003, DistrictID: 103, UnitID: 1041, RankID: 4, DesignationID: 4, KGID: 'SYN-KGID-9003', FirstName: 'Synthetic Analyst Three', EmployeeDOB: '1990-03-03', GenderID: 1, BloodGroupID: 3, PhysicallyChallenged: false, AppointmentDate: '2015-03-03' },
    ],
    CaseCategory: [
      { CaseCategoryID: 1, LookupValue: 'Synthetic Cognizable Case' },
    ],
    GravityOffence: [
      { GravityOffenceID: 1, LookupValue: 'Synthetic Low' },
      { GravityOffenceID: 2, LookupValue: 'Synthetic Moderate' },
      { GravityOffenceID: 3, LookupValue: 'Synthetic High' },
      { GravityOffenceID: 4, LookupValue: 'Synthetic Severe' },
    ],
    ChargesheetDetails: cases.map((row) => ({
      CSID: 500000000 + row.number,
      CaseMasterID: row.CaseMasterID,
      csdate: plusHours(row.incidentAt, 72),
      cstype: 'SYNTHETIC_FINAL',
      PolicePersonID: 9001 + (row.number % 3),
    })),
  };

  return Object.freeze({
    fixtureVersion: 'pdf-aligned-1.0.0',
    seed,
    syntheticData: true,
    sourceDocument: 'Police_FIR_ER_Diagram.pdf',
    canonicalCaseMap,
    tables,
  });
}

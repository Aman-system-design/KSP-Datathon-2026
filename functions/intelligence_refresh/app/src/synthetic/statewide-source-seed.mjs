import { buildCrimeIdentity, formatKarnatakaDateTime } from '../ingestion/pdf-semantic-rules.mjs';

const STATE_ID = 29;
const STATE_UNIT_ID = 1;
const DAY_MS = 86_400_000;

const districts = Object.freeze([
  ['Bagalkot', 16.1691, 75.6615], ['Ballari', 15.1394, 76.9214],
  ['Belagavi', 15.8497, 74.4977], ['Bengaluru Rural', 13.2847, 77.6078],
  ['Bengaluru Urban', 12.9716, 77.5946], ['Bidar', 17.9149, 77.5046],
  ['Chamarajanagar', 11.9261, 76.9437], ['Chikkaballapur', 13.4355, 77.7315],
  ['Chikkamagaluru', 13.3153, 75.7754], ['Chitradurga', 14.2251, 76.3980],
  ['Dakshina Kannada', 12.8438, 75.2479], ['Davanagere', 14.4644, 75.9218],
  ['Dharwad', 15.4589, 75.0078], ['Gadag', 15.4315, 75.6355],
  ['Hassan', 13.0072, 76.0962], ['Haveri', 14.7951, 75.3991],
  ['Kalaburagi', 17.3297, 76.8343], ['Kodagu', 12.3375, 75.8069],
  ['Kolar', 13.1362, 78.1291], ['Koppal', 15.3505, 76.1567],
  ['Mandya', 12.5223, 76.8970], ['Mysuru', 12.2958, 76.6394],
  ['Raichur', 16.2076, 77.3463], ['Ramanagara', 12.7200, 77.2800],
  ['Shivamogga', 13.9299, 75.5681], ['Tumakuru', 13.3379, 77.1173],
  ['Udupi', 13.3409, 74.7421], ['Uttara Kannada', 14.7937, 74.6869],
  ['Vijayapura', 16.8302, 75.7100], ['Yadgir', 16.7700, 77.1400],
  ['Vijayanagara', 15.3350, 76.4600],
].map(([name, latitude, longitude], index) => Object.freeze({
  name,
  latitude,
  longitude,
  districtId: 201 + index,
  stationId: 2001 + index,
  employeeId: 9201 + index,
  courtId: 701 + index,
})));

const offenceCycle = Object.freeze([
  { major: 1, minor: 12, gravity: 3, act: 1, section: 303, label: 'vehicle theft' },
  { major: 1, minor: 12, gravity: 3, act: 1, section: 303, label: 'vehicle theft' },
  { major: 1, minor: 11, gravity: 4, act: 1, section: 305, label: 'burglary' },
  { major: 2, minor: 21, gravity: 3, act: 2, section: 6603, label: 'payment fraud' },
  { major: 2, minor: 21, gravity: 3, act: 2, section: 6603, label: 'payment fraud' },
  { major: 3, minor: 31, gravity: 2, act: 1, section: 303, label: 'public order incident' },
  { major: 3, minor: 31, gravity: 2, act: 1, section: 303, label: 'public order incident' },
  { major: 1, minor: 11, gravity: 4, act: 1, section: 305, label: 'burglary' },
  { major: 3, minor: 31, gravity: 2, act: 1, section: 303, label: 'public order incident' },
  { major: 1, minor: 12, gravity: 3, act: 1, section: 303, label: 'vehicle theft' },
]);

function randomGenerator(seed) {
  let value = seed >>> 0;
  return () => {
    value += 0x6D2B79F5;
    let next = value;
    next = Math.imul(next ^ next >>> 15, next | 1);
    next ^= next + Math.imul(next ^ next >>> 7, next | 61);
    return ((next ^ next >>> 14) >>> 0) / 4_294_967_296;
  };
}

const plusHours = (dateText, hours) => formatKarnatakaDateTime(
  new Date(dateText).getTime() + hours * 60 * 60 * 1000,
);

function plantedScenario(index) {
  if (index <= 72) {
    const group = Math.floor((index - 1) / 12);
    return { type: 'hotspot', group };
  }
  if (index >= 101 && index <= 140) {
    const group = Math.floor((index - 101) / 10);
    return { type: 'pattern', group };
  }
  return null;
}

function createCaseRows({ caseCount, seed }) {
  const random = randomGenerator(seed);
  const start = Date.UTC(2025, 0, 1, 0, 30);
  const serialByScope = new Map();
  const cases = [];

  for (let offset = 0; offset < caseCount; offset += 1) {
    const index = offset + 1;
    const scenario = plantedScenario(index);
    const district = districts[(index * 7 + Math.floor(index / 31)) % districts.length];
    const offence = scenario?.type === 'pattern'
      ? { major: 1, minor: 11, gravity: 4, act: 1, section: 305, label: 'burglary' }
      : offenceCycle[offset % offenceCycle.length];
    const dayOffset = (offset * 37 + Math.floor(offset / 17)) % 540;
    const night = offset % 4 === 0 || offence.minor === 12 || scenario !== null;
    const hour = night ? 20 + (offset % 8) : 7 + (offset % 12);
    const incident = new Date(start + dayOffset * DAY_MS + (hour % 24) * 60 * 60 * 1000);
    const incidentAt = formatKarnatakaDateTime(incident);
    const scope = `${district.districtId}|${district.stationId}|${incidentAt.slice(0, 4)}`;
    const serial = (serialByScope.get(scope) ?? 0) + 1;
    serialByScope.set(scope, serial);

    const jitterLatitude = (random() - 0.5) * 0.22;
    const jitterLongitude = (random() - 0.5) * 0.22;
    const hotspotDistrict = districts[[4, 21, 2, 16, 10, 24][scenario?.group ?? 0]];
    const latitude = scenario?.type === 'hotspot'
      ? hotspotDistrict.latitude + ((index - 1) % 12) * 0.00045
      : district.latitude + jitterLatitude;
    const longitude = scenario?.type === 'hotspot'
      ? hotspotDistrict.longitude + ((index - 1) % 12) * 0.00038
      : district.longitude + jitterLongitude;
    const caseMasterId = 200000000 + index;
    const identity = buildCrimeIdentity({
      categoryCode: 1,
      districtId: district.districtId,
      stationId: district.stationId,
      year: Number(incidentAt.slice(0, 4)),
      serial,
    });
    const brief = scenario?.type === 'pattern'
      ? `Synthetic pattern ${scenario.group + 1}: rear entry, jewellery targeted, duplicate registration motorcycle observed.`
      : scenario?.type === 'hotspot'
        ? `Synthetic hotspot ${scenario.group + 1}: parked vehicle theft reported during night patrol window.`
        : `Synthetic ${offence.label} record ${index} generated for governed statewide analytics.`;

    cases.push(Object.freeze({
      index,
      caseMasterId,
      district,
      offence,
      incidentAt,
      latitude: Number(latitude.toFixed(6)),
      longitude: Number(longitude.toFixed(6)),
      identity,
      brief,
      scenario,
    }));
  }
  return cases;
}

function accusedMasterId(caseRow) {
  if (caseRow.index === 1) return 420007001;
  if (caseRow.index === 201) return 420007002;
  if (caseRow.index === 301) return 430000001;
  if (caseRow.index === 401) return 430000002;
  return 410000000 + caseRow.index;
}

function buildTruth(cases) {
  const ids = rows => rows.map(row => row.caseMasterId);
  return Object.freeze({
    hotspots: Object.freeze(Array.from({ length: 6 }, (_, group) => Object.freeze({
      id: `TRUTH-HOTSPOT-${group + 1}`,
      caseMasterIds: Object.freeze(ids(cases.filter(row => row.scenario?.type === 'hotspot' && row.scenario.group === group))),
    }))),
    patterns: Object.freeze(Array.from({ length: 4 }, (_, group) => Object.freeze({
      id: `TRUTH-PATTERN-${group + 1}`,
      caseMasterIds: Object.freeze(ids(cases.filter(row => row.scenario?.type === 'pattern' && row.scenario.group === group))),
    }))),
    anomalies: Object.freeze(Array.from({ length: 4 }, (_, index) => Object.freeze({
      id: `TRUTH-ANOMALY-${index + 1}`,
      districtId: districts[[4, 21, 2, 16][index]].districtId,
      offence: index % 2 === 0 ? 'VEHICLE_THEFT' : 'BURGLARY',
    }))),
    negativeControls: Object.freeze([
      Object.freeze({ id: 'CONTROL-SEASONAL-FESTIVAL', expected: false }),
      Object.freeze({ id: 'CONTROL-SAME-NAME', expected: false }),
      Object.freeze({ id: 'CONTROL-SPARSE-RURAL', expected: false }),
    ]),
    repeatIdentity: Object.freeze({ personId: 'PERSON-007', caseMasterIds: Object.freeze([200000001, 200000201]) }),
  });
}

export function generateStatewideSourceSeed({ seed = 20260724, caseCount = 5200 } = {}) {
  if (!Number.isSafeInteger(caseCount) || caseCount < 5200 || caseCount > 50_000) {
    throw new TypeError('statewide caseCount must be an integer from 5,200 to 50,000');
  }
  const cases = createCaseRows({ caseCount, seed });
  const accusedRows = cases.flatMap((row) => {
    const primary = {
      AccusedMasterID: accusedMasterId(row), CaseMasterID: row.caseMasterId,
      AccusedName: row.index === 301 || row.index === 401 ? 'Synthetic Same Name' : `Synthetic Accused ${row.index}`,
      AgeYear: 18 + row.index % 52, GenderID: row.index % 3 === 0 ? 2 : 1, PersonID: 'A1',
    };
    if (row.scenario?.type !== 'pattern') return [primary];
    return [primary, {
      AccusedMasterID: 440000000 + row.index, CaseMasterID: row.caseMasterId,
      AccusedName: `Synthetic Pattern Associate ${row.scenario.group + 1}`,
      AgeYear: 31 + row.scenario.group, GenderID: 1, PersonID: 'A2',
    }];
  });
  const firstAccused = new Map(accusedRows.filter(row => row.PersonID === 'A1').map(row => [row.CaseMasterID, row]));

  const tables = {
    CaseMaster: cases.map(row => ({
      CaseMasterID: row.caseMasterId, ...row.identity,
      CrimeRegisteredDate: row.incidentAt.slice(0, 10), PolicePersonID: row.district.employeeId,
      PoliceStationID: row.district.stationId, CaseCategoryID: 1, GravityOffenceID: row.offence.gravity,
      CrimeMajorHeadID: row.offence.major, CrimeMinorHeadID: row.offence.minor,
      CaseStatusID: row.index % 5 === 0 ? 2 : 1, CourtID: row.district.courtId,
      IncidentFromDate: row.incidentAt, IncidentToDate: plusHours(row.incidentAt, 1),
      InfoReceivedPSDate: plusHours(row.incidentAt, 2), latitude: row.latitude, longitude: row.longitude,
      BriefFacts: row.brief,
    })),
    ComplainantDetails: cases.map(row => ({
      ComplainantID: 300000000 + row.index, CaseMasterID: row.caseMasterId,
      ComplainantName: `Synthetic Complainant ${row.index}`, AgeYear: 21 + row.index % 55,
      OccupationID: 1 + row.index % 3, ReligionID: 1 + row.index % 2,
      CasteID: 1 + row.index % 2, GenderID: 1 + row.index % 2,
    })),
    ActSectionAssociation: cases.map(row => ({
      CaseMasterID: row.caseMasterId, ActID: row.offence.act, SectionID: row.offence.section,
      ActOrderID: 1, SectionOrderID: 1,
    })),
    Victim: cases.map(row => ({
      VictimMasterID: 350000000 + row.index, CaseMasterID: row.caseMasterId,
      VictimName: `Synthetic Victim ${row.index}`, AgeYear: 18 + row.index % 63,
      GenderID: 1 + row.index % 2, VictimPolice: '0',
    })),
    Accused: accusedRows,
    ArrestSurrender: cases.map(row => ({
      ArrestSurrenderID: 450000000 + row.index, CaseMasterID: row.caseMasterId,
      ArrestSurrenderTypeID: row.index % 4 === 0 ? 2 : 1,
      ArrestSurrenderDate: plusHours(row.incidentAt, 24).slice(0, 10), ArrestSurrenderStateId: STATE_ID,
      ArrestSurrenderDistrictId: row.district.districtId, PoliceStationID: row.district.stationId,
      IOID: row.district.employeeId, CourtID: row.district.courtId,
      AccusedMasterID: firstAccused.get(row.caseMasterId).AccusedMasterID,
      IsAccused: true, IsComplainantAccused: false,
    })),
    Act: [
      { ActCode: 'BNS', ActDescription: 'Synthetic Bharatiya Nyaya Sanhita lookup', ShortName: 'BNS', Active: true },
      { ActCode: 'IT_ACT', ActDescription: 'Synthetic Information Technology Act lookup', ShortName: 'IT Act', Active: true },
    ],
    Section: [
      { ActCode: 'BNS', SectionCode: '305', SectionDescription: 'Synthetic burglary section', Active: true },
      { ActCode: 'BNS', SectionCode: '303', SectionDescription: 'Synthetic theft section', Active: true },
      { ActCode: 'IT_ACT', SectionCode: '66C', SectionDescription: 'Synthetic identity misuse section', Active: true },
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
      { CrimeSubHeadID: 31, CrimeHeadID: 3, CrimeHeadName: 'Synthetic Public Order', SeqID: 1 },
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
    Court: districts.map(row => ({
      CourtID: row.courtId, CourtName: `Synthetic ${row.name} Court`, DistrictID: row.districtId,
      StateID: STATE_ID, Active: true,
    })),
    District: districts.map(row => ({
      DistrictID: row.districtId, DistrictName: `Synthetic ${row.name}`, StateID: STATE_ID, Active: true,
    })),
    State: [{ StateID: STATE_ID, StateName: 'Synthetic Karnataka', NationalityID: 1, Active: true }],
    Unit: [
      { UnitID: STATE_UNIT_ID, UnitName: 'Synthetic Karnataka State Police HQ', TypeID: 1, ParentUnit: null, NationalityID: 1, StateID: STATE_ID, DistrictID: null, Active: true },
      ...districts.flatMap(row => ([
        { UnitID: row.districtId, UnitName: `Synthetic ${row.name} District`, TypeID: 2, ParentUnit: STATE_UNIT_ID, NationalityID: 1, StateID: STATE_ID, DistrictID: row.districtId, Active: true },
        { UnitID: row.stationId, UnitName: `Synthetic ${row.name} Central Police Station`, TypeID: 3, ParentUnit: row.districtId, NationalityID: 1, StateID: STATE_ID, DistrictID: row.districtId, Active: true },
      ])),
    ],
    UnitType: [
      { UnitTypeID: 1, UnitTypeName: 'Synthetic State HQ', CityDistState: 'State', Hierarchy: 1, Active: true },
      { UnitTypeID: 2, UnitTypeName: 'Synthetic District', CityDistState: 'District', Hierarchy: 2, Active: true },
      { UnitTypeID: 3, UnitTypeName: 'Synthetic Police Station', CityDistState: 'District', Hierarchy: 3, Active: true },
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
    Employee: districts.map((row, index) => ({
      EmployeeID: row.employeeId, DistrictID: row.districtId, UnitID: row.stationId,
      RankID: 4, DesignationID: index % 5 === 0 ? 4 : 3, KGID: `SYN-KGID-${row.employeeId}`,
      FirstName: `Synthetic Officer ${index + 1}`, EmployeeDOB: `198${index % 10}-01-01`,
      GenderID: 1 + index % 2, BloodGroupID: 1 + index % 4, PhysicallyChallenged: false,
      AppointmentDate: `${2010 + index % 10}-01-01`,
    })),
    CaseCategory: [{ CaseCategoryID: 1, LookupValue: 'FIR' }],
    GravityOffence: [
      { GravityOffenceID: 1, LookupValue: 'Synthetic Low' },
      { GravityOffenceID: 2, LookupValue: 'Synthetic Moderate' },
      { GravityOffenceID: 3, LookupValue: 'Synthetic High' },
      { GravityOffenceID: 4, LookupValue: 'Synthetic Severe' },
    ],
    ChargesheetDetails: cases.map(row => ({
      CSID: 500000000 + row.index, CaseMasterID: row.caseMasterId,
      csdate: plusHours(row.incidentAt, 72), cstype: 'A', PolicePersonID: row.district.employeeId,
    })),
  };

  return Object.freeze({
    fixtureVersion: 'pdf-aligned-statewide-2.0.0',
    seed,
    syntheticData: true,
    sourceDocument: 'Police_FIR_ER_Diagram.pdf',
    canonicalCaseMap: Object.freeze(Object.fromEntries(cases.map(row => [String(row.caseMasterId), `CASE-${String(row.index).padStart(6, '0')}`]))),
    truth: buildTruth(cases),
    tables,
  });
}

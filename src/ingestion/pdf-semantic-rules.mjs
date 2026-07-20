import { readFileSync } from 'node:fs';

export const semanticContract = Object.freeze(JSON.parse(readFileSync(
  new URL('../../schema/catalyst/pdf-semantic-contract.json', import.meta.url),
  'utf8',
)));

const integerInRange = (name, value, minimum, maximum) => {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new TypeError(`${name} is outside its documented range.`);
  }
  return value;
};

export function buildCrimeIdentity({ categoryCode, districtId, stationId, year, serial }) {
  const category = integerInRange('categoryCode', categoryCode, 0, 9);
  const district = integerInRange('districtId', districtId, 0, 9999);
  const station = integerInRange('stationId', stationId, 0, 9999);
  const registrationYear = integerInRange('year', year, 1000, 9999);
  const runningSerial = integerInRange('serial', serial, 1, 99999);
  const CaseNo = `${registrationYear}${String(runningSerial).padStart(5, '0')}`;
  return Object.freeze({
    CrimeNo: `${category}${String(district).padStart(4, '0')}${String(station).padStart(4, '0')}${CaseNo}`,
    CaseNo,
  });
}

export function parseInstant(value) {
  const instant = new Date(value);
  if (Number.isNaN(instant.valueOf())) throw new TypeError('DateTime value is invalid.');
  return instant;
}

export function formatKarnatakaDateTime(value) {
  const shifted = new Date(parseInstant(value).valueOf() + 330 * 60 * 1000);
  return `${shifted.toISOString().slice(0, 19)}+05:30`;
}

const hasText = value => typeof value === 'string' && value.trim().length > 0;
const isPositiveInteger = value => Number.isInteger(value) && value > 0;
const isBoolean = value => value === true || value === false || value === 0 || value === 1;
const indexBy = (rows, key) => new Map(rows.map(row => [String(row[key]), row]));

export function validateSemanticSeed({ tables, reject }) {
  if (!tables || typeof reject !== 'function') throw new TypeError('Semantic validation inputs are required.');
  const units = indexBy(tables.Unit ?? [], 'UnitID');
  const districts = indexBy(tables.District ?? [], 'DistrictID');
  const states = indexBy(tables.State ?? [], 'StateID');
  const employees = indexBy(tables.Employee ?? [], 'EmployeeID');
  const cases = indexBy(tables.CaseMaster ?? [], 'CaseMasterID');
  const accused = indexBy(tables.Accused ?? [], 'AccusedMasterID');
  const crimeHeads = indexBy(tables.CrimeHead ?? [], 'CrimeHeadID');
  const caseCategories = indexBy(tables.CaseCategory ?? [], 'CaseCategoryID');
  const gravity = indexBy(tables.GravityOffence ?? [], 'GravityOffenceID');
  const statuses = indexBy(tables.CaseStatusMaster ?? [], 'CaseStatusID');
  const courts = indexBy(tables.Court ?? [], 'CourtID');
  const ranks = indexBy(tables.Rank ?? [], 'RankID');
  const designations = indexBy(tables.Designation ?? [], 'DesignationID');
  const unitTypes = indexBy(tables.UnitType ?? [], 'UnitTypeID');

  const scopedSerials = new Map();
  (tables.CaseMaster ?? []).forEach((row, index) => {
    if (!isPositiveInteger(row.CaseMasterID)) reject('CaseMaster', index, 'PDF-CASE-BUSINESS-ID');
    const station = units.get(String(row.PoliceStationID));
    const year = Number(String(row.CrimeRegisteredDate).slice(0, 4));
    const validShape = /^\d{18}$/u.test(String(row.CrimeNo));
    if (!validShape || !station || !caseCategories.has(String(row.CaseCategoryID))) {
      reject('CaseMaster', index, 'PDF-CASE-CRIME-NO');
    } else {
      const serial = Number(String(row.CrimeNo).slice(13));
      try {
        const expected = buildCrimeIdentity({
          categoryCode: Number(row.CaseCategoryID), districtId: Number(station.DistrictID),
          stationId: Number(row.PoliceStationID), year, serial,
        });
        if (row.CrimeNo !== expected.CrimeNo) reject('CaseMaster', index, 'PDF-CASE-CRIME-NO');
        const token = `${String(row.CrimeNo).slice(0, 13)}|${serial}`;
        const prior = scopedSerials.get(token);
        if (prior !== undefined) {
          reject('CaseMaster', prior, 'PDF-CASE-CRIME-NO');
          reject('CaseMaster', index, 'PDF-CASE-CRIME-NO');
        }
        scopedSerials.set(token, index);
      } catch {
        reject('CaseMaster', index, 'PDF-CASE-CRIME-NO');
      }
    }
    if (!/^\d{9}$/u.test(String(row.CaseNo)) || row.CaseNo !== String(row.CrimeNo).slice(-9)) {
      reject('CaseMaster', index, 'PDF-CASE-CASE-NO');
    }
    const from = Date.parse(row.IncidentFromDate);
    const to = Date.parse(row.IncidentToDate);
    const received = Date.parse(row.InfoReceivedPSDate);
    if (![from, to, received].every(Number.isFinite) || from > to || to > received) {
      reject('CaseMaster', index, 'PDF-CASE-CHRONOLOGY');
    }
    if (!employees.has(String(row.PolicePersonID)) || !gravity.has(String(row.GravityOffenceID))
      || !crimeHeads.has(String(row.CrimeMajorHeadID)) || !statuses.has(String(row.CaseStatusID))
      || !courts.has(String(row.CourtID))) reject('CaseMaster', index, 'PDF-CASE-BUSINESS-ID');
  });

  (tables.Accused ?? []).forEach((row, index) => {
    if (!/^A[1-9][0-9]*$/u.test(String(row.PersonID))) reject('Accused', index, 'PDF-ACCUSED-ORDER');
    if (!Number.isInteger(row.AgeYear) || row.AgeYear < 0 || row.AgeYear > 120) reject('Accused', index, 'PDF-ACCUSED-SEMANTICS');
  });
  (tables.Victim ?? []).forEach((row, index) => {
    if (!['0', '1'].includes(String(row.VictimPolice))) reject('Victim', index, 'PDF-VICTIM-POLICE');
    if (!Number.isInteger(row.AgeYear) || row.AgeYear < 0 || row.AgeYear > 120) reject('Victim', index, 'PDF-VICTIM-SEMANTICS');
  });
  (tables.ComplainantDetails ?? []).forEach((row, index) => {
    if (!Number.isInteger(row.AgeYear) || row.AgeYear < 0 || row.AgeYear > 120) reject('ComplainantDetails', index, 'PDF-COMPLAINANT-SEMANTICS');
  });

  const syntheticActCodes = new Map([[1, 'BNS'], [2, 'IT_ACT']]);
  const syntheticSectionCodes = new Map([[305, '305'], [303, '303'], [6603, '66C']]);
  const sectionKeys = new Set((tables.Section ?? []).map(row => `${row.ActCode}|${row.SectionCode}`));
  (tables.ActSectionAssociation ?? []).forEach((row, index) => {
    const actCode = syntheticActCodes.get(row.ActID);
    const sectionCode = syntheticSectionCodes.get(row.SectionID);
    if (!actCode || !sectionCode || !sectionKeys.has(`${actCode}|${sectionCode}`)
      || !isPositiveInteger(row.ActOrderID) || !isPositiveInteger(row.SectionOrderID)) {
      reject('ActSectionAssociation', index, 'PDF-CASE-LEGAL-SEMANTICS');
    }
  });

  (tables.ArrestSurrender ?? []).forEach((row, index) => {
    const caseRow = cases.get(String(row.CaseMasterID));
    const valid = caseRow && accused.has(String(row.AccusedMasterID)) && units.has(String(row.PoliceStationID))
      && employees.has(String(row.IOID)) && courts.has(String(row.CourtID))
      && states.has(String(row.ArrestSurrenderStateId)) && districts.has(String(row.ArrestSurrenderDistrictId))
      && isBoolean(row.IsAccused) && isBoolean(row.IsComplainantAccused)
      && Number.isFinite(Date.parse(row.ArrestSurrenderDate))
      && Date.parse(row.ArrestSurrenderDate) >= Date.parse(caseRow.IncidentFromDate);
    if (!valid) reject('ArrestSurrender', index, 'PDF-ARREST-SEMANTICS');
  });

  const activeLookupSpecs = [
    ['Act', 'ActCode', 'ActDescription', 'PDF-ACT-SEMANTICS'],
    ['CrimeHead', 'CrimeHeadID', 'CrimeGroupName', 'PDF-CRIME-HEAD-SEMANTICS'],
    ['State', 'StateID', 'StateName', 'PDF-STATE-SEMANTICS'],
  ];
  for (const [table, id, label, code] of activeLookupSpecs) {
    (tables[table] ?? []).forEach((row, index) => {
      if (!hasText(String(row[id])) || !hasText(row[label]) || !isBoolean(row.Active)
        || (table === 'Act' && !hasText(row.ShortName))) reject(table, index, code);
    });
  }

  const lookupSpecs = [
    ['CasteMaster', 'caste_master_id', 'caste_master_name', 'PDF-CASTE-SEMANTICS'],
    ['ReligionMaster', 'ReligionID', 'ReligionName', 'PDF-RELIGION-SEMANTICS'],
    ['OccupationMaster', 'OccupationID', 'OccupationName', 'PDF-OCCUPATION-SEMANTICS'],
    ['CaseStatusMaster', 'CaseStatusID', 'CaseStatusName', 'PDF-CASE-STATUS-SEMANTICS'],
    ['GravityOffence', 'GravityOffenceID', 'LookupValue', 'PDF-GRAVITY-SEMANTICS'],
  ];
  for (const [table, id, label, code] of lookupSpecs) {
    (tables[table] ?? []).forEach((row, index) => {
      if (!isPositiveInteger(row[id]) || !hasText(row[label])) reject(table, index, code);
    });
  }

  (tables.Section ?? []).forEach((row, index) => {
    if (!hasText(row.ActCode) || !hasText(row.SectionCode) || !hasText(row.SectionDescription)
      || !isBoolean(row.Active)) reject('Section', index, 'PDF-SECTION-SEMANTICS');
  });
  (tables.CrimeHeadActSection ?? []).forEach((row, index) => {
    if (!crimeHeads.has(String(row.CrimeHeadID)) || !sectionKeys.has(`${row.ActCode}|${row.SectionCode}`)) {
      reject('CrimeHeadActSection', index, 'PDF-CRIME-LEGAL-MAP');
    }
  });
  (tables.CrimeSubHead ?? []).forEach((row, index) => {
    if (!crimeHeads.has(String(row.CrimeHeadID)) || !hasText(row.CrimeHeadName) || !isPositiveInteger(row.SeqID)) {
      reject('CrimeSubHead', index, 'PDF-CRIME-SUBHEAD-SEMANTICS');
    }
  });

  (tables.District ?? []).forEach((row, index) => {
    if (!states.has(String(row.StateID)) || !hasText(row.DistrictName) || !isBoolean(row.Active)) {
      reject('District', index, 'PDF-DISTRICT-SEMANTICS');
    }
  });
  (tables.Court ?? []).forEach((row, index) => {
    const district = districts.get(String(row.DistrictID));
    if (!district || String(district.StateID) !== String(row.StateID) || !hasText(row.CourtName) || !isBoolean(row.Active)) {
      reject('Court', index, 'PDF-COURT-SEMANTICS');
    }
  });

  (tables.Unit ?? []).forEach((row, index) => {
    let current = row;
    const visited = new Set();
    let invalid = !hasText(row.UnitName) || !unitTypes.has(String(row.TypeID)) || !states.has(String(row.StateID)) || !isBoolean(row.Active);
    while (current?.ParentUnit !== null && current?.ParentUnit !== undefined) {
      if (visited.has(String(current.UnitID))) { invalid = true; break; }
      visited.add(String(current.UnitID));
      current = units.get(String(current.ParentUnit));
      if (!current) { invalid = true; break; }
    }
    if (invalid) reject('Unit', index, 'PDF-UNIT-HIERARCHY');
  });
  (tables.UnitType ?? []).forEach((row, index) => {
    if (!hasText(row.UnitTypeName) || !['City', 'District', 'State'].includes(row.CityDistState)
      || !isPositiveInteger(row.Hierarchy) || !isBoolean(row.Active)) reject('UnitType', index, 'PDF-UNIT-TYPE-SEMANTICS');
  });
  (tables.Rank ?? []).forEach((row, index) => {
    if (!hasText(row.RankName) || !isPositiveInteger(row.Hierarchy) || !isBoolean(row.Active)) reject('Rank', index, 'PDF-RANK-SEMANTICS');
  });
  (tables.Designation ?? []).forEach((row, index) => {
    if (!hasText(row.DesignationName) || !isPositiveInteger(row.SortOrder) || !isBoolean(row.Active)) {
      reject('Designation', index, 'PDF-DESIGNATION-SEMANTICS');
    }
  });
  (tables.Employee ?? []).forEach((row, index) => {
    const unit = units.get(String(row.UnitID));
    const valid = unit && String(unit.DistrictID) === String(row.DistrictID)
      && ranks.has(String(row.RankID)) && designations.has(String(row.DesignationID))
      && hasText(row.KGID) && hasText(row.FirstName) && isBoolean(row.PhysicallyChallenged)
      && Number.isFinite(Date.parse(row.EmployeeDOB)) && Number.isFinite(Date.parse(row.AppointmentDate))
      && Date.parse(row.EmployeeDOB) < Date.parse(row.AppointmentDate);
    if (!valid) reject('Employee', index, 'PDF-EMPLOYEE-SEMANTICS');
  });
  (tables.CaseCategory ?? []).forEach((row, index) => {
    if (!Number.isInteger(row.CaseCategoryID) || row.CaseCategoryID < 0 || row.CaseCategoryID > 9
      || !['FIR', 'UDR', 'PAR', 'ZERO_FIR'].includes(row.LookupValue)) {
      reject('CaseCategory', index, 'PDF-CASE-CATEGORY-SEMANTICS');
    }
  });
  (tables.ChargesheetDetails ?? []).forEach((row, index) => {
    const caseRow = cases.get(String(row.CaseMasterID));
    if (!['A', 'B', 'C'].includes(row.cstype)) reject('ChargesheetDetails', index, 'PDF-CS-TYPE');
    if (!caseRow || !employees.has(String(row.PolicePersonID)) || !Number.isFinite(Date.parse(row.csdate))
      || Date.parse(row.csdate) < Date.parse(caseRow.CrimeRegisteredDate)) {
      reject('ChargesheetDetails', index, 'PDF-CS-SEMANTICS');
    }
  });
}

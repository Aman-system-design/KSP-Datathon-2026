import { createHash } from 'node:crypto';

import { validateSemanticSeed } from './pdf-semantic-rules.mjs';

const businessKeys = {
  CaseMaster: ['CaseMasterID'],
  ComplainantDetails: ['ComplainantID'],
  ActSectionAssociation: ['CaseMasterID', 'ActID', 'SectionID'],
  Victim: ['VictimMasterID'],
  Accused: ['AccusedMasterID'],
  ArrestSurrender: ['ArrestSurrenderID'],
  Act: ['ActCode'],
  Section: ['ActCode', 'SectionCode'],
  CrimeHeadActSection: ['CrimeHeadID', 'ActCode', 'SectionCode'],
  CrimeHead: ['CrimeHeadID'],
  CrimeSubHead: ['CrimeSubHeadID'],
  CasteMaster: ['caste_master_id'],
  ReligionMaster: ['ReligionID'],
  OccupationMaster: ['OccupationID'],
  CaseStatusMaster: ['CaseStatusID'],
  Court: ['CourtID'],
  District: ['DistrictID'],
  State: ['StateID'],
  Unit: ['UnitID'],
  UnitType: ['UnitTypeID'],
  Rank: ['RankID'],
  Designation: ['DesignationID'],
  Employee: ['EmployeeID'],
  CaseCategory: ['CaseCategoryID'],
  GravityOffence: ['GravityOffenceID'],
  ChargesheetDetails: ['CSID'],
};

const rowToken = (table, index) => `${table}:${index}`;
const hasValue = value => value !== null && value !== undefined && value !== '';
const rowHash = row => createHash('sha256').update(JSON.stringify(row)).digest('hex');

function sourceKey(table, row, index) {
  const values = (businessKeys[table] ?? []).map(column => row[column]);
  return values.every(hasValue) ? values.join('|') : `[missing]:${index + 1}`;
}

export function validateSourceSeed(seed) {
  const tables = seed?.tables ?? {};
  const reasons = new Map();
  const reject = (table, index, reasonCode) => {
    const token = rowToken(table, index);
    if (!reasons.has(token)) reasons.set(token, reasonCode);
  };

  for (const [table, rows] of Object.entries(tables)) {
    const keys = businessKeys[table] ?? [];
    const occurrences = new Map();

    rows.forEach((row, index) => {
      if (seed.syntheticData !== true) reject(table, index, 'NON_SYNTHETIC_PROVENANCE');
      if (keys.some(key => !hasValue(row[key]))) reject(table, index, 'MISSING_BUSINESS_ID');
      if (keys.every(key => hasValue(row[key]))) {
        const key = keys.map(column => String(row[column])).join('|');
        const indexes = occurrences.get(key) ?? [];
        indexes.push(index);
        occurrences.set(key, indexes);
      }
    });

    for (const indexes of occurrences.values()) {
      if (indexes.length > 1) indexes.forEach(index => reject(table, index, 'DUPLICATE_BUSINESS_ID'));
    }
  }

  (tables.CaseMaster ?? []).forEach((row, index) => {
    if (!Number.isFinite(row.latitude) || row.latitude < -90 || row.latitude > 90
      || !Number.isFinite(row.longitude) || row.longitude < -180 || row.longitude > 180) {
      reject('CaseMaster', index, 'INVALID_COORDINATE');
    }
    const from = Date.parse(row.IncidentFromDate);
    const to = Date.parse(row.IncidentToDate);
    if (!Number.isFinite(from) || !Number.isFinite(to) || to < from) {
      reject('CaseMaster', index, 'INVALID_INCIDENT_RANGE');
    }
  });

  validateSemanticSeed({ tables, reject });

  const validCaseIds = new Set(
    (tables.CaseMaster ?? [])
      .filter((_, index) => !reasons.has(rowToken('CaseMaster', index)))
      .map(({ CaseMasterID }) => CaseMasterID),
  );
  for (const [table, rows] of Object.entries(tables)) {
    if (table === 'CaseMaster' || !rows.some(row => Object.hasOwn(row, 'CaseMasterID'))) continue;
    rows.forEach((row, index) => {
      if (!validCaseIds.has(row.CaseMasterID)) reject(table, index, 'ORPHAN_CASE');
    });
  }

  const accepted = Object.fromEntries(Object.keys(tables).map(table => [table, []]));
  const rejected = [];
  let sourceRows = 0;

  for (const [table, rows] of Object.entries(tables)) {
    rows.forEach((row, index) => {
      sourceRows += 1;
      const reasonCode = reasons.get(rowToken(table, index));
      if (!reasonCode) {
        accepted[table].push(row);
        return;
      }
      rejected.push({
        table,
        sourceKey: sourceKey(table, row, index),
        reasonCode,
        rowHash: rowHash(row),
      });
    });
  }

  const acceptedRows = Object.values(accepted).reduce((sum, rows) => sum + rows.length, 0);
  const rejectedRows = rejected.length;
  return Object.freeze({
    accepted,
    rejected,
    reconciliation: Object.freeze({
      sourceRows,
      acceptedRows,
      rejectedRows,
      balanced: sourceRows === acceptedRows + rejectedRows,
    }),
  });
}

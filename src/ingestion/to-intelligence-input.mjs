import { readFileSync } from 'node:fs';

const identityAuthority = Object.freeze(JSON.parse(readFileSync(
  new URL('../../fixtures/intelligence/synthetic-identity-authority.json', import.meta.url),
  'utf8',
)));

const pad = value => String(value).padStart(3, '0');
const caseId = sourceId => `CASE-${pad(Number(sourceId) - 200000000)}`;

function canonicalPersonId(sourceId) {
  const key = String(sourceId);
  if (identityAuthority.exact[key]) return identityAuthority.exact[key];
  const numeric = Number(sourceId);
  const range = identityAuthority.ranges.find(({ minimum, maximum }) => numeric >= minimum && numeric <= maximum);
  if (!range) throw new Error(`Synthetic identity authority is missing accused ${sourceId}.`);
  if (range.constant) return range.constant;
  const value = numeric - range.sourceBase + range.canonicalOffset;
  return `${range.prefix}${String(value).padStart(range.width, '0')}`;
}

function appearanceId(sourceId) {
  const id = Number(sourceId);
  if (id >= 410000001 && id <= 410000999) return `APP-${pad(id - 410000000)}`;
  if (id === 420007001) return 'APP-007-A';
  if (id === 420007002) return 'APP-007-B';
  if (id === 430000001) return 'APP-FALSE-A';
  if (id === 430000002) return 'APP-FALSE-B';
  if (id >= 440000001 && id <= 440000999) return `APP-NET-${pad(id - 440000000)}`;
  return `APP-ACC-${id}`;
}

function groupBy(rows, key) {
  const groups = new Map();
  for (const row of rows) {
    const values = groups.get(row[key]) ?? [];
    values.push(row);
    groups.set(row[key], values);
  }
  return groups;
}

function buildWeeklySeries(cases) {
  const dates = cases.map(row => new Date(row.incidentAt));
  const latest = new Date(Math.max(...dates.map(date => date.valueOf())));
  const currentStart = new Date(Date.UTC(latest.getUTCFullYear(), latest.getUTCMonth(), 1));
  const currentEnd = new Date(currentStart.valueOf() + 7 * 86_400_000);
  const inCurrentWindow = cases.filter((row) => {
    const time = new Date(row.incidentAt).valueOf();
    return time >= currentStart.valueOf() && time < currentEnd.valueOf();
  });
  const majorCounts = new Map();
  for (const row of inCurrentWindow) {
    majorCounts.set(row.crimeMajor, (majorCounts.get(row.crimeMajor) ?? 0) + 1);
  }
  const targetMajor = [...majorCounts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))[0]?.[0];
  const evidence = inCurrentWindow.filter(row => row.crimeMajor === targetMajor);
  const history = Array.from({ length: 12 }, (_, reverseIndex) => {
    const index = 12 - reverseIndex;
    const start = currentStart.valueOf() - index * 7 * 86_400_000;
    const end = start + 7 * 86_400_000;
    return cases.filter((row) => {
      const time = new Date(row.incidentAt).valueOf();
      return row.crimeMajor === targetMajor && time >= start && time < end;
    }).length;
  });
  const districtCount = new Set(cases.map(({ districtId }) => districtId)).size;

  return [
    {
      seriesId: 'SERIES-ANOMALY',
      history,
      current: evidence.length,
      seasonalPeriod: 0,
      evidenceCaseIds: evidence.map(({ caseId: id }) => id),
    },
    {
      seriesId: 'SERIES-SEASONAL',
      history: Array(12).fill(districtCount),
      current: districtCount,
      seasonalPeriod: 6,
      evidenceCaseIds: [],
    },
  ];
}

export function toIntelligenceInput(accepted) {
  const associations = groupBy(accepted.ActSectionAssociation ?? [], 'CaseMasterID');
  const accused = groupBy(accepted.Accused ?? [], 'CaseMasterID');
  const districtByStation = new Map(
    (accepted.Unit ?? [])
      .filter(({ DistrictID }) => DistrictID !== null)
      .map(({ UnitID, DistrictID }) => [UnitID, DistrictID]),
  );

  const cases = (accepted.CaseMaster ?? [])
    .map((row) => {
      const legal = associations.get(row.CaseMasterID) ?? [];
      const appearances = accused.get(row.CaseMasterID) ?? [];
      const coordinatesValid = Number.isFinite(row.latitude) && Number.isFinite(row.longitude);
      const relationshipResolved = legal.length > 0 && appearances.length > 0;
      return {
        caseId: caseId(row.CaseMasterID),
        districtId: `D-${districtByStation.get(row.PoliceStationID)}`,
        stationId: `PS-${row.PoliceStationID}`,
        crimeMajor: `HEAD-${row.CrimeMajorHeadID}`,
        crimeMinor: `SUBHEAD-${row.CrimeMinorHeadID}`,
        gravity: Number(row.GravityOffenceID),
        incidentAt: row.IncidentFromDate,
        latitude: row.latitude,
        longitude: row.longitude,
        acts: [...new Set(legal.map(({ ActID }) => `ACT-${ActID}`))],
        sections: [...new Set(legal.map(({ SectionID }) => `SECTION-${SectionID}`))],
        accused: appearances.map(person => ({
          appearanceId: appearanceId(person.AccusedMasterID),
          personId: canonicalPersonId(person.AccusedMasterID),
          sourcePersonOrder: person.PersonID,
          identityEvidenceLabel: identityAuthority.evidenceLabel,
          identityAuthorityVersion: identityAuthority.authorityVersion,
          name: person.AccusedName,
          age: person.AgeYear,
          gender: person.GenderID === 2 ? 'F' : 'M',
        })),
        briefFacts: row.BriefFacts,
        synthetic: true,
        quality: {
          coordinatesValid,
          relationshipResolved,
          completeness: coordinatesValid && relationshipResolved ? 1 : 0.5,
        },
      };
    })
    .sort((left, right) => left.caseId.localeCompare(right.caseId));

  return Object.freeze({
    schemaVersion: 'police-fir-er-diagram-2026-06-10',
    fixtureVersion: 'pdf-aligned-1.0.0',
    asOf: '2026-07-01T00:00:00Z',
    cases,
    weeklySeries: buildWeeklySeries(cases),
  });
}

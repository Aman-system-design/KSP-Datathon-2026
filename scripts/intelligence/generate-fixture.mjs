import fs from 'node:fs';

const pad = value => String(value).padStart(3, '0');
const patternIds = new Set([1, 2, 21, 22]);
const hotspotCoordinates = [
  [12.9716, 77.5946], [12.9720, 77.5950], [12.9724, 77.5953],
  [12.9709, 77.5941], [12.9712, 77.5956], [12.9728, 77.5948],
];

const cases = Array.from({ length: 50 }, (_, offset) => {
  const index = offset + 1;
  const pattern = patternIds.has(index);
  const hotspot = index <= 6;
  const baseLatitude = 13.5 + index * 0.07;
  const baseLongitude = 75.5 + (index % 10) * 0.18;
  const [latitude, longitude] = hotspot
    ? hotspotCoordinates[index - 1]
    : index === 21 ? [12.85, 77.60]
      : index === 22 ? [12.84, 77.61]
        : [baseLatitude, baseLongitude];
  const personId = index === 1 || index === 21 ? 'PERSON-007' : index === 30 ? 'PERSON-031' : index === 44 ? 'PERSON-044' : `PERSON-${pad(index + 100)}`;
  const appearanceId = index === 1 ? 'APP-007-A' : index === 21 ? 'APP-007-B' : index === 30 ? 'APP-FALSE-A' : index === 44 ? 'APP-FALSE-B' : `APP-${pad(index)}`;
  const displayName = index === 30 || index === 44 ? 'Synthetic Same Name' : `Synthetic Person ${index}`;
  return {
    caseId: `CASE-${pad(index)}`,
    districtId: index <= 20 ? 'D-BLR-U' : index <= 35 ? 'D-BLR-R' : 'D-MYS',
    stationId: index <= 20 ? 'PS-001' : index <= 35 ? 'PS-021' : 'PS-041',
    crimeMajor: pattern || hotspot ? 'PROPERTY' : index % 2 ? 'CYBER' : 'PUBLIC_ORDER',
    crimeMinor: pattern ? 'BURGLARY' : hotspot ? 'VEHICLE_THEFT' : index % 2 ? 'PAYMENT_FRAUD' : 'NUISANCE',
    gravity: pattern ? 4 : hotspot ? 3 : 2,
    incidentAt: pattern || hotspot ? `2026-06-${String(1 + (index % 20)).padStart(2, '0')}T21:${String(index).padStart(2, '0')}:00+05:30` : `2026-05-${String(1 + (index % 27)).padStart(2, '0')}T10:00:00+05:30`,
    latitude,
    longitude,
    acts: pattern || hotspot ? ['BNS'] : ['IT_ACT'],
    sections: pattern ? ['305'] : hotspot ? ['303'] : ['66C'],
    accused: [{ appearanceId, personId, name: displayName, age: index === 44 ? 30 : 28 + (index % 5), gender: 'M' }],
    briefFacts: pattern
      ? 'Synthetic test record: rear-window entry, jewellery targeted, motorcycle observed.'
      : hotspot
        ? 'Synthetic test record: parked vehicle property theft control.'
        : `Synthetic test record: unrelated control incident number ${index}.`,
    synthetic: true,
    quality: { coordinatesValid: true, relationshipResolved: true, completeness: 1 },
  };
});

const input = {
  schemaVersion: '1.0.0', fixtureVersion: '1.0.0', asOf: '2026-07-01T00:00:00Z', cases,
  weeklySeries: [
    { seriesId: 'SERIES-ANOMALY', history: [2, 2, 3, 2, 2, 3, 2, 2, 3, 2, 2, 3], current: 9, seasonalPeriod: 0, evidenceCaseIds: ['CASE-001', 'CASE-002'] },
    { seriesId: 'SERIES-SEASONAL', history: [4, 6, 7, 8, 6, 5, 4, 6, 7, 8, 6, 5], current: 4, seasonalPeriod: 6, evidenceCaseIds: [] },
  ],
};

const truth = {
  fixtureVersion: '1.0.0',
  pattern: { id: 'PATTERN-CROSS-DISTRICT-1', caseIds: ['CASE-001', 'CASE-002', 'CASE-021', 'CASE-022'] },
  hotspot: { id: 'HOTSPOT-1', caseIds: ['CASE-001', 'CASE-002', 'CASE-003', 'CASE-004', 'CASE-005', 'CASE-006'] },
  anomaly: { seriesId: 'SERIES-ANOMALY', expected: true },
  seasonalNegativeControl: { seriesId: 'SERIES-SEASONAL', expected: false },
  repeatIdentity: { personId: 'PERSON-007', appearanceIds: ['APP-007-A', 'APP-007-B'] },
  falseNameMatch: { personId: 'PERSON-031', otherPersonId: 'PERSON-044', expectedConfirmed: false },
};

fs.mkdirSync('fixtures/intelligence', { recursive: true });
fs.writeFileSync('fixtures/intelligence/demo-input.json', `${JSON.stringify(input, null, 2)}\n`);
fs.writeFileSync('fixtures/intelligence/demo-truth.json', `${JSON.stringify(truth, null, 2)}\n`);

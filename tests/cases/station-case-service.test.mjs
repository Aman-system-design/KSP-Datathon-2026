import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ageInDays,
  ageingBucket,
  createStationCaseService,
  karnatakaCalendarAgeDays,
  karnatakaIncidentHour,
} from '../../src/backend/cases/station-case-service.mjs';
import { MemoryIntelligenceRepository } from '../../src/backend/repository/memory-repository.mjs';

const rows = [
  {
    caseId: 'CASE-1', caseNumber: '01/2026', unitId: 1001, unitName: 'Central Station',
    status: 'Under Investigation', registeredAt: '2026-07-20T00:00:00Z',
    incidentAt: '2026-07-19T22:00:00Z', majorHead: 'Theft', minorHead: 'Vehicle Theft',
    syntheticData: true,
  },
  {
    caseId: 'CASE-2', caseNumber: '02/2026', unitId: 2001, unitName: 'North Station',
    status: 'Under Investigation', registeredAt: '2026-04-01T00:00:00Z',
    incidentAt: '2026-04-01T00:00:00Z', majorHead: 'Property', minorHead: 'Burglary',
    syntheticData: true,
  },
];
const repository = {
  async listStationCaseRows() { return rows; },
  async getStationCaseRow(id) { return rows.find(row => row.caseId === id); },
};
const service = createStationCaseService({
  repository,
  now: () => new Date('2026-07-26T00:00:00Z'),
});
const access = { scopeUnitId: 1001, authorizedUnitIds: new Set([1001]), actions: ['READ_CASE'] };

test('station case list returns only authorized units with deterministic ageing', async () => {
  const result = await service.list({ access, query: {} });
  assert.deepEqual(
    result.data.items.map(({ caseId, ageDays, ageingBucket }) => ({ caseId, ageDays, ageingBucket })),
    [{ caseId: 'CASE-1', ageDays: 6, ageingBucket: '0–7 days' }],
  );
  assert.equal(result.data.items[0].registeredAgeDays, 6);
  assert.equal(result.data.items[0].incidentHour, 3);
});

test('station analytics derive provenance from synthetic, operational, mixed, and empty rows', async () => {
  for (const [sourceRows, provenance, syntheticData] of [
    [[rows[0]], 'SYNTHETIC', true],
    [[{ ...rows[0], syntheticData: false }], 'OPERATIONAL', false],
    [[rows[0], { ...rows[0], caseId: 'CASE-MIXED', syntheticData: false }], 'MIXED', false],
    [[], 'EMPTY', false],
  ]) {
    const provenanceService = createStationCaseService({
      repository: { async listStationCaseRows() { return sourceRows; } },
      now: () => new Date('2026-07-26T00:00:00Z'),
    });
    const result = await provenanceService.listForReport({ access });
    assert.equal(result.provenance, provenance);
    assert.equal(result.syntheticData, syntheticData);
  }
});

test('case detail fails closed outside the station scope', async () => {
  await assert.rejects(service.get({ access, caseId: 'CASE-2' }), { code: 'NOT_FOUND' });
  await assert.rejects(service.get({ access, caseId: 'MISSING' }), { code: 'NOT_FOUND' });
});

test('case list and detail require the dedicated case-read action', async () => {
  const denied = { ...access, actions: [] };
  await assert.rejects(service.list({ access: denied, query: {} }), { code: 'FORBIDDEN_ACTION' });
  await assert.rejects(service.get({ access: denied, caseId: 'CASE-1' }), { code: 'FORBIDDEN_ACTION' });
});

test('ageing boundaries use Karnataka civil calendar days', () => {
  const current = new Date('2026-07-26T12:30:00Z');
  const expected = [
    [7, '0–7 days'],
    [8, '8–30 days'],
    [30, '8–30 days'],
    [31, '31–60 days'],
    [60, '31–60 days'],
    [61, '60+ days'],
  ];
  for (const [days, bucket] of expected) {
    const registeredAt = new Date(current.getTime() - days * 86_400_000).toISOString();
    assert.equal(ageInDays(registeredAt, current), days);
    assert.equal(ageingBucket(days), bucket);
  }
  assert.equal(ageInDays('2026-07-25T13:00:00Z', current), 1);
});

test('age calculation clamps future dates and handles invalid dates safely', () => {
  const current = new Date('2026-07-26T00:00:00Z');
  assert.equal(ageInDays('2026-07-27T00:00:00Z', current), 0);
  assert.equal(ageInDays('not-a-date', current), 0);
  assert.equal(ageInDays(undefined, current), 0);
  assert.equal(ageInDays('2026-07-20T00:00:00Z', new Date('invalid')), 0);
});

test('Karnataka incident hour interprets zone-less civil time and converts zoned instants', () => {
  assert.equal(karnatakaIncidentHour('2026-07-19T22:15:00'), 22);
  assert.equal(karnatakaIncidentHour('2026-07-19T22:15:00.123456'), 22);
  assert.equal(karnatakaIncidentHour('2026-07-19T22:15:00+05:30'), 22);
  assert.equal(karnatakaIncidentHour('2026-07-19T20:45:00Z'), 2);
  assert.equal(karnatakaIncidentHour('invalid'), null);
});

test('Karnataka registration age uses civil calendar days independent of timestamp zone', () => {
  const now = '2026-07-31T20:00:00Z'; // 1 August in Karnataka.
  assert.equal(karnatakaCalendarAgeDays('2026-07-02T23:59:59', now), 30);
  assert.equal(karnatakaCalendarAgeDays('2026-07-02T23:59:59+05:30', now), 30);
  assert.equal(karnatakaCalendarAgeDays('2026-07-02T18:29:59Z', now), 30);
  assert.equal(karnatakaCalendarAgeDays('2026-07-02T18:30:00Z', now), 29);
  assert.equal(karnatakaCalendarAgeDays('2026-08-02T00:00:00', now), 0);
  assert.equal(karnatakaCalendarAgeDays('invalid', now), null);
});

test('invalid source dates remain unavailable for report filters and incident grouping', async () => {
  const invalid = { ...rows[0], registeredAt: 'invalid', incidentAt: undefined };
  const invalidService = createStationCaseService({
    repository: { async listStationCaseRows() { return [invalid]; } },
    now: () => new Date('2026-07-26T00:00:00Z'),
  });
  const [projected] = (await invalidService.listForReport({ access })).data.items;
  assert.equal(projected.registeredAgeDays, null);
  assert.equal(projected.incidentHour, null);
});

test('openOnly accepts strict boolean transport forms', async () => {
  const lifecycleRows = [
    ...rows.slice(0, 1),
    ...['Closed', 'Disposed', 'Acquitted', 'Convicted', 'False case', 'Mistake of fact']
      .map((status, index) => ({
        ...rows[0], caseId: `CLOSED-${index}`, caseNumber: `${index + 2}/2026`, status,
      })),
  ];
  const lifecycleRepository = {
    async listStationCaseRows() { return lifecycleRows; },
    async getStationCaseRow(id) { return lifecycleRows.find(row => row.caseId === id); },
  };
  const lifecycleService = createStationCaseService({
    repository: lifecycleRepository, now: () => new Date('2026-07-26T00:00:00Z'),
  });

  const open = await lifecycleService.list({ access, query: {} });
  assert.deepEqual(open.data.items.map(row => row.caseId), ['CASE-1']);
  for (const openOnly of [true, 'true']) {
    assert.deepEqual(
      (await lifecycleService.list({ access, query: { openOnly } })).data.items.map(row => row.caseId),
      ['CASE-1'],
    );
  }
  for (const openOnly of [false, 'false']) {
    const all = await lifecycleService.list({ access, query: { openOnly } });
    assert.equal(all.data.items.length, lifecycleRows.length);
    assert.equal(all.data.items.filter(row => !row.isOpen).length, lifecycleRows.length - 1);
  }
  for (const openOnly of ['FALSE', 'yes', 0, null]) {
    await assert.rejects(
      lifecycleService.list({ access, query: { openOnly } }),
      { code: 'INVALID_REQUEST' },
    );
  }
});

test('only explicit known open lifecycle labels enter default metrics', async () => {
  const statusRows = [
    { ...rows[0], caseId: 'OPEN-1', status: 'Under Investigation' },
    { ...rows[0], caseId: 'OPEN-2', status: 'Synthetic Chargesheet Filed' },
    { ...rows[0], caseId: 'UNKNOWN-1', status: 'Unknown' },
    { ...rows[0], caseId: 'UNKNOWN-2', status: 'Awaiting external review' },
  ];
  const statusService = createStationCaseService({
    repository: {
      async listStationCaseRows() { return statusRows; },
      async getStationCaseRow(id) { return statusRows.find(row => row.caseId === id); },
    },
    now: () => new Date('2026-07-26T00:00:00Z'),
  });

  const open = await statusService.list({ access, query: {} });
  assert.deepEqual(open.data.items.map(row => row.caseId), ['OPEN-1', 'OPEN-2']);
  const all = await statusService.list({ access, query: { openOnly: false } });
  assert.deepEqual(
    all.data.items.map(({ caseId, isOpen }) => ({ caseId, isOpen })),
    [
      { caseId: 'OPEN-1', isOpen: true },
      { caseId: 'OPEN-2', isOpen: true },
      { caseId: 'UNKNOWN-1', isOpen: false },
      { caseId: 'UNKNOWN-2', isOpen: false },
    ],
  );
});

test('list limit is bounded to the inclusive range 1 through 200', async () => {
  const manyRows = Array.from({ length: 205 }, (_, index) => ({
    ...rows[0], caseId: `CASE-${index + 1}`, caseNumber: `${index + 1}/2026`,
  }));
  const manyService = createStationCaseService({
    repository: {
      async listStationCaseRows() { return manyRows; },
      async getStationCaseRow() { return undefined; },
    },
    now: () => new Date('2026-07-26T00:00:00Z'),
  });

  assert.equal((await manyService.list({ access, query: { limit: 0 } })).data.items.length, 1);
  assert.equal((await manyService.list({ access, query: { limit: -10 } })).data.items.length, 1);
  assert.equal((await manyService.list({ access, query: { limit: 999 } })).data.items.length, 200);
});

test('analytical case reads include more than one HTTP page without silently truncating', async () => {
  const manyRows = Array.from({ length: 205 }, (_, index) => ({
    ...rows[0], caseId: `CASE-${index + 1}`, caseNumber: `${index + 1}/2026`,
  }));
  let requestedUnitIds;
  const manyService = createStationCaseService({
    repository: {
      async listStationCaseRows({ unitIds }) { requestedUnitIds = unitIds; return manyRows; },
      async getStationCaseRow() { return undefined; },
    },
    now: () => new Date('2026-07-26T00:00:00Z'),
  });

  const result = await manyService.listForReport({ access });
  assert.equal(result.data.items.length, 205);
  assert.strictEqual(requestedUnitIds, access.authorizedUnitIds);
});

test('list sorts newest registrations first with stable case tie-breaks before limiting', async () => {
  const unordered = [
    { ...rows[0], caseId: 'CASE-Z', registeredAt: 'invalid' },
    { ...rows[0], caseId: 'CASE-B', registeredAt: '2026-07-25T00:00:00Z' },
    { ...rows[0], caseId: 'CASE-C', registeredAt: '2026-07-24T00:00:00Z' },
    { ...rows[0], caseId: 'CASE-A', registeredAt: '2026-07-25T00:00:00Z' },
    { ...rows[0], caseId: 'CASE-Y', registeredAt: undefined },
  ];
  const orderedService = createStationCaseService({
    repository: {
      async listStationCaseRows() { return unordered; },
      async getStationCaseRow() { return undefined; },
    },
    now: () => new Date('2026-07-26T00:00:00Z'),
  });

  const limited = await orderedService.list({ access, query: { limit: 3 } });
  assert.deepEqual(limited.data.items.map(row => row.caseId), ['CASE-A', 'CASE-B', 'CASE-C']);
  const all = await orderedService.list({ access, query: { openOnly: false } });
  assert.deepEqual(
    all.data.items.map(row => row.caseId),
    ['CASE-A', 'CASE-B', 'CASE-C', 'CASE-Y', 'CASE-Z'],
  );
});

test('client projections are immutable, synthetic, and contain no unapproved fields', async () => {
  const unsafeRow = { ...rows[0], BriefFacts: 'must not leave the domain boundary', accused: ['person'] };
  const projectionService = createStationCaseService({
    repository: {
      async listStationCaseRows() { return [unsafeRow]; },
      async getStationCaseRow() { return unsafeRow; },
    },
    now: () => new Date('2026-07-26T00:00:00Z'),
  });
  const result = await projectionService.get({ access, caseId: unsafeRow.caseId });

  assert.equal(result.syntheticData, true);
  assert.equal(result.data.syntheticData, true);
  assert.equal(Object.isFrozen(result.data), true);
  assert.equal(Object.hasOwn(result.data, 'BriefFacts'), false);
  assert.equal(Object.hasOwn(result.data, 'accused'), false);
  assert.throws(() => { result.data.status = 'mutated'; }, TypeError);
});

test('memory repository joins canonical source masters into a cloned safe projection', async () => {
  const state = {
    source: {
      tables: {
        CaseMaster: [
          {
            CaseMasterID: 42, CaseNo: '00042/2026', PoliceStationID: 1001, CaseStatusID: 1,
            FIRDate: '2026-07-20T00:00:00Z', IncidentFromDate: '2026-07-19T22:00:00Z',
            CrimeMajorHeadID: 10, CrimeMinorHeadID: 11, BriefFacts: 'restricted narrative',
            ComplainantName: 'restricted person',
          },
          {
            CaseMasterID: 43, CaseNo: '00043/2026', PoliceStationID: 1001, CaseStatusID: 999,
            FIRDate: '2026-07-21T00:00:00Z', IncidentFromDate: '2026-07-20T22:00:00Z',
            CrimeMajorHeadID: 10, CrimeMinorHeadID: 11,
          },
          {
            CaseMasterID: 44, CaseNo: '00044/2026', PoliceStationID: 9999, CaseStatusID: 999,
            FIRDate: '2026-07-22T00:00:00Z', IncidentFromDate: '2026-07-21T22:00:00Z',
            CrimeMajorHeadID: 999, CrimeMinorHeadID: 999,
          },
        ],
        Unit: [{ UnitID: 1001, UnitName: 'Central Station' }],
        CaseStatusMaster: [{ CaseStatusID: 1, CaseStatusName: 'Under Investigation' }],
        CrimeMajorHeadMaster: [{ CrimeMajorHeadID: 10, CrimeMajorHeadName: 'Property' }],
        CrimeMinorHeadMaster: [{ CrimeMinorHeadID: 11, CrimeMinorHeadName: 'Burglary' }],
      },
    },
    runGroups: [],
  };
  const sourceRepository = new MemoryIntelligenceRepository(state);
  assert.deepEqual(await sourceRepository.listStationCaseRows(), []);
  assert.deepEqual(await sourceRepository.listStationCaseRows({ unitIds: [] }), []);
  const projected = await sourceRepository.listStationCaseRows({ unitIds: [1001, 9999] });

  assert.deepEqual(projected, [
    {
      caseId: '42', caseNumber: '00042/2026', unitId: 1001, unitName: 'Central Station',
      status: 'Under Investigation', registeredAt: '2026-07-20T00:00:00Z',
      incidentAt: '2026-07-19T22:00:00Z', majorHead: 'Property', minorHead: 'Burglary',
      syntheticData: true,
    },
    {
      caseId: '43', caseNumber: '00043/2026', unitId: 1001, unitName: 'Central Station',
      status: 'Unknown', registeredAt: '2026-07-21T00:00:00Z',
      incidentAt: '2026-07-20T22:00:00Z', majorHead: 'Property', minorHead: 'Burglary',
      syntheticData: true,
    },
    {
      caseId: '44', caseNumber: '00044/2026', unitId: 9999, unitName: 'Unknown',
      status: 'Unknown', registeredAt: '2026-07-22T00:00:00Z',
      incidentAt: '2026-07-21T22:00:00Z', majorHead: 'Unknown', minorHead: 'Unknown',
      syntheticData: true,
    },
  ]);
  projected[0].status = 'mutated';
  assert.equal((await sourceRepository.getStationCaseRow(42)).status, 'Under Investigation');
});

import assert from 'node:assert/strict';
import test from 'node:test';

import { createStationCaseService } from '../../src/backend/cases/station-case-service.mjs';
import { buildDemoState } from '../../src/backend/repository/build-demo-state.mjs';
import { MemoryIntelligenceRepository } from '../../src/backend/repository/memory-repository.mjs';
import { createReportService } from '../../src/backend/reporting/report-service.mjs';

const NOW = '2026-07-26T00:00:00Z';
const owner = {
  actualUserId: 'OWNER', role: 'STATION_OPERATIONS', scopeUnitId: 1001,
  authorizedUnitIds: new Set([1001]), actions: ['READ_CASE'],
};

const caseRow = (index, overrides = {}) => ({
  caseId: `CASE-${index}`, caseNumber: `${index}/2026`, unitId: 1001, unitName: 'Central Station',
  status: 'Under Investigation', registeredAt: '2026-07-20T00:00:00Z',
  incidentAt: '2026-07-19T22:00:00Z', majorHead: 'Theft', minorHead: 'Vehicle Theft',
  syntheticData: true, ...overrides,
});

function harness(rows) {
  const repository = new MemoryIntelligenceRepository(buildDemoState());
  repository.listStationCaseRows = async () => rows;
  const cases = createStationCaseService({ repository, now: () => new Date(NOW) });
  let id = 0;
  const reports = createReportService({
    repository,
    readServices: { listStationCasesForAnalytics: input => cases.listForReport(input) },
    now: () => NOW, idFactory: () => `REPORT-${++id}`,
  });
  return { reports };
}

async function execute(rows, definition, access = owner) {
  const { reports } = harness(rows);
  const report = await reports.create({ access: owner, input: definition });
  if (access !== owner) {
    await reports.share({ access: owner, reportId: report.id, target: { role: access.role } });
  }
  return reports.execute({ access, reportId: report.id });
}

test('station case ageing bars aggregate only the current viewer station', async () => {
  const result = await execute([
    caseRow(1), caseRow(2, { registeredAt: '2026-06-01T00:00:00Z' }),
    caseRow(3, { unitId: 2001, unitName: 'North Station' }),
  ], {
    name: 'Case ageing', sourceKey: 'stationCases', dimensions: ['ageingBucket'],
    measures: [{ field: 'recordCount', aggregate: 'sum' }], visualization: { type: 'bar' },
  });

  assert.deepEqual(result.result.data.items, [
    { ageingBucket: '0–7 days', recordCount_sum: 1 },
    { ageingBucket: '31–60 days', recordCount_sum: 1 },
  ]);
});

test('station case number reports count open cases', async () => {
  const result = await execute([
    caseRow(1), caseRow(2, { status: 'Closed' }), caseRow(3),
  ], {
    name: 'Open cases', sourceKey: 'stationCases',
    measures: [{ field: 'recordCount', aggregate: 'sum' }],
    filters: [{ field: 'isOpen', operator: 'eq', value: true }],
    visualization: { type: 'number' },
  });
  assert.deepEqual(result.result.data.items, [{ recordCount_sum: 2 }]);
  assert.equal(result.syntheticData, true);
  assert.equal(result.provenance, 'SYNTHETIC');
});

test('new case reports count all lifecycle states registered in the last thirty days', async () => {
  const result = await execute([
    caseRow(1, { registeredAt: '2026-07-20T00:00:00Z' }),
    caseRow(2, { registeredAt: '2026-07-10T00:00:00Z', status: 'Closed' }),
    caseRow(3, { registeredAt: '2026-06-01T00:00:00Z' }),
    caseRow(4, { registeredAt: 'invalid' }),
  ], {
    name: 'New Cases · Last 30 Days', sourceKey: 'stationCases',
    measures: [{ field: 'recordCount', aggregate: 'sum' }],
    filters: [{ field: 'registeredAgeDays', operator: 'lte', value: 30 }],
    visualization: { type: 'number' },
  });
  assert.deepEqual(result.result.data.items, [{ recordCount_sum: 2 }]);
});

test('selected-period reports exclude future registrations across every supported period', async () => {
  for (const periodDays of [7, 30, 90]) {
    const result = await execute([
      caseRow(1, { registeredAt: '2026-07-20T00:00:00Z' }),
      caseRow(2, { registeredAt: '2026-08-01T00:00:00Z' }),
    ], {
      name: `New Cases - Last ${periodDays} Days`, sourceKey: 'stationCases',
      measures: [{ field: 'recordCount', aggregate: 'sum' }],
      filters: [{ field: 'registeredAgeDays', operator: 'lte', value: periodDays }],
      visualization: { type: 'number' },
    });
    assert.deepEqual(result.result.data.items, [{ recordCount_sum: 1 }]);
  }
});

test('incident pattern reports group valid server-derived Karnataka civil hours', async () => {
  const result = await execute([
    caseRow(1, { incidentAt: '2026-07-19T22:15:00Z' }),
    caseRow(2, { incidentAt: '2026-07-18T00:45:00Z' }),
    caseRow(3, { incidentAt: '2026-07-17T22:59:00Z' }),
    caseRow(4, { incidentAt: 'invalid' }),
  ], {
    name: '24-Hour Incident Pattern', sourceKey: 'stationCases', dimensions: ['incidentHour'],
    measures: [{ field: 'recordCount', aggregate: 'sum' }],
    filters: [{ field: 'incidentHour', operator: 'gte', value: 0 }],
    sort: [{ field: 'incidentHour', direction: 'asc' }], visualization: { type: 'line' },
  });
  assert.deepEqual(result.result.data.items, [
    { incidentHour: 3, recordCount_sum: 1 },
    { incidentHour: 4, recordCount_sum: 1 },
    { incidentHour: 6, recordCount_sum: 1 },
  ]);
});

test('report execution preserves mixed provenance without claiming demonstration data', async () => {
  const result = await execute([
    caseRow(1, { syntheticData: true }),
    caseRow(2, { syntheticData: false }),
  ], {
    name: 'All cases', sourceKey: 'stationCases',
    measures: [{ field: 'recordCount', aggregate: 'sum' }], visualization: { type: 'number' },
  });
  assert.equal(result.provenance, 'MIXED');
  assert.equal(result.syntheticData, false);
});

test('station case reports aggregate complete analytical reads beyond the 200-row HTTP limit', async () => {
  const result = await execute(Array.from({ length: 205 }, (_, index) => caseRow(index + 1)), {
    name: 'All cases', sourceKey: 'stationCases',
    measures: [{ field: 'recordCount', aggregate: 'sum' }], visualization: { type: 'number' },
  });
  assert.deepEqual(result.result.data.items, [{ recordCount_sum: 205 }]);
});

test('shared station case reports reauthorize READ_CASE for the current viewer', async () => {
  const denied = {
    actualUserId: 'DENIED', role: 'COMMAND_CENTER', scopeUnitId: 1001,
    authorizedUnitIds: new Set([1001]), actions: [],
  };
  await assert.rejects(execute([caseRow(1)], {
    name: 'Shared cases', sourceKey: 'stationCases',
    measures: [{ field: 'recordCount', aggregate: 'sum' }], visualization: { type: 'number' },
  }, denied), { code: 'FORBIDDEN_ACTION' });
});

test('station case reports fail honestly above the 5,000-case analytical ceiling', async () => {
  await assert.rejects(execute(Array.from({ length: 5001 }, (_, index) => caseRow(index + 1)), {
    name: 'Too many cases', sourceKey: 'stationCases',
    measures: [{ field: 'recordCount', aggregate: 'sum' }], visualization: { type: 'number' },
  }), { code: 'DATA_NOT_READY' });
});

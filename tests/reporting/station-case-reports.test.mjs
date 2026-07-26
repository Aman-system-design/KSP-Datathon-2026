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

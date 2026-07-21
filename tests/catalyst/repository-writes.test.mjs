import assert from 'node:assert/strict';
import test from 'node:test';

import { CatalystIntelligenceRepository } from '../../src/backend/repository/catalyst/catalyst-repository.mjs';
import { buildDemoState } from '../../src/backend/repository/build-demo-state.mjs';
import { assertRepository } from '../../src/backend/repository/contract.mjs';
import { createCommandService } from '../../src/backend/workflow/command-service.mjs';

function fakeApplication({ failOnceOnTable, failAfterDurableInsertTable } = {}) {
  const tables = new Map(Object.entries({
    WF_Alert: [{ ROWID: '1001', AlertID: 'ALT-1', FindingType: 'PATTERN', FindingBusinessID: 'PAT-1', ScopeUnitID: 101, Status: 'GENERATED', AlertVersion: 0, LastCommandRef: null, Severity: 0.9, OriginalFindingJSON: '{}', MethodVersion: '1.0.0', CreatedAt: '2026-07-20T00:00:00Z', SyntheticData: true }],
    WF_Command: [], WF_Assignment: [], WF_AnalystConclusion: [], WF_Outcome: [], WF_AuditEvent: [],
    OPS_IntelligenceRunRequest: [],
  }));
  const queries = [];
  let failureInjected = false;
  let rowId = 2000;
  const table = name => ({
    async getPagedRows({ nextToken, maxRows }) {
      const rows = tables.get(name) ?? [];
      const offset = nextToken ? Number(nextToken) : 0;
      const data = rows.slice(offset, offset + maxRows);
      const next = offset + data.length;
      return { data: structuredClone(data), more_records: next < rows.length, next_token: next < rows.length ? String(next) : undefined };
    },
    async insertRow(input) {
      const rows = tables.get(name) ?? [];
      const uniqueColumns = {
        WF_Command: ['CommandID', 'IdempotencyKeyHash'], WF_Assignment: ['AssignmentID', 'CommandRef'],
        WF_AnalystConclusion: ['ConclusionID', 'CommandRef'], WF_Outcome: ['OutcomeID', 'CommandRef'],
        WF_AuditEvent: ['AuditEventID', 'EventHash', 'CommandRef'], INT_AnalysisRun: ['AnalysisRunID'],
        TRN_CaseFeature: ['CaseFeatureID'], TRN_LocationFeature: ['LocationFeatureID'],
        TRN_DistrictContext: ['DistrictContextID'], INT_Pattern: ['PatternID'], INT_FindingEvidence: ['FindingEvidenceID'],
        INT_Hotspot: ['HotspotID'], INT_Anomaly: ['AnomalyID'], INT_AreaRisk: ['AreaRiskID'],
        INT_NetworkNode: ['NetworkNodeID'], INT_NetworkEdge: ['NetworkEdgeID'],
        INT_RepeatOffenderSignal: ['RepeatSignalID'], WF_Alert: ['AlertID'],
        OPS_IntelligenceRunRequest: ['RunRequestID', 'IdempotencyKeyHash'],
      }[name] ?? [];
      if (rows.some(row => uniqueColumns.some(column => row[column] !== undefined && row[column] === input[column]))) {
        const error = new Error('duplicate row'); error.code = 'DUPLICATE_VALUE'; throw error;
      }
      const stored = { ...structuredClone(input), ROWID: String(++rowId) };
      rows.push(stored); tables.set(name, rows);
      if (name === failAfterDurableInsertTable && !failureInjected) {
        failureInjected = true; const error = new Error('injected after durable insert'); error.code = 'INJECTED_FAILURE'; throw error;
      }
      return structuredClone(stored);
    },
    async insertRows(inputs) {
      const stored = [];
      for (const input of inputs) stored.push(await this.insertRow(input));
      if (name === failOnceOnTable && !failureInjected) {
        failureInjected = true; const error = new Error('injected after durable insert'); error.code = 'INJECTED_FAILURE'; throw error;
      }
      return stored;
    },
    async updateRow(input) {
      const rows = tables.get(name) ?? [];
      const index = rows.findIndex(row => String(row.ROWID) === String(input.ROWID));
      if (index < 0) throw new Error('missing update row');
      rows[index] = structuredClone(input); return structuredClone(input);
    },
  });
  const zcql = () => ({ async executeZCQLQuery(query) {
    queries.push(query);
    const match = query.match(/Status = '([^']+)', AlertVersion = (\d+), LastCommandRef = (\d+) WHERE ROWID = (\d+) AND Status = '([^']+)' AND AlertVersion = (\d+)/u);
    if (!match) throw new Error('unexpected ZCQL');
    const [, target, targetVersion, commandRef, alertRef, expected, expectedVersion] = match;
    const alert = tables.get('WF_Alert').find(row => row.ROWID === alertRef);
    if (alert && alert.Status === expected && alert.AlertVersion === Number(expectedVersion)) {
      Object.assign(alert, { Status: target, AlertVersion: Number(targetVersion), LastCommandRef: commandRef });
      return [{ affected_rows: 1 }];
    }
    return [{ affected_rows: 0 }];
  } });
  return { application: { datastore: () => ({ table }), zcql }, tables, queries };
}

const access = Object.freeze({
  actualUserId: 'CAT-1', employeeId: 9001, role: 'DISTRICT_LEADERSHIP', scopeUnitId: 101,
  authorizedUnitIds: new Set([101]), actions: ['ASSIGN_ALERT'], syntheticData: true,
});

test('Catalyst run requests persist idempotency and controlled status transitions', async () => {
  const fake = fakeApplication();
  const repository = new CatalystIntelligenceRepository({ application: fake.application });
  const request = {
    RunRequestID: 'RUNREQ-1', IdempotencyKeyHash: 'a'.repeat(64), RequestHash: 'b'.repeat(64),
    BatchKey: 'SOURCE-BATCH-1', Operation: 'REFRESH_INTELLIGENCE', RequestedBy: 'CAT-1',
    Status: 'QUEUED', CatalystJobID: null, Attempt: 1, RequestedAt: '2026-07-22T01:00:00Z',
    StartedAt: null, CompletedAt: null, UpdatedAt: '2026-07-22T01:00:00Z', FailedPhase: null,
    FailureCode: null, CurrentRunGroupID: null, SyntheticData: true,
  };

  await repository.createRunRequest(request);
  assert.equal((await repository.getRunRequestByIdempotencyHash('a'.repeat(64))).RunRequestID, 'RUNREQ-1');
  const submitted = await repository.updateRunRequest('RUNREQ-1', {
    Status: 'SUBMITTED', CatalystJobID: 'JOB-1', UpdatedAt: '2026-07-22T01:01:00Z',
  });
  assert.equal(submitted.Status, 'SUBMITTED');
  assert.equal((await repository.listRunRequests()).length, 1);
  await assert.rejects(repository.updateRunRequest('RUNREQ-1', { Status: 'PUBLISHED' }), { code: 'INVALID_STATE' });
  assert.equal(fake.tables.get('OPS_IntelligenceRunRequest')[0].RequestedAt, '2026-07-22 01:00:00');
});

test('Catalyst workflow persists one command/artifact/audit and verifies compare-and-swap', async () => {
  const fake = fakeApplication();
  const repository = new CatalystIntelligenceRepository({ application: fake.application });
  assert.equal(assertRepository(repository), repository);
  let id = 0;
  const service = createCommandService({
    repository, clock: () => '2026-07-20T12:00:00.000Z', idFactory: prefix => `${prefix}-${++id}`,
    auditKeys: { v1: 'test-only-audit-key' }, activeAuditKeyVersion: 'v1',
  });
  const input = {
    access, route: '/v1/alerts/{alertId}/assign', commandType: 'ASSIGN', alertId: 'ALT-1',
    idempotencyKey: 'one-client-key', expectedState: 'GENERATED', expectedVersion: 0,
    payload: { assignedUnitId: 101, assignedEmployeeId: 9003, reason: 'Synthetic review', authorizedUnitIds: [101], authorizedCaseIds: ['CASE-1'], evidenceAccessLevel: 'ASSIGNED_CASES' },
  };
  const first = await service.execute(input);
  const replay = await service.execute(input);
  assert.deepEqual(replay, first);
  assert.equal(first.alert.status, 'ASSIGNED');
  assert.equal(fake.tables.get('WF_Command').length, 1);
  assert.equal(fake.tables.get('WF_Assignment').length, 1);
  assert.equal(fake.tables.get('WF_AuditEvent').length, 1);
  assert.equal(fake.queries.length, 1);
  assert.match(fake.queries[0], /^UPDATE WF_Alert SET/u);
  assert.equal(fake.queries[0].includes('one-client-key'), false);
  assert.equal((await repository.getAlert('ALT-1')).LastCommandID, first.command.id);
});

test('Catalyst compare-and-swap rejects stale versions without overwriting the winner', async () => {
  const fake = fakeApplication();
  const repository = new CatalystIntelligenceRepository({ application: fake.application });
  await repository.createCommand({ CommandID: 'CMD-A', IdempotencyKeyHash: 'a'.repeat(64), RequestHash: 'b'.repeat(64), AlertID: 'ALT-1', ActorCatalystUserID: 'CAT-1', EffectiveRole: 'DISTRICT_LEADERSHIP', CommandType: 'ASSIGN', ExpectedAlertState: 'GENERATED', ExpectedAlertVersion: 0, TargetAlertState: 'ASSIGNED', Status: 'RECEIVED', ResponseJSON: null, ErrorCode: null, CreatedAt: '2026-07-20T00:00:00Z', CompletedAt: null, SyntheticData: true });
  await repository.createCommand({ CommandID: 'CMD-B', IdempotencyKeyHash: 'c'.repeat(64), RequestHash: 'd'.repeat(64), AlertID: 'ALT-1', ActorCatalystUserID: 'CAT-1', EffectiveRole: 'DISTRICT_LEADERSHIP', CommandType: 'ASSIGN', ExpectedAlertState: 'GENERATED', ExpectedAlertVersion: 0, TargetAlertState: 'ASSIGNED', Status: 'RECEIVED', ResponseJSON: null, ErrorCode: null, CreatedAt: '2026-07-20T00:00:00Z', CompletedAt: null, SyntheticData: true });
  const winner = await repository.compareAndSwapAlert({ alertId: 'ALT-1', expectedState: 'GENERATED', expectedVersion: 0, targetState: 'ASSIGNED', commandId: 'CMD-A' });
  const loser = await repository.compareAndSwapAlert({ alertId: 'ALT-1', expectedState: 'GENERATED', expectedVersion: 0, targetState: 'ASSIGNED', commandId: 'CMD-B' });
  assert.equal(winner.matched, 1);
  assert.deepEqual(loser, { matched: 0 });
  assert.equal((await repository.getAlert('ALT-1')).LastCommandID, 'CMD-A');
});

test('workflow retry reconciles an artifact inserted before an uncertain SDK failure', async () => {
  const fake = fakeApplication({ failAfterDurableInsertTable: 'WF_Assignment' });
  const repository = new CatalystIntelligenceRepository({ application: fake.application });
  let id = 0;
  const service = createCommandService({ repository, clock: () => '2026-07-20T12:00:00Z', idFactory: prefix => `${prefix}-R-${++id}`, auditKeys: { v1: 'test-key' }, activeAuditKeyVersion: 'v1' });
  const input = { access, route: '/v1/alerts/{alertId}/assign', commandType: 'ASSIGN', alertId: 'ALT-1', idempotencyKey: 'retry-key', expectedState: 'GENERATED', expectedVersion: 0, payload: { assignedUnitId: 101, assignedEmployeeId: 9003, reason: 'Retry', authorizedUnitIds: [101], authorizedCaseIds: ['CASE-1'], evidenceAccessLevel: 'ASSIGNED_CASES' } };
  await assert.rejects(service.execute(input), { code: 'CATALYST_UNAVAILABLE' });
  const result = await service.execute(input);
  assert.equal(result.alert.status, 'ASSIGNED');
  assert.equal(fake.tables.get('WF_Assignment').length, 1);
});

test('refresh run publication is durable, seven-type coherent and retryable by batch key', async () => {
  const fake = fakeApplication();
  const repository = new CatalystIntelligenceRepository({ application: fake.application });
  const types = ['FEATURE_BUILD', 'HOTSPOT', 'ANOMALY', 'PATTERN', 'AREA_RISK', 'NETWORK', 'IDENTITY_RESOLUTION'];
  const runs = types.map((AnalysisType, index) => ({
    AnalysisRunID: `RUN-${index}`, RunGroupID: 'GROUP-1', AnalysisType,
    RunTypeKey: `GROUP-1:${AnalysisType}`, Status: 'COMPLETED', PublishStatus: 'STAGED',
    InputManifestHash: 'a'.repeat(64), ObservationStart: '2026-06-01T00:00:00Z',
    ObservationEnd: '2026-07-01T00:00:00Z', EngineVersion: '1.0.0', MethodVersion: '1.0.0',
    CompletedAt: '2026-07-20T12:00:00Z', PublishedAt: null, SyntheticData: true,
  }));
  const batch = {
    BatchKey: 'KSP-DEMO-20260720-V1', Operation: 'BOOTSTRAP_SYNTHETIC', Status: 'STAGED',
    Reconciliation: { sourceRows: 200, acceptedRows: 200, rejectedRows: 0, balanced: true },
    Findings: {}, PublishedFindings: (() => {
      const state = buildDemoState();
      return { features: state.features, patterns: state.patterns, hotspots: state.hotspots, anomalies: state.anomalies, areaRisks: state.areaRisks, networks: state.networks, districtContexts: state.districtContexts, alerts: state.alerts };
    })(), RunGroup: { RunGroupID: 'GROUP-1', PublishedAt: null, runs },
    CreatedAt: '2026-07-20T12:00:00Z', CompletedAt: null, SyntheticData: true,
  };
  await repository.createRefreshBatch(batch);
  const storedRuns = fake.tables.get('INT_AnalysisRun');
  assert.equal(storedRuns.every(run => run.ObservationStart === '2026-06-01 00:00:00'), true);
  assert.equal(storedRuns.every(run => run.ObservationEnd === '2026-07-01 00:00:00'), true);
  assert.equal(storedRuns.every(run => run.CompletedAt === '2026-07-20 12:00:00'), true);
  assert.equal(storedRuns.every(run => !Object.hasOwn(run, 'PublishedAt')), true);
  assert.equal((await repository.getRefreshBatch(batch.BatchKey)).Status, 'STAGED');
  for (const table of ['TRN_CaseFeature', 'TRN_LocationFeature', 'TRN_DistrictContext', 'INT_Hotspot', 'INT_Anomaly', 'INT_Pattern', 'INT_AreaRisk', 'INT_NetworkNode', 'INT_NetworkEdge', 'INT_RepeatOffenderSignal', 'INT_FindingEvidence', 'WF_Alert']) {
    assert.ok((fake.tables.get(table) ?? []).length > 0, `${table} was not staged`);
  }
  const completed = await repository.publishRefreshBatch(batch.BatchKey, '2026-07-20T12:05:00Z');
  assert.equal(completed.Status, 'COMPLETED');
  assert.equal(completed.RunGroup.runs.length, 7);
  assert.equal(completed.RunGroup.runs.every(run => run.PublishStatus === 'PUBLISHED'), true);
  assert.equal((await repository.getCurrentRunGroup()).RunGroupID, 'GROUP-1');
  assert.deepEqual(await repository.publishRefreshBatch(batch.BatchKey, '2026-07-20T12:06:00Z'), completed);
});

test('partial refresh staging stays invisible and a retry converges without duplicate features', async () => {
  const fake = fakeApplication({ failOnceOnTable: 'TRN_CaseFeature' });
  const repository = new CatalystIntelligenceRepository({ application: fake.application });
  const types = ['FEATURE_BUILD', 'HOTSPOT', 'ANOMALY', 'PATTERN', 'AREA_RISK', 'NETWORK', 'IDENTITY_RESOLUTION'];
  const runs = types.map((AnalysisType, index) => ({
    AnalysisRunID: `RETRY-RUN-${index}`, RunGroupID: 'RETRY-GROUP', AnalysisType,
    RunTypeKey: `RETRY-GROUP:${AnalysisType}`, Status: 'COMPLETED', PublishStatus: 'STAGED',
    InputManifestHash: 'b'.repeat(64), ObservationStart: '2026-06-01T00:00:00Z', ObservationEnd: '2026-07-01T00:00:00Z',
    EngineVersion: '1.0.0', MethodVersion: '1.0.0', CompletedAt: '2026-07-20T00:00:00Z', PublishedAt: null, SyntheticData: true,
  }));
  const feature = buildDemoState().features[0];
  const batch = { BatchKey: 'RETRY-BATCH-1', Operation: 'BOOTSTRAP_SYNTHETIC', Reconciliation: { sourceRows: 1, acceptedRows: 1, rejectedRows: 0, balanced: true }, PublishedFindings: { features: [feature] }, RunGroup: { RunGroupID: 'RETRY-GROUP', runs }, CreatedAt: '2026-07-20T00:00:00Z', SyntheticData: true };
  await assert.rejects(repository.createRefreshBatch(batch), { code: 'CATALYST_UNAVAILABLE' });
  assert.equal(await repository.getRefreshBatch(batch.BatchKey), undefined);
  await repository.createRefreshBatch(batch);
  assert.equal(fake.tables.get('TRN_CaseFeature').length, 1);
  const completed = await repository.publishRefreshBatch(batch.BatchKey, '2026-07-20T01:00:00Z');
  assert.equal(completed.Status, 'COMPLETED');
});

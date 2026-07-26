import assert from 'node:assert/strict';
import test from 'node:test';

import { runIntelligencePipeline } from '@ksp/intelligence-core';

import { createRefreshService } from '../../src/backend/refresh/refresh-service.mjs';
import { buildDemoState } from '../../src/backend/repository/build-demo-state.mjs';
import { MemoryIntelligenceRepository } from '../../src/backend/repository/memory-repository.mjs';
import { toIntelligenceInput } from '../../src/ingestion/to-intelligence-input.mjs';
import { validateSourceSeed } from '../../src/ingestion/validate-source-seed.mjs';
import { generateSourceSeed } from '../../src/synthetic/source-seed.mjs';

const clock = () => '2026-07-20T14:00:00.000Z';

const rule = ({ id, utilityKey, enabled = true, scopeUnitId = 101, thresholds }) => ({
  RuleID: id, UtilityKey: utilityKey, UtilityVersion: '1.0.0', Enabled: enabled,
  ScopeUnitID: scopeUnitId, ThresholdsJSON: JSON.stringify(thresholds),
  EvaluationWindowDays: 180, Severity: 'HIGH', RecipientRolesJSON: '["DISTRICT_LEADERSHIP"]',
  Version: 1, CreatedByUserID: 'TEST', CreatedAt: clock(), UpdatedAt: clock(), SyntheticData: true,
});

function fixture({
  failureRuleId, omitPublishedFindings = false, failureRead, catalystRunRefs = false, extraRules = [],
  includeDefaultRules = true,
} = {}) {
  const state = buildDemoState();
  const defaultRules = [
    rule({ id: 'RULE-PATTERN', utilityKey: 'patterns', thresholds: { threshold: 0.65 } }),
    rule({ id: 'RULE-HOTSPOT', utilityKey: 'hotspots', thresholds: { minimumCases: 2 } }),
    rule({ id: 'RULE-ANOMALY', utilityKey: 'anomalies', thresholds: { deviation: 1 } }),
    rule({ id: 'RULE-DISABLED', utilityKey: 'patterns', enabled: false, thresholds: { threshold: 0.65 } }),
    rule({ id: 'RULE-AREA', utilityKey: 'area-attention', thresholds: {} }),
  ];
  state.utilityRules = [...(includeDefaultRules ? defaultRules : []), ...extraRules];
  const memory = new MemoryIntelligenceRepository(state);
  const repository = (failureRuleId || omitPublishedFindings || failureRead || catalystRunRefs) ? new Proxy(memory, { get(target, property) {
    if (property === 'createAlertsIfAbsent') return async input => {
      if (input.ruleGuard.ruleId === failureRuleId) {
        const error = new Error('injected rule failure'); error.code = 'CATALYST_UNAVAILABLE'; throw error;
      }
      return target.createAlertsIfAbsent(input);
    };
    if ((omitPublishedFindings || catalystRunRefs) && ['getRefreshBatch', 'publishRefreshBatch'].includes(property)) return async (...args) => {
      const value = await target[property](...args);
      if (!value) return value;
      return {
        ...value,
        ...(omitPublishedFindings ? { PublishedFindings: {} } : {}),
        ...(catalystRunRefs ? { RunGroup: { ...value.RunGroup, runs: value.RunGroup.runs.map((run, index) => {
          const copy = { ...run, ROWID: String(1000 + index) };
          delete copy.AnalysisRunRef;
          return copy;
        }) } } : {}),
      };
    };
    if (property === failureRead) return async () => {
      const error = new Error('injected finding read failure'); error.code = 'CATALYST_UNAVAILABLE'; throw error;
    };
    const value = target[property];
    return typeof value === 'function' ? value.bind(target) : value;
  } }) : memory;
  let id = 0;
  const refresh = createRefreshService({
    repository, sourceGenerator: generateSourceSeed, sourceValidator: validateSourceSeed,
    adapter: toIntelligenceInput, pipeline: runIntelligencePipeline, clock,
    idFactory: prefix => `${prefix}-UTILITY-${++id}`,
  });
  return { memory, refresh };
}

test('successful publication evaluates enabled supported rules against that exact run', async () => {
  const { memory, refresh } = fixture();
  const result = await refresh.execute({ operation: 'BOOTSTRAP_SYNTHETIC', batchKey: 'UTILITY-SUCCESS', seed: 20260720 });
  assert.equal(result.utilityEvaluation.status, 'COMPLETED');
  assert.equal(result.utilityEvaluation.rulesEligible, 3);
  assert.equal(result.utilityEvaluation.rulesExcluded, 2);
  assert.equal(result.utilityEvaluation.rulesFailed, 0);
  const runIds = new Set(result.runGroup.runs.map(row => row.AnalysisRunID));
  const utilityAlerts = (await memory.listAlerts()).filter(row => row.AlertID.startsWith('ALT-UTIL-'));
  assert.equal(utilityAlerts.length, result.utilityEvaluation.created);
  assert.ok(utilityAlerts.length > 0);
  assert.ok(utilityAlerts.every(row => runIds.has(row.AnalysisRunRef)), 'alerts bind only to the newly published run');
});

test('refresh replay is idempotent and reports existing alerts rather than duplicates', async () => {
  const { memory, refresh } = fixture();
  const input = { operation: 'BOOTSTRAP_SYNTHETIC', batchKey: 'UTILITY-REPLAY', seed: 20260720 };
  const first = await refresh.execute(input);
  const count = (await memory.listAlerts()).length;
  const replay = await refresh.execute(input);
  assert.equal((await memory.listAlerts()).length, count);
  assert.equal(replay.utilityEvaluation.created, 0);
  assert.equal(replay.utilityEvaluation.existing, first.utilityEvaluation.created);
});

test('replaying a historical batch after a newer publication never evaluates or mutates alerts', async () => {
  const { memory, refresh } = fixture();
  const inputA = { operation: 'BOOTSTRAP_SYNTHETIC', batchKey: 'UTILITY-HISTORY-A', seed: 20260720 };
  const first = await refresh.execute(inputA);
  await refresh.execute({ operation: 'BOOTSTRAP_SYNTHETIC', batchKey: 'UTILITY-HISTORY-B', seed: 20260721 });
  await memory.createUtilityRule(rule({
    id: 'RULE-LATE', utilityKey: 'patterns', thresholds: { threshold: 0.65 },
  }));
  const before = await memory.listAlerts();
  const replay = await refresh.execute(inputA);
  assert.equal(replay.runGroup.RunGroupID, first.runGroup.RunGroupID);
  assert.equal(replay.utilityEvaluation.status, 'SKIPPED_HISTORICAL_PUBLICATION');
  assert.equal(replay.utilityEvaluation.reason, 'NOT_CURRENT_PUBLICATION');
  assert.deepEqual(await memory.listAlerts(), before);
});

test('current-batch replay excludes rules created or edited after its publication', async () => {
  const { memory, refresh } = fixture();
  const input = { operation: 'BOOTSTRAP_SYNTHETIC', batchKey: 'UTILITY-CURRENT-REPLAY', seed: 20260720 };
  const first = await refresh.execute(input);
  const before = await memory.listAlerts();
  await memory.updateUtilityRule('RULE-PATTERN', 1, {
    ThresholdsJSON: JSON.stringify({ threshold: 0.7 }), UpdatedAt: '2026-07-20T15:00:00.000Z',
  });
  await memory.createUtilityRule({
    ...rule({ id: 'RULE-LATE-CURRENT', utilityKey: 'patterns', thresholds: { threshold: 0.65 } }),
    CreatedAt: '2026-07-20T15:00:00.000Z', UpdatedAt: '2026-07-20T15:00:00.000Z',
  });
  const replay = await refresh.execute(input);
  assert.equal(replay.utilityEvaluation.status, 'COMPLETED');
  assert.equal(replay.utilityEvaluation.created, 0);
  assert.ok(replay.utilityEvaluation.rulesExcluded >= 4);
  assert.ok(replay.utilityEvaluation.existing > 0, 'unchanged rules still replay deterministically');
  assert.deepEqual(await memory.listAlerts(), before);
  assert.equal(first.runGroup.PublishedAt, '2026-07-20T14:00:00.000Z');
});

test('publication advance between pointer check and alert commit leaves no stale-run insertion', async () => {
  const { memory, refresh } = fixture();
  const input = { operation: 'BOOTSTRAP_SYNTHETIC', batchKey: 'UTILITY-RACE-A', seed: 20260720 };
  const first = await refresh.execute(input);
  const originalBatch = await memory.getRefreshBatch('UTILITY-RACE-A');
  const attemptSequence = await memory.reserveRefreshAttempt();
  await memory.createRefreshBatch({
    ...originalBatch, BatchKey: 'UTILITY-RACE-B', RequestHash: 'b'.repeat(64),
    AttemptSequence: attemptSequence, Status: 'STAGED', CompletedAt: null,
    RunGroup: {
      RunGroupID: 'UTILITY-RACE-B-GROUP', PublishedAt: null,
      runs: originalBatch.RunGroup.runs.map(run => ({
        ...run, AnalysisRunID: `UTILITY-RACE-B-${run.AnalysisType}`,
        RunGroupID: 'UTILITY-RACE-B-GROUP', RunTypeKey: `UTILITY-RACE-B-GROUP:${run.AnalysisType}`,
        AttemptSequence: attemptSequence, PublishStatus: 'STAGED', PublishedAt: null,
      })),
    },
  });
  await memory.createUtilityRule({
    ...rule({ id: 'RULE-000-RACE', utilityKey: 'patterns', thresholds: { threshold: 0.65 } }),
    CreatedAt: first.runGroup.PublishedAt, UpdatedAt: first.runGroup.PublishedAt,
  });
  const before = await memory.listAlerts();
  let advance = true;
  const racingRepository = new Proxy(memory, { get(target, property) {
    if (property === 'createAlertsIfAbsent') return async payload => {
      if (advance) { advance = false; await target.publishRefreshBatch('UTILITY-RACE-B', clock()); }
      return target.createAlertsIfAbsent(payload);
    };
    const value = target[property];
    return typeof value === 'function' ? value.bind(target) : value;
  } });
  let id = 500;
  const racingRefresh = createRefreshService({
    repository: racingRepository, sourceGenerator: generateSourceSeed, sourceValidator: validateSourceSeed,
    adapter: toIntelligenceInput, pipeline: runIntelligencePipeline, clock,
    idFactory: prefix => `${prefix}-RACE-${++id}`,
  });
  const replay = await racingRefresh.execute(input);
  assert.equal(replay.utilityEvaluation.status, 'COMPLETED_WITH_ERRORS');
  assert.ok(replay.utilityEvaluation.failures.every(item => item.code === 'VERSION_CONFLICT'));
  assert.equal((await memory.getCurrentRunGroup()).RunGroupID, 'UTILITY-RACE-B-GROUP');
  assert.deepEqual(await memory.listAlerts(), before);
});

test('evaluation loads findings by the exact published run when the persisted batch omits its projection', async () => {
  const { memory, refresh } = fixture({ omitPublishedFindings: true });
  const result = await refresh.execute({ operation: 'BOOTSTRAP_SYNTHETIC', batchKey: 'UTILITY-EXACT-READ', seed: 20260720 });
  assert.equal(result.utilityEvaluation.status, 'COMPLETED');
  assert.ok(result.utilityEvaluation.created > 0);
  const runIds = new Set(result.runGroup.runs.map(row => row.AnalysisRunID));
  const created = (await memory.listAlerts()).filter(row => result.utilityEvaluation.alertIds.includes(row.AlertID));
  assert.ok(created.every(row => runIds.has(row.AnalysisRunRef)));
});

test('Catalyst ROWID is used as the governed analysis run reference for created alerts', async () => {
  const { memory, refresh } = fixture({ catalystRunRefs: true });
  const result = await refresh.execute({ operation: 'BOOTSTRAP_SYNTHETIC', batchKey: 'UTILITY-CATALYST-REF', seed: 20260720 });
  const runRefs = new Set(result.runGroup.runs.map(row => String(row.ROWID)));
  const created = (await memory.listAlerts()).filter(row => result.utilityEvaluation.alertIds.includes(row.AlertID));
  assert.ok(created.length > 0);
  assert.ok(created.every(row => runRefs.has(String(row.AnalysisRunRef))));
});

test('one rule evaluation failure is isolated after publication and reported honestly', async () => {
  const { memory, refresh } = fixture({ failureRuleId: 'RULE-HOTSPOT' });
  const result = await refresh.execute({ operation: 'BOOTSTRAP_SYNTHETIC', batchKey: 'UTILITY-PARTIAL', seed: 20260720 });
  assert.equal(result.status, 'COMPLETED');
  assert.equal((await memory.getCurrentRunGroup()).RunGroupID, result.runGroup.RunGroupID);
  assert.equal(result.utilityEvaluation.status, 'COMPLETED_WITH_ERRORS');
  assert.equal(result.utilityEvaluation.rulesFailed, 1);
  assert.deepEqual(result.utilityEvaluation.failures, [{ ruleId: 'RULE-HOTSPOT', code: 'CATALYST_UNAVAILABLE' }]);
  assert.ok(result.utilityEvaluation.rulesSucceeded >= 2);
});

test('one utility finding read failure does not prevent other utilities from evaluating', async () => {
  const { refresh } = fixture({ omitPublishedFindings: true, failureRead: 'listHotspots' });
  const result = await refresh.execute({ operation: 'BOOTSTRAP_SYNTHETIC', batchKey: 'UTILITY-READ-PARTIAL', seed: 20260720 });
  assert.equal(result.utilityEvaluation.status, 'COMPLETED_WITH_ERRORS');
  assert.equal(result.utilityEvaluation.rulesFailed, 1);
  assert.equal(result.utilityEvaluation.rulesSucceeded, 2);
  assert.ok(result.utilityEvaluation.created > 0);
  assert.deepEqual(result.utilityEvaluation.failures, [{ ruleId: 'RULE-HOTSPOT', code: 'CATALYST_UNAVAILABLE' }]);
});

test('stale utility versions are excluded and malformed persisted rules are stable failures', async () => {
  const stale = { ...rule({ id: 'RULE-STALE', utilityKey: 'patterns', thresholds: { threshold: 0.65 } }), UtilityVersion: '0.9.0' };
  const malformed = [
    { ...rule({ id: 'RULE-BAD-JSON', utilityKey: 'patterns', thresholds: { threshold: 0.65 } }), ThresholdsJSON: '{' },
    { ...rule({ id: 'RULE-BAD-THRESHOLD', utilityKey: 'patterns', thresholds: { threshold: 0.65 } }), ThresholdsJSON: '{}' },
    { ...rule({ id: 'RULE-BAD-RECIPIENT', utilityKey: 'patterns', thresholds: { threshold: 0.65 } }), RecipientRolesJSON: '[]' },
    { ...rule({ id: 'RULE-BAD-WINDOW', utilityKey: 'patterns', thresholds: { threshold: 0.65 } }), EvaluationWindowDays: 181 },
    { ...rule({ id: 'RULE-BAD-SEVERITY', utilityKey: 'patterns', thresholds: { threshold: 0.65 } }), Severity: 'URGENT' },
  ];
  const { refresh } = fixture({ extraRules: [stale, ...malformed] });
  const result = await refresh.execute({ operation: 'BOOTSTRAP_SYNTHETIC', batchKey: 'UTILITY-RULE-QUALITY', seed: 20260720 });
  assert.equal(result.utilityEvaluation.rulesDiscovered, 11);
  assert.equal(result.utilityEvaluation.rulesExcluded, 3);
  assert.equal(result.utilityEvaluation.rulesEligible, 8);
  assert.equal(result.utilityEvaluation.rulesSucceeded, 3);
  assert.equal(result.utilityEvaluation.rulesFailed, 5);
  assert.deepEqual(result.utilityEvaluation.failures.map(item => item.code), Array(5).fill('INVALID_PERSISTED_RULE'));
});

test('malformed persisted rules fail before finding reads and create no utility alert', async () => {
  const malformed = {
    ...rule({ id: 'RULE-ONLY-MALFORMED', utilityKey: 'patterns', thresholds: { threshold: 0.65 } }),
    RecipientRolesJSON: '["UNKNOWN_ROLE"]',
  };
  const { memory, refresh } = fixture({
    includeDefaultRules: false, extraRules: [malformed], omitPublishedFindings: true,
    failureRead: 'listPatterns',
  });
  const result = await refresh.execute({ operation: 'BOOTSTRAP_SYNTHETIC', batchKey: 'UTILITY-MALFORMED-NO-READ', seed: 20260720 });
  assert.deepEqual(result.utilityEvaluation.failures, [{
    ruleId: 'RULE-ONLY-MALFORMED', code: 'INVALID_PERSISTED_RULE',
  }]);
  assert.equal((await memory.listAlerts()).some(row => row.AlertID.startsWith('ALT-UTIL-')), false);
});

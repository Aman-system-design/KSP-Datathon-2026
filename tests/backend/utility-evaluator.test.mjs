import assert from 'node:assert/strict';
import test from 'node:test';

import { buildDemoState } from '../../src/backend/repository/build-demo-state.mjs';
import { MemoryIntelligenceRepository } from '../../src/backend/repository/memory-repository.mjs';
import { evaluateUtilityFinding } from '../../src/backend/utilities/utility-evaluator.mjs';

const state = buildDemoState();
const run = type => state.runGroups[0].runs.find(item => item.AnalysisType === type);
const rule = (utilityKey, thresholds, overrides = {}) => ({
  RuleID: `RULE-${utilityKey}`,
  UtilityKey: utilityKey,
  UtilityVersion: '1.0.0',
  Enabled: true,
  ScopeUnitID: 101,
  ThresholdsJSON: JSON.stringify(thresholds),
  EvaluationWindowDays: 30,
  Severity: 'HIGH',
  RecipientRolesJSON: JSON.stringify(['DISTRICT_LEADERSHIP', 'CRIME_ANALYST']),
  Version: 3,
  SyntheticData: true,
  ...overrides,
});

test('pattern candidate is deterministic, scoped and retains governed provenance', () => {
  const finding = state.patterns[0];
  const input = {
    rule: rule('patterns', { threshold: 0.9 }), finding,
    analysisRun: run('PATTERN'), now: '2026-07-26T10:00:00.000Z',
  };
  const first = evaluateUtilityFinding(input);
  const second = evaluateUtilityFinding({ ...input, now: '2026-07-26T11:00:00.000Z' });

  assert.equal(first.matched, true);
  assert.equal(first.alert.AlertID, second.alert.AlertID);
  assert.equal(first.alert.FindingType, 'PATTERN');
  assert.equal(first.alert.FindingBusinessID, finding.id);
  assert.equal(first.alert.ScopeUnitID, 101);
  const envelope = JSON.parse(first.alert.OriginalFindingJSON);
  assert.equal(envelope.rule.id, 'RULE-patterns');
  assert.equal(envelope.rule.version, 3);
  assert.equal(envelope.analysisRun.id, run('PATTERN').AnalysisRunID);
  assert.equal(envelope.provenance.syntheticData, true);
  assert.equal(envelope.provenance.claim, 'DEMONSTRATION_DATA');
  assert.ok(envelope.evidence.length > 0);
  assert.ok(envelope.evidence.every(item => item.unitId === 101));
  assert.ok(envelope.evidence.every(item => Object.keys(item).sort().join(',') === 'caseId,unitId'));
  assert.deepEqual(envelope.unitSummaries.map(item => item.unitId), [101]);
  assert.ok(envelope.limitations.includes('SIMILARITY_IS_NOT_PROOF'));
});

test('hotspot and anomaly thresholds produce positive and negative controls', () => {
  const hotspot = state.hotspots[0];
  assert.equal(evaluateUtilityFinding({
    rule: rule('hotspots', { minimumCases: hotspot.magnitude }), finding: hotspot,
    analysisRun: run('HOTSPOT'), now: '2026-07-26T10:00:00.000Z',
  }).matched, true);
  assert.deepEqual(evaluateUtilityFinding({
    rule: rule('hotspots', { minimumCases: hotspot.magnitude + 1 }), finding: hotspot,
    analysisRun: run('HOTSPOT'), now: '2026-07-26T10:00:00.000Z',
  }), { matched: false, reason: 'THRESHOLD_NOT_MET' });

  const anomaly = state.anomalies.find(item => item.isAnomaly);
  assert.equal(evaluateUtilityFinding({
    rule: rule('anomalies', { deviation: Math.abs(anomaly.deviation) }), finding: anomaly,
    analysisRun: run('ANOMALY'), now: '2026-07-26T10:00:00.000Z',
  }).matched, true);
  assert.deepEqual(evaluateUtilityFinding({
    rule: rule('anomalies', { deviation: Math.abs(anomaly.deviation) + 1 }), finding: anomaly,
    analysisRun: run('ANOMALY'), now: '2026-07-26T10:00:00.000Z',
  }), { matched: false, reason: 'THRESHOLD_NOT_MET' });
});

test('hotspot threshold counts only authorized scoped evidence and evaluation window rejects stale runs', () => {
  const hotspot = {
    ...state.hotspots[0], magnitude: 6,
    evidenceCaseIds: ['A', 'B', 'C', 'D', 'E', 'F'],
    evidenceUnits: { A: 101, B: 101, C: 102, D: 102, E: 102, F: 102 },
  };
  assert.deepEqual(evaluateUtilityFinding({
    rule: rule('hotspots', { minimumCases: 3 }), finding: hotspot,
    analysisRun: run('HOTSPOT'), now: '2026-07-26T10:00:00.000Z',
  }), { matched: false, reason: 'THRESHOLD_NOT_MET' });
  assert.deepEqual(evaluateUtilityFinding({
    rule: rule('patterns', { threshold: 0.9 }, { EvaluationWindowDays: 10 }),
    finding: state.patterns[0], analysisRun: run('PATTERN'), now: '2026-07-26T10:00:00.000Z',
  }), { matched: false, reason: 'EVALUATION_WINDOW_EXPIRED' });
});

test('disabled, stale, unsupported and out-of-scope evaluations create no candidate', () => {
  const finding = state.patterns[0];
  assert.deepEqual(evaluateUtilityFinding({
    rule: rule('patterns', { threshold: 0.9 }, { Enabled: false }), finding,
    analysisRun: run('PATTERN'), now: '2026-07-26T10:00:00.000Z',
  }), { matched: false, reason: 'RULE_DISABLED' });
  assert.deepEqual(evaluateUtilityFinding({
    rule: rule('patterns', { threshold: 0.9 }, { UtilityVersion: '0.9.0' }), finding,
    analysisRun: run('PATTERN'), now: '2026-07-26T10:00:00.000Z',
  }), { matched: false, reason: 'STALE_UTILITY_VERSION' });
  assert.deepEqual(evaluateUtilityFinding({
    rule: rule('area-attention', {}), finding,
    analysisRun: run('AREA_RISK'), now: '2026-07-26T10:00:00.000Z',
  }), { matched: false, reason: 'UNSUPPORTED_UTILITY' });
  assert.deepEqual(evaluateUtilityFinding({
    rule: rule('patterns', { threshold: 0.9 }, { ScopeUnitID: 999 }), finding,
    analysisRun: run('PATTERN'), now: '2026-07-26T10:00:00.000Z',
  }), { matched: false, reason: 'OUT_OF_SCOPE' });
});

test('repository creates a deterministic alert once and returns the existing row on replay', async () => {
  const repository = new MemoryIntelligenceRepository(state);
  const evaluated = evaluateUtilityFinding({
    rule: rule('hotspots', { minimumCases: 5 }), finding: state.hotspots[0],
    analysisRun: run('HOTSPOT'), now: '2026-07-26T10:00:00.000Z',
  });
  const first = await repository.createAlertIfAbsent(evaluated.alert);
  const second = await repository.createAlertIfAbsent({
    ...evaluated.alert, CreatedAt: '2026-07-26T11:00:00.000Z',
  });

  assert.equal(first.created, true);
  assert.equal(second.created, false);
  assert.equal(second.alert.CreatedAt, '2026-07-26T10:00:00.000Z');
  assert.equal((await repository.listAlerts()).filter(item => item.AlertID === evaluated.alert.AlertID).length, 1);
});

test('memory pattern and anomaly reads honor the captured run group instead of mutable current arrays', async () => {
  const changed = structuredClone(state);
  const captured = changed.runGroups[0];
  changed.patterns = [{ ...changed.patterns[0], id: 'NEWER-PATTERN' }];
  changed.anomalies = [{ ...changed.anomalies[0], id: 'NEWER-ANOMALY' }];
  const repository = new MemoryIntelligenceRepository(changed);

  assert.equal((await repository.listPatterns({ runGroup: captured })).data[0].id, state.patterns[0].id);
  assert.equal((await repository.listAnomalies({ runGroup: captured })).data[0].id, state.anomalies[0].id);
});

test('memory alert batch is atomic and guarded by the exact persisted rule snapshot', async () => {
  const guardedState = structuredClone(state);
  const storedRule = rule('hotspots', { minimumCases: 2 });
  guardedState.utilityRules = [storedRule];
  const candidate = evaluateUtilityFinding({
    rule: storedRule, finding: state.hotspots[0], analysisRun: run('HOTSPOT'),
    now: '2026-07-26T10:00:00.000Z',
  }).alert;
  const alerts = [candidate, { ...candidate, AlertID: `${candidate.AlertID.slice(0, -1)}x`, FindingBusinessID: 'HOT-SECOND' }];
  const repository = new MemoryIntelligenceRepository(guardedState, {
    failureInjector(phase) { if (phase === 'beforeAlertBatchCommit') throw new Error('batch failed'); },
  });
  await assert.rejects(repository.createAlertsIfAbsent({
    alerts, ruleGuard: { ruleId: storedRule.RuleID, expectedVersion: 3, scopeUnitId: 101, utilityVersion: '1.0.0' },
  }), /batch failed/u);
  assert.equal((await repository.listAlerts()).some(item => alerts.some(alert => alert.AlertID === item.AlertID)), false);

  const changedState = structuredClone(guardedState);
  changedState.utilityRules[0].Enabled = false;
  const changed = new MemoryIntelligenceRepository(changedState);
  await assert.rejects(changed.createAlertsIfAbsent({
    alerts: [candidate],
    ruleGuard: { ruleId: storedRule.RuleID, expectedVersion: 3, scopeUnitId: 101, utilityVersion: '1.0.0' },
  }), { code: 'VERSION_CONFLICT' });
});

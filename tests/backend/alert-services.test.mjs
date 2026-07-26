import assert from 'node:assert/strict';
import test from 'node:test';

import { buildDemoState } from '../../src/backend/repository/build-demo-state.mjs';
import { MemoryIntelligenceRepository } from '../../src/backend/repository/memory-repository.mjs';
import { createAlertServices } from '../../src/backend/services/alert-services.mjs';
import { evaluateUtilityFinding } from '../../src/backend/utilities/utility-evaluator.mjs';

const access = (units) => ({
  actualUserId: 'USER-1', role: 'DISTRICT_LEADERSHIP', actions: ['READ_ALERT'],
  authorizedUnitIds: new Set(units), scopeUnitId: units[0], syntheticData: true,
});

test('alert discovery is scoped and exposes explainable immutable finding evidence', async () => {
  const repository = new MemoryIntelligenceRepository(buildDemoState());
  const alerts = createAlertServices({ repository });
  const list = await alerts.listAlerts({ access: access([101]), query: { status: 'GENERATED' } });
  assert.equal(list.data.items.length, 1);

  const detail = await alerts.getAlertDetail({ access: access([101]), params: { alertId: 'ALT-PATTERN-1' } });
  assert.equal(detail.data.syntheticData, true);
  assert.equal(detail.data.explanation.methodVersion, '1.0.0');
  assert.ok(detail.data.evidence.length > 0);
  assert.ok(detail.data.evidence.every(({ unitId }) => unitId === 101));
  assert.ok(detail.data.observation.every(({ unitId }) => unitId === 101));
  assert.equal(detail.data.originalFinding.status, 'IMMUTABLE');
  assert.deepEqual(detail.data.limitations, ['SYNTHETIC_DATA', 'SIMILARITY_IS_NOT_PROOF']);
});

test('alert discovery rejects missing permission, invalid filters and hidden geography', async () => {
  const repository = new MemoryIntelligenceRepository(buildDemoState());
  const alerts = createAlertServices({ repository });
  await assert.rejects(alerts.listAlerts({ access: { ...access([101]), actions: [] }, query: {} }), { code: 'FORBIDDEN_ACTION' });
  await assert.rejects(alerts.listAlerts({ access: access([101]), query: { status: 'DROP TABLE' } }), { code: 'INVALID_REQUEST' });
  await assert.rejects(alerts.getAlertDetail({ access: access([999]), params: { alertId: 'ALT-PATTERN-1' } }), { code: 'NOT_FOUND' });
});

test('utility alert detail exposes deterministic rule, run and demonstration provenance', async () => {
  const state = buildDemoState();
  const repository = new MemoryIntelligenceRepository(state);
  const analysisRun = state.runGroups[0].runs.find(row => row.AnalysisType === 'HOTSPOT');
  const utilityRule = {
    RuleID: 'RULE-HOT-1', UtilityKey: 'hotspots', UtilityVersion: '1.0.0', Enabled: true,
    ScopeUnitID: 101, ThresholdsJSON: '{"minimumCases":5}', EvaluationWindowDays: 30,
    Severity: 'HIGH', RecipientRolesJSON: '["CRIME_ANALYST"]', Version: 1,
  };
  await repository.createUtilityRule(utilityRule);
  const evaluated = evaluateUtilityFinding({
    rule: utilityRule,
    finding: state.hotspots[0], analysisRun, now: '2026-07-26T10:00:00.000Z',
  });
  await repository.createAlertIfAbsent(evaluated.alert);

  const detail = await createAlertServices({ repository }).getAlertDetail({
    access: access([101]), params: { alertId: evaluated.alert.AlertID },
  });
  assert.deepEqual(detail.data.evaluation, {
    utilityKey: 'hotspots', ruleId: 'RULE-HOT-1', ruleVersion: 1,
    analysisRunId: analysisRun.AnalysisRunID, runGroupId: analysisRun.RunGroupID,
  });
  assert.deepEqual(detail.data.provenance, { syntheticData: true, claim: 'DEMONSTRATION_DATA' });
  assert.equal(detail.data.evidence.every(item => Object.keys(item).sort().join(',') === 'caseId,unitId'), true);
  assert.equal(detail.data.observation.every(item => item.unitId === 101), true);

  await repository.updateUtilityRule('RULE-HOT-1', 1, {
    Enabled: false, UpdatedAt: '2026-07-26T11:00:00.000Z',
  });
  const afterRuleChange = await createAlertServices({ repository }).listAlerts({
    access: access([101]), query: {},
  });
  assert.equal(afterRuleChange.data.items.some(item => item.id === evaluated.alert.AlertID), false);
  await assert.rejects(createAlertServices({ repository }).getAlertDetail({
    access: access([101]), params: { alertId: evaluated.alert.AlertID },
  }), { code: 'NOT_FOUND' });
});

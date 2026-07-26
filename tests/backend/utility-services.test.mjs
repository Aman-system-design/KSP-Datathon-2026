import assert from 'node:assert/strict';
import test from 'node:test';

import { buildDemoState } from '../../src/backend/repository/build-demo-state.mjs';
import { MemoryIntelligenceRepository } from '../../src/backend/repository/memory-repository.mjs';
import { createUtilityServices } from '../../src/backend/utilities/utility-services.mjs';

const services = createUtilityServices();

const catalogueAccess = Object.freeze({ actions: Object.freeze(['READ_UTILITY']) });

const access = Object.freeze({
  actualUserId: 'CAT-ANALYST', actions: Object.freeze(['READ_UTILITY', 'MANAGE_UTILITY_RULE']),
  authorizedUnitIds: new Set([101, 1001]),
});
const input = Object.freeze({
  utilityKey: 'patterns', enabled: true, scopeUnitId: 101,
  thresholds: Object.freeze({ threshold: 0.8 }),
  evaluationWindowDays: 30, severity: 'HIGH',
  recipientRoles: Object.freeze(['CRIME_ANALYST', 'DISTRICT_LEADERSHIP']),
});

function ruleHarness(rows = []) {
  const state = structuredClone(rows);
  const repository = {
    async listUtilityRules({ utilityKey } = {}) {
      return structuredClone(state.filter(row => utilityKey === undefined || row.UtilityKey === utilityKey));
    },
    async getUtilityRule(ruleId) { return structuredClone(state.find(row => row.RuleID === ruleId)); },
    async createUtilityRule(row) {
      if (state.some(item => item.RuleID === row.RuleID || item.IdempotencyKeyHash === row.IdempotencyKeyHash)) {
        const error = new Error('duplicate'); error.code = 'UNIQUE_CONFLICT'; throw error;
      }
      state.push(structuredClone(row)); return structuredClone(row);
    },
    async updateUtilityRule(ruleId, expectedVersion, changes) {
      const row = state.find(item => item.RuleID === ruleId);
      if (!row) return undefined;
      if (row.Version !== expectedVersion) return { conflict: true };
      Object.assign(row, structuredClone(changes), { Version: row.Version + 1 });
      return structuredClone(row);
    },
  };
  let sequence = 0;
  return {
    state,
    services: createUtilityServices({
      repository, idFactory: prefix => `${prefix}-${++sequence}`, now: () => '2026-07-26T10:00:00.000Z',
    }),
  };
}

test('catalogue lists all four utility definitions and supports category filtering', async () => {
  const all = await services.listUtilities({ access: catalogueAccess, query: {} });
  assert.deepEqual(all.data.map(({ key }) => key), [
    'patterns', 'hotspots', 'anomalies', 'area-attention',
  ]);

  const filtered = await services.listUtilities({ access: catalogueAccess, query: { category: 'spatial-intelligence' } });
  assert.deepEqual(filtered.data.map(({ key }) => key), ['hotspots']);
});

test('catalogue lists unique utility categories in registry order', async () => {
  const result = await services.listUtilityCategories({ access: catalogueAccess });
  const repeated = await services.listUtilityCategories({ access: catalogueAccess });

  assert.deepEqual(result.data, [
    'patterns-networks',
    'spatial-intelligence',
    'trends-anomalies',
    'risk-prioritization',
  ]);
  assert.equal(new Set(result.data).size, result.data.length);
  assert.equal(Object.isFrozen(result.data), true);
  assert.equal(repeated.data, result.data);
});

test('catalogue returns one definition and keeps area-attention alerts disabled', async () => {
  const result = await services.getUtility({ access: catalogueAccess, params: { utilityKey: 'area-attention' } });

  assert.equal(result.data.key, 'area-attention');
  assert.deepEqual(result.data.alertPolicy, { enabled: false, fields: {} });
});

test('catalogue rejects an unknown utility with the stable NOT_FOUND service error', async () => {
  await assert.rejects(
    services.getUtility({ access: catalogueAccess, params: { utilityKey: 'unknown' } }),
    error => error?.code === 'NOT_FOUND' && error?.status === 404,
  );
});

test('catalogue requires READ_UTILITY for every read method', async () => {
  for (const request of [
    () => services.listUtilities({ access: { actions: [] }, query: {} }),
    () => services.listUtilityCategories({ access: { actions: [] } }),
    () => services.getUtility({ access: { actions: [] }, params: { utilityKey: 'patterns' } }),
  ]) await assert.rejects(request(), { code: 'FORBIDDEN_ACTION' });
});

test('catalogue accepts only the optional exact category query', async () => {
  await assert.rejects(
    services.listUtilities({ access: catalogueAccess, query: { category: 'unknown' } }),
    { code: 'INVALID_REQUEST' },
  );
  await assert.rejects(
    services.listUtilities({ access: catalogueAccess, query: { category: 'spatial-intelligence', extra: 'x' } }),
    { code: 'INVALID_REQUEST' },
  );
  await assert.rejects(
    services.listUtilityCategories({ access: catalogueAccess, query: { category: 'spatial-intelligence' } }),
    { code: 'INVALID_REQUEST' },
  );
  await assert.rejects(
    services.getUtility({ access: catalogueAccess, params: { utilityKey: 'patterns' }, query: { extra: 'x' } }),
    { code: 'INVALID_REQUEST' },
  );
});

test('rule creation requires management permission and persists server-owned metadata', async () => {
  const { services: ruleServices, state } = ruleHarness();
  const result = await ruleServices.createUtilityAlertRule({ access, headers: { 'Idempotency-Key': 'create-one' }, body: input });

  assert.deepEqual(result.data, {
    id: result.data.id, ...structuredClone(input),
    recipientRoles: ['DISTRICT_LEADERSHIP', 'CRIME_ANALYST'], utilityVersion: '1.0.0', version: 1,
    createdBy: 'CAT-ANALYST', createdAt: '2026-07-26T10:00:00.000Z',
    updatedAt: '2026-07-26T10:00:00.000Z', syntheticData: true,
  });
  assert.deepEqual(state[0], {
    RuleID: result.data.id, UtilityKey: 'patterns', UtilityVersion: '1.0.0', Enabled: true,
    ScopeUnitID: 101, ThresholdsJSON: '{"threshold":0.8}',
    EvaluationWindowDays: 30, Severity: 'HIGH',
    RecipientRolesJSON: '["DISTRICT_LEADERSHIP","CRIME_ANALYST"]', Version: 1,
    CreatedByUserID: 'CAT-ANALYST', CreatedAt: '2026-07-26T10:00:00.000Z',
    UpdatedAt: '2026-07-26T10:00:00.000Z', SyntheticData: true,
    IdempotencyKeyHash: state[0].IdempotencyKeyHash, RequestHash: state[0].RequestHash,
  });
  assert.match(result.data.id, /^URULE-[a-f0-9]{57}$/u);
  assert.match(state[0].IdempotencyKeyHash, /^[a-f0-9]{64}$/u);
  assert.match(state[0].RequestHash, /^[a-f0-9]{64}$/u);
  await assert.rejects(
    ruleServices.createUtilityAlertRule({ access: { ...access, actions: ['READ_UTILITY'] }, headers: { 'Idempotency-Key': 'x' }, body: input }),
    { code: 'FORBIDDEN_ACTION' },
  );
  await assert.rejects(
    ruleServices.createUtilityAlertRule({ access, headers: { 'Idempotency-Key': 'x' }, body: { ...input, scopeUnitId: 999 } }),
    { code: 'FORBIDDEN_SCOPE' },
  );
  await assert.rejects(
    ruleServices.createUtilityAlertRule({ access, headers: { 'Idempotency-Key': 'x' }, body: { ...input, scopeUnitId: '101' } }),
    { code: 'INVALID_REQUEST' },
  );
});

test('rule creation persists and returns command center recipients in canonical order', async () => {
  const { services: ruleServices, state } = ruleHarness();
  const result = await ruleServices.createUtilityAlertRule({
    access,
    headers: { 'Idempotency-Key': 'create-command-center' },
    body: { ...input, recipientRoles: ['CRIME_ANALYST', 'COMMAND_CENTER'] },
  });

  assert.equal(state[0].RecipientRolesJSON, '["COMMAND_CENTER","CRIME_ANALYST"]');
  assert.deepEqual(result.data.recipientRoles, ['COMMAND_CENTER', 'CRIME_ANALYST']);
});

test('rule creation requires an idempotency key and reconciles only the same normalized request', async () => {
  const { services: ruleServices, state } = ruleHarness();
  await assert.rejects(ruleServices.createUtilityAlertRule({ access, headers: {}, body: input }), { code: 'INVALID_REQUEST' });
  const first = await ruleServices.createUtilityAlertRule({ access, headers: { 'idempotency-key': 'retry-key' }, body: input });
  const replay = await ruleServices.createUtilityAlertRule({
    access, headers: { 'Idempotency-Key': 'retry-key' }, body: { ...input, recipientRoles: ['DISTRICT_LEADERSHIP', 'CRIME_ANALYST'] },
  });
  assert.equal(replay.data.id, first.data.id);
  assert.equal(state.length, 1);
  await assert.rejects(ruleServices.createUtilityAlertRule({
    access, headers: { 'Idempotency-Key': 'retry-key' }, body: { ...input, severity: 'CRITICAL' },
  }), { code: 'IDEMPOTENCY_CONFLICT' });
  await assert.rejects(ruleServices.createUtilityAlertRule({
    access, headers: { 'Idempotency-Key': 'other-key' }, query: { extra: 'x' }, body: input,
  }), { code: 'INVALID_REQUEST' });
});

test('rule listing returns shared authorized rules only and validates the exact utility key', async () => {
  const base = {
    RuleID: 'URULE-A', UtilityKey: 'patterns', UtilityVersion: '1.0.0', Enabled: true,
    ScopeUnitID: 101, ThresholdsJSON: '{"threshold":0.8}',
    EvaluationWindowDays: 30, Severity: 'HIGH', RecipientRolesJSON: '["CRIME_ANALYST"]',
    Version: 1, CreatedByUserID: 'SOMEONE-ELSE', CreatedAt: '2026-07-26T09:00:00.000Z',
    UpdatedAt: '2026-07-26T09:00:00.000Z', SyntheticData: true,
  };
  const { services: ruleServices } = ruleHarness([
    base, { ...base, RuleID: 'URULE-HIDDEN', ScopeUnitID: 999 },
    { ...base, RuleID: 'URULE-HOTSPOT', UtilityKey: 'hotspots', ThresholdsJSON: '{"minimumCases":4}' },
  ]);

  const result = await ruleServices.listUtilityAlertRules({ access, query: { utilityKey: 'patterns', limit: '1' } });
  assert.deepEqual(result.data.items.map(rule => rule.id), ['URULE-A']);
  assert.equal(result.data.nextToken, undefined);
  await assert.rejects(
    ruleServices.listUtilityAlertRules({ access, query: { utilityKey: 'unknown' } }),
    { code: 'INVALID_REQUEST' },
  );
  await assert.rejects(
    ruleServices.listUtilityAlertRules({ access: { ...access, actions: [] }, query: {} }),
    { code: 'FORBIDDEN_ACTION' },
  );
});

test('rule listing uses a filter-bound RuleID cursor stable across repository row reorder', async () => {
  const row = index => ({
    RuleID: `URULE-${index}`, UtilityKey: 'patterns', UtilityVersion: '1.0.0', Enabled: true,
    ScopeUnitID: 101, ThresholdsJSON: '{"threshold":0.8}', EvaluationWindowDays: 30,
    Severity: 'HIGH', RecipientRolesJSON: '["CRIME_ANALYST"]', Version: 1,
    CreatedByUserID: 'CAT-ANALYST', CreatedAt: '2026-07-26T09:00:00.000Z',
    UpdatedAt: '2026-07-26T09:00:00.000Z', SyntheticData: true,
  });
  const { services: ruleServices, state } = ruleHarness([row(3), row(1), row(2)]);
  const first = await ruleServices.listUtilityAlertRules({ access, query: { limit: '2' } });
  assert.deepEqual(first.data.items.map(rule => rule.id), ['URULE-1', 'URULE-2']);
  assert.match(first.data.nextToken, /^[A-Za-z0-9_-]+$/u);
  state.reverse();
  state.unshift(row(0));
  const second = await ruleServices.listUtilityAlertRules({ access, query: { limit: '2', nextToken: first.data.nextToken } });
  assert.deepEqual(second.data.items.map(rule => rule.id), ['URULE-3']);
  assert.equal(second.data.nextToken, undefined);
  assert.equal(new Set([...first.data.items, ...second.data.items].map(rule => rule.id)).size, 3);

  const filtered = await ruleServices.listUtilityAlertRules({ access, query: { utilityKey: 'patterns', limit: '1' } });
  await assert.rejects(ruleServices.listUtilityAlertRules({
    access, query: { limit: '1', nextToken: filtered.data.nextToken },
  }), { code: 'INVALID_REQUEST' });
  const wrongShape = Buffer.from('{"lastRuleId":"URULE-1","utilityKey":null,"extra":true}', 'utf8').toString('base64url');
  for (const query of [
    { unknown: 'x' }, { limit: '0' }, { limit: '101' }, { limit: '1.5' },
    { nextToken: '*' }, { nextToken: wrongShape },
  ]) await assert.rejects(ruleServices.listUtilityAlertRules({ access, query }), { code: 'INVALID_REQUEST' });
});

test('rule patch authorizes the stored scope, validates merged input and maps optimistic conflicts', async () => {
  const row = {
    RuleID: 'URULE-A', UtilityKey: 'patterns', UtilityVersion: '1.0.0', Enabled: true,
    ScopeUnitID: 101, ThresholdsJSON: '{"threshold":0.8}',
    EvaluationWindowDays: 30, Severity: 'HIGH', RecipientRolesJSON: '["CRIME_ANALYST"]',
    Version: 1, CreatedByUserID: 'SOMEONE-ELSE', CreatedAt: '2026-07-26T09:00:00.000Z',
    UpdatedAt: '2026-07-26T09:00:00.000Z', SyntheticData: true,
  };
  const { services: ruleServices, state } = ruleHarness([row]);
  const updated = await ruleServices.updateUtilityAlertRule({
    access, params: { ruleId: 'URULE-A' },
    body: { expectedVersion: 1, enabled: false, recipientRoles: ['DISTRICT_LEADERSHIP'] },
  });
  assert.equal(updated.data.version, 2);
  assert.equal(updated.data.enabled, false);
  assert.equal(updated.data.createdBy, 'SOMEONE-ELSE');
  assert.equal(state[0].RuleID, 'URULE-A');
  assert.equal(state[0].CreatedByUserID, 'SOMEONE-ELSE');

  await assert.rejects(ruleServices.updateUtilityAlertRule({
    access, params: { ruleId: 'URULE-A' }, body: { expectedVersion: 1, severity: 'LOW' },
  }), { code: 'VERSION_CONFLICT' });
  for (const body of [
    { expectedVersion: 2, utilityKey: 'hotspots' },
    { expectedVersion: 2, createdBy: 'ATTACKER' },
    { expectedVersion: 1.5, enabled: true },
  ]) await assert.rejects(ruleServices.updateUtilityAlertRule({
    access, params: { ruleId: 'URULE-A' }, body,
  }), { code: 'INVALID_REQUEST' });
  await assert.rejects(ruleServices.updateUtilityAlertRule({
    access, params: { ruleId: 'URULE-A' }, query: { extra: 'x' },
    body: { expectedVersion: 2, enabled: true },
  }), { code: 'INVALID_REQUEST' });

  const { services: hiddenServices } = ruleHarness([{ ...row, ScopeUnitID: 999 }]);
  await assert.rejects(hiddenServices.updateUtilityAlertRule({
    access, params: { ruleId: 'URULE-A' }, body: { expectedVersion: 1, enabled: false },
  }), { code: 'FORBIDDEN_SCOPE' });
});

test('rule patch reconciles an identical committed retry and re-authorizes a concurrent scope change', async () => {
  const row = {
    RuleID: 'URULE-A', UtilityKey: 'patterns', UtilityVersion: '1.0.0', Enabled: true,
    ScopeUnitID: 101, ThresholdsJSON: '{"threshold":0.8}', EvaluationWindowDays: 30,
    Severity: 'HIGH', RecipientRolesJSON: '["CRIME_ANALYST"]', Version: 1,
    CreatedByUserID: 'OTHER', CreatedAt: '2026-07-26T09:00:00.000Z',
    UpdatedAt: '2026-07-26T09:00:00.000Z', SyntheticData: true,
  };
  const replayHarness = ruleHarness([{ ...row, Enabled: false, Version: 2 }]);
  const replay = await replayHarness.services.updateUtilityAlertRule({
    access, params: { ruleId: 'URULE-A' }, body: { expectedVersion: 1, enabled: false },
  });
  assert.equal(replay.data.version, 2);

  const scopeHarness = ruleHarness([row]);
  const originalUpdate = scopeHarness.services;
  // Simulate another writer moving the rule after the service's initial authorized read.
  let reads = 0;
  const repository = {
    async getUtilityRule() {
      reads += 1;
      return structuredClone(reads === 1 ? row : { ...row, ScopeUnitID: 999, Version: 2 });
    },
    async updateUtilityRule() { return { conflict: true }; },
  };
  const service = createUtilityServices({ repository, idFactory: () => 'unused', now: () => '2026-07-26T10:00:00.000Z' });
  assert.ok(originalUpdate);
  await assert.rejects(service.updateUtilityAlertRule({
    access, params: { ruleId: 'URULE-A' }, body: { expectedVersion: 1, enabled: false },
  }), { code: 'FORBIDDEN_SCOPE' });
});

test('manual evaluation uses current published findings and replays the deterministic alert', async () => {
  const repository = new MemoryIntelligenceRepository(buildDemoState());
  await repository.createUtilityRule({
    RuleID: 'URULE-EVAL-1', IdempotencyKeyHash: 'a'.repeat(64), RequestHash: 'b'.repeat(64),
    UtilityKey: 'hotspots', UtilityVersion: '1.0.0', Enabled: true, ScopeUnitID: 101,
    ThresholdsJSON: '{"minimumCases":5}', EvaluationWindowDays: 30, Severity: 'HIGH',
    RecipientRolesJSON: '["DISTRICT_LEADERSHIP","CRIME_ANALYST"]', Version: 1,
    CreatedByUserID: 'CAT-ANALYST', CreatedAt: '2026-07-26T09:00:00.000Z',
    UpdatedAt: '2026-07-26T09:00:00.000Z', SyntheticData: true,
  });
  const evaluationAccess = {
    ...access, actions: ['READ_UTILITY', 'RUN_UTILITY_EVALUATION'], authorizedUnitIds: new Set([101]),
  };
  const evaluation = createUtilityServices({
    repository, idFactory: prefix => `${prefix}-1`, now: () => '2026-07-26T10:00:00.000Z',
  });

  const first = await evaluation.evaluateUtilityAlertRule({
    access: evaluationAccess, params: { ruleId: 'URULE-EVAL-1' }, query: {}, body: { expectedVersion: 1 },
  });
  const replay = await evaluation.evaluateUtilityAlertRule({
    access: evaluationAccess, params: { ruleId: 'URULE-EVAL-1' }, query: {}, body: { expectedVersion: 1 },
  });

  assert.equal(first.data.ruleId, 'URULE-EVAL-1');
  assert.equal(first.data.ruleVersion, 1);
  assert.equal(first.data.findingType, 'HOTSPOT');
  assert.equal(first.data.matched, 1);
  assert.equal(first.data.created, 1);
  assert.equal(first.data.existing, 0);
  assert.equal(replay.data.created, 0);
  assert.equal(replay.data.existing, 1);
  assert.deepEqual(replay.data.alertIds, first.data.alertIds);
});

test('manual evaluation aggregates multiple qualifying findings into one atomic rule-run alert', async () => {
  const state = buildDemoState();
  const duplicate = { ...state.hotspots[0], id: `${state.hotspots[0].id}-SECOND` };
  state.hotspots.push(duplicate);
  state.findingsByRunGroup[state.runGroups[0].RunGroupID].hotspots.push(duplicate);
  const repository = new MemoryIntelligenceRepository(state);
  const stored = {
    RuleID: 'URULE-AGG-1', IdempotencyKeyHash: 'e'.repeat(64), RequestHash: 'f'.repeat(64),
    UtilityKey: 'hotspots', UtilityVersion: '1.0.0', Enabled: true, ScopeUnitID: 101,
    ThresholdsJSON: '{"minimumCases":5}', EvaluationWindowDays: 30, Severity: 'HIGH',
    RecipientRolesJSON: '["CRIME_ANALYST"]', Version: 1, CreatedByUserID: 'CAT-ANALYST',
    CreatedAt: '2026-07-26T09:00:00.000Z', UpdatedAt: '2026-07-26T09:00:00.000Z', SyntheticData: true,
  };
  await repository.createUtilityRule(stored);
  const evaluation = createUtilityServices({ repository, now: () => '2026-07-26T10:00:00.000Z' });
  const result = await evaluation.evaluateUtilityAlertRule({
    access: { ...access, actions: ['RUN_UTILITY_EVALUATION'], authorizedUnitIds: new Set([101]) },
    params: { ruleId: stored.RuleID }, body: { expectedVersion: 1 },
  });

  const expectedIds = state.findingsByRunGroup[state.runGroups[0].RunGroupID].hotspots
    .filter(item => Object.values(item.evidenceUnits ?? {}).filter(unitId => unitId === 101).length >= 5)
    .map(item => item.id).sort();
  assert.equal(result.data.matched, expectedIds.length);
  assert.equal(result.data.created, 1);
  assert.equal(result.data.alertIds.length, 1);
  const alert = await repository.getAlert(result.data.alertIds[0]);
  assert.deepEqual(JSON.parse(alert.OriginalFindingJSON).evaluationSummary, {
    matchedFindingCount: expectedIds.length,
    matchedFindingIds: expectedIds,
    aggregation: 'ONE_ALERT_PER_RULE_RUN',
  });
});

test('manual evaluation rejects unauthorized, disabled and stale rule execution', async () => {
  const repository = new MemoryIntelligenceRepository(buildDemoState());
  const base = {
    RuleID: 'URULE-EVAL-2', IdempotencyKeyHash: 'c'.repeat(64), RequestHash: 'd'.repeat(64),
    UtilityKey: 'patterns', UtilityVersion: '1.0.0', Enabled: true, ScopeUnitID: 101,
    ThresholdsJSON: '{"threshold":0.99}', EvaluationWindowDays: 30, Severity: 'HIGH',
    RecipientRolesJSON: '["CRIME_ANALYST"]', Version: 2, CreatedByUserID: 'CAT-ANALYST',
    CreatedAt: '2026-07-26T09:00:00.000Z', UpdatedAt: '2026-07-26T09:00:00.000Z', SyntheticData: true,
  };
  await repository.createUtilityRule(base);
  const evaluation = createUtilityServices({ repository, now: () => '2026-07-26T10:00:00.000Z' });
  const canRun = { ...access, actions: ['RUN_UTILITY_EVALUATION'], authorizedUnitIds: new Set([101]) };

  await assert.rejects(evaluation.evaluateUtilityAlertRule({
    access: { ...canRun, actions: [] }, params: { ruleId: base.RuleID }, body: { expectedVersion: 2 },
  }), { code: 'FORBIDDEN_ACTION' });
  await assert.rejects(evaluation.evaluateUtilityAlertRule({
    access: { ...canRun, authorizedUnitIds: new Set([999]) }, params: { ruleId: base.RuleID }, body: { expectedVersion: 2 },
  }), { code: 'FORBIDDEN_SCOPE' });
  await assert.rejects(evaluation.evaluateUtilityAlertRule({
    access: canRun, params: { ruleId: base.RuleID }, body: { expectedVersion: 1 },
  }), { code: 'VERSION_CONFLICT' });

  await repository.updateUtilityRule(base.RuleID, 2, { Enabled: false, UpdatedAt: '2026-07-26T10:00:00.000Z' });
  await assert.rejects(evaluation.evaluateUtilityAlertRule({
    access: canRun, params: { ruleId: base.RuleID }, body: { expectedVersion: 3 },
  }), { code: 'INVALID_STATE' });
});

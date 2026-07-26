import assert from 'node:assert/strict';
import test from 'node:test';

import {
  normalizeUtilityRuleInput,
  normalizeUtilityRulePatch,
} from '../../src/backend/utilities/rule-contract.mjs';

const authorizedUnitIds = new Set([101, 102]);
const base = {
  utilityKey: 'patterns',
  enabled: true,
  scopeUnitId: 101,
  thresholds: { threshold: 0.8 },
  evaluationWindowDays: 30,
  severity: 'HIGH',
  recipientRoles: ['CRIME_ANALYST', 'DISTRICT_LEADERSHIP'],
};

test('normalizes the exact bounded rule payload and derives registry version', () => {
  assert.deepEqual(normalizeUtilityRuleInput(base, { authorizedUnitIds }), {
    ...base,
    recipientRoles: ['DISTRICT_LEADERSHIP', 'CRIME_ANALYST'],
    utilityVersion: '1.0.0',
  });
});

test('accepts command center recipients and canonicalizes them first', () => {
  assert.deepEqual(normalizeUtilityRuleInput({
    ...base,
    recipientRoles: ['CRIME_ANALYST', 'COMMAND_CENTER'],
  }, { authorizedUnitIds }).recipientRoles, ['COMMAND_CENTER', 'CRIME_ANALYST']);
});

test('uses the utility-specific threshold name and registry bounds', () => {
  assert.equal(normalizeUtilityRuleInput({
    ...base, utilityKey: 'hotspots', thresholds: { minimumCases: 2 }, evaluationWindowDays: 180,
  }, { authorizedUnitIds }).utilityVersion, '1.0.0');
  assert.equal(normalizeUtilityRuleInput({
    ...base, utilityKey: 'anomalies', thresholds: { deviation: 10 }, evaluationWindowDays: 1,
  }, { authorizedUnitIds }).utilityVersion, '1.0.0');

  for (const input of [
    { ...base, thresholds: { threshold: 0.64 } },
    { ...base, thresholds: { threshold: 1.01 } },
    { ...base, thresholds: { threshold: 0.8, formula: 'x > 1' } },
    { ...base, utilityKey: 'hotspots', thresholds: { minimumCases: 2.5 } },
    { ...base, evaluationWindowDays: 181 },
  ]) assert.throws(() => normalizeUtilityRuleInput(input, { authorizedUnitIds }), TypeError);
});

test('rejects unsupported utilities, arbitrary execution fields, and unknown keys', () => {
  for (const input of [
    { ...base, utilityKey: 'area-attention' },
    { ...base, formula: 'threshold * 2' },
    { ...base, expression: 'true' },
    { ...base, sql: 'select 1' },
    { ...base, utilityVersion: '9.9.9' },
  ]) assert.throws(() => normalizeUtilityRuleInput(input, { authorizedUnitIds }), TypeError);
});

test('rejects invalid scope, enums, duplicate roles, and malformed values', () => {
  for (const input of [
    { ...base, scopeUnitId: 0 },
    { ...base, scopeUnitId: 999 },
    { ...base, enabled: 1 },
    { ...base, severity: 'URGENT' },
    { ...base, recipientRoles: [] },
    { ...base, recipientRoles: ['CRIME_ANALYST', 'CRIME_ANALYST'] },
    { ...base, recipientRoles: ['SUPER_ADMIN'] },
  ]) assert.throws(() => normalizeUtilityRuleInput(input, { authorizedUnitIds }), TypeError);
});

test('normalizes patches by validating the merged rule while returning only changed fields', () => {
  assert.deepEqual(normalizeUtilityRulePatch({
    enabled: false, severity: 'CRITICAL', thresholds: { threshold: 0.9 },
  }, { authorizedUnitIds, current: { ...base, utilityVersion: '1.0.0' } }), {
    enabled: false,
    severity: 'CRITICAL',
    thresholds: { threshold: 0.9 },
  });
  assert.deepEqual(normalizeUtilityRulePatch({
    recipientRoles: ['CRIME_ANALYST', 'STATE_LEADERSHIP'],
  }, { authorizedUnitIds, current: { ...base, utilityVersion: '1.0.0' } }), {
    recipientRoles: ['STATE_LEADERSHIP', 'CRIME_ANALYST'],
  });
  assert.throws(() => normalizeUtilityRulePatch(
    { utilityKey: 'hotspots' },
    { authorizedUnitIds, current: { ...base, utilityVersion: '1.0.0' } },
  ), TypeError);
  assert.throws(() => normalizeUtilityRulePatch(
    { sql: 'select 1' },
    { authorizedUnitIds, current: { ...base, utilityVersion: '1.0.0' } },
  ), TypeError);
});

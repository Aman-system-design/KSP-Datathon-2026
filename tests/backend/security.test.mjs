import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { projectNetwork, projectPattern } from '../../src/backend/security/disclosure.mjs';
import { resolveAccess } from '../../src/backend/security/identity.mjs';
import { buildAuthorizedUnitSet, buildEscalationUnitSet } from '../../src/backend/security/scope.mjs';

const policy = JSON.parse(await readFile(
  new URL('../../config/access-policy.json', import.meta.url),
  'utf8',
));
const user = { user_id: 'CAT-USER-1', status: 'ACTIVE', role: 'UNTRUSTED_CALLER_ROLE' };
const profile = {
  CatalystUserID: 'CAT-USER-1', DefaultRole: 'DISTRICT_LEADERSHIP', ScopeUnitID: 101,
  EmployeeID: 9001, Active: true, DemoPersonaAllowed: false,
  PermissionVersion: '1.0.0', SyntheticData: true,
};

function errorCode(callback) {
  assert.throws(callback, error => Boolean(error?.code));
  try { callback(); } catch (error) { return error.code; }
  return undefined;
}

test('identity resolution fails closed and ignores caller role fields', () => {
  assert.equal(errorCode(() => resolveAccess({ currentUser: null, profile, environment: 'Development', policy })), 'UNAUTHENTICATED');
  assert.equal(errorCode(() => resolveAccess({ currentUser: { ...user, status: 'DISABLED' }, profile, environment: 'Development', policy })), 'UNAUTHENTICATED');
  assert.equal(errorCode(() => resolveAccess({ currentUser: user, profile: null, environment: 'Development', policy })), 'INACTIVE_ACCESS_PROFILE');
  assert.equal(errorCode(() => resolveAccess({ currentUser: user, profile: { ...profile, Active: false }, environment: 'Development', policy })), 'INACTIVE_ACCESS_PROFILE');

  const access = resolveAccess({ currentUser: user, profile, environment: 'Development', policy });
  assert.equal(access.role, 'DISTRICT_LEADERSHIP');
  assert.equal(access.actualRole, 'DISTRICT_LEADERSHIP');
  assert.equal(access.actualUserId, 'CAT-USER-1');
  assert.equal(access.employeeId, 9001);
  assert.equal(access.scopeUnitId, 101);
  assert.equal(access.personaSwitchAllowed, false);
  assert.deepEqual(access.availablePersonas, []);
});

test('map-view policy grants ownership actions without broad management to operational roles', () => {
  for (const role of ['REGIONAL_LEADERSHIP', 'DISTRICT_LEADERSHIP', 'CRIME_ANALYST', 'STATION_OPERATIONS']) {
    assert.ok(policy.roles[role].includes('CREATE_MAP_VIEW'), role);
    assert.ok(policy.roles[role].includes('EDIT_OWN_MAP_VIEW'), role);
    assert.equal(policy.roles[role].includes('MANAGE_MAP_VIEWS'), false, role);
  }
  assert.ok(policy.roles.STATE_LEADERSHIP.includes('MANAGE_MAP_VIEWS'));
  assert.ok(policy.roles.PLATFORM_ADMIN.includes('MANAGE_MAP_VIEWS'));
});

test('case reads are restricted to operational, analyst, and leadership roles', () => {
  for (const role of [
    'STATE_LEADERSHIP', 'REGIONAL_LEADERSHIP', 'DISTRICT_LEADERSHIP',
    'CRIME_ANALYST', 'STATION_OPERATIONS',
  ]) {
    assert.ok(policy.roles[role].includes('READ_CASE'), role);
  }
  for (const role of ['COMMAND_CENTER', 'DEMO_PRESENTER', 'PLATFORM_ADMIN', 'AUDITOR']) {
    assert.equal(policy.roles[role].includes('READ_CASE'), false, role);
  }
});

test('demo persona is allowlisted, synthetic, authenticated, and Development-only', () => {
  const presenter = {
    ...profile, DefaultRole: 'DEMO_PRESENTER', DemoPersonaAllowed: true, SyntheticData: true,
  };
  const access = resolveAccess({
    currentUser: user, profile: presenter, requestedPersona: 'CRIME_ANALYST',
    environment: 'Development', policy,
  });
  assert.equal(access.role, 'CRIME_ANALYST');
  assert.equal(access.actualRole, 'DEMO_PRESENTER');
  assert.equal(access.demoPersona, true);
  assert.equal(access.personaSwitchAllowed, true);
  assert.deepEqual(access.availablePersonas, policy.personaAllowlist);

  assert.equal(errorCode(() => resolveAccess({
    currentUser: user, profile: presenter, requestedPersona: 'CRIME_ANALYST',
    environment: 'Production', policy,
  })), 'FORBIDDEN_ACTION');
  assert.equal(errorCode(() => resolveAccess({
    currentUser: user, profile: presenter, requestedPersona: 'PLATFORM_ADMIN',
    environment: 'Development', policy,
  })), 'FORBIDDEN_ACTION');
});

test('Command Center is a Development-only synthetic persona with an exact read and utility policy', () => {
  const presenter = {
    ...profile, DefaultRole: 'DEMO_PRESENTER', DemoPersonaAllowed: true, SyntheticData: true,
  };
  const expectedActions = [
    'READ_BRIEF', 'READ_PATTERN', 'READ_HOTSPOT', 'READ_ANOMALY', 'READ_AREA_RISK',
    'READ_NETWORK', 'READ_DISTRICT_CONTEXT', 'READ_ALERT', 'READ_INTELLIGENCE_RUNS',
    'READ_UTILITY', 'MANAGE_UTILITY_RULE', 'RUN_UTILITY_EVALUATION',
  ];
  const access = resolveAccess({
    currentUser: user, profile: presenter, requestedPersona: 'COMMAND_CENTER',
    environment: 'Development', policy,
  });

  assert.equal(policy.personaAllowlist.filter(role => role === 'COMMAND_CENTER').length, 1);
  assert.equal(Object.keys(policy.roles).filter(role => role === 'COMMAND_CENTER').length, 1);
  assert.equal(new Set(policy.roles.COMMAND_CENTER).size, policy.roles.COMMAND_CENTER.length);
  assert.deepEqual(access.actions, expectedActions);
  assert.ok(access.actions.includes('MANAGE_UTILITY_RULE'));
  assert.ok(access.actions.includes('RUN_UTILITY_EVALUATION'));
  assert.equal(access.role, 'COMMAND_CENTER');
  assert.equal(access.actualRole, 'DEMO_PRESENTER');
  assert.equal(access.demoPersona, true);
  assert.equal(access.syntheticData, true);
  assert.equal(errorCode(() => resolveAccess({
    currentUser: user, profile: presenter, requestedPersona: 'COMMAND_CENTER',
    environment: 'Production', policy,
  })), 'FORBIDDEN_ACTION');
});

test('unit hierarchy authorizes descendants and rejects siblings and invalid graphs', () => {
  const units = [
    { UnitID: 1, ParentUnit: null },
    { UnitID: 101, ParentUnit: 1 },
    { UnitID: 102, ParentUnit: 1 },
    { UnitID: 1001, ParentUnit: 101 },
  ];
  const authorized = buildAuthorizedUnitSet({ scopeUnitId: 101, units });
  assert.deepEqual([...authorized].sort((a, b) => a - b), [101, 1001]);
  assert.equal(authorized.has(102), false);

  const catalystUnits = units.map(unit => ({
    ...unit,
    UnitID: String(unit.UnitID),
    ParentUnit: unit.ParentUnit === null ? null : String(unit.ParentUnit),
  }));
  const normalized = buildAuthorizedUnitSet({ scopeUnitId: 101, units: catalystUnits });
  assert.deepEqual([...normalized].sort((a, b) => a - b), [101, 1001]);
  assert.deepEqual([...buildEscalationUnitSet({ scopeUnitId: 1001, units })], [101, 1]);
  assert.deepEqual([...buildEscalationUnitSet({ scopeUnitId: 1, units })], []);

  assert.equal(errorCode(() => buildAuthorizedUnitSet({
    scopeUnitId: 101,
    units: [...units, { UnitID: 1001, ParentUnit: 102 }],
  })), 'INVALID_UNIT_HIERARCHY');
  assert.equal(errorCode(() => buildAuthorizedUnitSet({
    scopeUnitId: 101,
    units: [{ UnitID: 101, ParentUnit: 1001 }, { UnitID: 1001, ParentUnit: 101 }],
  })), 'INVALID_UNIT_HIERARCHY');
  assert.equal(errorCode(() => buildAuthorizedUnitSet({
    scopeUnitId: 101,
    units: [{ UnitID: 101, ParentUnit: 999 }],
  })), 'INVALID_UNIT_HIERARCHY');
});

const pattern = {
  id: 'PAT-1', alertId: 'ALT-1', title: 'Synthetic cross-district pattern',
  unitSummaries: [
    { unitId: 101, unitName: 'Synthetic District A', caseCount: 1, observationPeriod: { from: '2026-06-01', to: '2026-06-02' } },
    { unitId: 102, unitName: 'Synthetic District B', caseCount: 1, observationPeriod: { from: '2026-06-03', to: '2026-06-04' } },
  ],
  evidence: [
    { unitId: 101, caseId: 'CASE-1', stationId: 1001, personId: 'PERSON-1', name: 'Synthetic Person 1', briefFacts: 'Synthetic facts A', exactCoordinates: [12.9, 77.5], evidenceObjectPath: 'evidence/a' },
    { unitId: 102, caseId: 'CASE-2', stationId: 2001, personId: 'PERSON-2', name: 'Synthetic Person 2', briefFacts: 'Synthetic facts B', exactCoordinates: [13.0, 77.6], evidenceObjectPath: 'evidence/b' },
  ],
};

test('cross-district projection returns full local evidence and aggregate remote evidence', () => {
  const result = projectPattern({
    pattern,
    access: { role: 'DISTRICT_LEADERSHIP', authorizedUnitIds: new Set([101]) },
  });
  assert.deepEqual(result.evidence.map(({ caseId }) => caseId), ['CASE-1']);
  assert.deepEqual(result.aggregateUnits, [{
    unitId: 102, unitName: 'Synthetic District B', caseCount: 1,
    observationPeriod: { from: '2026-06-03', to: '2026-06-04' }, accessLevel: 'AGGREGATE',
  }]);
  assert.equal(result.redactedEvidenceCount, 1);
  assert.equal(result.redactedUnitCount, 1);
  assert.equal(result.redactionReason, 'CROSS_UNIT_SCOPE');
  assert.doesNotMatch(JSON.stringify(result.aggregateUnits), /CASE-2|PERSON-2|facts B|evidence\/b|2001/);
});

test('assigned analyst receives only explicitly granted cross-unit case evidence', () => {
  const result = projectPattern({
    pattern,
    access: {
      role: 'CRIME_ANALYST', authorizedUnitIds: new Set([101]),
      assignments: [{
        alertId: 'ALT-1', authorizedUnitIds: [102], authorizedCaseIds: ['CASE-2'],
        evidenceAccessLevel: 'CASE_EVIDENCE', active: true,
      }],
    },
  });
  assert.deepEqual(result.evidence.map(({ caseId }) => caseId).sort(), ['CASE-1', 'CASE-2']);
  assert.equal(result.redactedEvidenceCount, 0);
});

test('patterns and network nodes outside scope use not-found semantics', () => {
  assert.equal(errorCode(() => projectPattern({
    pattern,
    access: { role: 'DISTRICT_LEADERSHIP', authorizedUnitIds: new Set([999]) },
  })), 'NOT_FOUND');
  assert.equal(errorCode(() => projectNetwork({
    network: { node: { id: 'PERSON-2', unitId: 102 }, edges: [] },
    access: { role: 'DISTRICT_LEADERSHIP', authorizedUnitIds: new Set([101]) },
  })), 'NOT_FOUND');
});

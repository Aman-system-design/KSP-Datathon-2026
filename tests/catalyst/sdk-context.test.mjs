import assert from 'node:assert/strict';
import test from 'node:test';

import { createCatalystSdkContext } from '../../src/backend/repository/catalyst/sdk-context.mjs';
import { sanitizeCatalystSdkError } from '../../src/backend/repository/catalyst/sdk-errors.mjs';
import { mapCatalystRow } from '../../src/backend/repository/catalyst/row-mapper.mjs';

const activeUser = Object.freeze({ user_id: 'CAT-1001', status: 'ACTIVE', email_id: 'private@example.invalid' });
const activeProfile = Object.freeze({
  CatalystUserID: 'CAT-1001', Active: true, PermissionVersion: '1.0.0', DefaultRole: 'CRIME_ANALYST',
});

function sdkFixture({ currentUser = activeUser } = {}) {
  const calls = [];
  const userApplication = {
    userManagement: () => ({ getCurrentUser: async () => currentUser }),
  };
  const adminApplication = { datastore: () => ({ trusted: true }) };
  return {
    calls,
    adminApplication,
    sdk: {
      initialize(request, options) {
        calls.push({ request, options });
        return options?.scope === 'admin' ? adminApplication : userApplication;
      },
    },
  };
}

test('Catalyst current user is resolved in user scope before admin initialization', async () => {
  const fixture = sdkFixture();
  const request = { headers: { 'x-catalyst-user-id': 'SPOOFED' }, user_id: 'SPOOFED' };
  const context = createCatalystSdkContext({ request, sdk: fixture.sdk, policyVersion: '1.0.0' });

  const currentUser = await context.getCurrentUser();
  assert.equal(currentUser.user_id, 'CAT-1001');
  assert.deepEqual(fixture.calls[0].options, { scope: 'user' });
  assert.equal(fixture.calls.filter(call => call.options?.scope === 'admin').length, 0);

  const admin = await context.authorize(activeProfile);
  assert.equal(admin, fixture.adminApplication);
  assert.equal(fixture.calls.filter(call => call.options?.scope === 'admin').length, 1);
  assert.deepEqual(fixture.calls[1].options, { scope: 'admin' });
});

test('authorization rejects absent/inactive users and invalid access profiles without admin scope', async () => {
  for (const [currentUser, profile] of [
    [null, activeProfile],
    [{ ...activeUser, status: 'DISABLED' }, activeProfile],
    [activeUser, null],
    [activeUser, { ...activeProfile, Active: false }],
    [activeUser, { ...activeProfile, CatalystUserID: 'CAT-OTHER' }],
    [activeUser, { ...activeProfile, PermissionVersion: '0.9.0' }],
  ]) {
    const fixture = sdkFixture({ currentUser });
    const context = createCatalystSdkContext({ request: {}, sdk: fixture.sdk, policyVersion: '1.0.0' });
    await assert.rejects(() => context.authorize(profile), error => [
      'UNAUTHENTICATED', 'INACTIVE_ACCESS_PROFILE',
    ].includes(error.code));
    assert.equal(fixture.calls.filter(call => call.options?.scope === 'admin').length, 0);
  }
});

test('current-user lookup failures are treated as unauthenticated and never unlock admin scope', async () => {
  const calls = [];
  const sdk = { initialize(_request, options) {
    calls.push(options);
    if (options.scope === 'user') return { userManagement: () => ({ getCurrentUser: async () => { throw new Error('private SDK auth detail'); } }) };
    throw new Error('admin must not initialize');
  } };
  const context = createCatalystSdkContext({ request: {}, sdk, policyVersion: '1.0.0' });
  await assert.rejects(context.getCurrentUser(), { code: 'UNAUTHENTICATED' });
  assert.deepEqual(calls, [{ scope: 'user' }]);
});

test('admin initialization is idempotent only after the same profile remains authorized', async () => {
  const fixture = sdkFixture();
  const context = createCatalystSdkContext({ request: {}, sdk: fixture.sdk, policyVersion: '1.0.0' });
  await context.authorize(activeProfile);
  await context.authorize({ ...activeProfile });
  assert.equal(fixture.calls.filter(call => call.options?.scope === 'admin').length, 1);
  await assert.rejects(() => context.authorize({ ...activeProfile, CatalystUserID: 'CAT-OTHER' }), /profile|access/i);
});

test('authenticated identity can unlock only the server-side profile lookup before profile authorization', async () => {
  const fixture = sdkFixture();
  const context = createCatalystSdkContext({ request: {}, sdk: fixture.sdk, policyVersion: '1.0.0' });
  const profileApplication = await context.getProfileApplication();
  assert.equal(profileApplication, fixture.adminApplication);
  assert.equal(fixture.calls[0].options.scope, 'user');
  assert.equal(fixture.calls[1].options.scope, 'admin');
  await context.authorize(activeProfile);
  assert.equal(fixture.calls.filter(call => call.options?.scope === 'admin').length, 1);
});

test('SDK errors reduce to stable safe codes without operational leakage', () => {
  const unsafe = Object.assign(new Error('table 4349 ROWID 999 token=secret-value'), {
    stack: 'private stack', unsafeCredential: 'secret-value', tableId: '4349',
  });
  const safe = sanitizeCatalystSdkError(unsafe, { operation: 'READ_HOTSPOTS' });
  assert.equal(safe.code, 'CATALYST_UNAVAILABLE');
  assert.equal(safe.status, 503);
  assert.equal(safe.message, 'Catalyst service is temporarily unavailable.');
  assert.equal(JSON.stringify(safe).includes('4349'), false);
  assert.equal(JSON.stringify(safe).includes('secret-value'), false);
  assert.equal(JSON.stringify(safe).includes('ROWID'), false);
  assert.equal(JSON.stringify(safe).includes('stack'), false);
});

test('Catalyst row mapping strips metadata unless internal ROWID resolution is explicit', () => {
  const row = {
    ROWID: '10001', CREATORID: '20002', CREATEDTIME: 'now', MODIFIEDTIME: 'later',
    CaseMasterID: 42, BriefFacts: 'Synthetic narrative',
  };
  assert.deepEqual(mapCatalystRow(row), { CaseMasterID: 42, BriefFacts: 'Synthetic narrative' });
  assert.deepEqual(mapCatalystRow(row, { includeRowId: true }), {
    ROWID: '10001', CaseMasterID: 42, BriefFacts: 'Synthetic narrative',
  });
  assert.deepEqual(row, {
    ROWID: '10001', CREATORID: '20002', CREATEDTIME: 'now', MODIFIEDTIME: 'later',
    CaseMasterID: 42, BriefFacts: 'Synthetic narrative',
  });
});

import assert from 'node:assert/strict';
import test from 'node:test';

import { buildDemoState } from '../../src/backend/repository/build-demo-state.mjs';
import { MemoryIntelligenceRepository } from '../../src/backend/repository/memory-repository.mjs';
import { buildAlertCompareAndSwap } from '../../src/backend/repository/zcql-cas.mjs';
import { buildAuditEvent, verifyAuditStream } from '../../src/backend/workflow/audit.mjs';
import { canonicalStringify } from '../../src/backend/workflow/canonical-json.mjs';
import { createCommandService, hashIdempotencyScope } from '../../src/backend/workflow/command-service.mjs';
import { resolveTransition } from '../../src/backend/workflow/state-machine.mjs';

const secret = 'test-only-secret-not-persisted';
const clock = () => '2026-07-20T12:00:00.000Z';
const district = Object.freeze({
  actualUserId: 'CAT-DISTRICT', employeeId: 9001, role: 'DISTRICT_LEADERSHIP',
  scopeUnitId: 101, authorizedUnitIds: new Set([101]),
  actions: ['ASSIGN_ALERT', 'CLOSE_ALERT'], syntheticData: true,
});
const analyst = Object.freeze({
  actualUserId: 'CAT-ANALYST', employeeId: 9003, role: 'CRIME_ANALYST',
  scopeUnitId: 101, authorizedUnitIds: new Set([101]),
  actions: ['ACKNOWLEDGE_ALERT', 'CONCLUDE_ALERT'], syntheticData: true,
});

function harness(options = {}) {
  let id = 0;
  const repository = new MemoryIntelligenceRepository(buildDemoState(), options);
  return {
    repository,
    service: createCommandService({
      repository, clock, idFactory: prefix => `${prefix}-${++id}`,
      auditKeys: { v1: secret }, activeAuditKeyVersion: 'v1',
    }),
  };
}

const request = (overrides = {}) => ({
  access: district,
  route: '/v1/alerts/{alertId}/assign',
  commandType: 'ASSIGN',
  alertId: 'ALT-PATTERN-1',
  idempotencyKey: 'client-key-1',
  expectedState: 'GENERATED',
  expectedVersion: 0,
  payload: {
    assignedUnitId: 101, assignedEmployeeId: 9003, reason: 'Review linked synthetic cases.',
    authorizedUnitIds: [101], authorizedCaseIds: ['CASE-001'], evidenceAccessLevel: 'ASSIGNED_CASES',
  },
  ...overrides,
});

test('canonical JSON is stable and rejects values that cannot be safely hashed', () => {
  assert.equal(canonicalStringify({ z: 1, a: { y: 2, x: [3, 4] } }), '{"a":{"x":[3,4],"y":2},"z":1}');
  assert.throws(() => canonicalStringify({ unsafe: undefined }), /unsupported/i);
  assert.throws(() => canonicalStringify({ unsafe: Number.NaN }), /finite/i);
  const cyclic = {}; cyclic.self = cyclic;
  assert.throws(() => canonicalStringify(cyclic), /cyclic/i);
});

test('state machine permits only the approved transitions and actions', () => {
  assert.deepEqual(resolveTransition('ASSIGN', 'GENERATED'), { action: 'ASSIGN_ALERT', targetState: 'ASSIGNED', artifact: 'assignment' });
  assert.equal(resolveTransition('ASSIGN', 'ASSIGNED').targetState, 'ASSIGNED');
  assert.equal(resolveTransition('ACKNOWLEDGE', 'ASSIGNED').targetState, 'ACKNOWLEDGED');
  assert.equal(resolveTransition('CONCLUDE', 'ACKNOWLEDGED').targetState, 'CONCLUDED');
  assert.equal(resolveTransition('CLOSE', 'CONCLUDED').targetState, 'CLOSED');
  assert.throws(() => resolveTransition('CLOSE', 'GENERATED'), { code: 'INVALID_STATE' });
});

test('ZCQL compare-and-swap accepts resolved values only and rejects injection', () => {
  const query = buildAlertCompareAndSwap({ alertRowId: '43492000000046055', commandRowId: '43492000000047001', expectedState: 'GENERATED', expectedVersion: 0, targetState: 'ASSIGNED' });
  assert.match(query, /^UPDATE WF_Alert SET Status = 'ASSIGNED'/);
  assert.match(query, /ROWID = 43492000000046055/);
  for (const value of ["1 OR 1=1", 'abc', '-1']) {
    assert.throws(() => buildAlertCompareAndSwap({ alertRowId: value, commandRowId: '2', expectedState: 'GENERATED', expectedVersion: 0, targetState: 'ASSIGNED' }));
  }
  assert.throws(() => buildAlertCompareAndSwap({ alertRowId: '1', commandRowId: '2', expectedState: "GENERATED' OR 1=1", expectedVersion: 0, targetState: 'ASSIGNED' }));
});

test('audit events form a verifiable HMAC chain without persisting key material', () => {
  const first = buildAuditEvent({ eventId: 'AUD-1', commandId: 'CMD-1', alertId: 'ALT-1', actorEmployeeId: 9001, eventType: 'ALERT_ASSIGNED', streamSequence: 1, previousEventHash: null, payload: { state: 'ASSIGNED' }, occurredAt: clock(), keyVersion: 'v1', key: secret });
  const second = buildAuditEvent({ eventId: 'AUD-2', commandId: 'CMD-2', alertId: 'ALT-1', actorEmployeeId: 9003, eventType: 'ALERT_ACKNOWLEDGED', streamSequence: 2, previousEventHash: first.EventHash, payload: { state: 'ACKNOWLEDGED' }, occurredAt: clock(), keyVersion: 'v1', key: secret });
  assert.equal(JSON.stringify([first, second]).includes(secret), false);
  assert.deepEqual(verifyAuditStream([first, second], { v1: secret }), { valid: true, errors: [] });
  const tampered = structuredClone([first, second]); tampered[1].EventPayloadJSON = '{}';
  assert.equal(verifyAuditStream(tampered, { v1: secret }).valid, false);
  assert.equal(verifyAuditStream([second], { v1: secret }).valid, false, 'missing sequence is detected');
  const forked = structuredClone([first, second]); forked[1].PreviousEventHash = 'f'.repeat(64);
  assert.equal(verifyAuditStream(forked, { v1: secret }).valid, false, 'fork is detected');
  const rotated = buildAuditEvent({ eventId: 'AUD-3', commandId: 'CMD-3', alertId: 'ALT-1', actorEmployeeId: 9003, eventType: 'ALERT_CLOSED', streamSequence: 3, previousEventHash: second.EventHash, payload: { state: 'CLOSED' }, occurredAt: clock(), keyVersion: 'v2', key: 'rotated-test-key' });
  assert.equal(verifyAuditStream([first, second, rotated], { v1: secret, v2: 'rotated-test-key' }).valid, true);
});

test('workflow completes assignment, acknowledgement, conclusion, outcome and reassignment', async () => {
  const { service, repository } = harness();
  const assigned = await service.execute(request());
  assert.equal(assigned.alert.status, 'ASSIGNED');
  assert.deepEqual(await service.execute(request()), assigned, 'same key replays stored response');
  await assert.rejects(service.execute(request({ payload: { ...request().payload, reason: 'different' } })), { code: 'IDEMPOTENCY_CONFLICT' });

  const reassigned = await service.execute(request({ idempotencyKey: 'reassign', expectedState: 'ASSIGNED', expectedVersion: 1 }));
  assert.equal(reassigned.alert.version, 2);
  const acknowledged = await service.execute(request({ access: analyst, route: '/v1/alerts/{alertId}/acknowledge', commandType: 'ACKNOWLEDGE', idempotencyKey: 'ack', expectedState: 'ASSIGNED', expectedVersion: 2, payload: { note: 'Accepted for analysis.' } }));
  assert.equal(acknowledged.alert.status, 'ACKNOWLEDGED');
  const concluded = await service.execute(request({ access: analyst, route: '/v1/alerts/{alertId}/analyst-conclusion', commandType: 'CONCLUDE', idempotencyKey: 'conclude', expectedState: 'ACKNOWLEDGED', expectedVersion: 3, payload: { conclusionCode: 'SUPPORTED', conclusionText: 'Synthetic links merit review.' } }));
  assert.equal(concluded.alert.status, 'CONCLUDED');
  const closed = await service.execute(request({ route: '/v1/alerts/{alertId}/outcome', commandType: 'CLOSE', idempotencyKey: 'close', expectedState: 'CONCLUDED', expectedVersion: 4, payload: { outcomeCode: 'REVIEWED', outcomeText: 'Human review completed.' } }));
  assert.equal(closed.alert.status, 'CLOSED');
  assert.equal((await repository.getAuditStream('ALT-PATTERN-1')).length, 5);
});

test('workflow denies wrong role, assignment, state/version, and isolates users idempotently', async () => {
  const { service } = harness();
  await assert.rejects(service.execute(request({ access: analyst })), { code: 'FORBIDDEN_ACTION' });
  await assert.rejects(service.execute(request({ expectedVersion: 9 })), { code: 'INVALID_STATE' });
  await service.execute(request());
  const otherAnalyst = { ...analyst, actualUserId: 'CAT-OTHER', employeeId: 9010 };
  await assert.rejects(service.execute(request({ access: otherAnalyst, route: '/v1/alerts/{alertId}/acknowledge', commandType: 'ACKNOWLEDGE', idempotencyKey: 'same-raw-key', expectedState: 'ASSIGNED', expectedVersion: 1, payload: { note: 'x' } })), { code: 'FORBIDDEN_ACTION' });
  const result = await service.execute(request({ access: analyst, route: '/v1/alerts/{alertId}/acknowledge', commandType: 'ACKNOWLEDGE', idempotencyKey: 'same-raw-key', expectedState: 'ASSIGNED', expectedVersion: 1, payload: { note: 'x' } }));
  assert.equal(result.alert.status, 'ACKNOWLEDGED');
  assert.equal(JSON.stringify(result).includes('same-raw-key'), false);
  assert.notEqual(
    hashIdempotencyScope({ actor: 'CAT-ANALYST', route: '/route', key: 'same-raw-key' }),
    hashIdempotencyScope({ actor: 'CAT-OTHER', route: '/route', key: 'same-raw-key' }),
  );
});

test('concurrent commands for one expected version allow exactly one transition', async () => {
  const { service, repository } = harness();
  const results = await Promise.allSettled([
    service.execute(request({ idempotencyKey: 'concurrent-a' })),
    service.execute(request({ idempotencyKey: 'concurrent-b', payload: { ...request().payload, assignedEmployeeId: 9010 } })),
  ]);
  assert.equal(results.filter(({ status }) => status === 'fulfilled').length, 1);
  const rejected = results.find(({ status }) => status === 'rejected');
  assert.equal(rejected.reason.code, 'INVALID_STATE');
  const effective = await repository.getAssignmentsForAlert('ALT-PATTERN-1');
  assert.equal(effective.length, 1);
  const losingEmployee = effective[0].AssignedEmployeeID === 9003 ? 9010 : 9003;
  assert.deepEqual(await repository.getAssignmentsForEmployee(losingEmployee), []);
});

test('a later command is blocked until the preceding version has command and audit completion', async () => {
  let failed = false;
  const { service } = harness({ failureInjector(point) {
    if (!failed && point === 'afterAlertCas') { failed = true; const error = new Error(point); error.code = 'INJECTED_FAILURE'; throw error; }
  } });
  await assert.rejects(service.execute(request()), { code: 'INJECTED_FAILURE' });
  await assert.rejects(service.execute(request({
    access: analyst, route: '/v1/alerts/{alertId}/acknowledge', commandType: 'ACKNOWLEDGE',
    idempotencyKey: 'premature-ack', expectedState: 'ASSIGNED', expectedVersion: 1,
    payload: { note: 'Must wait.' },
  })), { code: 'DATA_NOT_READY' });
  await service.execute(request());
  const acknowledged = await service.execute(request({
    access: analyst, route: '/v1/alerts/{alertId}/acknowledge', commandType: 'ACKNOWLEDGE',
    idempotencyKey: 'ack-after-recovery', expectedState: 'ASSIGNED', expectedVersion: 1,
    payload: { note: 'Now complete.' },
  }));
  assert.equal(acknowledged.alert.status, 'ACKNOWLEDGED');
});

test('retry after every persistence boundary converges to exactly one result', async () => {
  for (const failurePoint of ['afterCommandCreate', 'afterDomainInsert', 'afterAlertCas', 'afterAuditInsert', 'beforeCommandComplete']) {
    let injected = false;
    const { service, repository } = harness({ failureInjector(point) {
      if (!injected && point === failurePoint) { injected = true; const error = new Error(point); error.code = 'INJECTED_FAILURE'; throw error; }
    } });
    await assert.rejects(service.execute(request()), { code: 'INJECTED_FAILURE' }, failurePoint);
    const completed = await service.execute(request());
    assert.equal(completed.alert.version, 1, failurePoint);
    const command = await repository.getCommandByIdempotencyHash(completed.command.idempotencyKeyHash);
    const reconciled = await repository.reconcileCommand(command.CommandID);
    assert.equal(reconciled.command.Status, 'COMPLETED', failurePoint);
    assert.ok(reconciled.assignment, failurePoint);
    assert.ok(reconciled.audit, failurePoint);
    assert.equal(reconciled.alert.AlertVersion, 1, failurePoint);
  }
});

import { createHash } from 'node:crypto';

import { fail, ServiceError } from '../services/errors.mjs';
import { buildAuditEvent } from './audit.mjs';
import { canonicalStringify } from './canonical-json.mjs';
import { resolveTransition } from './state-machine.mjs';

const sha256 = value => createHash('sha256').update(value).digest('hex');
export const hashIdempotencyScope = ({ actor, route, key }) => sha256(canonicalStringify({ actor, route, key }));
const requiredText = (value, name, max = 4000) => {
  if (typeof value !== 'string' || !value.trim() || value.length > max) fail('INVALID_REQUEST', `${name} is required.`);
  return value.trim();
};
const requiredInteger = (value, name) => {
  if (!Number.isInteger(value) || value < 0) fail('INVALID_REQUEST', `${name} must be a non-negative integer.`);
  return value;
};
const eventTypes = Object.freeze({
  ASSIGN: 'ALERT_ASSIGNED', ACKNOWLEDGE: 'ALERT_ACKNOWLEDGED',
  CONCLUDE: 'ANALYST_CONCLUSION_RECORDED', CLOSE: 'ALERT_OUTCOME_RECORDED',
});

function validatePayload(commandType, payload, access) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) fail('INVALID_REQUEST');
  if (commandType === 'ASSIGN') {
    if (!Number.isInteger(payload.assignedUnitId) || !access.authorizedUnitIds.has(payload.assignedUnitId)) fail('FORBIDDEN_SCOPE');
    if (payload.assignedEmployeeId !== null && payload.assignedEmployeeId !== undefined && !Number.isInteger(payload.assignedEmployeeId)) fail('INVALID_REQUEST');
    requiredText(payload.reason, 'reason');
    if (!Array.isArray(payload.authorizedUnitIds) || payload.authorizedUnitIds.some(id => !access.authorizedUnitIds.has(id))) fail('FORBIDDEN_SCOPE');
    if (!Array.isArray(payload.authorizedCaseIds)) fail('INVALID_REQUEST');
    requiredText(payload.evidenceAccessLevel, 'evidenceAccessLevel', 32);
  } else if (commandType === 'ACKNOWLEDGE') {
    requiredText(payload.note, 'note');
  } else if (commandType === 'CONCLUDE') {
    requiredText(payload.conclusionCode, 'conclusionCode', 32);
    requiredText(payload.conclusionText, 'conclusionText');
  } else if (commandType === 'CLOSE') {
    requiredText(payload.outcomeCode, 'outcomeCode', 32);
    requiredText(payload.outcomeText, 'outcomeText');
  }
  return structuredClone(payload);
}

function domainArtifact({ kind, command, payload, access, now }) {
  const common = { AlertID: command.AlertID, CommandID: command.CommandID, SyntheticData: true };
  if (kind === 'assignment') return {
    ...common, AssignmentID: `ASN-${command.CommandID}`, AssignedUnitID: payload.assignedUnitId,
    AssignedEmployeeID: payload.assignedEmployeeId ?? null, AssignedByEmployeeID: access.employeeId,
    Reason: payload.reason, AuthorizedUnitIDsJSON: canonicalStringify(payload.authorizedUnitIds),
    AuthorizedCaseIDsJSON: canonicalStringify(payload.authorizedCaseIds),
    EvidenceAccessLevel: payload.evidenceAccessLevel, AssignedAt: now,
  };
  if (kind === 'conclusion') return {
    ...common, ConclusionID: `CON-${command.CommandID}`, AnalystEmployeeID: access.employeeId,
    ConclusionCode: payload.conclusionCode, ConclusionText: payload.conclusionText,
    EvidencePackPath: payload.evidencePackPath ?? null, CreatedAt: now,
  };
  if (kind === 'outcome') return {
    ...common, OutcomeID: `OUT-${command.CommandID}`, RecordedByEmployeeID: access.employeeId,
    OutcomeCode: payload.outcomeCode, OutcomeText: payload.outcomeText, RecordedAt: now,
  };
  return null;
}

const replay = (command) => {
  if (command.Status === 'COMPLETED') return JSON.parse(command.ResponseJSON);
  if (command.Status === 'FAILED_FINAL') fail(command.ErrorCode || 'INVALID_STATE');
  return null;
};

export function createCommandService({
  repository, clock = () => new Date().toISOString(), idFactory,
  auditKeys, activeAuditKeyVersion,
}) {
  if (!auditKeys?.[activeAuditKeyVersion]) throw new TypeError('active audit key is unavailable');

  return Object.freeze({
    async execute(input) {
      const {
        access, route, commandType, alertId, idempotencyKey,
        expectedState, expectedVersion,
      } = input;
      if (!access?.actualUserId || !access.authorizedUnitIds) fail('FORBIDDEN_ACTION');
      requiredText(route, 'route', 255);
      requiredText(alertId, 'alertId', 64);
      const rawKey = requiredText(idempotencyKey, 'Idempotency-Key', 255);
      requiredInteger(expectedVersion, 'expectedVersion');
      const transition = resolveTransition(commandType, expectedState);
      if (!access.actions?.includes(transition.action)) fail('FORBIDDEN_ACTION');
      const payload = validatePayload(commandType, input.payload, access);
      const idempotencyKeyHash = hashIdempotencyScope({ actor: access.actualUserId, route, key: rawKey });
      const requestHash = sha256(canonicalStringify({
        actor: access.actualUserId, role: access.role, route, commandType, alertId,
        expectedState, expectedVersion, payload,
      }));

      let command = await repository.getCommandByIdempotencyHash(idempotencyKeyHash);
      if (command) {
        if (command.RequestHash !== requestHash) fail('IDEMPOTENCY_CONFLICT');
        const prior = replay(command);
        if (prior) return prior;
      } else {
        const alert = await repository.getAlert(alertId);
        if (!alert) fail('NOT_FOUND');
        if (!access.authorizedUnitIds.has(alert.ScopeUnitID)) fail('FORBIDDEN_SCOPE');
        if (alert.Status !== expectedState || alert.AlertVersion !== expectedVersion) fail('INVALID_STATE');
        if (expectedVersion > 0) {
          const previousCommand = alert.LastCommandID
            ? await repository.getCommand(alert.LastCommandID) : undefined;
          const previousAudit = alert.LastCommandID
            ? await repository.findAuditByCommand(alert.LastCommandID) : undefined;
          if (previousCommand?.Status !== 'COMPLETED'
            || previousAudit?.StreamSequence !== expectedVersion) fail('DATA_NOT_READY');
        }
        if (commandType === 'ACKNOWLEDGE' || commandType === 'CONCLUDE') {
          const assignments = await repository.getAssignmentsForAlert(alertId);
          const current = assignments.at(-1);
          if (!current || current.AssignedEmployeeID !== access.employeeId) fail('FORBIDDEN_ACTION');
        }
        command = {
          CommandID: idFactory('CMD'), IdempotencyKeyHash: idempotencyKeyHash,
          RequestHash: requestHash, AlertID: alertId, ActorCatalystUserID: access.actualUserId,
          EffectiveRole: access.role, CommandType: commandType,
          ExpectedAlertState: expectedState, ExpectedAlertVersion: expectedVersion,
          TargetAlertState: transition.targetState, Status: 'RECEIVED',
          ResponseJSON: null, ErrorCode: null, CreatedAt: clock(), CompletedAt: null,
          SyntheticData: access.syntheticData === true,
        };
        try {
          await repository.createCommand(command);
        } catch (error) {
          if (error.code !== 'UNIQUE_CONFLICT') throw error;
          command = await repository.getCommandByIdempotencyHash(idempotencyKeyHash);
          if (!command || command.RequestHash !== requestHash) fail('IDEMPOTENCY_CONFLICT');
          const prior = replay(command);
          if (prior) return prior;
        }
      }

      try {
        await repository.updateCommand(command.CommandID, { Status: 'EXECUTING', ErrorCode: null });
        if (transition.artifact && !await repository.findDomainArtifactByCommand(transition.artifact, command.CommandID)) {
          await repository.insertDomainArtifact(transition.artifact, domainArtifact({
            kind: transition.artifact, command, payload, access, now: clock(),
          }));
        }

        let alert = await repository.getAlert(alertId);
        const alreadyApplied = alert?.LastCommandID === command.CommandID
          && alert.AlertVersion === expectedVersion + 1
          && alert.Status === transition.targetState;
        if (!alreadyApplied) {
          const result = await repository.compareAndSwapAlert({
            alertId, expectedState, expectedVersion,
            targetState: transition.targetState, commandId: command.CommandID,
          });
          if (result.matched !== 1) {
            await repository.updateCommand(command.CommandID, { Status: 'FAILED_FINAL', ErrorCode: 'INVALID_STATE' });
            fail('INVALID_STATE');
          }
          alert = result.alert;
        }

        let audit = await repository.findAuditByCommand(command.CommandID);
        if (!audit) {
          const stream = await repository.getAuditStream(alertId);
          if (stream.length !== expectedVersion) fail('DATA_NOT_READY');
          audit = buildAuditEvent({
            eventId: idFactory('AUD'), commandId: command.CommandID, alertId,
            actorEmployeeId: access.employeeId, eventType: eventTypes[commandType],
            streamSequence: alert.AlertVersion,
            previousEventHash: stream.at(-1)?.EventHash ?? null,
            payload: { commandType, targetState: transition.targetState, requestHash },
            occurredAt: clock(), keyVersion: activeAuditKeyVersion,
            key: auditKeys[activeAuditKeyVersion],
          });
          await repository.appendAuditEvent(audit);
        }

        const response = {
          command: { id: command.CommandID, status: 'COMPLETED', idempotencyKeyHash },
          alert: { id: alert.AlertID, status: alert.Status, version: alert.AlertVersion },
          audit: { id: audit.AuditEventID, sequence: audit.StreamSequence, hash: audit.EventHash },
          syntheticData: command.SyntheticData,
        };
        await repository.updateCommand(command.CommandID, {
          Status: 'COMPLETED', ResponseJSON: canonicalStringify(response),
          ErrorCode: null, CompletedAt: clock(),
        });
        return response;
      } catch (error) {
        const current = await repository.getCommand(command.CommandID);
        if (current?.Status !== 'COMPLETED' && current?.Status !== 'FAILED_FINAL') {
          await repository.updateCommand(command.CommandID, { Status: 'FAILED_RETRYABLE', ErrorCode: error.code ?? 'RETRYABLE_PERSISTENCE_FAILURE' });
        }
        if (error instanceof ServiceError || error.code) throw error;
        throw error;
      }
    },
  });
}

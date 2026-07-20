import { createHash } from 'node:crypto';

import { buildAuditEvent } from '../workflow/audit.mjs';

const digest = value => createHash('sha256').update(String(value)).digest('hex');

export function createAccessAuditService({
  repository, clock = () => new Date().toISOString(), idFactory,
  auditKeys, activeAuditKeyVersion,
}) {
  if (!auditKeys?.[activeAuditKeyVersion]) throw new TypeError('active audit key is unavailable');
  return Object.freeze({
    async record({ access, currentUser, eventType, requestId, route, outcome, code = null }) {
      const actor = access?.actualUserId ?? currentUser?.user_id;
      if (!actor) return undefined;
      const token = digest(`${actor}|${requestId}|${eventType}|${route}`);
      const event = buildAuditEvent({
        eventId: idFactory('AUD'), commandId: null, alertId: null,
        actorEmployeeId: access?.employeeId ?? null, eventType,
        streamSequence: 1, previousEventHash: null,
        payload: {
          actorCatalystUserHash: digest(actor), effectiveRole: access?.role ?? null,
          route, outcome, code, demoPersona: access?.demoPersona === true,
        },
        occurredAt: clock(), keyVersion: activeAuditKeyVersion,
        key: auditKeys[activeAuditKeyVersion], streamId: `ACCESS:${token.slice(0, 47)}`,
        entityType: 'API_REQUEST', entityBusinessId: token.slice(0, 64),
      });
      return repository.appendAuditEvent(event);
    },
  });
}

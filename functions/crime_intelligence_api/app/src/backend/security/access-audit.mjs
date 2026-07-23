import { createHash } from 'node:crypto';

import { buildAuditEvent } from '../workflow/audit.mjs';

const digest = value => createHash('sha256').update(String(value)).digest('hex');
const resourceDetails = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/u.test(value.MapViewID ?? '')
    || !Number.isSafeInteger(value.Version) || value.Version < 1
    || !/^[a-f0-9]{64}$/u.test(value.DefinitionHash ?? '')) return undefined;
  return { DefinitionHash: value.DefinitionHash, MapViewID: value.MapViewID, Version: value.Version };
};

export function createAccessAuditService({
  repository, clock = () => new Date().toISOString(), idFactory,
  auditKeys, activeAuditKeyVersion,
}) {
  if (!auditKeys?.[activeAuditKeyVersion]) throw new TypeError('active audit key is unavailable');
  return Object.freeze({
    async record({ access, currentUser, eventType, requestId, route, outcome, code = null, details }) {
      const actor = access?.actualUserId ?? currentUser?.user_id;
      if (!actor) return undefined;
      const token = digest(`${actor}|${requestId}|${eventType}|${route}`);
      const event = buildAuditEvent({
        eventId: idFactory('AUD'), commandId: null, alertId: null,
        actorEmployeeId: access?.employeeId ?? null, eventType,
        streamSequence: 1, previousEventHash: null,
        payload: {
          actorCatalystUserHash: digest(actor), effectiveRole: access?.role ?? null,
          requestId, route, outcome, code, demoPersona: access?.demoPersona === true,
          ...(resourceDetails(details) ? { resource: resourceDetails(details) } : {}),
        },
        occurredAt: clock(), keyVersion: activeAuditKeyVersion,
        key: auditKeys[activeAuditKeyVersion], streamId: `ACCESS:${token.slice(0, 47)}`,
        entityType: 'API_REQUEST', entityBusinessId: token.slice(0, 64),
      });
      return repository.appendAuditEvent(event);
    },
  });
}

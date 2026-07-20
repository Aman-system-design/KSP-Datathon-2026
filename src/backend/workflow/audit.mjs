import { createHmac, timingSafeEqual } from 'node:crypto';

import { canonicalStringify } from './canonical-json.mjs';

const signedContent = event => ({
  AuditEventID: event.AuditEventID,
  AlertID: event.AlertID,
  CommandID: event.CommandID,
  ActorEmployeeID: event.ActorEmployeeID,
  ActorType: event.ActorType,
  EventType: event.EventType,
  EntityType: event.EntityType,
  EntityBusinessID: event.EntityBusinessID,
  EventPayloadJSON: event.EventPayloadJSON,
  StreamID: event.StreamID,
  StreamSequence: event.StreamSequence,
  HashAlgorithm: event.HashAlgorithm,
  HashKeyVersion: event.HashKeyVersion,
  PreviousEventHash: event.PreviousEventHash,
  OccurredAt: event.OccurredAt,
  SyntheticData: event.SyntheticData,
});

const digest = (event, key) => createHmac('sha256', key)
  .update(canonicalStringify(signedContent(event))).digest('hex');

export function buildAuditEvent({
  eventId, commandId, alertId, actorEmployeeId, eventType, streamSequence,
  previousEventHash, payload, occurredAt, keyVersion, key,
  streamId = alertId, entityType = 'WF_Alert', entityBusinessId = alertId,
  actorType = 'CATALYST_USER',
}) {
  if (!key || !keyVersion) throw new TypeError('versioned audit key is required');
  const event = {
    AuditEventID: eventId, AlertID: alertId, CommandID: commandId,
    ActorEmployeeID: actorEmployeeId ?? null, ActorType: actorType,
    EventType: eventType, EntityType: entityType, EntityBusinessID: entityBusinessId,
    EventPayloadJSON: canonicalStringify(payload), StreamID: streamId,
    StreamSequence: streamSequence, HashAlgorithm: 'HMAC-SHA-256',
    HashKeyVersion: keyVersion, PreviousEventHash: previousEventHash ?? null,
    OccurredAt: occurredAt, SyntheticData: true,
  };
  return { ...event, EventHash: digest(event, key) };
}

export function verifyAuditStream(events, keys) {
  const errors = [];
  let previous = null;
  for (let index = 0; index < events.length; index += 1) {
    const event = events[index];
    if (event.StreamSequence !== index + 1) errors.push(`invalid sequence at ${index}`);
    if (event.PreviousEventHash !== previous) errors.push(`broken previous hash at ${index}`);
    const key = keys[event.HashKeyVersion];
    if (!key) {
      errors.push(`unknown key version at ${index}`);
    } else {
      try {
        const actual = Buffer.from(event.EventHash ?? '', 'hex');
        const expected = Buffer.from(digest(event, key), 'hex');
        if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) errors.push(`HMAC mismatch at ${index}`);
      } catch {
        errors.push(`invalid event content at ${index}`);
      }
    }
    previous = event.EventHash;
  }
  return { valid: errors.length === 0, errors };
}

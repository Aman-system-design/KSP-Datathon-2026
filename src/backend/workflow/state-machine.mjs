import { fail } from '../services/errors.mjs';

const transitions = Object.freeze({
  ASSIGN: Object.freeze({
    GENERATED: Object.freeze({ action: 'ASSIGN_ALERT', targetState: 'ASSIGNED', artifact: 'assignment' }),
    ASSIGNED: Object.freeze({ action: 'ASSIGN_ALERT', targetState: 'ASSIGNED', artifact: 'assignment' }),
  }),
  ACKNOWLEDGE: Object.freeze({
    ASSIGNED: Object.freeze({ action: 'ACKNOWLEDGE_ALERT', targetState: 'ACKNOWLEDGED', artifact: null }),
  }),
  CONCLUDE: Object.freeze({
    ACKNOWLEDGED: Object.freeze({ action: 'CONCLUDE_ALERT', targetState: 'CONCLUDED', artifact: 'conclusion' }),
  }),
  CLOSE: Object.freeze({
    CONCLUDED: Object.freeze({ action: 'CLOSE_ALERT', targetState: 'CLOSED', artifact: 'outcome' }),
  }),
});

export function resolveTransition(commandType, expectedState) {
  const transition = transitions[commandType]?.[expectedState];
  if (!transition) fail('INVALID_STATE', 'The alert cannot make the requested transition.');
  return { ...transition };
}

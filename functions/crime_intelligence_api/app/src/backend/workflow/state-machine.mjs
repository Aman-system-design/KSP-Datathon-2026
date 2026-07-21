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
  NOTE: Object.freeze(Object.fromEntries(
    ['GENERATED', 'ASSIGNED', 'ACKNOWLEDGED', 'CONCLUDED'].map(state => [
      state, Object.freeze({ action: 'ADD_ALERT_NOTE', targetState: state, artifact: 'note' }),
    ]),
  )),
  ESCALATE: Object.freeze(Object.fromEntries(
    ['GENERATED', 'ASSIGNED', 'ACKNOWLEDGED', 'CONCLUDED'].map(state => [
      state, Object.freeze({ action: 'ESCALATE_ALERT', targetState: state, artifact: 'escalation' }),
    ]),
  )),
});

export function resolveTransition(commandType, expectedState) {
  const transition = transitions[commandType]?.[expectedState];
  if (!transition) fail('INVALID_STATE', 'The alert cannot make the requested transition.');
  return { ...transition };
}

const states = new Set(['GENERATED', 'ASSIGNED', 'ACKNOWLEDGED', 'CONCLUDED', 'CLOSED']);
const rowId = (value, name) => {
  const text = String(value);
  if (!/^[1-9]\d*$/.test(text)) throw new TypeError(`${name} must be a resolved positive ROWID`);
  return text;
};
const state = (value, name) => {
  if (!states.has(value)) throw new TypeError(`${name} is not allowlisted`);
  return value;
};

export function buildAlertCompareAndSwap({
  alertRowId, commandRowId, expectedState, expectedVersion, targetState,
}) {
  const alert = rowId(alertRowId, 'alertRowId');
  const command = rowId(commandRowId, 'commandRowId');
  const from = state(expectedState, 'expectedState');
  const to = state(targetState, 'targetState');
  if (!Number.isInteger(expectedVersion) || expectedVersion < 0) throw new TypeError('expectedVersion must be a non-negative integer');
  return `UPDATE WF_Alert SET Status = '${to}', AlertVersion = ${expectedVersion + 1}, LastCommandRef = ${command} WHERE ROWID = ${alert} AND Status = '${from}' AND AlertVersion = ${expectedVersion}`;
}

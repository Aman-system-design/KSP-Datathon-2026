import { getUtility } from './utility-registry.mjs';

const inputKeys = Object.freeze([
  'utilityKey', 'enabled', 'scopeUnitId', 'thresholds', 'evaluationWindowDays',
  'severity', 'recipientRoles',
]);
const patchKeys = new Set(inputKeys.filter(key => key !== 'utilityKey'));
const severities = new Set(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);
const recipientRoleOrder = Object.freeze([
  'STATE_LEADERSHIP', 'REGIONAL_LEADERSHIP', 'DISTRICT_LEADERSHIP', 'CRIME_ANALYST',
]);
const recipientRoles = new Set(recipientRoleOrder);
const supportedUtilities = new Set(['patterns', 'hotspots', 'anomalies']);

const fail = message => { throw new TypeError(message); };
const isPlainObject = value => value !== null
  && typeof value === 'object'
  && !Array.isArray(value)
  && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);

function assertExactKeys(input, allowed, { required = allowed } = {}) {
  if (!isPlainObject(input)) fail('utility rule must be an object');
  const keys = Object.keys(input);
  for (const key of keys) if (!allowed.includes(key)) fail(`unknown utility rule field: ${key}`);
  for (const key of required) if (!Object.hasOwn(input, key)) fail(`utility rule field required: ${key}`);
}

function hasAuthorizedUnit(authorizedUnitIds, scopeUnitId) {
  if (authorizedUnitIds instanceof Set) return authorizedUnitIds.has(scopeUnitId);
  return Array.isArray(authorizedUnitIds) && authorizedUnitIds.includes(scopeUnitId);
}

export function normalizeUtilityRuleInput(input, { authorizedUnitIds } = {}) {
  assertExactKeys(input, inputKeys);
  const utility = getUtility(input.utilityKey);
  if (!supportedUtilities.has(input.utilityKey) || !utility?.alertPolicy?.enabled) {
    fail('unsupported utility rule');
  }
  if (typeof input.enabled !== 'boolean') fail('enabled must be boolean');
  if (!Number.isSafeInteger(input.scopeUnitId) || input.scopeUnitId < 1) {
    fail('scopeUnitId must be a positive integer');
  }
  if (!hasAuthorizedUnit(authorizedUnitIds, input.scopeUnitId)) fail('scopeUnitId is not authorized');
  if (!severities.has(input.severity)) fail('unsupported severity');
  if (!Array.isArray(input.recipientRoles) || input.recipientRoles.length === 0) {
    fail('recipientRoles must be a non-empty array');
  }
  if (new Set(input.recipientRoles).size !== input.recipientRoles.length) {
    fail('recipientRoles must not contain duplicates');
  }
  if (input.recipientRoles.some(role => !recipientRoles.has(role))) fail('unsupported recipient role');

  const fields = utility.alertPolicy.fields;
  const thresholdNames = Object.keys(fields).filter(name => name !== 'evaluationWindowDays');
  assertExactKeys(input.thresholds, thresholdNames);
  for (const name of thresholdNames) {
    const value = input.thresholds[name];
    const { kind, min, max } = fields[name];
    if (typeof value !== 'number' || !Number.isFinite(value)
      || (kind === 'integer' && !Number.isSafeInteger(value)) || value < min || value > max) {
      fail(`${name} must be between ${min} and ${max}`);
    }
  }
  const windowBounds = fields.evaluationWindowDays;
  if (!Number.isSafeInteger(input.evaluationWindowDays)
    || input.evaluationWindowDays < windowBounds.min
    || input.evaluationWindowDays > windowBounds.max) {
    fail(`evaluationWindowDays must be between ${windowBounds.min} and ${windowBounds.max}`);
  }

  return {
    utilityKey: input.utilityKey,
    enabled: input.enabled,
    scopeUnitId: input.scopeUnitId,
    thresholds: structuredClone(input.thresholds),
    evaluationWindowDays: input.evaluationWindowDays,
    severity: input.severity,
    recipientRoles: recipientRoleOrder.filter(role => input.recipientRoles.includes(role)),
    utilityVersion: utility.version,
  };
}

export function normalizeUtilityRulePatch(input, { authorizedUnitIds, current } = {}) {
  if (!isPlainObject(input) || Object.keys(input).length === 0) fail('utility rule patch must not be empty');
  for (const key of Object.keys(input)) if (!patchKeys.has(key)) fail(`unknown utility rule patch field: ${key}`);
  if (!isPlainObject(current)) fail('current utility rule is required');
  const merged = {};
  for (const key of inputKeys) merged[key] = Object.hasOwn(input, key) ? input[key] : current[key];
  const normalized = normalizeUtilityRuleInput(merged, { authorizedUnitIds });
  return Object.fromEntries(Object.keys(input).map(key => [key, structuredClone(normalized[key])]));
}

import { createHash } from 'node:crypto';

import { fail } from '../services/errors.mjs';
import { canonicalStringify } from '../workflow/canonical-json.mjs';
import {
  getUtility as getUtilityDefinition,
  listUtilities as listUtilityDefinitions,
  listUtilityCategories as listRegistryCategories,
} from './utility-registry.mjs';
import { normalizeUtilityRuleInput, normalizeUtilityRulePatch } from './rule-contract.mjs';
import { evaluateUtilityFinding } from './utility-evaluator.mjs';

const envelope = data => ({ data });
const sha256 = value => createHash('sha256').update(value).digest('hex');
const listQueryKeys = new Set(['utilityKey', 'limit', 'nextToken']);
const noQueryKeys = new Set();

const requireAction = (access, action) => {
  if (!access?.actions?.includes(action)) fail('FORBIDDEN_ACTION');
};

const requireScope = (access, scopeUnitId) => {
  if (!access?.authorizedUnitIds?.has(scopeUnitId)) fail('FORBIDDEN_SCOPE');
};

function parseJson(value) {
  try { return JSON.parse(value); } catch { fail('DATA_NOT_READY'); }
}

function publicRule(row) {
  if (!row) return undefined;
  return {
    id: row.RuleID,
    utilityKey: row.UtilityKey,
    enabled: row.Enabled,
    scopeUnitId: row.ScopeUnitID,
    thresholds: parseJson(row.ThresholdsJSON),
    evaluationWindowDays: row.EvaluationWindowDays,
    severity: row.Severity,
    recipientRoles: parseJson(row.RecipientRolesJSON),
    utilityVersion: row.UtilityVersion,
    version: row.Version,
    createdBy: row.CreatedByUserID,
    createdAt: row.CreatedAt,
    updatedAt: row.UpdatedAt,
    syntheticData: row.SyntheticData === true,
  };
}

function storedRule(rule, metadata) {
  return {
    RuleID: metadata.id,
    IdempotencyKeyHash: metadata.idempotencyKeyHash,
    RequestHash: metadata.requestHash,
    UtilityKey: rule.utilityKey,
    UtilityVersion: rule.utilityVersion,
    Enabled: rule.enabled,
    ScopeUnitID: rule.scopeUnitId,
    ThresholdsJSON: JSON.stringify(rule.thresholds),
    EvaluationWindowDays: rule.evaluationWindowDays,
    Severity: rule.severity,
    RecipientRolesJSON: JSON.stringify(rule.recipientRoles),
    Version: 1,
    CreatedByUserID: metadata.createdBy,
    CreatedAt: metadata.at,
    UpdatedAt: metadata.at,
    SyntheticData: true,
  };
}

function currentInput(row) {
  const rule = publicRule(row);
  return {
    utilityKey: rule.utilityKey, enabled: rule.enabled, scopeUnitId: rule.scopeUnitId,
    thresholds: rule.thresholds, evaluationWindowDays: rule.evaluationWindowDays,
    severity: rule.severity, recipientRoles: rule.recipientRoles,
  };
}

function storedPatch(patch, updatedAt) {
  const names = {
    enabled: 'Enabled', scopeUnitId: 'ScopeUnitID', thresholds: 'ThresholdsJSON',
    evaluationWindowDays: 'EvaluationWindowDays', severity: 'Severity',
    recipientRoles: 'RecipientRolesJSON',
  };
  return Object.fromEntries([
    ...Object.entries(patch).map(([key, value]) => [
      names[key], key === 'thresholds' || key === 'recipientRoles' ? JSON.stringify(value) : value,
    ]),
    ['UpdatedAt', updatedAt],
  ]);
}

function header(headers, name) {
  return Object.entries(headers ?? {}).find(([key]) => key.toLowerCase() === name.toLowerCase())?.[1];
}

function exactKeys(input, allowed) {
  if (!input || typeof input !== 'object' || Array.isArray(input)
    || Object.getPrototypeOf(input) !== Object.prototype
    || Object.keys(input).some(key => !allowed.has(key))) fail('INVALID_REQUEST');
}

function listLimit(value) {
  if (value === undefined) return 100;
  if (typeof value !== 'string' || !/^(?:[1-9]|[1-9]\d|100)$/u.test(value)) fail('INVALID_REQUEST');
  return Number(value);
}

function listCursor(token, utilityKey) {
  if (token === undefined) return undefined;
  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]+$/u.test(token)) fail('INVALID_REQUEST');
  let decoded;
  try { decoded = Buffer.from(token, 'base64url').toString('utf8'); } catch { fail('INVALID_REQUEST'); }
  if (Buffer.from(decoded, 'utf8').toString('base64url') !== token) fail('INVALID_REQUEST');
  let cursor;
  try { cursor = JSON.parse(decoded); } catch { fail('INVALID_REQUEST'); }
  if (!cursor || typeof cursor !== 'object' || Array.isArray(cursor)
    || Object.keys(cursor).sort().join(',') !== 'lastRuleId,utilityKey'
    || canonicalStringify(cursor) !== decoded
    || cursor.utilityKey !== (utilityKey ?? null)
    || typeof cursor.lastRuleId !== 'string'
    || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/u.test(cursor.lastRuleId)) fail('INVALID_REQUEST');
  return cursor.lastRuleId;
}

const cursorToken = (utilityKey, lastRuleId) => Buffer
  .from(canonicalStringify({ utilityKey: utilityKey ?? null, lastRuleId }), 'utf8')
  .toString('base64url');

function sameStoredPatch(row, changes) {
  return Object.entries(changes).every(([key, value]) => key === 'UpdatedAt' || row[key] === value);
}

function invalidRequest(error) {
  if (error instanceof TypeError) fail('INVALID_REQUEST');
  throw error;
}

async function currentFindings(repository, utilityKey, runGroup) {
  const method = {
    patterns: 'listPatterns', hotspots: 'listHotspots', anomalies: 'listAnomalies',
  }[utilityKey];
  if (!method || typeof repository?.[method] !== 'function') fail('DATA_NOT_READY');
  const findings = [];
  let nextToken;
  for (let pageNumber = 0; pageNumber < 5; pageNumber += 1) {
    const page = await repository[method]({ runGroup, limit: 200, ...(nextToken ? { nextToken } : {}) });
    if (!page || !Array.isArray(page.data)) fail('DATA_NOT_READY');
    findings.push(...page.data);
    nextToken = page.nextToken;
    if (!nextToken) return findings;
  }
  fail('DATA_NOT_READY');
}

export function createUtilityServices({ repository, idFactory, now } = {}) {
  return Object.freeze({
    async listUtilities({ access, query = {} } = {}) {
      requireAction(access, 'READ_UTILITY');
      exactKeys(query, new Set(['category']));
      if (query.category !== undefined && !listRegistryCategories().includes(query.category)) fail('INVALID_REQUEST');
      return envelope(listUtilityDefinitions({ category: query.category }));
    },
    async listUtilityCategories({ access, query = {} } = {}) {
      requireAction(access, 'READ_UTILITY');
      exactKeys(query, noQueryKeys);
      return envelope(listRegistryCategories());
    },
    async getUtility({ access, params, query = {} } = {}) {
      requireAction(access, 'READ_UTILITY');
      exactKeys(query, noQueryKeys);
      const definition = getUtilityDefinition(params?.utilityKey);
      if (!definition) fail('NOT_FOUND');
      return envelope(structuredClone(definition));
    },
    async listUtilityAlertRules({ access, query = {} } = {}) {
      requireAction(access, 'READ_UTILITY');
      exactKeys(query, listQueryKeys);
      if (query.utilityKey !== undefined && !getUtilityDefinition(query.utilityKey)) fail('INVALID_REQUEST');
      const limit = listLimit(query.limit);
      const cursor = listCursor(query.nextToken, query.utilityKey);
      const rows = await repository.listUtilityRules({ utilityKey: query.utilityKey });
      const authorized = rows.filter(row => access.authorizedUnitIds?.has(row.ScopeUnitID));
      if (authorized.some(row => typeof row.RuleID !== 'string')) fail('DATA_NOT_READY');
      authorized.sort((left, right) => left.RuleID < right.RuleID ? -1 : left.RuleID > right.RuleID ? 1 : 0);
      const remaining = cursor === undefined ? authorized : authorized.filter(row => row.RuleID > cursor);
      const page = remaining.slice(0, limit);
      const items = page.map(publicRule);
      return envelope({
        items,
        ...(page.length < remaining.length
          ? { nextToken: cursorToken(query.utilityKey, page.at(-1).RuleID) } : {}),
      });
    },
    async createUtilityAlertRule({ access, query = {}, headers, body } = {}) {
      requireAction(access, 'MANAGE_UTILITY_RULE');
      exactKeys(query, noQueryKeys);
      if (!access?.actualUserId) fail('FORBIDDEN_ACTION');
      const rawKey = header(headers, 'Idempotency-Key');
      if (typeof rawKey !== 'string' || !rawKey.trim()) fail('INVALID_REQUEST');
      if (Number.isSafeInteger(body?.scopeUnitId) && body.scopeUnitId > 0) {
        requireScope(access, body.scopeUnitId);
      }
      let normalized;
      try {
        normalized = normalizeUtilityRuleInput(body, { authorizedUnitIds: access.authorizedUnitIds });
      } catch (error) { invalidRequest(error); }
      const idempotencyKeyHash = sha256(canonicalStringify({ actualUserId: access.actualUserId, key: rawKey }));
      const requestHash = sha256(canonicalStringify(normalized));
      const id = `URULE-${idempotencyKeyHash.slice(0, 57)}`;
      const at = now();
      let created;
      try {
        created = await repository.createUtilityRule(storedRule(normalized, {
          id, idempotencyKeyHash, requestHash, createdBy: access.actualUserId, at,
        }));
      } catch (error) {
        if (error?.code !== 'UNIQUE_CONFLICT') throw error;
        created = await repository.getUtilityRule(id);
        if (!created || created.IdempotencyKeyHash !== idempotencyKeyHash) fail('INVALID_REQUEST');
        if (created.RequestHash !== requestHash) fail('IDEMPOTENCY_CONFLICT');
      }
      return envelope(publicRule(created));
    },
    async updateUtilityAlertRule({ access, params, query = {}, body } = {}) {
      requireAction(access, 'MANAGE_UTILITY_RULE');
      exactKeys(query, noQueryKeys);
      const current = await repository.getUtilityRule(params?.ruleId);
      if (!current) fail('NOT_FOUND');
      requireScope(access, current.ScopeUnitID);
      if (!body || typeof body !== 'object' || Array.isArray(body)
        || Object.getPrototypeOf(body) !== Object.prototype
        || !Object.hasOwn(body, 'expectedVersion')
        || !Number.isSafeInteger(body.expectedVersion) || body.expectedVersion < 1) fail('INVALID_REQUEST');
      const { expectedVersion, ...input } = body;
      if (Number.isSafeInteger(input.scopeUnitId) && input.scopeUnitId > 0) {
        requireScope(access, input.scopeUnitId);
      }
      let patch;
      try {
        patch = normalizeUtilityRulePatch(input, {
          authorizedUnitIds: access.authorizedUnitIds, current: currentInput(current),
        });
      } catch (error) { invalidRequest(error); }
      const changes = storedPatch(patch, now());
      if (current.Version === expectedVersion + 1) {
        if (!sameStoredPatch(current, changes)) fail('VERSION_CONFLICT');
        return envelope(publicRule(current));
      }
      if (current.Version !== expectedVersion) fail('VERSION_CONFLICT');
      const updated = await repository.updateUtilityRule(current.RuleID, expectedVersion, changes);
      if (updated?.conflict) {
        const latest = await repository.getUtilityRule(current.RuleID);
        if (!latest) fail('NOT_FOUND');
        requireScope(access, latest.ScopeUnitID);
        if (latest.Version === expectedVersion + 1 && sameStoredPatch(latest, changes)) {
          return envelope(publicRule(latest));
        }
        fail('VERSION_CONFLICT');
      }
      if (!updated) fail('NOT_FOUND');
      return envelope(publicRule(updated));
    },
    async evaluateUtilityAlertRule({ access, params, query = {}, body } = {}) {
      requireAction(access, 'RUN_UTILITY_EVALUATION');
      exactKeys(query, noQueryKeys);
      exactKeys(body, new Set(['expectedVersion']));
      if (!Number.isSafeInteger(body.expectedVersion) || body.expectedVersion < 1) fail('INVALID_REQUEST');
      const rule = await repository.getUtilityRule(params?.ruleId);
      if (!rule) fail('NOT_FOUND');
      requireScope(access, rule.ScopeUnitID);
      if (rule.Version !== body.expectedVersion || rule.UtilityVersion !== getUtilityDefinition(rule.UtilityKey)?.version) {
        fail('VERSION_CONFLICT');
      }
      if (rule.Enabled !== true) fail('INVALID_STATE');
      const runGroup = await repository.getCurrentRunGroup();
      const utility = getUtilityDefinition(rule.UtilityKey);
      const analysisRun = runGroup?.runs?.find(item => item.AnalysisType === utility?.findingType);
      if (!analysisRun || analysisRun.PublishStatus !== 'PUBLISHED') fail('DATA_NOT_READY');
      const findings = await currentFindings(repository, rule.UtilityKey, runGroup);
      const results = [];
      const candidates = [];
      let evaluated = 0;
      let suppressed = 0;
      for (const finding of findings) {
        const candidate = evaluateUtilityFinding({ rule, finding, analysisRun, now: now() });
        if (!candidate.matched) {
          if (candidate.reason !== 'OUT_OF_SCOPE') {
            evaluated += 1;
            suppressed += 1;
          }
          continue;
        }
        evaluated += 1;
        candidates.push(candidate.alert);
      }
      if (candidates.length) {
        candidates.sort((left, right) => left.AlertID.localeCompare(right.AlertID));
        const selected = structuredClone(candidates[0]);
        const original = JSON.parse(selected.OriginalFindingJSON);
        original.evaluationSummary = {
          matchedFindingCount: candidates.length,
          matchedFindingIds: candidates.map(item => item.FindingBusinessID).sort(),
          aggregation: 'ONE_ALERT_PER_RULE_RUN',
        };
        selected.OriginalFindingJSON = canonicalStringify(original);
        results.push(...await repository.createAlertsIfAbsent({
          alerts: [selected],
          ruleGuard: {
            ruleId: rule.RuleID, expectedVersion: rule.Version,
            scopeUnitId: rule.ScopeUnitID, utilityVersion: rule.UtilityVersion,
          },
          publicationGuard: {
            runGroupId: runGroup.RunGroupID,
            analysisRunId: analysisRun.AnalysisRunID,
            analysisRunRef: String(analysisRun.AnalysisRunRef ?? analysisRun.AnalysisRunID),
          },
        }));
      }
      return envelope({
        ruleId: rule.RuleID, ruleVersion: rule.Version, utilityKey: rule.UtilityKey,
        findingType: utility.findingType, analysisRunId: analysisRun.AnalysisRunID,
        runGroupId: analysisRun.RunGroupID, evaluated, matched: candidates.length, suppressed,
        created: results.filter(item => item.created).length,
        existing: results.filter(item => !item.created).length,
        alertIds: results.map(item => item.alert.AlertID), syntheticData: true,
      });
    },
  });
}

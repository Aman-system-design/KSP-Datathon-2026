import { canonicalStringify } from '../workflow/canonical-json.mjs';
import { evaluateUtilityFinding } from './utility-evaluator.mjs';
import { getUtility } from './utility-registry.mjs';
import { normalizeUtilityRuleInput } from './rule-contract.mjs';

const findingCollections = Object.freeze({
  patterns: 'patterns',
  hotspots: 'hotspots',
  anomalies: 'anomalies',
});

const failureCode = error => typeof error?.code === 'string' && /^[A-Z][A-Z0-9_]{1,63}$/u.test(error.code)
  ? error.code : 'INTERNAL_ERROR';

function invalidPersistedRule() {
  const error = new Error('Persisted utility rule is invalid.');
  error.code = 'INVALID_PERSISTED_RULE';
  return error;
}

function ruleClassification(rule, publishedAt) {
  const utility = getUtility(rule?.UtilityKey);
  if (!rule || typeof rule !== 'object' || Array.isArray(rule)) return 'INVALID';
  if (rule.Enabled === false) return 'EXCLUDED';
  if (rule.Enabled !== true || !utility) return 'INVALID';
  if (!utility.alertPolicy?.enabled || !findingCollections[rule.UtilityKey]
    || rule.UtilityVersion !== utility.version) return 'EXCLUDED';
  const createdAt = Date.parse(rule.CreatedAt);
  const updatedAt = Date.parse(rule.UpdatedAt);
  const publicationTime = Date.parse(publishedAt);
  if (!Number.isFinite(createdAt) || !Number.isFinite(updatedAt) || !Number.isFinite(publicationTime)
    || typeof rule.RuleID !== 'string' || !rule.RuleID
    || !Number.isSafeInteger(rule.ScopeUnitID) || rule.ScopeUnitID < 1
    || !Number.isSafeInteger(rule.Version) || rule.Version < 1
    || !Number.isSafeInteger(rule.EvaluationWindowDays)) return 'INVALID';
  let thresholds;
  let recipients;
  try { thresholds = JSON.parse(rule.ThresholdsJSON); recipients = JSON.parse(rule.RecipientRolesJSON); }
  catch { return 'INVALID'; }
  try {
    normalizeUtilityRuleInput({
      utilityKey: rule.UtilityKey, enabled: rule.Enabled, scopeUnitId: rule.ScopeUnitID,
      thresholds, evaluationWindowDays: rule.EvaluationWindowDays,
      severity: rule.Severity, recipientRoles: recipients,
    }, { authorizedUnitIds: new Set([rule.ScopeUnitID]) });
  } catch { return 'INVALID'; }
  if (createdAt > publicationTime || updatedAt > publicationTime) return 'EXCLUDED';
  return 'ELIGIBLE';
}

async function exactFindings(repository, runGroup, supplied, utilityKeys) {
  const result = { ...(supplied ?? {}) };
  const errors = new Map();
  const methods = { patterns: 'listPatterns', hotspots: 'listHotspots', anomalies: 'listAnomalies' };
  for (const utilityKey of utilityKeys) {
    const collection = findingCollections[utilityKey];
    if (Array.isArray(result[collection])) continue;
    const method = methods[utilityKey];
    try {
      if (typeof repository?.[method] !== 'function') throw new TypeError(`Missing ${method}.`);
      const rows = [];
      let nextToken;
      for (let pageNumber = 0; pageNumber < 5; pageNumber += 1) {
        const page = await repository[method]({ runGroup, limit: 200, ...(nextToken ? { nextToken } : {}) });
        if (!page || !Array.isArray(page.data)) throw new TypeError(`${method} returned an invalid page.`);
        rows.push(...page.data);
        nextToken = page.nextToken;
        if (!nextToken) break;
        if (pageNumber === 4) throw new TypeError(`${method} exceeded its governed page limit.`);
      }
      result[collection] = rows;
    } catch (error) {
      errors.set(utilityKey, error);
    }
  }
  return { findings: result, errors };
}

export async function evaluateUtilityRuleRun({ repository, rule, runGroup, findings, now }) {
  const utility = getUtility(rule?.UtilityKey);
  const collection = findingCollections[rule?.UtilityKey];
  const analysisRun = runGroup?.runs?.find(item => item.AnalysisType === utility?.findingType);
  if (!utility?.alertPolicy?.enabled || !collection || rule?.Enabled !== true || !analysisRun
    || analysisRun.PublishStatus !== 'PUBLISHED' || !Array.isArray(findings?.[collection])) {
    return { excluded: true };
  }

  const candidates = [];
  let evaluated = 0;
  let suppressed = 0;
  for (const finding of findings[collection]) {
    const candidate = evaluateUtilityFinding({ rule, finding, analysisRun, now });
    if (!candidate.matched) {
      if (candidate.reason !== 'OUT_OF_SCOPE') { evaluated += 1; suppressed += 1; }
      continue;
    }
    evaluated += 1;
    candidates.push(candidate.alert);
  }

  let results = [];
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
    results = await repository.createAlertsIfAbsent({
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
    });
  }

  return {
    excluded: false, evaluated, matched: candidates.length, suppressed,
    created: results.filter(item => item.created).length,
    existing: results.filter(item => !item.created).length,
    alertIds: results.map(item => item.alert.AlertID),
  };
}

export async function evaluatePublishedUtilityRules({ repository, runGroup, findings, now }) {
  const summary = {
    status: 'COMPLETED', runGroupId: runGroup?.RunGroupID ?? null,
    rulesDiscovered: 0, rulesEligible: 0, rulesExcluded: 0,
    rulesSucceeded: 0, rulesFailed: 0, findingsEvaluated: 0,
    matched: 0, suppressed: 0, created: 0, existing: 0,
    alertIds: [], failures: [], syntheticData: true,
  };
  let rules;
  try {
    rules = await repository.listUtilityRules();
  } catch (error) {
    return { ...summary, status: 'COMPLETED_WITH_ERRORS', rulesFailed: 1,
      failures: [{ ruleId: null, code: failureCode(error) }] };
  }
  summary.rulesDiscovered = rules.length;
  const classifications = new Map(rules.map(rule => [rule, ruleClassification(rule, runGroup?.PublishedAt)]));
  const supportedKeys = [...new Set(rules
    .filter(rule => classifications.get(rule) === 'ELIGIBLE')
    .map(rule => rule.UtilityKey))];
  const loaded = await exactFindings(repository, runGroup, findings, supportedKeys);
  findings = loaded.findings;
  for (const rule of [...rules].sort((left, right) => String(left.RuleID).localeCompare(String(right.RuleID)))) {
    try {
      const classification = classifications.get(rule);
      if (classification === 'EXCLUDED') { summary.rulesExcluded += 1; continue; }
      if (classification === 'INVALID') throw invalidPersistedRule();
      if (loaded.errors.has(rule.UtilityKey)) throw loaded.errors.get(rule.UtilityKey);
      const result = await evaluateUtilityRuleRun({ repository, rule, runGroup, findings, now });
      if (result.excluded) { summary.rulesExcluded += 1; continue; }
      summary.rulesEligible += 1;
      summary.rulesSucceeded += 1;
      summary.findingsEvaluated += result.evaluated;
      summary.matched += result.matched;
      summary.suppressed += result.suppressed;
      summary.created += result.created;
      summary.existing += result.existing;
      summary.alertIds.push(...result.alertIds);
    } catch (error) {
      summary.rulesEligible += 1;
      summary.rulesFailed += 1;
      summary.failures.push({
        ruleId: typeof rule?.RuleID === 'string' && rule.RuleID ? rule.RuleID : null,
        code: failureCode(error),
      });
    }
  }
  if (summary.rulesFailed) summary.status = 'COMPLETED_WITH_ERRORS';
  summary.alertIds.sort();
  return summary;
}

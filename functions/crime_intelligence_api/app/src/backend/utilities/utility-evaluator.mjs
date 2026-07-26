import { createHash } from 'node:crypto';

import { canonicalStringify } from '../workflow/canonical-json.mjs';
import { getUtility } from './utility-registry.mjs';

const severityScore = Object.freeze({ LOW: 0.25, MEDIUM: 0.5, HIGH: 0.75, CRITICAL: 1 });

const parseObject = (value) => {
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : undefined;
  } catch { return undefined; }
};

const parseArray = (value) => {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : undefined;
  } catch { return undefined; }
};

function scopedEvidence(finding, scopeUnitId) {
  if (Array.isArray(finding.evidence)) {
    return finding.evidence
      .filter(item => Number(item?.unitId) === scopeUnitId && typeof item.caseId === 'string')
      .map(item => ({ caseId: item.caseId, unitId: scopeUnitId }));
  }
  const units = finding.evidenceUnits && typeof finding.evidenceUnits === 'object'
    ? finding.evidenceUnits : {};
  return (finding.evidenceCaseIds ?? [])
    .filter(caseId => Number(units[caseId]) === scopeUnitId)
    .map(caseId => ({ caseId, unitId: scopeUnitId }));
}

function scopedSummaries(finding, scopeUnitId, evidence) {
  const summaries = Array.isArray(finding.unitSummaries)
    ? finding.unitSummaries.filter(item => Number(item?.unitId) === scopeUnitId)
    : [];
  if (summaries.length) return structuredClone(summaries);
  return evidence.length ? [{ unitId: scopeUnitId, caseCount: evidence.length }] : [];
}

function thresholdMet(utilityKey, thresholds, finding, scopedEvidenceCount) {
  if (utilityKey === 'patterns') return Number(finding.confidence) >= thresholds.threshold;
  if (utilityKey === 'hotspots') return scopedEvidenceCount >= thresholds.minimumCases;
  if (utilityKey === 'anomalies') {
    return finding.isAnomaly === true && Math.abs(Number(finding.deviation)) >= thresholds.deviation;
  }
  return false;
}

function findingTitle(utilityKey, finding) {
  if (typeof finding.title === 'string' && finding.title.trim()) return finding.title;
  if (utilityKey === 'hotspots') return `Emerging hotspot ${finding.id}`;
  return `Trend anomaly ${finding.id}`;
}

function candidateId(rule, utility, finding, analysisRun) {
  const source = `${rule.RuleID}|${rule.Version}|${utility.findingType}|${finding.id}|${analysisRun.AnalysisRunID}`;
  return `ALT-UTIL-${createHash('sha256').update(source).digest('hex').slice(0, 55)}`;
}

export function evaluateUtilityFinding({ rule, finding, analysisRun, now }) {
  const utility = getUtility(rule?.UtilityKey);
  if (!utility?.alertPolicy?.enabled) return { matched: false, reason: 'UNSUPPORTED_UTILITY' };
  if (rule.Enabled !== true) return { matched: false, reason: 'RULE_DISABLED' };
  if (rule.UtilityVersion !== utility.version) return { matched: false, reason: 'STALE_UTILITY_VERSION' };
  if (!finding || typeof finding.id !== 'string' || !analysisRun
    || analysisRun.AnalysisType !== utility.findingType) {
    return { matched: false, reason: 'INVALID_FINDING' };
  }
  const thresholds = parseObject(rule.ThresholdsJSON);
  const recipientRoles = parseArray(rule.RecipientRolesJSON);
  if (!thresholds || !recipientRoles || !Number.isSafeInteger(rule.ScopeUnitID)
    || !Number.isSafeInteger(rule.Version) || rule.Version < 1) {
    return { matched: false, reason: 'INVALID_RULE' };
  }
  const evidence = scopedEvidence(finding, rule.ScopeUnitID);
  if (!evidence.length) return { matched: false, reason: 'OUT_OF_SCOPE' };
  const evaluatedAt = Date.parse(now);
  const observationEnd = Date.parse(analysisRun.ObservationEnd);
  if (!Number.isFinite(evaluatedAt) || !Number.isFinite(observationEnd)) {
    return { matched: false, reason: 'INVALID_FINDING' };
  }
  if (evaluatedAt - observationEnd > rule.EvaluationWindowDays * 86_400_000) {
    return { matched: false, reason: 'EVALUATION_WINDOW_EXPIRED' };
  }
  if (!thresholdMet(rule.UtilityKey, thresholds, finding, evidence.length)) {
    return { matched: false, reason: 'THRESHOLD_NOT_MET' };
  }

  const limitations = [...new Set([...(finding.limitations ?? []), ...utility.limitations])];
  const envelope = {
    schemaVersion: '1.0.0',
    title: findingTitle(rule.UtilityKey, finding),
    recommendation: finding.recommendation ?? 'Review the governed evidence before taking action.',
    confidence: Number.isFinite(Number(finding.confidence)) ? Number(finding.confidence) : undefined,
    method: finding.method ?? utility.analyticalMethod,
    version: finding.version ?? analysisRun.EngineVersion,
    componentSummary: finding.componentSummary ?? undefined,
    utility: { key: utility.key, version: utility.version, findingType: utility.findingType },
    rule: {
      id: rule.RuleID, version: rule.Version, enabled: rule.Enabled,
      scopeUnitId: rule.ScopeUnitID, thresholds, evaluationWindowDays: rule.EvaluationWindowDays,
      severity: rule.Severity, recipientRoles,
    },
    analysisRun: {
      id: analysisRun.AnalysisRunID, runGroupId: analysisRun.RunGroupID,
      engineVersion: analysisRun.EngineVersion, observationStart: analysisRun.ObservationStart,
      observationEnd: analysisRun.ObservationEnd, publishedAt: analysisRun.PublishedAt,
    },
    finding: {
      id: finding.id, type: utility.findingType,
      ...(rule.UtilityKey === 'hotspots' ? { magnitude: finding.magnitude, centroid: finding.centroid } : {}),
      ...(rule.UtilityKey === 'anomalies' ? {
        observed: finding.observed, expected: finding.expected, deviation: finding.deviation,
      } : {}),
    },
    unitSummaries: scopedSummaries(finding, rule.ScopeUnitID, evidence),
    evidence,
    limitations,
    provenance: { syntheticData: true, claim: 'DEMONSTRATION_DATA' },
  };
  const alert = {
    AlertID: candidateId(rule, utility, finding, analysisRun),
    AnalysisRunRef: String(analysisRun.AnalysisRunRef ?? analysisRun.AnalysisRunID),
    FindingType: utility.findingType,
    FindingBusinessID: finding.id,
    ScopeUnitID: rule.ScopeUnitID,
    Status: 'GENERATED', AlertVersion: 0, LastCommandID: null,
    Severity: severityScore[rule.Severity] ?? Number(finding.confidence) ?? 0.5,
    OriginalFindingJSON: canonicalStringify(JSON.parse(JSON.stringify(envelope))),
    MethodVersion: envelope.version,
    CreatedAt: now,
    SyntheticData: true,
  };
  return { matched: true, alert };
}

import { fail } from './errors.mjs';
import { isValidUtilityRecipientRoles } from '../utilities/rule-contract.mjs';
import { provenanceFields } from './result-provenance.mjs';

const STATUSES = new Set(['GENERATED', 'ASSIGNED', 'ACKNOWLEDGED', 'CONCLUDED', 'CLOSED']);

const requireRead = (access) => {
  if (!access?.actions?.includes('READ_ALERT')) fail('FORBIDDEN_ACTION');
};

const parseFinding = (alert) => {
  try { return JSON.parse(alert.OriginalFindingJSON); } catch { fail('DATA_NOT_READY'); }
};

const classifyFinding = (finding) => {
  const hasRule = finding !== null && typeof finding === 'object' && Object.hasOwn(finding, 'rule');
  const hasUtility = finding !== null && typeof finding === 'object' && Object.hasOwn(finding, 'utility');
  if (!hasRule && !hasUtility) return 'LEGACY';
  return hasRule && hasUtility ? 'UTILITY' : 'MALFORMED_UTILITY';
};

const isIntendedRecipient = (access, finding) => {
  const classification = classifyFinding(finding);
  if (classification === 'LEGACY') return true;
  if (classification !== 'UTILITY') return false;
  return isValidUtilityRecipientRoles(finding.rule.recipientRoles)
    && finding.rule.recipientRoles.includes(access?.role);
};

const isCurrentUtilityAlert = async (repository, alert, finding) => {
  const classification = classifyFinding(finding);
  if (classification === 'LEGACY') return true;
  if (classification !== 'UTILITY') return false;
  const rule = await repository.getUtilityRule(finding.rule?.id);
  return Boolean(rule && rule.Enabled === true && rule.Version === finding.rule.version
    && rule.UtilityVersion === finding.utility?.version
    && Number(rule.ScopeUnitID) === Number(alert.ScopeUnitID));
};

export function createAlertServices({ repository }) {
  return Object.freeze({
    async listAlerts({ access, query = {} }) {
      requireRead(access);
      if (query.status !== undefined && !STATUSES.has(query.status)) fail('INVALID_REQUEST');
      const items = [];
      for (const alert of await repository.listAlerts()) {
        if (!access.authorizedUnitIds.has(alert.ScopeUnitID)
          || (query.status !== undefined && alert.Status !== query.status)) continue;
        const finding = parseFinding(alert);
        if (!isIntendedRecipient(access, finding)) continue;
        if (!await isCurrentUtilityAlert(repository, alert, finding)) continue;
        items.push({
          id: alert.AlertID, type: finding.method, title: finding.title,
          status: alert.Status, version: alert.AlertVersion, scopeUnitId: alert.ScopeUnitID,
          confidence: finding.confidence, severity: alert.Severity ?? finding.confidence,
          createdAt: alert.CreatedAt, recommendation: finding.recommendation,
          syntheticData: alert.SyntheticData === true,
        });
      }
      return { data: { items }, ...provenanceFields(items) };
    },
    async getAlertDetail({ access, params }) {
      requireRead(access);
      const alert = await repository.getAlert(params?.alertId);
      if (!alert || !access.authorizedUnitIds.has(alert.ScopeUnitID)) fail('NOT_FOUND');
      const finding = parseFinding(alert);
      if (!isIntendedRecipient(access, finding)) fail('NOT_FOUND');
      if (!await isCurrentUtilityAlert(repository, alert, finding)) fail('NOT_FOUND');
      const evidence = (finding.evidence ?? []).filter(({ unitId }) => access.authorizedUnitIds.has(unitId));
      const data = {
          id: alert.AlertID, status: alert.Status, version: alert.AlertVersion,
          title: finding.title, recommendation: finding.recommendation,
          explanation: {
            method: finding.method, methodVersion: finding.version,
            confidence: finding.confidence, components: finding.componentSummary,
          },
          observation: (finding.unitSummaries ?? [])
            .filter(({ unitId }) => access.authorizedUnitIds.has(unitId)), evidence,
          limitations: finding.limitations ?? [],
          ...(finding.utility && finding.rule && finding.analysisRun ? {
            evaluation: {
              utilityKey: finding.utility.key, ruleId: finding.rule.id,
              ruleVersion: finding.rule.version, analysisRunId: finding.analysisRun.id,
              runGroupId: finding.analysisRun.runGroupId,
            },
          } : {}),
          ...(finding.provenance ? { provenance: finding.provenance } : {}),
          originalFinding: { status: 'IMMUTABLE', hashSource: 'OriginalFindingJSON' },
          syntheticData: alert.SyntheticData === true,
        };
      return { data, ...provenanceFields([data]) };
    },
  });
}

import { fail } from './errors.mjs';

const STATUSES = new Set(['GENERATED', 'ASSIGNED', 'ACKNOWLEDGED', 'CONCLUDED', 'CLOSED']);

const requireRead = (access) => {
  if (!access?.actions?.includes('READ_ALERT')) fail('FORBIDDEN_ACTION');
};

const parseFinding = (alert) => {
  try { return JSON.parse(alert.OriginalFindingJSON); } catch { fail('DATA_NOT_READY'); }
};

export function createAlertServices({ repository }) {
  return Object.freeze({
    async listAlerts({ access, query = {} }) {
      requireRead(access);
      if (query.status !== undefined && !STATUSES.has(query.status)) fail('INVALID_REQUEST');
      const items = (await repository.listAlerts())
        .filter((alert) => access.authorizedUnitIds.has(alert.ScopeUnitID))
        .filter((alert) => query.status === undefined || alert.Status === query.status)
        .map((alert) => {
          const finding = parseFinding(alert);
          return {
            id: alert.AlertID, type: finding.method, title: finding.title,
            status: alert.Status, version: alert.AlertVersion, scopeUnitId: alert.ScopeUnitID,
            confidence: finding.confidence, severity: alert.Severity ?? finding.confidence,
            createdAt: alert.CreatedAt, recommendation: finding.recommendation,
            syntheticData: alert.SyntheticData === true,
          };
        });
      return { data: { items }, syntheticData: true };
    },
    async getAlertDetail({ access, params }) {
      requireRead(access);
      const alert = await repository.getAlert(params?.alertId);
      if (!alert || !access.authorizedUnitIds.has(alert.ScopeUnitID)) fail('NOT_FOUND');
      const finding = parseFinding(alert);
      const evidence = (finding.evidence ?? []).filter(({ unitId }) => access.authorizedUnitIds.has(unitId));
      return {
        data: {
          id: alert.AlertID, status: alert.Status, version: alert.AlertVersion,
          title: finding.title, recommendation: finding.recommendation,
          explanation: {
            method: finding.method, methodVersion: finding.version,
            confidence: finding.confidence, components: finding.componentSummary,
          },
          observation: finding.unitSummaries ?? [], evidence,
          limitations: finding.limitations ?? [],
          originalFinding: { status: 'IMMUTABLE', hashSource: 'OriginalFindingJSON' },
          syntheticData: alert.SyntheticData === true,
        },
        syntheticData: true,
      };
    },
  });
}

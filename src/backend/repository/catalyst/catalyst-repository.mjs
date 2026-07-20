import { selectCurrentRunGroup } from '../../refresh/run-groups.mjs';
import { fail } from '../../services/errors.mjs';
import { readPagedRows } from './paged-table.mjs';
import { mapCatalystRow } from './row-mapper.mjs';

const TABLES = Object.freeze({
  runs: 'INT_AnalysisRun', features: 'TRN_CaseFeature', patterns: 'INT_Pattern',
  hotspots: 'INT_Hotspot', anomalies: 'INT_Anomaly', areaRisks: 'INT_AreaRisk',
  evidence: 'INT_FindingEvidence', nodes: 'INT_NetworkNode', edges: 'INT_NetworkEdge',
  repeatSignals: 'INT_RepeatOffenderSignal', districtContexts: 'TRN_DistrictContext',
  profiles: 'CFG_UserAccess', units: 'SRC_Unit', alerts: 'WF_Alert',
  assignments: 'WF_Assignment', commands: 'WF_Command',
});

const clone = value => value === undefined ? undefined : structuredClone(value);
const decodePage = (token) => {
  if (!token) return 0;
  try {
    const value = JSON.parse(Buffer.from(token, 'base64url').toString('utf8'));
    if (!Number.isInteger(value.offset) || value.offset < 0) throw new Error('invalid');
    return value.offset;
  } catch {
    fail('INVALID_REQUEST', 'Invalid pagination token.');
  }
};
const encodePage = offset => Buffer.from(JSON.stringify({ offset })).toString('base64url');

function page(rows, { limit = 50, nextToken } = {}) {
  const bounded = Math.max(1, Math.min(200, Number(limit) || 50));
  const offset = decodePage(nextToken);
  const data = rows.slice(offset, offset + bounded);
  const nextOffset = offset + data.length;
  return { data: clone(data), nextToken: nextOffset < rows.length ? encodePage(nextOffset) : null };
}

function parseJson(text, fallback = {}) {
  if (text === null || text === undefined || text === '') return clone(fallback);
  try { return JSON.parse(text); } catch { fail('DATA_NOT_READY', 'Persisted intelligence JSON is invalid.'); }
}

function limitations(text) {
  return typeof text === 'string' && text ? text.split('|').filter(Boolean) : [];
}

function stripRun(row) {
  return mapCatalystRow(row);
}

export class CatalystIntelligenceRepository {
  #datastore;
  #cache = new Map();

  constructor({ application }) {
    if (!application || typeof application.datastore !== 'function') throw new TypeError('Authorized Catalyst application is required.');
    this.#datastore = application.datastore();
  }

  async #read(tableName) {
    if (!Object.values(TABLES).includes(tableName)) throw new TypeError('Table is not allowlisted.');
    if (!this.#cache.has(tableName)) {
      this.#cache.set(tableName, readPagedRows({
        table: this.#datastore.table(tableName), maxRows: 200, maxPages: 50,
      }).then(result => result.rows.map(row => mapCatalystRow(row, { includeRowId: true }))));
    }
    return clone(await this.#cache.get(tableName));
  }

  async #current() {
    const group = selectCurrentRunGroup(await this.#read(TABLES.runs));
    if (!group) return undefined;
    return group;
  }

  async #currentRunRef(type) {
    const group = await this.#current();
    return group?.runs.find(row => row.AnalysisType === type)?.ROWID;
  }

  async getCurrentRunGroup() {
    const group = await this.#current();
    if (!group) return undefined;
    return { ...group, runs: group.runs.map(stripRun) };
  }

  async listAnalysisRuns() {
    return (await this.#read(TABLES.runs)).map(stripRun);
  }

  async getBrief() {
    const [features, patterns, hotspots, anomalies] = await Promise.all([
      this.#read(TABLES.features), this.#currentRows(TABLES.patterns, 'PATTERN'),
      this.#currentRows(TABLES.hotspots, 'HOTSPOT'), this.#currentRows(TABLES.anomalies, 'ANOMALY'),
    ]);
    return {
      activeCaseCount: new Set(features.map(row => String(row.SourceCaseMasterID))).size, patternCount: patterns.length,
      hotspotCount: hotspots.length, anomalyCount: anomalies.length, syntheticData: true,
    };
  }

  async #currentRows(tableName, analysisType) {
    const ref = await this.#currentRunRef(analysisType);
    return ref ? (await this.#read(tableName)).filter(row => String(row.AnalysisRunRef) === String(ref)) : [];
  }

  #pattern(row) {
    const domain = parseJson(row.SignalComponentsJSON, {});
    return {
      ...domain, id: row.PatternID, title: row.Title, confidence: row.Confidence,
      recommendation: row.Recommendation, version: row.MethodVersion,
      limitations: domain.limitations ?? limitations(row.Limitation), synthetic: row.SyntheticData === true,
    };
  }

  async listPatterns(options = {}) {
    const rows = await this.#currentRows(TABLES.patterns, 'PATTERN');
    return page(rows.map(row => this.#pattern(row)).sort((left, right) => left.id.localeCompare(right.id)), options);
  }

  async getPattern(id) {
    const row = (await this.#currentRows(TABLES.patterns, 'PATTERN')).find(item => item.PatternID === id);
    if (!row) return undefined;
    const pattern = this.#pattern(row);
    const evidence = (await this.#read(TABLES.evidence))
      .filter(item => String(item.AnalysisRunRef) === String(row.AnalysisRunRef)
        && item.FindingType === 'PATTERN' && item.FindingBusinessID === id)
      .map(item => parseJson(item.EvidenceSummary, {
        caseId: item.SourceBusinessID, evidenceLabel: item.EvidenceLabel,
      }));
    return { ...pattern, evidence };
  }

  async listHotspots(options = {}) {
    const rows = await this.#currentRows(TABLES.hotspots, 'HOTSPOT');
    return page(rows.map(row => ({
      id: row.HotspotID, areaId: row.AreaID,
      centroid: { latitude: row.CentroidLatitude, longitude: row.CentroidLongitude },
      magnitude: row.CaseCount, confidence: row.Severity, method: 'HAVERSINE_DBSCAN',
      version: row.MethodVersion, limitations: limitations(row.Limitation), synthetic: row.SyntheticData === true,
    })).sort((left, right) => left.id.localeCompare(right.id)), options);
  }

  async listAnomalies(options = {}) {
    const rows = await this.#currentRows(TABLES.anomalies, 'ANOMALY');
    return page(rows.map(row => ({
      id: row.AnomalyID, seriesId: row.AreaID, method: row.SignalType,
      observed: row.ObservedValue, expected: row.BaselineValue,
      deviation: row.ObservedValue - row.BaselineValue, isAnomaly: true,
      confidence: row.Severity, version: row.MethodVersion,
      limitations: limitations(row.Limitation), synthetic: row.SyntheticData === true,
    })).sort((left, right) => left.id.localeCompare(right.id)), options);
  }

  async getAreaRisk() {
    const row = (await this.#currentRows(TABLES.areaRisks, 'AREA_RISK'))[0];
    if (!row) return undefined;
    const domain = parseJson(row.ComponentsJSON, {});
    return {
      ...domain, score: row.Score, components: domain.components ?? domain,
      version: row.MethodVersion, limitations: domain.limitations ?? limitations(row.Limitation),
      synthetic: row.SyntheticData === true,
    };
  }

  async getNetwork(id) {
    const runRef = await this.#currentRunRef('NETWORK');
    if (!runRef) return undefined;
    const nodes = (await this.#read(TABLES.nodes)).filter(row => String(row.AnalysisRunRef) === String(runRef));
    const target = nodes.find(row => row.SourceBusinessID === id);
    if (!target) return undefined;
    const nodeByRef = new Map(nodes.map(row => [String(row.ROWID), row]));
    const edges = (await this.#read(TABLES.edges))
      .filter(row => String(row.AnalysisRunRef) === String(runRef)
        && (String(row.FromNodeRef) === String(target.ROWID) || String(row.ToNodeRef) === String(target.ROWID)))
      .map(row => {
        const persisted = parseJson(row.EvidenceLabel, {});
        return {
          ...persisted,
          from: nodeByRef.get(String(row.FromNodeRef))?.SourceBusinessID,
          to: nodeByRef.get(String(row.ToNodeRef))?.SourceBusinessID,
          type: row.EdgeType, confidence: row.Weight, synthetic: row.SyntheticData === true,
        };
      });
    const identityRef = await this.#currentRunRef('IDENTITY_RESOLUTION');
    const repeat = (await this.#read(TABLES.repeatSignals)).find(row => String(row.AnalysisRunRef) === String(identityRef)
      && row.CanonicalPersonKey === id);
    const repeatEvidence = repeat ? parseJson(repeat.EvidenceJSON, {}) : {};
    return {
      node: { id: target.SourceBusinessID, type: target.NodeType, synthetic: target.SyntheticData === true },
      edges, method: 'EVIDENCE_GRAPH', version: target.MethodVersion,
      evidenceCaseIds: repeatEvidence.evidenceCaseIds ?? [...new Set(edges.map(edge => edge.sourceCaseId).filter(Boolean))],
      repeatAppearanceCount: repeat?.CaseCount ?? 0,
      confidence: repeat?.Confidence ?? 1,
      limitations: repeat ? limitations(repeat.Limitation) : ['LINK_IS_INVESTIGATIVE_SIGNAL_NOT_PROOF'],
      synthetic: true,
    };
  }

  async getDistrictContext(unitId) {
    return (await this.#read(TABLES.districtContexts))
      .filter(row => !unitId || Number(row.UnitID) === Number(unitId))
      .map(row => parseJson(row.IndicatorsJSON, {
        unitId: Number(row.UnitID), sourceLabel: row.SourceLabel, limitation: row.Limitation, synthetic: true,
      }));
  }

  async getAccessProfile(userId) {
    const row = (await this.#read(TABLES.profiles)).find(item => String(item.CatalystUserID) === String(userId));
    if (!row) return undefined;
    const { ROWID, AccessProfileID, ...profile } = row;
    return profile;
  }

  async getUnits() {
    return (await this.#read(TABLES.units)).map(({
      ROWID, SourceBatchRef, SourceFileName, SourceRowNumber, SourceSchemaVersion,
      IsSynthetic, SourceRecordHash, ValidationStatus, UnitTypeRef, ParentUnitRef,
      StateRef, DistrictRef, ...unit
    }) => unit);
  }

  async getAlert(alertId) {
    const row = (await this.#read(TABLES.alerts)).find(item => item.AlertID === alertId);
    if (!row) return undefined;
    const command = row.LastCommandRef
      ? (await this.#read(TABLES.commands)).find(item => String(item.ROWID) === String(row.LastCommandRef))
      : undefined;
    return {
      AlertID: row.AlertID, PatternID: row.FindingBusinessID, ScopeUnitID: row.ScopeUnitID,
      Status: row.Status, AlertVersion: row.AlertVersion, LastCommandID: command?.CommandID ?? null,
      OriginalFindingJSON: row.OriginalFindingJSON, SyntheticData: row.SyntheticData === true,
    };
  }

  async getAssignmentsForAlert(alertId) {
    return (await this.#effectiveAssignments()).filter(row => row.AlertID === alertId);
  }

  async getAssignmentsForEmployee(employeeId) {
    return (await this.#effectiveAssignments())
      .filter(row => Number(row.AssignedEmployeeID) === Number(employeeId));
  }

  async #effectiveAssignments() {
    const [assignments, alerts, commands] = await Promise.all([
      this.#read(TABLES.assignments), this.#read(TABLES.alerts), this.#read(TABLES.commands),
    ]);
    const alertByRef = new Map(alerts.map(row => [String(row.ROWID), row]));
    const commandByRef = new Map(commands.map(row => [String(row.ROWID), row]));
    return assignments.flatMap(row => {
      const alert = alertByRef.get(String(row.AlertRef));
      const command = commandByRef.get(String(row.CommandRef));
      if (!alert || command?.Status !== 'COMPLETED') return [];
      return [{
        AssignmentID: row.AssignmentID, AlertID: alert.AlertID, CommandID: command.CommandID,
        AssignedUnitID: row.AssignedUnitID, AssignedEmployeeID: row.AssignedEmployeeID,
        AssignedByEmployeeID: row.AssignedByEmployeeID, Reason: row.Reason,
        AuthorizedUnitIDs: parseJson(row.AuthorizedUnitIDsJSON, []),
        AuthorizedCaseIDs: parseJson(row.AuthorizedCaseIDsJSON, []),
        EvidenceAccessLevel: row.EvidenceAccessLevel, AssignedAt: row.AssignedAt,
        SyntheticData: row.SyntheticData === true,
      }];
    });
  }
}

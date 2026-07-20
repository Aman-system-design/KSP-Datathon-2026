import { selectCurrentRunGroup } from '../../refresh/run-groups.mjs';
import { randomUUID } from 'node:crypto';
import { buildAlertCompareAndSwap } from '../zcql-cas.mjs';
import { fail } from '../../services/errors.mjs';
import { readPagedRows } from './paged-table.mjs';
import { mapCatalystRow } from './row-mapper.mjs';
import { sanitizeCatalystSdkError } from './sdk-errors.mjs';
import { createCatalystSourceWriter } from './source-writer.mjs';

const TABLES = Object.freeze({
  runs: 'INT_AnalysisRun', features: 'TRN_CaseFeature', locations: 'TRN_LocationFeature',
  personResolutions: 'TRN_PersonResolution', patterns: 'INT_Pattern',
  hotspots: 'INT_Hotspot', anomalies: 'INT_Anomaly', areaRisks: 'INT_AreaRisk',
  evidence: 'INT_FindingEvidence', nodes: 'INT_NetworkNode', edges: 'INT_NetworkEdge',
  repeatSignals: 'INT_RepeatOffenderSignal', districtContexts: 'TRN_DistrictContext',
  profiles: 'CFG_UserAccess', units: 'SRC_Unit', alerts: 'WF_Alert',
  assignments: 'WF_Assignment', commands: 'WF_Command',
  conclusions: 'WF_AnalystConclusion', outcomes: 'WF_Outcome', audits: 'WF_AuditEvent',
});
const BUSINESS_ID = Object.freeze({
  INT_AnalysisRun: 'AnalysisRunID', TRN_CaseFeature: 'CaseFeatureID', TRN_LocationFeature: 'LocationFeatureID',
  TRN_DistrictContext: 'DistrictContextID', INT_Pattern: 'PatternID', INT_FindingEvidence: 'FindingEvidenceID',
  INT_Hotspot: 'HotspotID', INT_Anomaly: 'AnomalyID', INT_AreaRisk: 'AreaRiskID',
  INT_NetworkNode: 'NetworkNodeID', INT_NetworkEdge: 'NetworkEdgeID',
  INT_RepeatOffenderSignal: 'RepeatSignalID', WF_Alert: 'AlertID',
});
const SOURCE_TABLES = Object.freeze({
  CaseMaster: 'SRC_CaseMaster', ComplainantDetails: 'SRC_ComplainantDetails', ActSectionAssociation: 'SRC_ActSectionAssociation',
  Victim: 'SRC_Victim', Accused: 'SRC_Accused', ArrestSurrender: 'SRC_ArrestSurrender', Act: 'SRC_Act', Section: 'SRC_Section',
  CrimeHeadActSection: 'SRC_CrimeHeadActSection', CrimeHead: 'SRC_CrimeHead', CrimeSubHead: 'SRC_CrimeSubHead',
  CasteMaster: 'SRC_CasteMaster', ReligionMaster: 'SRC_ReligionMaster', OccupationMaster: 'SRC_OccupationMaster',
  CaseStatusMaster: 'SRC_CaseStatusMaster', Court: 'SRC_Court', District: 'SRC_District', State: 'SRC_State', Unit: 'SRC_Unit',
  UnitType: 'SRC_UnitType', Rank: 'SRC_Rank', Designation: 'SRC_Designation', Employee: 'SRC_Employee',
  CaseCategory: 'SRC_CaseCategory', GravityOffence: 'SRC_GravityOffence', ChargesheetDetails: 'SRC_ChargesheetDetails',
});
const CONTROL_TABLES = Object.freeze(['TRN_IngestionBatch', 'TRN_RejectedRecord', 'TRN_SourceKeyMap']);
const ALLOWED_TABLES = new Set([...Object.values(TABLES), ...Object.values(SOURCE_TABLES), ...CONTROL_TABLES]);

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
  #zcql;
  #sourceManifest;
  #sourceWriter;
  #cache = new Map();

  constructor({ application, sourceManifest, clock, idFactory = () => randomUUID() }) {
    if (!application || typeof application.datastore !== 'function') throw new TypeError('Authorized Catalyst application is required.');
    this.#datastore = application.datastore();
    this.#zcql = typeof application.zcql === 'function' ? application.zcql() : null;
    this.#sourceManifest = sourceManifest;
    if (sourceManifest) {
      this.#sourceWriter = createCatalystSourceWriter({
        datastore: this.#datastore, manifest: sourceManifest, clock, idFactory,
        findBatch: batchKey => this.#findSourceBatch(batchKey),
        loadValidatedSource: batchKey => this.getValidatedSource(batchKey),
      });
    }
  }

  async #read(tableName) {
    if (!ALLOWED_TABLES.has(tableName)) throw new TypeError('Table is not allowlisted.');
    if (!this.#cache.has(tableName)) {
      this.#cache.set(tableName, readPagedRows({
        table: this.#datastore.table(tableName), maxRows: 200, maxPages: 50,
      }).then(result => result.rows.map(row => mapCatalystRow(row, { includeRowId: true }))));
    }
    return clone(await this.#cache.get(tableName));
  }

  #invalidate(...tableNames) {
    for (const tableName of tableNames) this.#cache.delete(tableName);
  }

  async #insert(tableName, row) {
    try {
      const response = await this.#datastore.table(tableName).insertRow(row);
      this.#invalidate(tableName);
      return response?.data && !Array.isArray(response.data) ? response.data : response;
    } catch (error) {
      this.#invalidate(tableName);
      if (/DUPLICATE|UNIQUE|ALREADY_EXISTS/iu.test(String(error?.code ?? ''))) {
        const conflict = new Error('Catalyst unique constraint conflict.'); conflict.code = 'UNIQUE_CONFLICT'; throw conflict;
      }
      throw sanitizeCatalystSdkError(error, { operation: `INSERT_${tableName}` });
    }
  }

  async #update(tableName, row) {
    try {
      const response = await this.#datastore.table(tableName).updateRow(row);
      this.#invalidate(tableName);
      return response?.data && !Array.isArray(response.data) ? response.data : response;
    } catch (error) {
      this.#invalidate(tableName);
      throw sanitizeCatalystSdkError(error, { operation: `UPDATE_${tableName}` });
    }
  }

  async #insertMany(tableName, rows) {
    const inserted = [];
    for (let offset = 0; offset < rows.length; offset += 200) {
      const batch = rows.slice(offset, offset + 200);
      try {
        const response = await this.#datastore.table(tableName).insertRows(batch);
        const values = Array.isArray(response) ? response : response?.data;
        if (!Array.isArray(values) || values.length !== batch.length) throw new Error('Unexpected Catalyst bulk insert response.');
        inserted.push(...values);
      } catch (error) {
        this.#invalidate(tableName);
        if (/DUPLICATE|UNIQUE|ALREADY_EXISTS/iu.test(String(error?.code ?? ''))) {
          const conflict = new Error('Catalyst unique constraint conflict.'); conflict.code = 'UNIQUE_CONFLICT'; throw conflict;
        }
        throw sanitizeCatalystSdkError(error, { operation: `INSERT_MANY_${tableName}` });
      }
    }
    this.#invalidate(tableName);
    return inserted;
  }

  async #ensureMany(tableName, rows) {
    if (rows.length === 0) return [];
    try { return await this.#insertMany(tableName, rows); }
    catch (error) {
      if (error.code !== 'UNIQUE_CONFLICT') throw error;
      const idColumn = BUSINESS_ID[tableName];
      if (!idColumn) throw error;
      const existing = await this.#read(tableName);
      const byId = new Map(existing.map(row => [String(row[idColumn]), row]));
      const result = [];
      for (const row of rows) {
        let stored = byId.get(String(row[idColumn]));
        if (!stored) {
          try { stored = await this.#insert(tableName, row); }
          catch (insertError) {
            if (insertError.code !== 'UNIQUE_CONFLICT') throw insertError;
            this.#invalidate(tableName);
            stored = (await this.#read(tableName)).find(item => String(item[idColumn]) === String(row[idColumn]));
          }
        }
        if (!stored) fail('DATA_NOT_READY', `Unable to reconcile ${tableName}.`);
        result.push(stored);
      }
      return result;
    }
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

  async #alertRow(alertId) {
    return (await this.#read(TABLES.alerts)).find(row => row.AlertID === alertId);
  }

  async #commandRow(commandId) {
    return (await this.#read(TABLES.commands)).find(row => row.CommandID === commandId);
  }

  async #mapCommand(row) {
    if (!row) return undefined;
    const alert = (await this.#read(TABLES.alerts)).find(item => String(item.ROWID) === String(row.AlertRef));
    return {
      CommandID: row.CommandID, IdempotencyKeyHash: row.IdempotencyKeyHash,
      RequestHash: row.RequestHash, AlertID: alert?.AlertID,
      ActorCatalystUserID: row.ActorCatalystUserID, EffectiveRole: row.EffectiveRole,
      CommandType: row.CommandType, ExpectedAlertState: row.ExpectedAlertState,
      ExpectedAlertVersion: row.ExpectedAlertVersion, TargetAlertState: row.TargetAlertState,
      Status: row.Status, ResponseJSON: row.ResponseJSON, ErrorCode: row.ErrorCode,
      CreatedAt: row.CreatedAt, CompletedAt: row.CompletedAt, SyntheticData: row.SyntheticData === true,
    };
  }

  async createCommand(command) {
    const alert = await this.#alertRow(command.AlertID);
    if (!alert) fail('NOT_FOUND');
    const { AlertID, ...values } = command;
    await this.#insert(TABLES.commands, { ...values, AlertRef: String(alert.ROWID) });
    return clone(command);
  }

  async getCommand(commandId) {
    return this.#mapCommand(await this.#commandRow(commandId));
  }

  async getCommandByIdempotencyHash(hash) {
    const row = (await this.#read(TABLES.commands)).find(item => item.IdempotencyKeyHash === hash);
    return this.#mapCommand(row);
  }

  async updateCommand(commandId, changes) {
    const row = await this.#commandRow(commandId);
    if (!row) return undefined;
    await this.#update(TABLES.commands, { ...row, ...clone(changes) });
    return this.getCommand(commandId);
  }

  #artifactTable(kind) {
    const table = { assignment: TABLES.assignments, conclusion: TABLES.conclusions, outcome: TABLES.outcomes }[kind];
    if (!table) throw new TypeError(`Unsupported artifact kind: ${kind}`);
    return table;
  }

  async insertDomainArtifact(kind, artifact) {
    const [alert, command] = await Promise.all([this.#alertRow(artifact.AlertID), this.#commandRow(artifact.CommandID)]);
    if (!alert || !command) fail('DATA_NOT_READY');
    const { AlertID, CommandID, ...values } = artifact;
    await this.#insert(this.#artifactTable(kind), {
      ...values, AlertRef: String(alert.ROWID), CommandRef: String(command.ROWID),
    });
    return clone(artifact);
  }

  async findDomainArtifactByCommand(kind, commandId) {
    const command = await this.#commandRow(commandId);
    if (!command) return undefined;
    const row = (await this.#read(this.#artifactTable(kind)))
      .find(item => String(item.CommandRef) === String(command.ROWID));
    if (!row) return undefined;
    const alert = (await this.#read(TABLES.alerts)).find(item => String(item.ROWID) === String(row.AlertRef));
    const { ROWID, AlertRef, CommandRef, ...values } = row;
    return { ...values, AlertID: alert?.AlertID, CommandID: command.CommandID };
  }

  async compareAndSwapAlert({ alertId, expectedState, expectedVersion, targetState, commandId }) {
    if (!this.#zcql || typeof this.#zcql.executeZCQLQuery !== 'function') throw new TypeError('Catalyst ZCQL is required.');
    const [alert, command] = await Promise.all([this.#alertRow(alertId), this.#commandRow(commandId)]);
    if (!alert || !command) return { matched: 0 };
    const query = buildAlertCompareAndSwap({
      alertRowId: alert.ROWID, commandRowId: command.ROWID,
      expectedState, expectedVersion, targetState,
    });
    try { await this.#zcql.executeZCQLQuery(query); }
    catch (error) {
      this.#invalidate(TABLES.alerts);
      throw sanitizeCatalystSdkError(error, { operation: 'ALERT_COMPARE_AND_SWAP' });
    }
    this.#invalidate(TABLES.alerts);
    const updated = await this.getAlert(alertId);
    const matched = updated?.Status === targetState && updated.AlertVersion === expectedVersion + 1
      && updated.LastCommandID === commandId;
    return matched ? { matched: 1, alert: updated } : { matched: 0 };
  }

  async appendAuditEvent(event) {
    const [alert, command] = await Promise.all([this.#alertRow(event.AlertID), this.#commandRow(event.CommandID)]);
    if (!alert || !command) fail('DATA_NOT_READY');
    const { AlertID, CommandID, ...values } = event;
    await this.#insert(TABLES.audits, {
      ...values, AlertRef: String(alert.ROWID), CommandRef: String(command.ROWID),
    });
    return clone(event);
  }

  async #mapAudit(row) {
    const [alert, command] = await Promise.all([
      (await this.#read(TABLES.alerts)).find(item => String(item.ROWID) === String(row.AlertRef)),
      (await this.#read(TABLES.commands)).find(item => String(item.ROWID) === String(row.CommandRef)),
    ]);
    const { ROWID, AlertRef, CommandRef, ...values } = row;
    return { ...values, AlertID: alert?.AlertID, CommandID: command?.CommandID };
  }

  async findAuditByCommand(commandId) {
    const command = await this.#commandRow(commandId);
    if (!command) return undefined;
    const row = (await this.#read(TABLES.audits)).find(item => String(item.CommandRef) === String(command.ROWID));
    return row ? this.#mapAudit(row) : undefined;
  }

  async getAuditStream(streamId) {
    const rows = (await this.#read(TABLES.audits))
      .filter(row => row.StreamID === streamId).sort((left, right) => left.StreamSequence - right.StreamSequence);
    return Promise.all(rows.map(row => this.#mapAudit(row)));
  }

  async listCommands() {
    return Promise.all((await this.#read(TABLES.commands)).map(row => this.#mapCommand(row)));
  }

  async listAuditEvents() {
    return Promise.all((await this.#read(TABLES.audits)).map(row => this.#mapAudit(row)));
  }

  async reconcileCommand(commandId) {
    const command = await this.getCommand(commandId);
    if (!command) return undefined;
    return {
      command,
      assignment: await this.findDomainArtifactByCommand('assignment', commandId),
      conclusion: await this.findDomainArtifactByCommand('conclusion', commandId),
      outcome: await this.findDomainArtifactByCommand('outcome', commandId),
      audit: await this.findAuditByCommand(commandId),
      alert: await this.getAlert(command.AlertID),
    };
  }

  async #findSourceBatch(batchKey) {
    return (await this.#read('TRN_IngestionBatch')).find(row => row.BatchID === batchKey);
  }

  async persistValidatedSource(input) {
    if (!this.#sourceWriter) throw new TypeError('Catalyst source manifest is required.');
    const result = await this.#sourceWriter.persistValidatedSource(input);
    this.#invalidate('TRN_IngestionBatch', 'TRN_RejectedRecord', 'TRN_SourceKeyMap', ...Object.values(SOURCE_TABLES));
    return result;
  }

  async getValidatedSource(batchKey) {
    if (!this.#sourceManifest) return undefined;
    const batch = await this.#findSourceBatch(batchKey);
    if (!batch || batch.Status !== 'COMPLETED') return undefined;
    const accepted = {};
    for (const [sourceName, tableName] of Object.entries(SOURCE_TABLES)) {
      const table = this.#sourceManifest.tables.find(item => item.name === tableName);
      const pdfColumns = table.columns.filter(column => column.origin === 'PDF').map(column => column.name);
      accepted[sourceName] = (await this.#read(tableName))
        .filter(row => String(row.SourceBatchRef) === String(batch.ROWID))
        .map(row => Object.fromEntries(pdfColumns.map(column => [column, clone(row[column])])));
    }
    const rejected = (await this.#read('TRN_RejectedRecord'))
      .filter(row => String(row.BatchRef) === String(batch.ROWID))
      .map(row => ({ table: row.SourceEntity, reasonCode: row.ReasonCode, reasonDetail: row.ReasonDetail }));
    return {
      batchKey, accepted, rejected,
      reconciliation: {
        sourceRows: batch.SourceRowCount, acceptedRows: batch.AcceptedRowCount,
        rejectedRows: batch.RejectedRowCount, balanced: batch.SourceRowCount === batch.AcceptedRowCount + batch.RejectedRowCount,
      },
      syntheticData: batch.IsSynthetic === true,
    };
  }

  async getRefreshBatch(batchKey) {
    const rows = (await this.#read(TABLES.runs)).filter(row => row.BatchKey === batchKey);
    if (rows.length === 0) return undefined;
    if (rows.length !== 7 || rows.some(row => row.Status === 'STAGING')) return undefined;
    const runs = rows.map(stripRun);
    const ref = type => rows.find(row => row.AnalysisType === type)?.ROWID;
    const [features, hotspots, anomalies, patterns, repeatSignals, edges, areaRisks] = await Promise.all([
      this.#read(TABLES.features).then(values => values.filter(row => String(row.CaseFeatureID).startsWith(`CF-${batchKey}-`))),
      this.#read(TABLES.hotspots).then(values => values.filter(row => String(row.AnalysisRunRef) === String(ref('HOTSPOT')))),
      this.#read(TABLES.anomalies).then(values => values.filter(row => String(row.AnalysisRunRef) === String(ref('ANOMALY')))),
      this.#read(TABLES.patterns).then(values => values.filter(row => String(row.AnalysisRunRef) === String(ref('PATTERN')))),
      this.#read(TABLES.repeatSignals).then(values => values.filter(row => String(row.AnalysisRunRef) === String(ref('IDENTITY_RESOLUTION')))),
      this.#read(TABLES.edges).then(values => values.filter(row => String(row.AnalysisRunRef) === String(ref('NETWORK')))),
      this.#read(TABLES.areaRisks).then(values => values.filter(row => String(row.AnalysisRunRef) === String(ref('AREA_RISK')))),
    ]);
    const completed = runs.length === 7 && runs.every(run => run.Status === 'COMPLETED'
      && run.PublishStatus === 'PUBLISHED' && typeof run.PublishedAt === 'string');
    return {
      BatchKey: batchKey, Operation: rows[0].Operation,
      Status: completed ? 'COMPLETED' : 'STAGED',
      Reconciliation: parseJson(rows[0].ReconciliationJSON, {}),
      Findings: {
        features, hotspots, anomalies, patterns, identityResolutions: repeatSignals,
        network: { edges }, areaRisk: areaRisks[0],
      },
      PublishedFindings: {},
      RunGroup: { RunGroupID: rows[0].RunGroupID, PublishedAt: completed ? rows[0].PublishedAt : null, runs },
      CreatedAt: rows[0].CompletedAt ?? rows[0].ObservationEnd,
      CompletedAt: completed ? rows[0].PublishedAt : null,
      SyntheticData: rows.every(row => row.SyntheticData === true),
    };
  }

  async createRefreshBatch(batch) {
    if (await this.getRefreshBatch(batch.BatchKey)) {
      const conflict = new Error('Refresh batch already exists.'); conflict.code = 'UNIQUE_CONFLICT'; throw conflict;
    }
    const reconciliation = JSON.stringify(batch.Reconciliation);
    const rows = batch.RunGroup.runs.map(run => ({
      ...clone(run), Status: 'STAGING', BatchKey: batch.BatchKey, Operation: batch.Operation,
      ReconciliationJSON: reconciliation,
      MethodVersion: run.MethodVersion ?? run.EngineVersion,
      CompletedAt: run.CompletedAt ?? batch.CreatedAt,
    }));
    const existingRuns = (await this.#read(TABLES.runs)).filter(row => row.BatchKey === batch.BatchKey);
    const insertedRuns = existingRuns.length > 0 ? existingRuns : await this.#ensureMany(TABLES.runs, rows);
    if (insertedRuns.length !== 7 || insertedRuns.some(row => row.RunGroupID !== batch.RunGroup.RunGroupID)) {
      fail('DATA_NOT_READY', 'Refresh staging rows are inconsistent.');
    }
    await this.#stageRefreshFindings(batch, insertedRuns);
    for (const run of insertedRuns) await this.#update(TABLES.runs, { ...run, Status: 'COMPLETED' });
    return this.getRefreshBatch(batch.BatchKey);
  }

  async #stageRefreshFindings(batch, runs) {
    const findings = batch.PublishedFindings ?? {};
    const runRef = type => {
      const run = runs.find(row => row.AnalysisType === type);
      if (!run?.ROWID) fail('DATA_NOT_READY', `Missing ${type} run ROWID.`);
      return String(run.ROWID);
    };
    const key = batch.BatchKey;
    const sourceCaseId = caseId => 200000000 + Number(String(caseId).match(/(\d+)$/u)?.[1] ?? 0);

    const features = findings.features ?? [];
    await this.#ensureMany(TABLES.features, features.map((feature, index) => ({
      CaseFeatureID: `CF-${key}-${index + 1}`, SourceCaseMasterID: sourceCaseId(feature.caseId),
      CrimeTypeCode: `${feature.crimeMajor}:${feature.crimeMinor}`,
      TimeFeaturesJSON: JSON.stringify({ incidentAt: feature.incidentAt, timeBand: feature.timeBand, hourSin: feature.hourSin, hourCos: feature.hourCos, ageDays: feature.ageDays }),
      LegalFeaturesJSON: JSON.stringify({ acts: feature.acts, sections: feature.sections, gravity: feature.gravity }),
      ModusOperandiTagsJSON: JSON.stringify({ briefFacts: feature.briefFacts }),
      QualityScore: feature.completeness, FeatureVersion: feature.featureVersion, SyntheticData: true,
    })));
    await this.#ensureMany(TABLES.locations, features.map((feature, index) => ({
      LocationFeatureID: `LF-${key}-${index + 1}`, SourceCaseMasterID: sourceCaseId(feature.caseId),
      Latitude: feature.latitude, Longitude: feature.longitude, AreaType: 'DISTRICT',
      AreaID: String(feature.districtId), FeatureVersion: feature.featureVersion, SyntheticData: true,
    })));

    await this.#ensureMany(TABLES.districtContexts, (findings.districtContexts ?? []).map((row, index) => ({
      DistrictContextID: `CTX-${key}-${index + 1}`, UnitID: row.unitId,
      PeriodStart: `${String(row.period).slice(0, 4)}-04-01`, PeriodEnd: `${String(row.period).slice(0, 4)}-06-30`,
      IndicatorsJSON: JSON.stringify(row), SourceLabel: row.sourceLabel,
      ContextVersion: row.correlation?.version ?? '1.0.0', Limitation: row.limitation, SyntheticData: true,
    })));

    const patterns = findings.patterns ?? [];
    await this.#ensureMany(TABLES.patterns, patterns.map(pattern => ({
      PatternID: pattern.id, AnalysisRunRef: runRef('PATTERN'), PatternType: pattern.method,
      Title: pattern.title, Confidence: pattern.confidence,
      SignalComponentsJSON: JSON.stringify(pattern), Recommendation: pattern.recommendation,
      MethodVersion: pattern.version, Limitation: (pattern.limitations ?? []).join('|'), SyntheticData: true,
    })));
    await this.#ensureMany(TABLES.evidence, patterns.flatMap((pattern, patternIndex) => (pattern.evidence ?? []).map((evidence, evidenceIndex) => ({
      FindingEvidenceID: `EVID-${key}-${patternIndex + 1}-${evidenceIndex + 1}`,
      AnalysisRunRef: runRef('PATTERN'), FindingType: 'PATTERN', FindingBusinessID: pattern.id,
      SourceEntity: 'CaseMaster', SourceBusinessID: evidence.caseId, EvidenceLabel: 'SOURCE_CASE',
      EvidenceSummary: JSON.stringify(evidence), MethodVersion: pattern.version, SyntheticData: true,
    }))));

    await this.#ensureMany(TABLES.hotspots, (findings.hotspots ?? []).map(hotspot => ({
      HotspotID: hotspot.id, AnalysisRunRef: runRef('HOTSPOT'),
      AreaID: String(Object.values(hotspot.evidenceUnits ?? {})[0] ?? 'UNKNOWN'),
      CentroidLatitude: hotspot.centroid.latitude, CentroidLongitude: hotspot.centroid.longitude,
      CaseCount: hotspot.magnitude, Severity: hotspot.confidence, MethodVersion: hotspot.version,
      Limitation: (hotspot.limitations ?? []).join('|'), SyntheticData: true,
    })));
    await this.#ensureMany(TABLES.anomalies, (findings.anomalies ?? []).filter(row => row.isAnomaly !== false).map(anomaly => ({
      AnomalyID: anomaly.id, AnalysisRunRef: runRef('ANOMALY'), AreaID: anomaly.seriesId,
      SignalType: anomaly.method, ObservedValue: anomaly.observed, BaselineValue: anomaly.expected,
      Severity: anomaly.confidence, MethodVersion: anomaly.version,
      Limitation: (anomaly.limitations ?? []).join('|'), SyntheticData: true,
    })));
    await this.#ensureMany(TABLES.areaRisks, (findings.areaRisks ?? []).map((risk, index) => ({
      AreaRiskID: `RISK-${key}-${index + 1}`, AnalysisRunRef: runRef('AREA_RISK'),
      AreaType: 'STATE', AreaID: 'KARNATAKA', PeriodStart: batch.RunGroup.runs[0].ObservationStart,
      PeriodEnd: batch.RunGroup.runs[0].ObservationEnd, Score: risk.score,
      Completeness: risk.inputs?.completeness ?? 0, ComponentsJSON: JSON.stringify(risk),
      MethodVersion: risk.version, Limitation: (risk.limitations ?? []).join('|'), SyntheticData: true,
    })));

    const networks = findings.networks ?? [];
    const nodeIds = new Set();
    for (const network of networks) {
      nodeIds.add(network.node.id);
      for (const edge of network.edges ?? []) { nodeIds.add(edge.from); nodeIds.add(edge.to); }
    }
    const nodeRows = [...nodeIds].sort().map((id, index) => ({
      NetworkNodeID: `NODE-${key}-${index + 1}`, AnalysisRunRef: runRef('NETWORK'),
      NodeType: id.startsWith('PERSON:') ? 'PERSON' : 'CASE', SourceEntity: id.startsWith('PERSON:') ? 'Accused' : 'CaseMaster',
      SourceBusinessID: id, EvidenceLabel: 'SOURCE_LINK', MethodVersion: '1.0.0', SyntheticData: true,
    }));
    const insertedNodes = await this.#ensureMany(TABLES.nodes, nodeRows);
    const nodeRef = new Map(insertedNodes.map(row => [row.SourceBusinessID, String(row.ROWID)]));
    const edges = new Map();
    for (const network of networks) for (const edge of network.edges ?? []) {
      edges.set(`${edge.from}|${edge.to}|${edge.type}|${edge.sourceCaseId}`, { edge, network });
    }
    await this.#ensureMany(TABLES.edges, [...edges.values()].map(({ edge, network }, index) => ({
      NetworkEdgeID: `EDGE-${key}-${index + 1}`, AnalysisRunRef: runRef('NETWORK'),
      FromNodeRef: nodeRef.get(edge.from), ToNodeRef: nodeRef.get(edge.to), EdgeType: edge.type,
      EvidenceLabel: edge.evidenceType ?? 'SOURCE_LINK', Weight: edge.confidence ?? 1,
      MethodVersion: network.version, Limitation: (network.limitations ?? []).join('|'), SyntheticData: true,
    })));
    await this.#ensureMany(TABLES.repeatSignals, networks
      .filter(network => network.node.id.startsWith('PERSON:') && network.repeatAppearanceCount > 1)
      .map((network, index) => ({
        RepeatSignalID: `REPEAT-${key}-${index + 1}`, AnalysisRunRef: runRef('IDENTITY_RESOLUTION'),
        CanonicalPersonKey: network.node.id, ResolutionStatus: 'CONFIRMED',
        CaseCount: network.repeatAppearanceCount, Confidence: network.confidence,
        EvidenceJSON: JSON.stringify({ evidenceCaseIds: network.evidenceCaseIds }),
        MethodVersion: network.version, Limitation: network.limitations.join('|'), SyntheticData: true,
      })));

    const patternRef = runRef('PATTERN');
    await this.#ensureMany(TABLES.alerts, (findings.alerts ?? []).map(alert => ({
      AlertID: alert.AlertID, AnalysisRunRef: patternRef, FindingType: 'PATTERN',
      FindingBusinessID: alert.PatternID, ScopeUnitID: alert.ScopeUnitID, Status: alert.Status,
      AlertVersion: alert.AlertVersion, LastCommandRef: null,
      Severity: patterns.find(pattern => pattern.id === alert.PatternID)?.confidence ?? 0,
      OriginalFindingJSON: alert.OriginalFindingJSON, MethodVersion: '1.0.0',
      CreatedAt: batch.CreatedAt, SyntheticData: true,
    })));
  }

  async updateRefreshBatch(batchKey, changes) {
    const rows = (await this.#read(TABLES.runs)).filter(row => row.BatchKey === batchKey);
    if (rows.length === 0) return undefined;
    for (const row of rows) {
      await this.#update(TABLES.runs, {
        ...row,
        Status: changes.Status ?? row.Status,
        ReconciliationJSON: changes.Reconciliation
          ? JSON.stringify(changes.Reconciliation) : row.ReconciliationJSON,
        CompletedAt: changes.CompletedAt ?? row.CompletedAt,
      });
    }
    return this.getRefreshBatch(batchKey);
  }

  async publishRefreshBatch(batchKey, publishedAt) {
    const existing = await this.getRefreshBatch(batchKey);
    if (!existing) return undefined;
    if (existing.Status === 'COMPLETED') return existing;
    const rows = (await this.#read(TABLES.runs)).filter(row => row.BatchKey === batchKey);
    if (rows.length !== 7) fail('DATA_NOT_READY', 'Refresh run group is incomplete.');
    for (const row of rows) {
      await this.#update(TABLES.runs, {
        ...row, Status: 'COMPLETED', PublishStatus: 'PUBLISHED',
        PublishedAt: publishedAt, CompletedAt: row.CompletedAt ?? publishedAt,
      });
    }
    const completed = await this.getRefreshBatch(batchKey);
    if (completed?.Status !== 'COMPLETED') fail('DATA_NOT_READY', 'Refresh publication is incoherent.');
    return completed;
  }
}

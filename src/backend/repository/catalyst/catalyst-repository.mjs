import { createHash, randomUUID } from 'node:crypto';
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
  reports: 'CFG_ReportDefinition', dashboards: 'CFG_Dashboard', dashboardItems: 'CFG_DashboardItem',
  contentShares: 'CFG_ContentShare', userPreferences: 'CFG_UserPreference',
  mapViews: 'CFG_MapView', mapViewVersions: 'CFG_MapViewVersion',
  assignments: 'WF_Assignment', commands: 'WF_Command',
  conclusions: 'WF_AnalystConclusion', outcomes: 'WF_Outcome', audits: 'WF_AuditEvent',
  alertNotes: 'WF_AlertNote', escalations: 'WF_Escalation',
  runRequests: 'OPS_IntelligenceRunRequest',
  publicationState: 'INT_PublicationState',
});
const BUSINESS_ID = Object.freeze({
  INT_AnalysisRun: 'AnalysisRunID', TRN_CaseFeature: 'CaseFeatureID', TRN_LocationFeature: 'LocationFeatureID',
  TRN_DistrictContext: 'DistrictContextID', INT_Pattern: 'PatternID', INT_FindingEvidence: 'FindingEvidenceID',
  INT_Hotspot: 'HotspotID', INT_Anomaly: 'AnomalyID', INT_AreaRisk: 'AreaRiskID',
  INT_NetworkNode: 'NetworkNodeID', INT_NetworkEdge: 'NetworkEdgeID',
  INT_RepeatOffenderSignal: 'RepeatSignalID', WF_Alert: 'AlertID',
  CFG_ReportDefinition: 'ReportDefinitionID', CFG_Dashboard: 'DashboardID',
  CFG_DashboardItem: 'DashboardItemID', CFG_ContentShare: 'ContentShareID',
  CFG_UserPreference: 'UserPreferenceID', CFG_MapView: 'MapViewID',
  CFG_MapViewVersion: 'MapViewVersionKey', WF_AlertNote: 'AlertNoteID', WF_Escalation: 'EscalationID',
  OPS_IntelligenceRunRequest: 'RunRequestID',
  INT_PublicationState: 'PublicationStateID',
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
const DATETIME_COLUMNS = Object.freeze({
  INT_AnalysisRun: ['ObservationStart', 'ObservationEnd', 'CompletedAt', 'PublishedAt'],
  INT_PublicationState: ['PublishedAt', 'LatestAttemptAt'],
  INT_AreaRisk: ['PeriodStart', 'PeriodEnd'],
  WF_Alert: ['CreatedAt'],
  WF_Command: ['CreatedAt', 'CompletedAt'],
  WF_Assignment: ['AssignedAt'],
  WF_AnalystConclusion: ['CreatedAt'],
  WF_Outcome: ['RecordedAt'],
  WF_AuditEvent: ['OccurredAt'],
  CFG_ReportDefinition: ['CreatedAt', 'UpdatedAt'], CFG_Dashboard: ['CreatedAt', 'UpdatedAt'],
  CFG_ContentShare: ['CreatedAt'], CFG_UserPreference: ['UpdatedAt'],
  CFG_MapView: ['CreatedAt', 'UpdatedAt'], CFG_MapViewVersion: ['PublishedAt', 'CreatedAt'],
  WF_AlertNote: ['CreatedAt'], WF_Escalation: ['EscalatedAt'],
  OPS_IntelligenceRunRequest: ['RequestedAt', 'StartedAt', 'CompletedAt', 'UpdatedAt'],
});

const RUN_REQUEST_TRANSITIONS = Object.freeze({
  QUEUED: new Set(['SUBMITTED', 'FAILED_RETRYABLE', 'FAILED_FINAL']),
  SUBMITTED: new Set(['RUNNING', 'FAILED_RETRYABLE', 'FAILED_FINAL']),
  RUNNING: new Set(['PUBLISHED', 'FAILED_RETRYABLE', 'FAILED_FINAL']),
  FAILED_RETRYABLE: new Set(['SUBMITTED']),
  PUBLISHED: new Set(), FAILED_FINAL: new Set(),
});

const clone = value => value === undefined ? undefined : structuredClone(value);
const positiveVersion = (value, name) => {
  if (!Number.isSafeInteger(value) || value < 1) throw new TypeError(`${name} must be a positive safe integer.`);
  return value;
};
const expectedVersionNumber = value => {
  if (!Number.isSafeInteger(value) || value < 0) throw new TypeError('expectedVersion must be a non-negative safe integer.');
  return value;
};
const safeId = (value, name, maxLength = 128) => {
  if (typeof value !== 'string' || value.length > maxLength || !/^[A-Za-z0-9][A-Za-z0-9._:-]*$/u.test(value)) {
    throw new TypeError(`${name} is invalid.`);
  }
  return value;
};
const decimalId = (value, name) => {
  if (typeof value === 'bigint' && value >= 0n) return value.toString();
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) return String(value);
  if (typeof value === 'string' && /^(0|[1-9]\d*)$/u.test(value)) return value;
  throw new TypeError(`${name} must be a canonical unsigned decimal ID.`);
};
const MAP_VIEW_VISIBILITIES = new Set(['PRIVATE', 'SHARED', 'ROLE_DEFAULT', 'ORGANIZATION_GLOBAL']);
const mapViewSummary = (version, current) => {
  const definition = JSON.parse(version.DefinitionJSON);
  const name = definition.name ?? current.Name;
  const visibility = definition.visibility ?? current.Visibility;
  if (typeof name !== 'string' || name.length < 1 || name.length > 128) throw new TypeError('Map view name is invalid.');
  if (!MAP_VIEW_VISIBILITIES.has(visibility)) throw new TypeError('Map view visibility is invalid.');
  return { name, visibility };
};
const zcqlText = value => value.replaceAll("'", "''");
const normalizeMapVersion = (version) => {
  if (!version || typeof version !== 'object') throw new TypeError('Map view version is required.');
  safeId(version.MapViewID, 'MapViewID', 64);
  safeId(version.OrganizationID, 'OrganizationID', 64);
  positiveVersion(version.Version, 'Version');
  if (version.MapViewVersionKey !== `${version.MapViewID}:${version.Version}`) {
    throw new TypeError('MapViewVersionKey must match the map view and version.');
  }
  safeId(version.MapViewVersionKey, 'MapViewVersionKey');
  if (typeof version.DefinitionJSON !== 'string') throw new TypeError('DefinitionJSON must be text.');
  let definition;
  try { definition = JSON.parse(version.DefinitionJSON); } catch { throw new TypeError('DefinitionJSON must be valid JSON.'); }
  if (!definition || typeof definition !== 'object' || Array.isArray(definition)) {
    throw new TypeError('DefinitionJSON must contain a JSON object.');
  }
  const hash = createHash('sha256').update(version.DefinitionJSON).digest('hex');
  if (version.DefinitionHash !== hash) throw new TypeError('DefinitionHash must match DefinitionJSON.');
  return { ...version, CreatedByEmployeeID: decimalId(version.CreatedByEmployeeID, 'CreatedByEmployeeID') };
};
const catalystDateTime = value => {
  const match = String(value).match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}:\d{2})/u);
  if (!match) throw new TypeError('Catalyst DateTime value is invalid.');
  return `${match[1]} ${match[2]}`;
};
const prepareCatalystRow = (tableName, row) => {
  const prepared = clone(row);
  for (const column of DATETIME_COLUMNS[tableName] ?? []) {
    if (prepared[column] === null || prepared[column] === undefined) delete prepared[column];
    else prepared[column] = catalystDateTime(prepared[column]);
  }
  return prepared;
};
const sameField = (name, stored, intended) => ['OwnerEmployeeID', 'CreatedByEmployeeID'].includes(name)
  ? decimalId(stored, name) === decimalId(intended, name) : stored === intended;
const samePreparedRow = (stored, intended) => stored && Object.entries(intended)
  .every(([name, value]) => sameField(name, stored[name], value));
const sameMapVersion = (stored, prepared) => stored && [
  'MapViewVersionKey', 'MapViewID', 'OrganizationID', 'Version', 'DefinitionJSON',
  'DefinitionHash', 'CreatedByEmployeeID', 'CreatedAt', 'SyntheticData',
].every(name => sameField(name, stored[name], prepared[name]))
  && (stored.PublishedAt ?? null) === (prepared.PublishedAt ?? null);
const uniqueConflict = () => {
  const error = new Error('Catalyst unique constraint conflict.');
  error.code = 'UNIQUE_CONFLICT';
  return error;
};
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

  async #queryIndexed(tableName, column, value, { maxRows = 5000 } = {}) {
    if (!ALLOWED_TABLES.has(tableName)) throw new TypeError('Table is not allowlisted.');
    if (!this.#zcql || typeof this.#zcql.executeZCQLQuery !== 'function') {
      return (await this.#read(tableName)).filter(row => String(row[column]) === String(value));
    }
    const pageSize = 200;
    const rows = [];
    const literal = typeof value === 'number' || /^(0|[1-9]\d*)$/u.test(String(value))
      ? String(value) : `'${zcqlText(String(value))}'`;
    for (let offset = 0; offset <= maxRows; offset += pageSize) {
      let result;
      try {
        result = await this.#zcql.executeZCQLQuery(
          `SELECT * FROM ${tableName} WHERE ${column} = ${literal} LIMIT ${offset}, ${pageSize}`,
        );
      } catch (error) {
        throw sanitizeCatalystSdkError(error, { operation: `QUERY_${tableName}_${column}` });
      }
      const values = Array.isArray(result) ? result : result?.data ?? [];
      const pageRows = values.map(item => mapCatalystRow(item?.[tableName] ?? item, { includeRowId: true }));
      rows.push(...pageRows);
      if (rows.length > maxRows) fail('DATA_NOT_READY', `${tableName} indexed result exceeds its governed read limit.`);
      if (pageRows.length < pageSize) return rows;
    }
    fail('DATA_NOT_READY', `${tableName} indexed result exceeds its governed read limit.`);
  }

  #invalidate(...tableNames) {
    for (const tableName of tableNames) this.#cache.delete(tableName);
  }

  async #insert(tableName, row) {
    try {
      const response = await this.#datastore.table(tableName).insertRow(prepareCatalystRow(tableName, row));
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
      const response = await this.#datastore.table(tableName).updateRow(prepareCatalystRow(tableName, row));
      this.#invalidate(tableName);
      return response?.data && !Array.isArray(response.data) ? response.data : response;
    } catch (error) {
      this.#invalidate(tableName);
      throw sanitizeCatalystSdkError(error, { operation: `UPDATE_${tableName}` });
    }
  }

  async #delete(tableName, rowId) {
    try {
      await this.#datastore.table(tableName).deleteRow(String(rowId));
      this.#invalidate(tableName);
    } catch (error) {
      this.#invalidate(tableName);
      throw sanitizeCatalystSdkError(error, { operation: `DELETE_${tableName}` });
    }
  }

  async #insertMany(tableName, rows) {
    const inserted = [];
    for (let offset = 0; offset < rows.length; offset += 200) {
      const batch = rows.slice(offset, offset + 200).map(row => prepareCatalystRow(tableName, row));
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

  #groupFromPointer(pointer) {
    if (!pointer?.CurrentRunGroupID) return undefined;
    const runs = parseJson(pointer.CurrentRunsJSON, []);
    if (!Array.isArray(runs) || runs.length !== 7) fail('DATA_NOT_READY', 'Publication pointer is invalid.');
    return {
      RunGroupID: pointer.CurrentRunGroupID, PublishedAt: pointer.PublishedAt,
      PublicationGeneration: Number(pointer.PublicationGeneration), PointerVersion: Number(pointer.PointerVersion),
      runs,
    };
  }

  async #current() {
    const [pointer] = await this.#queryIndexed(TABLES.publicationState, 'PublicationStateID', 'CURRENT', { maxRows: 1 });
    return this.#groupFromPointer(pointer);
  }

  async #currentRunRef(type, group) {
    group ??= await this.#current();
    const run = group?.runs.find(row => row.AnalysisType === type);
    return run?.ROWID ?? run?.AnalysisRunRef;
  }

  async getCurrentRunGroup() {
    const group = await this.#current();
    if (!group) return undefined;
    return {
      ...group,
      runs: group.runs.map(run => ({
        ...stripRun(run),
        ...((run.ROWID ?? run.AnalysisRunRef) ? { AnalysisRunRef: String(run.ROWID ?? run.AnalysisRunRef) } : {}),
      })),
    };
  }

  async listAnalysisRuns() {
    return (await this.#read(TABLES.runs)).map(stripRun);
  }

  async createRunRequest(request) {
    await this.#insert(TABLES.runRequests, request);
    return this.getRunRequest(request.RunRequestID);
  }

  async getRunRequest(runRequestId) {
    return clone((await this.#read(TABLES.runRequests)).find(row => row.RunRequestID === runRequestId));
  }

  async getRunRequestByIdempotencyHash(hash) {
    return clone((await this.#read(TABLES.runRequests)).find(row => row.IdempotencyKeyHash === hash));
  }

  async listRunRequests() {
    return clone(await this.#read(TABLES.runRequests));
  }

  async updateRunRequest(runRequestId, changes) {
    const row = (await this.#read(TABLES.runRequests)).find(item => item.RunRequestID === runRequestId);
    if (!row) return undefined;
    if (changes.Status && changes.Status !== row.Status && !RUN_REQUEST_TRANSITIONS[row.Status]?.has(changes.Status)) {
      const error = new Error(`invalid run request transition ${row.Status} -> ${changes.Status}`);
      error.code = 'INVALID_STATE'; throw error;
    }
    await this.#update(TABLES.runRequests, { ...row, ...clone(changes) });
    return this.getRunRequest(runRequestId);
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

  async #currentRows(tableName, analysisType, runGroup) {
    const ref = await this.#currentRunRef(analysisType, runGroup);
    return ref ? this.#queryIndexed(tableName, 'AnalysisRunRef', ref) : [];
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
    const rows = await this.#currentRows(TABLES.hotspots, 'HOTSPOT', options.runGroup);
    const runRefs = new Set(rows.map(row => String(row.AnalysisRunRef)));
    const evidenceRows = [];
    for (const runRef of runRefs) evidenceRows.push(...await this.#queryIndexed(TABLES.evidence, 'AnalysisRunRef', runRef));
    const evidence = evidenceRows.filter(row => row.FindingType === 'HOTSPOT');
    return page(rows.map((row) => {
      const contributing = evidence.filter(item => item.FindingBusinessID === row.HotspotID).map(item => ({
        caseId: item.SourceBusinessID,
        unitId: Number(parseJson(item.EvidenceSummary, {}).unitId),
      }));
      return {
        id: row.HotspotID, areaId: row.AreaID,
        centroid: { latitude: row.CentroidLatitude, longitude: row.CentroidLongitude },
        magnitude: row.CaseCount, confidence: row.Severity, method: 'HAVERSINE_DBSCAN',
        version: row.MethodVersion, limitations: limitations(row.Limitation), synthetic: row.SyntheticData === true,
        evidenceCaseIds: contributing.map(item => item.caseId),
        evidenceUnits: Object.fromEntries(contributing.filter(item => Number.isInteger(item.unitId))
          .map(item => [item.caseId, item.unitId])),
      };
    }).sort((left, right) => left.id.localeCompare(right.id)), options);
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

  async #publicationPointer() {
    const rows = await this.#queryIndexed(TABLES.publicationState, 'PublicationStateID', 'CURRENT', { maxRows: 1 });
    if (rows.length > 1) fail('DATA_NOT_READY', 'Publication pointer is not unique.');
    return rows[0];
  }

  async #annotatePublicationGeneration(rows, generation) {
    for (const row of rows) await this.#update(TABLES.runs, { ...row, PublicationGeneration: generation });
  }

  async #advancePublication({ runGroup, rows, publishedAt, attemptSequence }) {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      let pointer = await this.#publicationPointer();
      if (!pointer) {
        try {
          await this.#insert(TABLES.publicationState, {
            PublicationStateID: 'CURRENT', PublicationGeneration: 0, CurrentRunsJSON: '[]',
            PointerVersion: 1, LastReservedAttemptSequence: Number(attemptSequence),
            LatestAttemptSequence: 0, LatestAttemptStatus: 'NONE', SyntheticData: true,
          });
        } catch (error) {
          if (error.code !== 'UNIQUE_CONFLICT') throw error;
        }
        continue;
      }
      if (Number(attemptSequence) < Number(pointer.LatestAttemptSequence ?? 0)
        && pointer.CurrentRunGroupID !== runGroup.RunGroupID) {
        fail('VERSION_CONFLICT', 'A newer intelligence refresh attempt has already completed.');
      }
      if (pointer.CurrentRunGroupID === runGroup.RunGroupID) {
        const pointedRuns = parseJson(pointer.CurrentRunsJSON, []);
        const pointedIds = pointedRuns.map(run => run.AnalysisRunID).sort();
        const candidateIds = runGroup.runs.map(run => run.AnalysisRunID).sort();
        if (JSON.stringify(pointedIds) === JSON.stringify(candidateIds)) {
          const generation = Number(pointer.PublicationGeneration);
          await this.#annotatePublicationGeneration(rows, generation);
          return generation;
        }
      }
      const rowId = String(pointer.ROWID);
      if (!/^[1-9]\d*$/u.test(rowId)) fail('DATA_NOT_READY', 'Publication pointer ROWID is invalid.');
      const nextVersion = Number(pointer.PointerVersion) + 1;
      const nextGeneration = Number(pointer.PublicationGeneration) + 1;
      await this.#annotatePublicationGeneration(rows, nextGeneration);
      const query = `UPDATE INT_PublicationState SET PublicationGeneration = ${nextGeneration}, CurrentRunGroupID = '${zcqlText(runGroup.RunGroupID)}', CurrentRunsJSON = '${zcqlText(JSON.stringify(runGroup.runs.map(run => ({ ...run, PublicationGeneration: nextGeneration }))))}', PointerVersion = ${nextVersion}, PublishedAt = '${catalystDateTime(publishedAt)}', LastReservedAttemptSequence = ${Math.max(Number(pointer.LastReservedAttemptSequence ?? 0), Number(attemptSequence))}, LatestAttemptSequence = ${Number(attemptSequence)}, LatestAttemptStatus = 'COMPLETED', LatestAttemptRunGroupID = '${zcqlText(runGroup.RunGroupID)}', LatestAttemptAt = '${catalystDateTime(publishedAt)}' WHERE ROWID = ${rowId} AND PointerVersion = ${Number(pointer.PointerVersion)}`;
      let result;
      try { result = await this.#zcql.executeZCQLQuery(query); }
      catch (error) { throw sanitizeCatalystSdkError(error, { operation: 'PUBLICATION_POINTER_COMPARE_AND_SWAP' }); }
      this.#invalidate(TABLES.publicationState);
      const affected = (Array.isArray(result) ? result[0] : result)?.affected_rows;
      if (affected === undefined || Number(affected) === 1) {
        const committed = await this.#publicationPointer();
        if (committed?.CurrentRunGroupID === runGroup.RunGroupID
          && Number(committed.PublicationGeneration) === nextGeneration) return nextGeneration;
      }
    }
    fail('DATA_NOT_READY', 'Publication pointer contention exceeded retry budget.');
  }

  async reserveRefreshAttempt() {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      let pointer = await this.#publicationPointer();
      if (!pointer) {
        try {
          await this.#insert(TABLES.publicationState, {
            PublicationStateID: 'CURRENT', PublicationGeneration: 0, CurrentRunsJSON: '[]',
            PointerVersion: 1, LastReservedAttemptSequence: 0, LatestAttemptSequence: 0,
            LatestAttemptStatus: 'NONE', SyntheticData: true,
          });
        } catch (error) { if (error.code !== 'UNIQUE_CONFLICT') throw error; }
        continue;
      }
      const rowId = String(pointer.ROWID);
      if (!/^[1-9]\d*$/u.test(rowId)) fail('DATA_NOT_READY', 'Publication pointer ROWID is invalid.');
      const currentVersion = Number(pointer.PointerVersion);
      const sequence = Number(pointer.LastReservedAttemptSequence ?? 0) + 1;
      const query = `UPDATE INT_PublicationState SET PointerVersion = ${currentVersion + 1}, LastReservedAttemptSequence = ${sequence} WHERE ROWID = ${rowId} AND PointerVersion = ${currentVersion}`;
      let result;
      try { result = await this.#zcql.executeZCQLQuery(query); }
      catch (error) { throw sanitizeCatalystSdkError(error, { operation: 'PUBLICATION_ATTEMPT_RESERVE' }); }
      this.#invalidate(TABLES.publicationState);
      const affected = (Array.isArray(result) ? result[0] : result)?.affected_rows;
      if (affected === undefined || Number(affected) === 1) return sequence;
    }
    fail('DATA_NOT_READY', 'Publication attempt reservation contention exceeded retry budget.');
  }

  async #updatePublicationAttempt({ sequence, status, runGroupId, at }) {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const pointer = await this.#publicationPointer();
      if (!pointer) return;
      if (Number(sequence) < Number(pointer.LatestAttemptSequence ?? 0)) return;
      if (Number(sequence) === Number(pointer.LatestAttemptSequence ?? 0)
        && ['COMPLETED', 'FAILED_FINAL'].includes(pointer.LatestAttemptStatus)
        && status !== pointer.LatestAttemptStatus) return;
      const rowId = String(pointer.ROWID);
      if (!/^[1-9]\d*$/u.test(rowId)) fail('DATA_NOT_READY', 'Publication pointer ROWID is invalid.');
      const currentVersion = Number(pointer.PointerVersion);
      const nextVersion = currentVersion + 1;
      const query = `UPDATE INT_PublicationState SET PointerVersion = ${nextVersion}, LatestAttemptSequence = ${Number(sequence)}, LatestAttemptStatus = '${zcqlText(status)}', LatestAttemptRunGroupID = '${zcqlText(runGroupId)}', LatestAttemptAt = '${catalystDateTime(at)}' WHERE ROWID = ${rowId} AND PointerVersion = ${currentVersion} AND LatestAttemptSequence <= ${Number(sequence)}`;
      let result;
      try { result = await this.#zcql.executeZCQLQuery(query); }
      catch (error) { throw sanitizeCatalystSdkError(error, { operation: 'PUBLICATION_ATTEMPT_COMPARE_AND_SWAP' }); }
      this.#invalidate(TABLES.publicationState);
      const affected = (Array.isArray(result) ? result[0] : result)?.affected_rows;
      if (affected === undefined || Number(affected) === 1) {
        const committed = await this.#publicationPointer();
        if (committed?.LatestAttemptStatus === status
          && committed?.LatestAttemptRunGroupID === runGroupId
          && Number(committed.LatestAttemptSequence) === Number(sequence)
          && Number(committed.PointerVersion) === nextVersion) return;
      }
    }
    fail('DATA_NOT_READY', 'Publication attempt pointer contention exceeded retry budget.');
  }

  async getRefreshStatus() {
    const [pointer] = await this.#queryIndexed(TABLES.publicationState, 'PublicationStateID', 'CURRENT', { maxRows: 1 });
    if (pointer) return {
      currentRunGroup: this.#groupFromPointer(pointer),
      publicationGeneration: Number(pointer.PublicationGeneration),
      latestAttempt: {
        sequence: Number(pointer.LatestAttemptSequence ?? 0),
        status: pointer.LatestAttemptStatus, runGroupId: pointer.LatestAttemptRunGroupID ?? null,
        createdAt: pointer.LatestAttemptAt,
        completedAt: pointer.LatestAttemptStatus === 'COMPLETED' ? pointer.LatestAttemptAt : null,
      },
    };
    return { currentRunGroup: undefined, publicationGeneration: 0, latestAttempt: null };
  }

  #mapView(row) {
    return row ? mapCatalystRow(row) : undefined;
  }

  async listMapViews({ organizationId, visibility, ownerEmployeeId, limit, nextToken } = {}) {
    if (!organizationId) throw new TypeError('organizationId is required.');
    const owner = ownerEmployeeId === undefined ? undefined : decimalId(ownerEmployeeId, 'ownerEmployeeId');
    const rows = (await this.#read(TABLES.mapViews))
      .filter(row => row.OrganizationID === organizationId
        && (!visibility || row.Visibility === visibility)
        && (owner === undefined || decimalId(row.OwnerEmployeeID, 'OwnerEmployeeID') === owner))
      .sort((left, right) => left.MapViewID.localeCompare(right.MapViewID))
      .map(row => this.#mapView(row));
    return page(rows, { limit, nextToken });
  }

  async getMapView(mapViewId, organizationId) {
    if (!organizationId) throw new TypeError('organizationId is required.');
    return this.#mapView((await this.#read(TABLES.mapViews))
      .find(row => row.MapViewID === mapViewId && row.OrganizationID === organizationId));
  }

  async getMapViewVersion(mapViewId, version, organizationId) {
    if (!organizationId) throw new TypeError('organizationId is required.');
    positiveVersion(version, 'version');
    const row = (await this.#read(TABLES.mapViewVersions)).find(item => item.MapViewID === mapViewId
      && item.OrganizationID === organizationId && item.Version === version);
    if (!row) return undefined;
    const { MapViewRef, ...mapped } = mapCatalystRow(row);
    return mapped;
  }

  async createMapView({ mapView, version }) {
    if (!mapView || typeof mapView !== 'object') throw new TypeError('Map view is required.');
    safeId(mapView.MapViewID, 'MapViewID', 64);
    safeId(mapView.OrganizationID, 'OrganizationID', 64);
    positiveVersion(mapView.CurrentVersion, 'CurrentVersion');
    const intendedMap = { ...mapView, OwnerEmployeeID: decimalId(mapView.OwnerEmployeeID, 'OwnerEmployeeID') };
    const intendedVersion = normalizeMapVersion(version);
    if (mapView.CurrentVersion !== 1 || version.Version !== 1
      || mapView.MapViewID !== intendedVersion.MapViewID
      || mapView.OrganizationID !== intendedVersion.OrganizationID
      || mapView.CurrentVersion !== intendedVersion.Version) {
      throw new TypeError('Map view and initial version identity must match.');
    }
    let inserted;
    try {
      inserted = await this.#insert(TABLES.mapViews, intendedMap);
    } catch (error) {
      this.#invalidate(TABLES.mapViews);
      const existing = (await this.#read(TABLES.mapViews)).find(row => row.MapViewID === intendedMap.MapViewID
        && row.OrganizationID === intendedMap.OrganizationID);
      if (!existing) throw error;
      if (!samePreparedRow(existing, prepareCatalystRow(TABLES.mapViews, intendedMap))) throw uniqueConflict();
      inserted = existing;
    }
    const rowId = String(inserted.ROWID);
    if (!/^[1-9]\d*$/u.test(rowId)) throw new TypeError('Map view must have a resolved positive ROWID.');
    const versionRow = { ...intendedVersion, MapViewRef: rowId };
    try {
      await this.#insert(TABLES.mapViewVersions, versionRow);
    } catch (error) {
      this.#invalidate(TABLES.mapViewVersions);
      const existing = (await this.#read(TABLES.mapViewVersions))
        .find(row => row.MapViewVersionKey === intendedVersion.MapViewVersionKey
          && row.MapViewID === intendedVersion.MapViewID
          && row.OrganizationID === intendedVersion.OrganizationID);
      if (!existing) throw error;
      if (!samePreparedRow(existing, prepareCatalystRow(TABLES.mapViewVersions, versionRow))) throw uniqueConflict();
    }
    return this.getMapView(intendedMap.MapViewID, intendedMap.OrganizationID);
  }

  async updateMapView({ mapViewId, organizationId, expectedVersion, nextVersion }) {
    safeId(mapViewId, 'mapViewId', 64);
    safeId(organizationId, 'organizationId', 64);
    expectedVersionNumber(expectedVersion);
    const row = (await this.#read(TABLES.mapViews)).find(item => item.MapViewID === mapViewId
      && item.OrganizationID === organizationId);
    if (!row) return undefined;
    if (row.CurrentVersion !== expectedVersion) fail('VERSION_CONFLICT', 'Map view version changed.');
    const intendedVersion = normalizeMapVersion(nextVersion);
    if (intendedVersion.MapViewID !== mapViewId
      || intendedVersion.OrganizationID !== organizationId
      || intendedVersion.Version !== expectedVersion + 1) {
      throw new TypeError('nextVersion must be the next scoped immutable version.');
    }
    if (!this.#zcql || typeof this.#zcql.executeZCQLQuery !== 'function') throw new TypeError('Catalyst ZCQL is required.');
    const rowId = String(row.ROWID);
    if (!/^[1-9]\d*$/u.test(rowId)) throw new TypeError('Map view must have a resolved positive ROWID.');
    try {
      await this.#insert(TABLES.mapViewVersions, { ...intendedVersion, MapViewRef: rowId });
    } catch (error) {
      if (error.code !== 'UNIQUE_CONFLICT') throw error;
      this.#invalidate(TABLES.mapViews, TABLES.mapViewVersions);
      const [stored, current] = await Promise.all([
        this.getMapViewVersion(mapViewId, intendedVersion.Version, organizationId),
        this.getMapView(mapViewId, organizationId),
      ]);
      const prepared = prepareCatalystRow(TABLES.mapViewVersions, intendedVersion);
      if (!sameMapVersion(stored, prepared) || current?.CurrentVersion !== expectedVersion) {
        fail('VERSION_CONFLICT', 'Map view version changed.');
      }
    }
    const updatedAt = catalystDateTime(intendedVersion.CreatedAt);
    const summary = mapViewSummary(intendedVersion, row);
    const query = `UPDATE CFG_MapView SET Name = '${zcqlText(summary.name)}', Visibility = '${summary.visibility}', CurrentVersion = ${expectedVersion + 1}, UpdatedAt = '${updatedAt}' WHERE ROWID = ${rowId} AND CurrentVersion = ${expectedVersion}`;
    const committed = () => this.#mapView({
      ...row, Name: summary.name, Visibility: summary.visibility,
      CurrentVersion: expectedVersion + 1, UpdatedAt: updatedAt,
    });
    const reconcile = async () => {
      this.#invalidate(TABLES.mapViews, TABLES.mapViewVersions);
      const [current, stored] = await Promise.all([
        this.getMapView(mapViewId, organizationId),
        this.getMapViewVersion(mapViewId, intendedVersion.Version, organizationId),
      ]);
      const sameVersion = sameMapVersion(stored, prepareCatalystRow(TABLES.mapViewVersions, intendedVersion));
      if (sameVersion && current?.CurrentVersion >= expectedVersion + 1) return committed();
      if (!sameVersion || current?.CurrentVersion !== expectedVersion) fail('VERSION_CONFLICT', 'Map view version changed.');
      return undefined;
    };
    let result;
    try { result = await this.#zcql.executeZCQLQuery(query); }
    catch (error) {
      const reconciled = await reconcile();
      if (reconciled) return reconciled;
      throw sanitizeCatalystSdkError(error, { operation: 'MAP_VIEW_COMPARE_AND_SWAP' });
    }
    this.#invalidate(TABLES.mapViews);
    const affected = (Array.isArray(result) ? result[0] : result)?.affected_rows;
    if (affected !== undefined && Number(affected) === 0) fail('VERSION_CONFLICT', 'Map view version changed.');
    if (affected !== undefined && Number(affected) === 1) return committed();
    return (await reconcile()) ?? fail('VERSION_CONFLICT', 'Map view version changed.');
  }

  #mapReport(row) {
    if (!row) return undefined;
    return {
      id: row.ReportDefinitionID, name: row.Name, description: row.Description ?? '',
      ownerUserId: row.OwnerUserID, visibility: row.Visibility,
      definition: parseJson(row.DefinitionJSON, {}), version: Number(row.Version),
      createdAt: row.CreatedAt, updatedAt: row.UpdatedAt, syntheticData: row.SyntheticData === true,
    };
  }

  async listReports() { return (await this.#read(TABLES.reports)).map(row => this.#mapReport(row)); }
  async getReport(id) { return this.#mapReport((await this.#read(TABLES.reports)).find(row => row.ReportDefinitionID === id)); }
  async createReport(report) {
    await this.#insert(TABLES.reports, {
      ReportDefinitionID: report.id, Name: report.name, Description: report.definition?.description ?? '',
      OwnerUserID: report.ownerUserId, SourceKey: report.definition?.sourceKey,
      DefinitionJSON: JSON.stringify(report.definition), Visibility: report.visibility,
      Version: report.version, CreatedAt: report.createdAt, UpdatedAt: report.updatedAt, SyntheticData: true,
    });
    return this.getReport(report.id);
  }
  async updateReport(id, expectedVersion, changes) {
    const row = (await this.#read(TABLES.reports)).find(item => item.ReportDefinitionID === id);
    if (!row) return undefined;
    if (Number(row.Version) !== expectedVersion) return { conflict: true };
    const definition = changes.definition ?? parseJson(row.DefinitionJSON, {});
    await this.#update(TABLES.reports, {
      ...row, Name: changes.name ?? row.Name, Description: definition.description ?? row.Description,
      SourceKey: definition.sourceKey ?? row.SourceKey, DefinitionJSON: JSON.stringify(definition),
      Visibility: changes.visibility ?? row.Visibility, Version: Number(row.Version) + 1,
      UpdatedAt: changes.updatedAt ?? row.UpdatedAt,
    });
    return this.getReport(id);
  }
  async deleteReport(id) {
    const row = (await this.#read(TABLES.reports)).find(item => item.ReportDefinitionID === id);
    if (!row) return false;
    await this.#delete(TABLES.reports, row.ROWID);
    return true;
  }
  async isReportReferenced(id) {
    const report = (await this.#read(TABLES.reports)).find(row => row.ReportDefinitionID === id);
    return report ? (await this.#read(TABLES.dashboardItems)).some(row => String(row.ReportRef) === String(report.ROWID)) : false;
  }

  #mapDashboard(row) {
    if (!row) return undefined;
    return {
      id: row.DashboardID, name: row.Name, description: row.Description ?? '',
      ownerUserId: row.OwnerUserID, visibility: row.Visibility, defaultRole: row.DefaultRole,
      version: Number(row.Version), createdAt: row.CreatedAt, updatedAt: row.UpdatedAt,
      syntheticData: row.SyntheticData === true,
    };
  }
  async listDashboards() { return (await this.#read(TABLES.dashboards)).map(row => this.#mapDashboard(row)); }
  async getDashboard(id) { return this.#mapDashboard((await this.#read(TABLES.dashboards)).find(row => row.DashboardID === id)); }
  async createDashboard(dashboard) {
    await this.#insert(TABLES.dashboards, {
      DashboardID: dashboard.id, Name: dashboard.name, Description: dashboard.description ?? '',
      OwnerUserID: dashboard.ownerUserId, Visibility: dashboard.visibility,
      DefaultRole: dashboard.defaultRole ?? null, Version: dashboard.version,
      CreatedAt: dashboard.createdAt, UpdatedAt: dashboard.updatedAt, SyntheticData: true,
    });
    return this.getDashboard(dashboard.id);
  }
  async updateDashboard(id, expectedVersion, changes) {
    const row = (await this.#read(TABLES.dashboards)).find(item => item.DashboardID === id);
    if (!row) return undefined;
    if (Number(row.Version) !== expectedVersion) return { conflict: true };
    await this.#update(TABLES.dashboards, {
      ...row, Name: changes.name ?? row.Name, Description: changes.description ?? row.Description,
      Visibility: changes.visibility ?? row.Visibility,
      DefaultRole: Object.hasOwn(changes, 'defaultRole') ? changes.defaultRole ?? null : row.DefaultRole,
      Version: Number(row.Version) + 1, UpdatedAt: changes.updatedAt ?? row.UpdatedAt,
    });
    return this.getDashboard(id);
  }
  async deleteDashboard(id) {
    const row = (await this.#read(TABLES.dashboards)).find(item => item.DashboardID === id);
    if (!row) return false;
    for (const item of await this.#read(TABLES.dashboardItems)) {
      if (String(item.DashboardRef) === String(row.ROWID)) await this.#delete(TABLES.dashboardItems, item.ROWID);
    }
    await this.#delete(TABLES.dashboards, row.ROWID);
    return true;
  }

  async listDashboardItems(dashboardId) {
    const [dashboard, reports, items] = await Promise.all([
      this.#read(TABLES.dashboards).then(rows => rows.find(row => row.DashboardID === dashboardId)),
      this.#read(TABLES.reports), this.#read(TABLES.dashboardItems),
    ]);
    if (!dashboard) return [];
    const reportByRef = new Map(reports.map(row => [String(row.ROWID), row.ReportDefinitionID]));
    return items.filter(row => String(row.DashboardRef) === String(dashboard.ROWID)).map(row => ({
      id: row.DashboardItemID, dashboardId, reportId: reportByRef.get(String(row.ReportRef)),
      column: Number(row.GridColumn), row: Number(row.GridRow), width: Number(row.GridWidth),
      height: Number(row.GridHeight), displayOrder: Number(row.DisplayOrder),
      version: Number(row.Version), syntheticData: row.SyntheticData === true,
    }));
  }
  async createDashboardItem(item) {
    const [dashboard, report] = await Promise.all([
      this.#read(TABLES.dashboards).then(rows => rows.find(row => row.DashboardID === item.dashboardId)),
      this.#read(TABLES.reports).then(rows => rows.find(row => row.ReportDefinitionID === item.reportId)),
    ]);
    if (!dashboard || !report) fail('DATA_NOT_READY');
    await this.#insert(TABLES.dashboardItems, {
      DashboardItemID: item.id, DashboardRef: String(dashboard.ROWID), ReportRef: String(report.ROWID),
      GridColumn: item.column, GridRow: item.row, GridWidth: item.width, GridHeight: item.height,
      DisplayOrder: item.displayOrder ?? 1, Version: item.version, SyntheticData: true,
    });
    return (await this.listDashboardItems(item.dashboardId)).find(row => row.id === item.id);
  }
  async updateDashboardItem(id, expectedVersion, changes) {
    const row = (await this.#read(TABLES.dashboardItems)).find(item => item.DashboardItemID === id);
    if (!row) return undefined;
    if (Number(row.Version) !== expectedVersion) return { conflict: true };
    await this.#update(TABLES.dashboardItems, {
      ...row, GridColumn: changes.column ?? row.GridColumn, GridRow: changes.row ?? row.GridRow,
      GridWidth: changes.width ?? row.GridWidth, GridHeight: changes.height ?? row.GridHeight,
      DisplayOrder: changes.displayOrder ?? row.DisplayOrder, Version: Number(row.Version) + 1,
    });
    return { id, ...changes, version: expectedVersion + 1 };
  }
  async deleteDashboardItem(id) {
    const row = (await this.#read(TABLES.dashboardItems)).find(item => item.DashboardItemID === id);
    if (!row) return false;
    await this.#delete(TABLES.dashboardItems, row.ROWID);
    return true;
  }
  async replaceDashboardItems(dashboardId, items) {
    for (const current of await this.listDashboardItems(dashboardId)) await this.deleteDashboardItem(current.id);
    const result = [];
    for (const item of items) result.push(await this.createDashboardItem(item));
    return result;
  }

  async listContentShares(contentType, contentId) {
    return (await this.#read(TABLES.contentShares))
      .filter(row => row.ContentType === contentType && row.ContentBusinessID === contentId)
      .map(row => ({
        id: row.ContentShareID, contentType, contentId, targetUserId: row.TargetUserID,
        targetRole: row.TargetRole, targetUnitId: row.TargetUnitID === undefined ? undefined : Number(row.TargetUnitID),
        permission: row.Permission, sharedByUserId: row.SharedByUserID, createdAt: row.CreatedAt,
        syntheticData: row.SyntheticData === true,
      }));
  }
  async createContentShare(share) {
    await this.#insert(TABLES.contentShares, {
      ContentShareID: share.id, ContentType: share.contentType, ContentBusinessID: share.contentId,
      TargetUserID: share.targetUserId ?? null, TargetRole: share.targetRole ?? null,
      TargetUnitID: share.targetUnitId ?? null, Permission: share.permission,
      SharedByUserID: share.sharedByUserId, CreatedAt: share.createdAt, SyntheticData: true,
    });
    return (await this.listContentShares(share.contentType, share.contentId)).find(row => row.id === share.id);
  }
  async deleteContentShare(id) {
    const row = (await this.#read(TABLES.contentShares)).find(item => item.ContentShareID === id);
    if (!row) return false;
    await this.#delete(TABLES.contentShares, row.ROWID);
    return true;
  }
  async getUserPreference(userId) {
    const [row, dashboards] = await Promise.all([
      this.#read(TABLES.userPreferences).then(rows => rows.find(item => item.CatalystUserID === userId)),
      this.#read(TABLES.dashboards),
    ]);
    if (!row) return undefined;
    const dashboard = dashboards.find(item => String(item.ROWID) === String(row.LandingDashboardRef));
    return {
      id: row.UserPreferenceID, userId, landingDashboardId: dashboard?.DashboardID,
      preferences: parseJson(row.PreferencesJSON, {}), version: Number(row.Version),
      updatedAt: row.UpdatedAt, syntheticData: row.SyntheticData === true,
    };
  }
  async upsertUserPreference(preference) {
    const dashboard = (await this.#read(TABLES.dashboards)).find(row => row.DashboardID === preference.landingDashboardId);
    if (!dashboard) fail('NOT_FOUND');
    const current = (await this.#read(TABLES.userPreferences)).find(row => row.CatalystUserID === preference.userId);
    const values = {
      UserPreferenceID: current?.UserPreferenceID ?? preference.id, CatalystUserID: preference.userId,
      LandingDashboardRef: String(dashboard.ROWID), PreferencesJSON: JSON.stringify(preference.preferences ?? {}),
      Version: current ? Number(current.Version) + 1 : 1, UpdatedAt: preference.updatedAt, SyntheticData: true,
    };
    if (current) await this.#update(TABLES.userPreferences, { ...current, ...values });
    else await this.#insert(TABLES.userPreferences, values);
    return this.getUserPreference(preference.userId);
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

  async listAlerts() {
    const alerts = await this.#read(TABLES.alerts);
    const commands = await this.#read(TABLES.commands);
    const commandByRef = new Map(commands.map(row => [String(row.ROWID), row.CommandID]));
    return alerts.map(row => ({
      AlertID: row.AlertID, PatternID: row.FindingBusinessID, ScopeUnitID: row.ScopeUnitID,
      Status: row.Status, AlertVersion: row.AlertVersion,
      LastCommandID: row.LastCommandRef ? commandByRef.get(String(row.LastCommandRef)) ?? null : null,
      OriginalFindingJSON: row.OriginalFindingJSON, SyntheticData: row.SyntheticData === true,
    }));
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
        AuthorizedUnitIDsJSON: row.AuthorizedUnitIDsJSON,
        AuthorizedCaseIDsJSON: row.AuthorizedCaseIDsJSON,
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
    const table = {
      assignment: TABLES.assignments, conclusion: TABLES.conclusions, outcome: TABLES.outcomes,
      note: TABLES.alertNotes, escalation: TABLES.escalations,
    }[kind];
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
    const [alert, command] = await Promise.all([
      event.AlertID ? this.#alertRow(event.AlertID) : undefined,
      event.CommandID ? this.#commandRow(event.CommandID) : undefined,
    ]);
    if ((event.AlertID && !alert) || (event.CommandID && !command)) fail('DATA_NOT_READY');
    const { AlertID, CommandID, ...values } = event;
    await this.#insert(TABLES.audits, {
      ...values, AlertRef: alert ? String(alert.ROWID) : null, CommandRef: command ? String(command.ROWID) : null,
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
      note: await this.findDomainArtifactByCommand('note', commandId),
      escalation: await this.findDomainArtifactByCommand('escalation', commandId),
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
    const rows = await this.#queryIndexed(TABLES.runs, 'BatchKey', batchKey, { maxRows: 8 });
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
      BatchKey: batchKey, Operation: rows[0].Operation, RequestHash: rows[0].RequestHash,
      Status: completed ? 'COMPLETED'
        : rows.some(row => row.Status === 'FAILED_RETRYABLE') ? 'FAILED_RETRYABLE'
          : rows.some(row => row.Status === 'FAILED_FINAL') ? 'FAILED_FINAL' : 'STAGED',
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
      AttemptSequence: batch.AttemptSequence,
      ReconciliationJSON: reconciliation,
      MethodVersion: run.MethodVersion ?? run.EngineVersion,
      CompletedAt: run.CompletedAt ?? batch.CreatedAt,
    }));
    const existingRuns = await this.#queryIndexed(TABLES.runs, 'BatchKey', batch.BatchKey, { maxRows: 8 });
    const insertedRuns = existingRuns.length > 0 ? existingRuns : await this.#ensureMany(TABLES.runs, rows);
    if (insertedRuns.length !== 7 || insertedRuns.some(row => row.RunGroupID !== batch.RunGroup.RunGroupID)) {
      fail('DATA_NOT_READY', 'Refresh staging rows are inconsistent.');
    }
    await this.#stageRefreshFindings(batch, insertedRuns);
    for (const run of insertedRuns) await this.#update(TABLES.runs, { ...run, Status: 'COMPLETED' });
    await this.#updatePublicationAttempt({
      sequence: batch.AttemptSequence, status: 'STAGED', runGroupId: batch.RunGroup.RunGroupID, at: batch.CreatedAt,
    });
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
    const hotspots = findings.hotspots ?? [];
    await this.#ensureMany(TABLES.patterns, patterns.map(pattern => ({
      PatternID: pattern.id, AnalysisRunRef: runRef('PATTERN'), PatternType: pattern.method,
      Title: pattern.title, Confidence: pattern.confidence,
      SignalComponentsJSON: JSON.stringify(pattern), Recommendation: pattern.recommendation,
      MethodVersion: pattern.version, Limitation: (pattern.limitations ?? []).join('|'), SyntheticData: true,
    })));
    const patternEvidence = patterns.flatMap((pattern, patternIndex) => (pattern.evidence ?? []).map((evidence, evidenceIndex) => ({
      FindingEvidenceID: `EVID-${key}-PAT-${patternIndex + 1}-${evidenceIndex + 1}`,
      AnalysisRunRef: runRef('PATTERN'), FindingType: 'PATTERN', FindingBusinessID: pattern.id,
      SourceEntity: 'CaseMaster', SourceBusinessID: evidence.caseId, EvidenceLabel: 'SOURCE_CASE',
      EvidenceSummary: JSON.stringify(evidence), MethodVersion: pattern.version, SyntheticData: true,
    })));
    const hotspotEvidence = hotspots.flatMap((hotspot, hotspotIndex) => (hotspot.evidenceCaseIds ?? []).map((caseId, evidenceIndex) => ({
      FindingEvidenceID: `EVID-${key}-HOT-${hotspotIndex + 1}-${evidenceIndex + 1}`,
      AnalysisRunRef: runRef('HOTSPOT'), FindingType: 'HOTSPOT', FindingBusinessID: hotspot.id,
      SourceEntity: 'CaseMaster', SourceBusinessID: caseId, EvidenceLabel: 'CONTRIBUTING_CASE',
      EvidenceSummary: JSON.stringify({ caseId, unitId: hotspot.evidenceUnits?.[caseId] ?? null }),
      MethodVersion: hotspot.version, SyntheticData: true,
    })));
    await this.#ensureMany(TABLES.evidence, [...patternEvidence, ...hotspotEvidence]);

    await this.#ensureMany(TABLES.hotspots, hotspots.map(hotspot => ({
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
    const rows = await this.#queryIndexed(TABLES.runs, 'BatchKey', batchKey, { maxRows: 8 });
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
    if (changes.Status) await this.#updatePublicationAttempt({
      sequence: rows[0].AttemptSequence, status: changes.Status, runGroupId: rows[0].RunGroupID,
      at: changes.CompletedAt ?? rows[0].CompletedAt ?? rows[0].ObservationEnd,
    });
    return this.getRefreshBatch(batchKey);
  }

  async publishRefreshBatch(batchKey, publishedAt) {
    const existing = await this.getRefreshBatch(batchKey);
    if (!existing) return undefined;
    const rows = await this.#queryIndexed(TABLES.runs, 'BatchKey', batchKey, { maxRows: 8 });
    if (rows.length !== 7) fail('DATA_NOT_READY', 'Refresh run group is incomplete.');
    const persistedGenerations = [...new Set(rows.map(row => Number(row.PublicationGeneration))
      .filter(value => Number.isSafeInteger(value) && value >= 1))];
    if (existing.Status === 'COMPLETED' && persistedGenerations.length === 1
      && rows.every(row => Number(row.PublicationGeneration) === persistedGenerations[0])) {
      const pointer = await this.#publicationPointer();
      if (pointer?.CurrentRunGroupID === existing.RunGroup.RunGroupID
        || Number(pointer?.PublicationGeneration) >= persistedGenerations[0]) return existing;
    }
    // Generation annotations are prepared before the pointer CAS. A retry must be
    // allowed to reconcile a partially annotated group after an interrupted write.
    if (existing.Status !== 'COMPLETED') {
      for (const row of rows) {
        await this.#update(TABLES.runs, {
          ...row, Status: 'COMPLETED', PublishStatus: 'PUBLISHED',
          PublishedAt: publishedAt, CompletedAt: row.CompletedAt ?? publishedAt,
        });
      }
    }
    const completed = await this.getRefreshBatch(batchKey);
    if (completed?.Status !== 'COMPLETED') fail('DATA_NOT_READY', 'Refresh publication is incoherent.');
    const publishedRows = await this.#queryIndexed(TABLES.runs, 'BatchKey', batchKey, { maxRows: 8 });
    await this.#advancePublication({
      runGroup: {
        RunGroupID: completed.RunGroup.RunGroupID,
        PublishedAt: completed.RunGroup.PublishedAt,
        runs: publishedRows.map(row => ({ ...stripRun(row), ROWID: String(row.ROWID) })),
      },
      rows: publishedRows, publishedAt, attemptSequence: rows[0].AttemptSequence,
    });
    return this.getRefreshBatch(batchKey);
  }
}

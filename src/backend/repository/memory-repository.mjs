import { isCompletePublishedGroup, selectCurrentRunGroup } from '../refresh/run-groups.mjs';

const clone = value => value === undefined ? undefined : structuredClone(value);
const conflict = (message) => {
  const error = new Error(message);
  error.code = 'UNIQUE_CONFLICT';
  return error;
};
const invalidState = (message) => {
  const error = new Error(message);
  error.code = 'INVALID_STATE';
  return error;
};
const runRequestTransitions = Object.freeze({
  QUEUED: new Set(['SUBMITTED', 'FAILED_RETRYABLE', 'FAILED_FINAL']),
  SUBMITTED: new Set(['RUNNING', 'FAILED_RETRYABLE', 'FAILED_FINAL']),
  RUNNING: new Set(['PUBLISHED', 'FAILED_RETRYABLE', 'FAILED_FINAL']),
  FAILED_RETRYABLE: new Set(['SUBMITTED']),
  PUBLISHED: new Set(),
  FAILED_FINAL: new Set(),
});
const encodeToken = offset => Buffer.from(JSON.stringify({ offset })).toString('base64url');
const decodeToken = (token) => {
  if (!token) return 0;
  try {
    const { offset } = JSON.parse(Buffer.from(token, 'base64url').toString('utf8'));
    if (!Number.isInteger(offset) || offset < 0) throw new Error('invalid');
    return offset;
  } catch {
    const error = new Error('invalid pagination token');
    error.code = 'INVALID_PAGE_TOKEN';
    throw error;
  }
};

export class MemoryIntelligenceRepository {
  #state;
  #failureInjector;

  constructor(state, { failureInjector = () => {} } = {}) {
    this.#state = clone(state);
    for (const collection of ['reports', 'dashboards', 'dashboardItems', 'contentShares', 'userPreferences', 'mapViews', 'mapViewVersions']) {
      this.#state[collection] ??= [];
    }
    this.#state.runRequests ??= [];
    const initial = selectCurrentRunGroup(this.#state.runGroups.flatMap(({ runs }) => runs));
    this.#state.publicationState ??= initial ? {
      PublicationGeneration: 1, PointerVersion: 1, CurrentRunGroupID: initial.RunGroupID,
      CurrentRunGroup: initial, PublishedAt: initial.PublishedAt,
      LatestAttemptStatus: 'COMPLETED', LatestAttemptRunGroupID: initial.RunGroupID,
      LatestAttemptAt: initial.PublishedAt,
    } : undefined;
    this.#state.findingsByRunGroup ??= initial ? { [initial.RunGroupID]: {
      brief: this.#state.brief, features: this.#state.features, patterns: this.#state.patterns,
      hotspots: this.#state.hotspots, anomalies: this.#state.anomalies, areaRisks: this.#state.areaRisks,
      networks: this.#state.networks, districtContexts: this.#state.districtContexts,
    } } : {};
    this.#failureInjector = failureInjector;
  }

  async getCurrentRunGroup() {
    const pointer = this.#state.publicationState;
    return pointer ? clone({
      ...pointer.CurrentRunGroup,
      PublicationGeneration: pointer.PublicationGeneration,
      PointerVersion: pointer.PointerVersion,
    }) : undefined;
  }

  async getRefreshStatus() {
    const currentRunGroup = await this.getCurrentRunGroup();
    const latest = (this.#state.refreshBatches ?? []).at(-1);
    return clone({
      currentRunGroup,
      publicationGeneration: this.#state.publicationState?.PublicationGeneration ?? 0,
      latestAttempt: latest ? {
        batchKey: latest.BatchKey, status: latest.Status, runGroupId: latest.RunGroup?.RunGroupID,
        createdAt: latest.CreatedAt ?? null, completedAt: latest.CompletedAt ?? null,
      } : null,
    });
  }

  async listAnalysisRuns() { return clone(this.#state.runGroups.flatMap(({ runs }) => runs)); }

  async createRunRequest(request) {
    if (this.#state.runRequests.some(row => row.RunRequestID === request.RunRequestID
      || row.IdempotencyKeyHash === request.IdempotencyKeyHash)) throw conflict('run request unique conflict');
    this.#state.runRequests.push(clone(request));
    return clone(request);
  }

  async getRunRequest(runRequestId) {
    return clone(this.#state.runRequests.find(row => row.RunRequestID === runRequestId));
  }

  async getRunRequestByIdempotencyHash(hash) {
    return clone(this.#state.runRequests.find(row => row.IdempotencyKeyHash === hash));
  }

  async listRunRequests() { return clone(this.#state.runRequests); }

  async updateRunRequest(runRequestId, changes) {
    const request = this.#state.runRequests.find(row => row.RunRequestID === runRequestId);
    if (!request) return undefined;
    if (changes.Status && changes.Status !== request.Status
      && !runRequestTransitions[request.Status]?.has(changes.Status)) {
      throw invalidState(`invalid run request transition ${request.Status} -> ${changes.Status}`);
    }
    Object.assign(request, clone(changes));
    return clone(request);
  }

  async getBrief() { return clone(this.#state.brief); }
  async listPatterns(options = {}) { return this.#page(this.#state.patterns, options); }
  async getPattern(id) { return clone(this.#state.patterns.find(row => row.id === id)); }
  async listHotspots(options = {}) {
    const rows = options.runGroup
      ? this.#state.findingsByRunGroup?.[options.runGroup.RunGroupID]?.hotspots ?? []
      : this.#state.hotspots;
    return this.#page(rows, options);
  }
  async listAnomalies(options = {}) { return this.#page(this.#state.anomalies, options); }
  async getAreaRisk() { return clone(this.#state.areaRisks[0]); }
  async getNetwork(id) { return clone(this.#state.networks.find(({ node }) => node.id === id)); }
  async getDistrictContext(unitId) { return clone(this.#state.districtContexts.filter(row => !unitId || row.unitId === unitId)); }
  async listMapViews({ organizationId, visibility, ownerEmployeeId, limit, nextToken } = {}) {
    return this.#page(this.#state.mapViews.filter(row => row.OrganizationID === organizationId
      && (!visibility || row.Visibility === visibility)
      && (ownerEmployeeId === undefined || String(row.OwnerEmployeeID) === String(ownerEmployeeId))), { limit, nextToken });
  }
  async getMapView(id, organizationId) {
    return clone(this.#state.mapViews.find(row => row.MapViewID === id && row.OrganizationID === organizationId));
  }
  async getMapViewVersion(id, version, organizationId) {
    return clone(this.#state.mapViewVersions.find(row => row.MapViewID === id
      && row.Version === version && row.OrganizationID === organizationId));
  }
  async createMapView({ mapView, version }) {
    if (this.#state.mapViews.some(row => row.MapViewID === mapView.MapViewID)) throw conflict('map view unique conflict');
    this.#state.mapViews.push(clone(mapView));
    this.#state.mapViewVersions.push(clone(version));
    return clone(mapView);
  }
  async updateMapView({ mapViewId, organizationId, expectedVersion, nextVersion }) {
    const view = this.#state.mapViews.find(row => row.MapViewID === mapViewId && row.OrganizationID === organizationId);
    if (!view) return undefined;
    if (view.CurrentVersion !== expectedVersion) {
      const error = new Error('map view version changed'); error.code = 'VERSION_CONFLICT'; throw error;
    }
    if (this.#state.mapViewVersions.some(row => row.MapViewVersionKey === nextVersion.MapViewVersionKey)) {
      throw conflict('map view version unique conflict');
    }
    this.#state.mapViewVersions.push(clone(nextVersion));
    view.CurrentVersion = nextVersion.Version;
    view.UpdatedAt = nextVersion.CreatedAt;
    const definition = JSON.parse(nextVersion.DefinitionJSON);
    view.Name = definition.name ?? view.Name;
    view.Visibility = definition.visibility ?? view.Visibility;
    return clone(view);
  }
  async listReports() { return clone(this.#state.reports); }
  async getReport(id) { return clone(this.#state.reports.find(row => row.id === id)); }
  async createReport(report) {
    if (this.#state.reports.some(row => row.id === report.id)) throw conflict('report unique conflict');
    this.#state.reports.push(clone(report));
    return clone(report);
  }
  async updateReport(id, expectedVersion, changes) {
    const report = this.#state.reports.find(row => row.id === id);
    if (!report) return undefined;
    if (report.version !== expectedVersion) return { conflict: true };
    Object.assign(report, clone(changes), { version: report.version + 1 });
    return clone(report);
  }
  async deleteReport(id) {
    const index = this.#state.reports.findIndex(row => row.id === id);
    if (index < 0) return false;
    this.#state.reports.splice(index, 1);
    this.#state.contentShares = this.#state.contentShares.filter(row => !(row.contentType === 'REPORT' && row.contentId === id));
    return true;
  }
  async isReportReferenced(id) { return this.#state.dashboardItems.some(row => row.reportId === id); }

  async listDashboards() { return clone(this.#state.dashboards); }
  async getDashboard(id) { return clone(this.#state.dashboards.find(row => row.id === id)); }
  async createDashboard(dashboard) {
    if (this.#state.dashboards.some(row => row.id === dashboard.id)) throw conflict('dashboard unique conflict');
    this.#state.dashboards.push(clone(dashboard));
    return clone(dashboard);
  }
  async updateDashboard(id, expectedVersion, changes) {
    const dashboard = this.#state.dashboards.find(row => row.id === id);
    if (!dashboard) return undefined;
    if (dashboard.version !== expectedVersion) return { conflict: true };
    Object.assign(dashboard, clone(changes), { version: dashboard.version + 1 });
    return clone(dashboard);
  }
  async deleteDashboard(id) {
    const index = this.#state.dashboards.findIndex(row => row.id === id);
    if (index < 0) return false;
    this.#state.dashboards.splice(index, 1);
    this.#state.dashboardItems = this.#state.dashboardItems.filter(row => row.dashboardId !== id);
    this.#state.contentShares = this.#state.contentShares.filter(row => !(row.contentType === 'DASHBOARD' && row.contentId === id));
    this.#state.userPreferences = this.#state.userPreferences.filter(row => row.landingDashboardId !== id);
    return true;
  }
  async listDashboardItems(dashboardId) { return clone(this.#state.dashboardItems.filter(row => row.dashboardId === dashboardId)); }
  async createDashboardItem(item) {
    if (this.#state.dashboardItems.some(row => row.id === item.id)) throw conflict('dashboard item unique conflict');
    this.#state.dashboardItems.push(clone(item));
    return clone(item);
  }
  async updateDashboardItem(id, expectedVersion, changes) {
    const item = this.#state.dashboardItems.find(row => row.id === id);
    if (!item) return undefined;
    if (item.version !== expectedVersion) return { conflict: true };
    Object.assign(item, clone(changes), { version: item.version + 1 });
    return clone(item);
  }
  async deleteDashboardItem(id) {
    const index = this.#state.dashboardItems.findIndex(row => row.id === id);
    if (index < 0) return false;
    this.#state.dashboardItems.splice(index, 1);
    return true;
  }
  async replaceDashboardItems(dashboardId, items) {
    this.#state.dashboardItems = this.#state.dashboardItems.filter(row => row.dashboardId !== dashboardId);
    this.#state.dashboardItems.push(...clone(items));
    return clone(items);
  }
  async listContentShares(contentType, contentId) {
    return clone(this.#state.contentShares.filter(row => row.contentType === contentType && row.contentId === contentId));
  }
  async createContentShare(share) {
    if (this.#state.contentShares.some(row => row.id === share.id)) throw conflict('content share unique conflict');
    this.#state.contentShares.push(clone(share));
    return clone(share);
  }
  async deleteContentShare(id) {
    const index = this.#state.contentShares.findIndex(row => row.id === id);
    if (index < 0) return false;
    this.#state.contentShares.splice(index, 1);
    return true;
  }
  async getUserPreference(userId) { return clone(this.#state.userPreferences.find(row => row.userId === userId)); }
  async upsertUserPreference(preference) {
    const existing = this.#state.userPreferences.find(row => row.userId === preference.userId);
    if (existing) Object.assign(existing, clone(preference), { version: existing.version + 1 });
    else this.#state.userPreferences.push(clone(preference));
    return clone(existing ?? preference);
  }
  async getAccessProfile(userId) { return clone(this.#state.profiles.find(row => String(row.CatalystUserID) === String(userId))); }
  async getUnits() { return clone(this.#state.units); }
  async getAlert(alertId) { return clone(this.#state.alerts.find(row => row.AlertID === alertId)); }
  async listAlerts() { return clone(this.#state.alerts); }

  async createCommand(command) {
    if (this.#state.commands.some(row => row.CommandID === command.CommandID
      || row.IdempotencyKeyHash === command.IdempotencyKeyHash)) throw conflict('command unique conflict');
    this.#state.commands.push(clone(command));
    this.#failureInjector('afterCommandCreate');
    return clone(command);
  }

  async getCommand(commandId) { return clone(this.#state.commands.find(row => row.CommandID === commandId)); }
  async getCommandByIdempotencyHash(hash) { return clone(this.#state.commands.find(row => row.IdempotencyKeyHash === hash)); }

  async updateCommand(commandId, changes) {
    const command = this.#state.commands.find(row => row.CommandID === commandId);
    if (!command) return undefined;
    Object.assign(command, clone(changes));
    if (changes.Status === 'COMPLETED') this.#failureInjector('beforeCommandComplete');
    return clone(command);
  }

  async insertDomainArtifact(kind, artifact) {
    const collection = this.#artifactCollection(kind);
    if (collection.some(row => row.CommandID === artifact.CommandID)) throw conflict('artifact command conflict');
    collection.push(clone(artifact));
    this.#failureInjector('afterDomainInsert');
    return clone(artifact);
  }

  async findDomainArtifactByCommand(kind, commandId) {
    return clone(this.#artifactCollection(kind).find(row => row.CommandID === commandId));
  }

  async getAssignmentsForAlert(alertId) {
    return clone(this.#state.assignments.filter(row => row.AlertID === alertId
      && this.#state.commands.some(command => command.CommandID === row.CommandID && command.Status === 'COMPLETED')));
  }

  async getAssignmentsForEmployee(employeeId) {
    const latestByAlert = new Map();
    for (const assignment of this.#state.assignments) {
      const completed = this.#state.commands.some(command => command.CommandID === assignment.CommandID
        && command.Status === 'COMPLETED');
      if (completed) latestByAlert.set(assignment.AlertID, assignment);
    }
    return clone([...latestByAlert.values()].filter(row => row.AssignedEmployeeID === employeeId));
  }

  async compareAndSwapAlert({ alertId, expectedState, expectedVersion, targetState, commandId }) {
    const alert = this.#state.alerts.find(row => row.AlertID === alertId);
    if (!alert || alert.Status !== expectedState || alert.AlertVersion !== expectedVersion) {
      return { matched: 0 };
    }
    alert.Status = targetState;
    alert.AlertVersion += 1;
    alert.LastCommandID = commandId;
    this.#failureInjector('afterAlertCas');
    return { matched: 1, alert: clone(alert) };
  }

  async appendAuditEvent(event) {
    if (this.#state.auditEvents.some(row => row.AuditEventID === event.AuditEventID
      || row.EventHash === event.EventHash)) throw conflict('audit unique conflict');
    this.#state.auditEvents.push(clone(event));
    this.#failureInjector('afterAuditInsert');
    return clone(event);
  }

  async findAuditByCommand(commandId) {
    return clone(this.#state.auditEvents.find(row => row.CommandID === commandId));
  }

  async getAuditStream(streamId) {
    return clone(this.#state.auditEvents.filter(row => row.StreamID === streamId)
      .sort((left, right) => left.StreamSequence - right.StreamSequence));
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

  async listCommands() { return clone(this.#state.commands); }
  async listAuditEvents() { return clone(this.#state.auditEvents); }

  async persistValidatedSource({ batchKey, source, accepted, rejected, reconciliation }) {
    this.#state.sourceBatches ??= [];
    const existing = this.#state.sourceBatches.find(row => row.batchKey === batchKey);
    if (existing) return clone(existing);
    if (source?.syntheticData !== true || !reconciliation?.balanced) throw new Error('invalid validated source batch');
    const stored = {
      batchKey, accepted: clone(accepted), rejected: clone(rejected),
      reconciliation: clone(reconciliation), syntheticData: true,
    };
    this.#state.sourceBatches.push(stored);
    this.#failureInjector('afterSourceBatchWrite');
    return clone(stored);
  }

  async getValidatedSource(batchKey) {
    return clone((this.#state.sourceBatches ?? []).find(row => row.batchKey === batchKey));
  }

  async getRefreshBatch(batchKey) {
    return clone((this.#state.refreshBatches ?? []).find(row => row.BatchKey === batchKey));
  }

  async createRefreshBatch(batch) {
    this.#state.refreshBatches ??= [];
    if (this.#state.refreshBatches.some(row => row.BatchKey === batch.BatchKey)) throw conflict('refresh batch conflict');
    this.#state.refreshBatches.push(clone(batch));
    if (this.#state.publicationState) Object.assign(this.#state.publicationState, {
      LatestAttemptStatus: 'STAGED', LatestAttemptRunGroupID: batch.RunGroup.RunGroupID,
      LatestAttemptAt: batch.CreatedAt,
    });
    return clone(batch);
  }

  async updateRefreshBatch(batchKey, changes) {
    const batch = (this.#state.refreshBatches ?? []).find(row => row.BatchKey === batchKey);
    if (!batch) return undefined;
    Object.assign(batch, clone(changes));
    if (this.#state.publicationState) Object.assign(this.#state.publicationState, {
      LatestAttemptStatus: batch.Status, LatestAttemptRunGroupID: batch.RunGroup?.RunGroupID,
      LatestAttemptAt: batch.CompletedAt ?? batch.CreatedAt,
    });
    return clone(batch);
  }

  async publishRefreshBatch(batchKey, publishedAt) {
    const batch = (this.#state.refreshBatches ?? []).find(row => row.BatchKey === batchKey);
    if (!batch) return undefined;
    if (batch.Status === 'COMPLETED') return clone(batch);
    const runs = batch.RunGroup.runs.map(row => ({
      ...row, Status: 'COMPLETED', PublishStatus: 'PUBLISHED', PublishedAt: publishedAt,
    }));
    if (!isCompletePublishedGroup(runs)) throw new Error('incoherent refresh group');
    this.#failureInjector('beforeRefreshPublish');
    const runGroup = { RunGroupID: batch.RunGroup.RunGroupID, PublishedAt: publishedAt, runs };
    const findings = batch.PublishedFindings;
    if (!findings) throw new Error('refresh findings are missing');
    for (const name of ['brief', 'features', 'patterns', 'hotspots', 'anomalies', 'areaRisks', 'networks', 'districtContexts']) {
      this.#state[name] = clone(findings[name]);
    }
    for (const alert of findings.alerts ?? []) {
      if (!this.#state.alerts.some(row => row.AlertID === alert.AlertID)) this.#state.alerts.push(clone(alert));
    }
    this.#state.runGroups.push(runGroup);
    this.#state.findingsByRunGroup[runGroup.RunGroupID] = clone(findings);
    const previousGeneration = this.#state.publicationState?.PublicationGeneration ?? 0;
    const previousVersion = this.#state.publicationState?.PointerVersion ?? 0;
    this.#state.publicationState = {
      PublicationGeneration: previousGeneration + 1, PointerVersion: previousVersion + 1,
      CurrentRunGroupID: runGroup.RunGroupID, CurrentRunGroup: clone(runGroup), PublishedAt: publishedAt,
      LatestAttemptStatus: 'COMPLETED', LatestAttemptRunGroupID: runGroup.RunGroupID,
      LatestAttemptAt: publishedAt,
    };
    Object.assign(batch, { Status: 'COMPLETED', RunGroup: runGroup, CompletedAt: publishedAt });
    return clone(batch);
  }

  #page(rows, { limit = 50, nextToken } = {}) {
    const bounded = Math.max(1, Math.min(200, Number(limit) || 50));
    const offset = decodeToken(nextToken);
    const data = rows.slice(offset, offset + bounded);
    const nextOffset = offset + data.length;
    return {
      data: clone(data),
      nextToken: nextOffset < rows.length ? encodeToken(nextOffset) : null,
    };
  }

  #artifactCollection(kind) {
    const names = {
      assignment: 'assignments', conclusion: 'conclusions', outcome: 'outcomes',
      note: 'alertNotes', escalation: 'escalations',
    };
    const name = names[kind];
    if (!name) throw new TypeError(`unsupported artifact ${kind}`);
    this.#state[name] ??= [];
    return this.#state[name];
  }
}

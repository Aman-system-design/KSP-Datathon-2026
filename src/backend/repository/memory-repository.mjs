import { isCompletePublishedGroup, selectCurrentRunGroup } from '../refresh/run-groups.mjs';

const clone = value => value === undefined ? undefined : structuredClone(value);
const conflict = (message) => {
  const error = new Error(message);
  error.code = 'UNIQUE_CONFLICT';
  return error;
};
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
    this.#failureInjector = failureInjector;
  }

  async getCurrentRunGroup() {
    return clone(selectCurrentRunGroup(this.#state.runGroups.flatMap(({ runs }) => runs)));
  }

  async listAnalysisRuns() { return clone(this.#state.runGroups.flatMap(({ runs }) => runs)); }

  async getBrief() { return clone(this.#state.brief); }
  async listPatterns(options = {}) { return this.#page(this.#state.patterns, options); }
  async getPattern(id) { return clone(this.#state.patterns.find(row => row.id === id)); }
  async listHotspots(options = {}) { return this.#page(this.#state.hotspots, options); }
  async listAnomalies(options = {}) { return this.#page(this.#state.anomalies, options); }
  async getAreaRisk() { return clone(this.#state.areaRisks[0]); }
  async getNetwork(id) { return clone(this.#state.networks.find(({ node }) => node.id === id)); }
  async getDistrictContext(unitId) { return clone(this.#state.districtContexts.filter(row => !unitId || row.unitId === unitId)); }
  async getAccessProfile(userId) { return clone(this.#state.profiles.find(row => String(row.CatalystUserID) === String(userId))); }
  async getUnits() { return clone(this.#state.units); }
  async getAlert(alertId) { return clone(this.#state.alerts.find(row => row.AlertID === alertId)); }

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
    return clone(batch);
  }

  async updateRefreshBatch(batchKey, changes) {
    const batch = (this.#state.refreshBatches ?? []).find(row => row.BatchKey === batchKey);
    if (!batch) return undefined;
    Object.assign(batch, clone(changes));
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
    const names = { assignment: 'assignments', conclusion: 'conclusions', outcome: 'outcomes' };
    const name = names[kind];
    if (!name) throw new TypeError(`unsupported artifact ${kind}`);
    return this.#state[name];
  }
}

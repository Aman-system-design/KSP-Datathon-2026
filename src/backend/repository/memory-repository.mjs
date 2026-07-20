const requiredAnalysisTypes = new Set([
  'FEATURE_BUILD', 'HOTSPOT', 'ANOMALY', 'PATTERN', 'AREA_RISK', 'NETWORK',
  'IDENTITY_RESOLUTION',
]);

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

function completeGroup(group) {
  if (!group?.runs || group.runs.length !== requiredAnalysisTypes.size) return false;
  const types = new Set(group.runs.map(({ AnalysisType }) => AnalysisType));
  if ([...requiredAnalysisTypes].some(type => !types.has(type))) return false;
  const first = group.runs[0];
  return group.runs.every(run => run.RunGroupID === group.RunGroupID
    && run.Status === 'COMPLETED'
    && run.PublishStatus === 'PUBLISHED'
    && run.InputManifestHash === first.InputManifestHash
    && run.ObservationStart === first.ObservationStart
    && run.ObservationEnd === first.ObservationEnd
    && run.EngineVersion === first.EngineVersion);
}

export class MemoryIntelligenceRepository {
  #state;
  #failureInjector;

  constructor(state, { failureInjector = () => {} } = {}) {
    this.#state = clone(state);
    this.#failureInjector = failureInjector;
  }

  async getCurrentRunGroup() {
    const current = this.#state.runGroups.filter(completeGroup)
      .sort((left, right) => right.PublishedAt.localeCompare(left.PublishedAt))[0];
    return clone(current);
  }

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

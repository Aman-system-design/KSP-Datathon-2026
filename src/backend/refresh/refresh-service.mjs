import { createHash } from 'node:crypto';

import { fail } from '../services/errors.mjs';
import { verifyAuditStream } from '../workflow/audit.mjs';
import { canonicalStringify } from '../workflow/canonical-json.mjs';
import { projectPipelineFindings } from './finding-projection.mjs';
import { isCompletePublishedGroup, REQUIRED_ANALYSIS_TYPES } from './run-groups.mjs';

const hash = value => createHash('sha256').update(canonicalStringify(value)).digest('hex');

function publicResult(batch) {
  const findings = batch.Findings ?? {};
  return {
    batchKey: batch.BatchKey,
    status: batch.Status,
    reconciliation: structuredClone(batch.Reconciliation),
    runGroup: structuredClone(batch.RunGroup),
    findingCounts: {
      features: findings.features?.length ?? 0,
      hotspots: findings.hotspots?.length ?? 0,
      anomalies: findings.anomalies?.length ?? 0,
      patterns: findings.patterns?.length ?? 0,
      identities: findings.identityResolutions?.length ?? 0,
      networkEdges: findings.network?.edges?.length ?? 0,
      areaRisks: findings.areaRisk ? 1 : 0,
    },
    syntheticData: true,
  };
}

async function governanceReport(repository, auditKeys, generatedAt) {
  const commands = await repository.listCommands();
  const incomplete = commands.filter(row => !['COMPLETED', 'FAILED_FINAL'].includes(row.Status));
  const reconciliation = [];
  for (const command of incomplete) reconciliation.push(await repository.reconcileCommand(command.CommandID));

  const events = await repository.listAuditEvents();
  const streams = new Map();
  for (const event of events) {
    const rows = streams.get(event.StreamID) ?? [];
    rows.push(event);
    streams.set(event.StreamID, rows);
  }
  const auditErrors = [];
  for (const [streamId, rows] of streams) {
    const result = verifyAuditStream(rows.sort((a, b) => a.StreamSequence - b.StreamSequence), auditKeys);
    auditErrors.push(...result.errors.map(error => `${streamId}: ${error}`));
  }
  for (const command of commands.filter(row => row.Status === 'COMPLETED')) {
    if (!events.some(event => event.CommandID === command.CommandID)) auditErrors.push(`${command.CommandID}: missing audit event`);
  }
  return {
    generatedAt,
    incompleteCommandIds: incomplete.map(row => row.CommandID).sort(),
    commandReconciliation: reconciliation.map(row => ({
      commandId: row.command.CommandID,
      status: row.command.Status,
      hasDomainArtifact: Boolean(row.assignment || row.conclusion || row.outcome) || row.command.CommandType === 'ACKNOWLEDGE',
      hasAudit: Boolean(row.audit),
      resultingVersion: row.alert?.AlertVersion ?? null,
    })),
    audit: { valid: auditErrors.length === 0, errors: auditErrors },
    historicalRowsMutated: false,
  };
}

export function createRefreshService({
  repository, sourceGenerator, sourceValidator, adapter, pipeline,
  clock = () => new Date().toISOString(), idFactory, auditKeys = {},
}) {
  return Object.freeze({
    async execute({ operation, batchKey, seed } = {}) {
      if (operation === 'RECONCILE_GOVERNANCE') return governanceReport(repository, auditKeys, clock());
      if (!['BOOTSTRAP_SYNTHETIC', 'REFRESH_INTELLIGENCE'].includes(operation)) fail('INVALID_REQUEST', 'Unsupported refresh operation.');
      if (typeof batchKey !== 'string' || !batchKey.trim() || batchKey.length > 128) fail('INVALID_REQUEST', 'batchKey is required.');

      let batch = await repository.getRefreshBatch(batchKey);
      if (batch?.Status === 'COMPLETED') return publicResult(batch);
      if (!batch) {
        const source = sourceGenerator(seed);
        if (source?.syntheticData !== true) fail('INVALID_REQUEST', 'Only synthetic bootstrap data is permitted.');
        const validation = sourceValidator(source);
        if (!validation.reconciliation?.balanced || validation.reconciliation.acceptedRows < 1) fail('DATA_NOT_READY');
        const input = adapter(validation.accepted);
        const findings = pipeline(input);
        const publishedFindings = projectPipelineFindings({ output: findings, input });
        const inputManifestHash = hash({
          schemaVersion: input.schemaVersion, fixtureVersion: input.fixtureVersion,
          asOf: input.asOf, accepted: validation.accepted,
        });
        const observationStart = input.cases.map(row => row.incidentAt).sort()[0];
        const observationEnd = input.asOf;
        const runGroupId = idFactory('RUN-GROUP');
        const runs = REQUIRED_ANALYSIS_TYPES.map(type => ({
          AnalysisRunID: idFactory('RUN'), RunGroupID: runGroupId,
          AnalysisType: type, RunTypeKey: `${runGroupId}:${type}`,
          Status: 'COMPLETED', PublishStatus: 'STAGED', InputManifestHash: inputManifestHash,
          ObservationStart: observationStart, ObservationEnd: observationEnd,
          EngineVersion: findings.run?.engineVersion ?? '1.0.0', PublishedAt: null,
          SyntheticData: true,
        }));
        const publishCandidate = runs.map(row => ({ ...row, PublishStatus: 'PUBLISHED', PublishedAt: clock() }));
        if (!isCompletePublishedGroup(publishCandidate)) fail('DATA_NOT_READY');
        batch = {
          BatchKey: batchKey, Operation: operation, Status: 'STAGED',
          InputManifestHash: inputManifestHash,
          Reconciliation: structuredClone(validation.reconciliation),
          Rejected: structuredClone(validation.rejected), Findings: structuredClone(findings),
          PublishedFindings: publishedFindings,
          RunGroup: { RunGroupID: runGroupId, PublishedAt: null, runs },
          CreatedAt: clock(), CompletedAt: null, SyntheticData: true,
        };
        try {
          await repository.createRefreshBatch(batch);
        } catch (error) {
          if (error.code !== 'UNIQUE_CONFLICT') throw error;
          batch = await repository.getRefreshBatch(batchKey);
        }
      }
      const completed = await repository.publishRefreshBatch(batchKey, clock());
      return publicResult(completed);
    },
  });
}

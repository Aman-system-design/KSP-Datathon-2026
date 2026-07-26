import { createHash } from 'node:crypto';

import { fail } from '../services/errors.mjs';
import { verifyAuditStream } from '../workflow/audit.mjs';
import { canonicalStringify } from '../workflow/canonical-json.mjs';
import { projectPipelineFindings } from './finding-projection.mjs';
import { isCompletePublishedGroup, REQUIRED_ANALYSIS_TYPES } from './run-groups.mjs';
import { evaluatePublishedUtilityRules } from '../utilities/utility-run-evaluation.mjs';

const hash = value => createHash('sha256').update(canonicalStringify(value)).digest('hex');

function batchPublicationGeneration(batch) {
  const runs = batch?.RunGroup?.runs ?? [];
  const values = [...new Set(runs.map(run => Number(run.PublicationGeneration)).filter(Number.isSafeInteger))];
  return runs.length === 7 && values.length === 1 && values[0] >= 1 ? values[0] : null;
}

function isCommittedBatch(batch, refreshStatus) {
  if (batch?.Status !== 'COMPLETED') return false;
  const generation = batchPublicationGeneration(batch);
  const current = refreshStatus?.currentRunGroup;
  if (current?.RunGroupID === batch.RunGroup?.RunGroupID) return true;
  return generation !== null && Number(refreshStatus?.publicationGeneration) >= generation;
}

function publicResult(batch, utilityEvaluation) {
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
    ...(utilityEvaluation ? { utilityEvaluation: structuredClone(utilityEvaluation) } : {}),
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
  clock = () => new Date().toISOString(), idFactory, auditKeys = {}, onProgress = () => {},
  onUtilityEvaluation = () => {},
}) {
  const reportEvaluation = (batch, utilityEvaluation) => {
    try { onUtilityEvaluation(structuredClone(utilityEvaluation)); } catch { /* Observability cannot change publication state. */ }
    return publicResult(batch, utilityEvaluation);
  };
  const historicalResult = (batch) => reportEvaluation(batch, {
    status: 'SKIPPED_HISTORICAL_PUBLICATION', reason: 'NOT_CURRENT_PUBLICATION',
    runGroupId: batch.RunGroup?.RunGroupID ?? null,
    rulesDiscovered: 0, rulesEligible: 0, rulesExcluded: 0, rulesSucceeded: 0,
    rulesFailed: 0, findingsEvaluated: 0, matched: 0, suppressed: 0,
    created: 0, existing: 0, alertIds: [], failures: [], syntheticData: true,
  });
  const publishedResult = async (batch, knownStatus) => {
    let refreshStatus = knownStatus;
    try { refreshStatus ??= await repository.getRefreshStatus(); }
    catch {
      return reportEvaluation(batch, {
        status: 'SKIPPED_PUBLICATION_POINTER_UNAVAILABLE', reason: 'CURRENT_PUBLICATION_UNVERIFIED',
        runGroupId: batch.RunGroup?.RunGroupID ?? null,
        rulesDiscovered: 0, rulesEligible: 0, rulesExcluded: 0, rulesSucceeded: 0,
        rulesFailed: 0, findingsEvaluated: 0, matched: 0, suppressed: 0,
        created: 0, existing: 0, alertIds: [], failures: [], syntheticData: true,
      });
    }
    if (refreshStatus?.currentRunGroup?.RunGroupID !== batch.RunGroup?.RunGroupID) {
      return historicalResult(batch);
    }
    let utilityEvaluation;
    try {
      const evaluationRunGroup = {
        ...batch.RunGroup,
        runs: batch.RunGroup.runs.map(run => ({
          ...run,
          ...((run.AnalysisRunRef ?? run.ROWID) !== undefined
            ? { AnalysisRunRef: String(run.AnalysisRunRef ?? run.ROWID) } : {}),
        })),
      };
      utilityEvaluation = await evaluatePublishedUtilityRules({
        repository, runGroup: evaluationRunGroup, findings: batch.PublishedFindings, now: clock(),
      });
    } catch (error) {
      utilityEvaluation = {
        status: 'COMPLETED_WITH_ERRORS', runGroupId: batch.RunGroup?.RunGroupID ?? null,
        rulesDiscovered: 0, rulesEligible: 0, rulesExcluded: 0, rulesSucceeded: 0,
        rulesFailed: 1, findingsEvaluated: 0, matched: 0, suppressed: 0,
        created: 0, existing: 0, alertIds: [],
        failures: [{ ruleId: null, code: 'INTERNAL_ERROR' }], syntheticData: true,
      };
    }
    return reportEvaluation(batch, utilityEvaluation);
  };
  return Object.freeze({
    async execute({ operation, batchKey, seed, profile = 'smoke', caseCount = 50 } = {}) {
      if (operation === 'RECONCILE_GOVERNANCE') return governanceReport(repository, auditKeys, clock());
      if (!['BOOTSTRAP_SYNTHETIC', 'REFRESH_INTELLIGENCE'].includes(operation)) fail('INVALID_REQUEST', 'Unsupported refresh operation.');
      if (typeof batchKey !== 'string' || !batchKey.trim() || batchKey.length > 128) fail('INVALID_REQUEST', 'batchKey is required.');

      onProgress('REFRESH_BATCH_LOOKUP');
      let batch = await repository.getRefreshBatch(batchKey);
      if (batch?.RequestHash === 'LEGACY_IDENTITY_UNKNOWN') {
        fail('LEGACY_IDENTITY_CONFLICT', 'This legacy batch has no provable request identity and cannot be replayed.');
      }
      const attemptSequence = batch?.AttemptSequence ?? await repository.reserveRefreshAttempt({ at: clock() });

      let validation;
      let bootstrapSource;
      if (operation === 'BOOTSTRAP_SYNTHETIC') {
        bootstrapSource = profile === 'statewide'
          ? sourceGenerator({ seed, profile, caseCount })
          : sourceGenerator(seed);
        if (bootstrapSource?.syntheticData !== true) fail('INVALID_REQUEST', 'Only synthetic bootstrap data is permitted.');
      } else {
        onProgress('VALIDATED_SOURCE_LOOKUP');
        validation = await repository.getValidatedSource(batchKey);
        if (!validation) fail('DATA_NOT_READY');
      }
      const requestHash = hash(operation === 'BOOTSTRAP_SYNTHETIC'
        ? { operation, seed: seed ?? null, profile, caseCount, source: bootstrapSource }
        : { operation, batchKey, accepted: validation.accepted, reconciliation: validation.reconciliation });

      if (batch && (batch.Operation !== operation || batch.RequestHash !== requestHash)) fail('IDEMPOTENCY_CONFLICT');
      if (batch?.Status === 'COMPLETED') {
        const refreshStatus = await repository.getRefreshStatus();
        if (isCommittedBatch(batch, refreshStatus)) return publishedResult(batch, refreshStatus);
        return publishedResult(await repository.publishRefreshBatch(batchKey, clock()));
      }
      if (!batch) {
        if (operation === 'BOOTSTRAP_SYNTHETIC') {
          const checked = sourceValidator(bootstrapSource);
          if (!checked.reconciliation?.balanced || checked.reconciliation.rejectedRows !== 0
            || checked.reconciliation.acceptedRows !== checked.reconciliation.sourceRows) fail('DATA_NOT_READY');
          onProgress('SOURCE_PERSIST');
          validation = await repository.persistValidatedSource({ batchKey, source: bootstrapSource, ...checked });
        }
        if (!validation.reconciliation?.balanced || validation.reconciliation.acceptedRows < 1) fail('DATA_NOT_READY');
        if (operation === 'BOOTSTRAP_SYNTHETIC' && (
          validation.reconciliation.rejectedRows !== 0
          || validation.reconciliation.acceptedRows !== validation.reconciliation.sourceRows
        )) fail('DATA_NOT_READY');
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
          RequestHash: requestHash, AttemptSequence: attemptSequence,
          Status: 'COMPLETED', PublishStatus: 'STAGED', InputManifestHash: inputManifestHash,
          ObservationStart: observationStart, ObservationEnd: observationEnd,
          EngineVersion: findings.run?.engineVersion ?? '1.0.0', PublishedAt: null,
          SyntheticData: true,
        }));
        const candidatePublishedAt = clock();
        const publishCandidate = runs.map(row => ({ ...row, PublishStatus: 'PUBLISHED', PublishedAt: candidatePublishedAt }));
        if (!isCompletePublishedGroup(publishCandidate)) fail('DATA_NOT_READY');
        batch = {
          BatchKey: batchKey, Operation: operation, RequestHash: requestHash,
          AttemptSequence: attemptSequence, Status: 'STAGED',
          InputManifestHash: inputManifestHash,
          Reconciliation: structuredClone(validation.reconciliation),
          Rejected: structuredClone(validation.rejected), Findings: structuredClone(findings),
          PublishedFindings: publishedFindings,
          RunGroup: { RunGroupID: runGroupId, PublishedAt: null, runs },
          CreatedAt: clock(), CompletedAt: null, SyntheticData: true,
        };
        try {
          onProgress('REFRESH_BATCH_STAGE');
          await repository.createRefreshBatch(batch);
        } catch (error) {
          if (error.code !== 'UNIQUE_CONFLICT') throw error;
          onProgress('REFRESH_BATCH_LOOKUP');
          batch = await repository.getRefreshBatch(batchKey);
          if (batch && (batch.Operation !== operation || batch.RequestHash !== requestHash)) fail('IDEMPOTENCY_CONFLICT');
        }
      }
      onProgress('REFRESH_BATCH_PUBLISH');
      try {
        const completed = await repository.publishRefreshBatch(batchKey, clock());
        return publishedResult(completed);
      } catch (error) {
        let reconciled = false;
        try {
          const persisted = await repository.getRefreshBatch(batchKey);
          const refreshStatus = await repository.getRefreshStatus();
          reconciled = true;
          if (isCommittedBatch(persisted, refreshStatus)) return publishedResult(persisted, refreshStatus);
        } catch { /* An unavailable reconciliation read must not cause a speculative state downgrade. */ }
        if (reconciled) {
          try {
            await repository.updateRefreshBatch(batchKey, { Status: 'FAILED_RETRYABLE', CompletedAt: clock() });
          } catch { /* Preserve the publication failure; stale state remains safely unpublished. */ }
        }
        throw error;
      }
    },
  });
}

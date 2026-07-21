import { runIntelligencePipeline } from '../../../vendor/intelligence-core/index.mjs';

import { toIntelligenceInput } from '../../ingestion/to-intelligence-input.mjs';
import { validateSourceSeed } from '../../ingestion/validate-source-seed.mjs';
import { generateSourceSeed } from '../../synthetic/source-seed.mjs';
import { createRefreshService } from '../refresh/refresh-service.mjs';
import { CatalystIntelligenceRepository } from '../repository/catalyst/catalyst-repository.mjs';

const OPERATIONS = new Set(['BOOTSTRAP_SYNTHETIC', 'REFRESH_INTELLIGENCE', 'RECONCILE_GOVERNANCE']);

function invalid() {
  const error = new Error('Invalid Job request.'); error.code = 'INVALID_REQUEST'; throw error;
}

function parameters(jobRequest) {
  const operation = jobRequest?.getJobParam?.('operation');
  if (!OPERATIONS.has(operation)) invalid();
  if (operation === 'RECONCILE_GOVERNANCE') return { operation };
  const batchKey = jobRequest.getJobParam('batchKey');
  if (!/^[A-Za-z0-9._:-]{1,128}$/u.test(batchKey ?? '')) invalid();
  if (operation === 'REFRESH_INTELLIGENCE') {
    const runRequestId = jobRequest.getJobParam('runRequestId');
    if (!/^[A-Za-z0-9._:-]{1,128}$/u.test(runRequestId ?? '')) invalid();
    return { operation, batchKey, runRequestId };
  }
  const rawSeed = jobRequest.getJobParam('seed');
  const seed = Number(rawSeed);
  if (!Number.isSafeInteger(seed) || seed < 1
    || String(jobRequest.getJobParam('syntheticOnly')).toLowerCase() !== 'true') invalid();
  return { operation, batchKey, seed };
}

export function createRefreshApplication({
  sdk, config, sourceManifest, clock = () => new Date().toISOString(), idFactory,
  logger = console,
  repositoryFactory = application => new CatalystIntelligenceRepository({
    application, sourceManifest, clock, idFactory,
  }),
}) {
  if (config?.environment !== 'Development' || config.projectId !== '43492000000013049'
    || !config.auditKey || !config.auditKeyVersion || !sourceManifest?.syntheticOnly) {
    throw new Error('Catalyst refresh runtime config is invalid.');
  }
  if (typeof idFactory !== 'function') throw new TypeError('idFactory is required.');

  return async function execute(jobRequest, context) {
    const requestId = idFactory('JOB');
    let phase = 'PARAMETERS';
    let input;
    let repository;
    try {
      input = parameters(jobRequest);
      phase = 'SDK_INITIALIZE';
      const application = sdk.initialize(context, { scope: 'admin' });
      phase = 'REPOSITORY_INITIALIZE';
      repository = repositoryFactory(application);
      if (input.runRequestId) {
        phase = 'RUN_REQUEST_VALIDATE';
        const request = await repository.getRunRequest(input.runRequestId);
        if (!request || request.Status !== 'SUBMITTED' || request.BatchKey !== input.batchKey
          || request.Operation !== input.operation) invalid();
        await repository.updateRunRequest(input.runRequestId, {
          Status: 'RUNNING', StartedAt: clock(), UpdatedAt: clock(), FailedPhase: null, FailureCode: null,
        });
      }
      const service = createRefreshService({
        repository, sourceGenerator: generateSourceSeed, sourceValidator: validateSourceSeed,
        adapter: toIntelligenceInput, pipeline: runIntelligencePipeline,
        clock, idFactory,
        auditKeys: { [config.auditKeyVersion]: config.auditKey },
        onProgress: nextPhase => { phase = nextPhase; },
      });
      phase = 'SERVICE_EXECUTION';
      const result = await service.execute(input);
      if (input.runRequestId) {
        phase = 'RUN_REQUEST_PUBLISH';
        await repository.updateRunRequest(input.runRequestId, {
          Status: 'PUBLISHED', CompletedAt: clock(), UpdatedAt: clock(),
          CurrentRunGroupID: result.runGroup?.RunGroupID ?? null,
        });
      }
      context.closeWithSuccess();
      return { ok: true, requestId, result };
    } catch (error) {
      const allowed = new Set(['INVALID_REQUEST', 'DATA_NOT_READY', 'CATALYST_UNAVAILABLE']);
      const code = allowed.has(error?.code) ? error.code : 'INTERNAL_ERROR';
      if (input?.runRequestId && repository) {
        try {
          const request = await repository.getRunRequest(input.runRequestId);
          if (request?.Status === 'RUNNING') await repository.updateRunRequest(input.runRequestId, {
            Status: 'FAILED_RETRYABLE', CompletedAt: clock(), UpdatedAt: clock(),
            FailedPhase: phase, FailureCode: code,
          });
        } catch { /* Preserve the original worker failure; stale requests are reconciled separately. */ }
      }
      try {
        logger.error(JSON.stringify({ event: 'intelligence_refresh_failed', requestId, phase, code }));
      } catch { /* Observability must not replace the original failure. */ }
      context.closeWithFailure(code);
      return { ok: false, requestId, error: { code } };
    }
  };
}

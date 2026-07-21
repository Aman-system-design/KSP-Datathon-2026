import { createHash } from 'node:crypto';

import { canonicalStringify } from '../workflow/canonical-json.mjs';
import { fail } from '../services/errors.mjs';

const digest = value => createHash('sha256').update(value).digest('hex');
const boundedKey = (value, name) => {
  if (typeof value !== 'string' || !/^[A-Za-z0-9._:-]{1,128}$/u.test(value)) {
    fail('INVALID_REQUEST', `${name} is invalid.`);
  }
  return value;
};
const mayManage = access => access?.actions?.includes('MANAGE_INTELLIGENCE_RUNS');
const mayRead = access => mayManage(access) || access?.actions?.includes('READ_INTELLIGENCE_RUNS');

export function createIntelligenceRunService({ repository, scheduler, clock, idFactory }) {
  if (typeof repository?.createRunRequest !== 'function') throw new TypeError('repository is required');
  if (typeof scheduler?.submit !== 'function') throw new TypeError('scheduler is required');
  if (typeof clock !== 'function' || typeof idFactory !== 'function') throw new TypeError('clock and idFactory are required');

  return Object.freeze({
    async list({ access }) {
      if (!mayRead(access)) fail('FORBIDDEN_ACTION');
      return repository.listRunRequests();
    },

    async submit({ access, batchKey, idempotencyKey }) {
      if (!mayManage(access)) fail('FORBIDDEN_ACTION');
      const boundedBatchKey = boundedKey(batchKey, 'batchKey');
      const boundedIdempotencyKey = boundedKey(idempotencyKey, 'Idempotency-Key');
      const requestHash = digest(canonicalStringify({
        operation: 'REFRESH_INTELLIGENCE', batchKey: boundedBatchKey,
      }));
      const idempotencyKeyHash = digest(boundedIdempotencyKey);
      const replay = await repository.getRunRequestByIdempotencyHash(idempotencyKeyHash);
      if (replay) {
        if (replay.RequestHash !== requestHash) fail('IDEMPOTENCY_CONFLICT');
        return replay;
      }

      const now = clock();
      let request = {
        RunRequestID: idFactory('RUNREQ'),
        IdempotencyKeyHash: idempotencyKeyHash,
        RequestHash: requestHash,
        BatchKey: boundedBatchKey,
        Operation: 'REFRESH_INTELLIGENCE',
        RequestedBy: access.actualUserId,
        Status: 'QUEUED',
        CatalystJobID: null,
        Attempt: 1,
        RequestedAt: now,
        StartedAt: null,
        CompletedAt: null,
        UpdatedAt: now,
        FailedPhase: null,
        FailureCode: null,
        CurrentRunGroupID: null,
        SyntheticData: access.syntheticData === true,
      };
      try {
        request = await repository.createRunRequest(request);
      } catch (error) {
        if (error?.code !== 'UNIQUE_CONFLICT') throw error;
        const concurrent = await repository.getRunRequestByIdempotencyHash(idempotencyKeyHash);
        if (!concurrent || concurrent.RequestHash !== requestHash) fail('IDEMPOTENCY_CONFLICT');
        return concurrent;
      }

      try {
        const job = await scheduler.submit({
          runRequestId: request.RunRequestID,
          batchKey: request.BatchKey,
          operation: request.Operation,
        });
        return repository.updateRunRequest(request.RunRequestID, {
          Status: 'SUBMITTED', CatalystJobID: String(job.jobId), UpdatedAt: clock(),
        });
      } catch {
        return repository.updateRunRequest(request.RunRequestID, {
          Status: 'FAILED_RETRYABLE', FailedPhase: 'JOB_SUBMISSION',
          FailureCode: 'JOB_SUBMISSION_FAILED', UpdatedAt: clock(),
        });
      }
    },
  });
}

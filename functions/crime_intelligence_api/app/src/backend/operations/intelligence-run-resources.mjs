import { fail } from '../services/errors.mjs';

const header = (headers, name) => Object.entries(headers ?? {})
  .find(([key]) => key.toLowerCase() === name.toLowerCase())?.[1];
const envelope = (data, access) => ({ data, syntheticData: access?.syntheticData === true });

export function createIntelligenceRunResources({ runService }) {
  if (typeof runService?.list !== 'function' || typeof runService?.submit !== 'function') {
    throw new TypeError('runService is required');
  }
  return Object.freeze({
    async listIntelligenceRuns({ access }) {
      return envelope(await runService.list({ access }), access);
    },
    async submitIntelligenceRun({ access, headers, body }) {
      const idempotencyKey = header(headers, 'Idempotency-Key');
      if (typeof idempotencyKey !== 'string' || !idempotencyKey.trim()) fail('INVALID_REQUEST');
      return envelope(await runService.submit({
        access, batchKey: body?.batchKey, idempotencyKey: idempotencyKey.trim(),
      }), access);
    },
  });
}

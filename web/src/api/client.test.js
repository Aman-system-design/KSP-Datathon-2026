import { afterEach, expect, test, vi } from 'vitest';

import { createApiClient } from './client.js';

afterEach(() => vi.unstubAllGlobals());

test('API client sends credentialed JSON and returns the governed data envelope', async () => {
  const fetch = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ data: { role: 'CRIME_ANALYST' } }) }));
  vi.stubGlobal('fetch', fetch);
  const api = createApiClient({ baseUrl: '/server/crime_intelligence_api' });
  expect(await api.get('/v1/workspace')).toEqual({ data: { role: 'CRIME_ANALYST' } });
  expect(fetch).toHaveBeenCalledWith('/server/crime_intelligence_api/v1/workspace', expect.objectContaining({ credentials: 'include' }));
});

test('workflow requests carry a client idempotency key', async () => {
  const fetch = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ data: {} }) }));
  vi.stubGlobal('fetch', fetch);
  const api = createApiClient({ baseUrl: '/api', keyFactory: () => 'KEY-1' });
  await api.workflow('/v1/alerts/ALT-1/notes', { expectedVersion: 0 });
  expect(fetch).toHaveBeenCalledWith('/api/v1/alerts/ALT-1/notes', expect.objectContaining({
    method: 'POST', headers: expect.objectContaining({ 'Idempotency-Key': 'KEY-1' }),
  }));
});

test('API client exposes only stable server errors', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok: false, status: 409,
    json: async () => ({ error: { code: 'VERSION_CONFLICT', message: 'The resource version has changed.', requestId: 'REQ-1' } }),
  })));
  const api = createApiClient({ baseUrl: '/api' });
  await expect(api.patch('/v1/reports/R-1', { expectedVersion: 1 })).rejects.toMatchObject({
    code: 'VERSION_CONFLICT', status: 409, requestId: 'REQ-1',
  });
});

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

test('Slate API client permits only the approved Catalyst Development Function base', async () => {
  const baseUrl = 'https://kspdatathon2026-60077844198.development.catalystserverless.in/server/crime_intelligence_api';
  const fetch = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ data: {} }) }));
  vi.stubGlobal('fetch', fetch);
  await createApiClient({ baseUrl }).get('/v1/workspace');
  expect(fetch).toHaveBeenCalledWith(`${baseUrl}/v1/workspace`, expect.objectContaining({ credentials: 'include' }));
  expect(() => createApiClient({ baseUrl: 'https://example.com/server/crime_intelligence_api' })).toThrow(TypeError);
});

test('Slate API calls carry a fresh Catalyst backend token in Authorization', async () => {
  const baseUrl = 'https://kspdatathon2026-60077844198.development.catalystserverless.in/server/crime_intelligence_api';
  const tokenProvider = vi.fn(async () => 'TOKEN-1');
  const fetch = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ data: {} }) }));
  vi.stubGlobal('fetch', fetch);

  await createApiClient({ baseUrl, tokenProvider }).get('/v1/workspace');

  expect(tokenProvider).toHaveBeenCalledOnce();
  expect(fetch).toHaveBeenCalledWith(`${baseUrl}/v1/workspace`, expect.objectContaining({
    headers: expect.objectContaining({ Authorization: 'TOKEN-1' }),
  }));
});

test('API client never sends an empty Authorization header', async () => {
  const fetch = vi.fn(async () => ({ ok: false, status: 401, json: async () => ({ error: { code: 'UNAUTHENTICATED' } }) }));
  vi.stubGlobal('fetch', fetch);
  const api = createApiClient({ baseUrl: '/api', tokenProvider: async () => null });

  await expect(api.get('/v1/workspace')).rejects.toMatchObject({ status: 401 });
  expect(fetch.mock.calls[0][1].headers).not.toHaveProperty('Authorization');
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

test('HTTP 401 remains an explicit unauthenticated state for the application boundary', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok: false, status: 401,
    json: async () => ({ error: { code: 'UNAUTHENTICATED', message: 'Authentication is required.', requestId: 'REQ-AUTH' } }),
  })));
  const api = createApiClient({ baseUrl: '/api' });
  await expect(api.get('/v1/workspace')).rejects.toMatchObject({
    code: 'UNAUTHENTICATED', status: 401, requestId: 'REQ-AUTH', authenticationRequired: true,
  });
});

test('development demo persona travels only as the explicit server-validated header', async () => {
  const fetch = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ data: {} }) }));
  vi.stubGlobal('fetch', fetch);
  const api = createApiClient({ baseUrl: '/api', headers: { 'X-Demo-Persona': 'CRIME_ANALYST' } });
  await api.get('/v1/workspace');
  expect(fetch).toHaveBeenCalledWith('/api/v1/workspace', expect.objectContaining({
    headers: expect.objectContaining({ 'X-Demo-Persona': 'CRIME_ANALYST' }),
  }));
});

export class ApiError extends Error {
  constructor({ code = 'INTERNAL_ERROR', message = 'The request could not be completed.', requestId, status }) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.requestId = requestId;
    this.status = status;
    this.authenticationRequired = status === 401 || code === 'UNAUTHENTICATED';
  }
}

const DEVELOPMENT_API = 'https://kspdatathon2026-60077844198.development.catalystserverless.in/server/crime_intelligence_api';

export function createApiClient({ baseUrl, keyFactory = () => crypto.randomUUID(), headers = {}, tokenProvider }) {
  const relative = typeof baseUrl === 'string' && baseUrl.startsWith('/') && !baseUrl.startsWith('//');
  if (!relative && baseUrl !== DEVELOPMENT_API) throw new TypeError('An approved API base URL is required');
  async function request(method, path, body, extraHeaders = {}) {
    const token = await tokenProvider?.();
    const authorization = typeof token === 'string' && token ? { Authorization: token } : {};
    const response = await fetch(`${baseUrl}${path}`, {
      method, credentials: 'include',
      headers: body === undefined
        ? { Accept: 'application/json', ...headers, ...extraHeaders, ...authorization }
        : { Accept: 'application/json', 'Content-Type': 'application/json', ...headers, ...extraHeaders, ...authorization },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new ApiError({ ...payload.error, status: response.status });
    return payload;
  }
  return Object.freeze({
    get: path => request('GET', path),
    post: (path, body) => request('POST', path, body),
    patch: (path, body) => request('PATCH', path, body),
    put: (path, body) => request('PUT', path, body),
    delete: path => request('DELETE', path),
    workflow: (path, body) => request('POST', path, body, { 'Idempotency-Key': keyFactory() }),
  });
}

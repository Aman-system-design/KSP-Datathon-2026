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

export function createApiClient({ baseUrl, keyFactory = () => crypto.randomUUID(), headers = {} }) {
  if (typeof baseUrl !== 'string' || !baseUrl.startsWith('/')) throw new TypeError('A relative API base URL is required');
  async function request(method, path, body, extraHeaders = {}) {
    const response = await fetch(`${baseUrl}${path}`, {
      method, credentials: 'include',
      headers: body === undefined
        ? { Accept: 'application/json', ...headers, ...extraHeaders }
        : { Accept: 'application/json', 'Content-Type': 'application/json', ...headers, ...extraHeaders },
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

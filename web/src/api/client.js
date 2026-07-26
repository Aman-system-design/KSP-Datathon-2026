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

export function apiFailureDiagnostic({ status, payload, error, token } = {}) {
  const body = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : null;
  const errorBody = body?.error && typeof body.error === 'object' && !Array.isArray(body.error) ? body.error : null;
  const dataBody = body?.data && typeof body.data === 'object' && !Array.isArray(body.data) ? body.data : null;
  return Object.freeze({
    status: Number.isInteger(status) ? status : null,
    kind: error ? 'transport' : 'response',
    payloadKeys: body ? Object.keys(body).sort() : [],
    errorKeys: errorBody ? Object.keys(errorBody).sort() : [],
    dataKeys: dataBody ? Object.keys(dataBody).sort() : [],
    ...(error ? { errorName: typeof error.name === 'string' ? error.name : 'UnknownError' } : {}),
    ...(error ? {
      tokenPresent: typeof token === 'string' && token.length > 0,
      tokenLength: typeof token === 'string' ? token.length : 0,
      tokenHeaderSafe: typeof token === 'string' && token.length > 0 && /^[\x20-\x7e]+$/u.test(token),
    } : {}),
  });
}

export function createApiClient({ baseUrl, keyFactory = () => crypto.randomUUID(), headers = {}, tokenProvider }) {
  const relative = typeof baseUrl === 'string' && baseUrl.startsWith('/') && !baseUrl.startsWith('//');
  if (!relative && baseUrl !== DEVELOPMENT_API) throw new TypeError('An approved API base URL is required');
  async function request(method, path, body, extraHeaders = {}) {
    const token = await tokenProvider?.();
    const authorization = typeof token === 'string' && token ? { Authorization: token } : {};
    let response;
    try {
      response = await fetch(`${baseUrl}${path}`, {
        method, credentials: relative ? 'include' : 'omit',
        headers: body === undefined
          ? { Accept: 'application/json', ...headers, ...extraHeaders, ...authorization }
          : { Accept: 'application/json', 'Content-Type': 'application/json', ...headers, ...extraHeaders, ...authorization },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch (error) {
      console.error('api_transport_failed', JSON.stringify(apiFailureDiagnostic({ error, token })));
      if (method === 'GET' && path === '/v1/workspace' && typeof token === 'string' && token.length > 0) {
        try {
          await fetch(`${baseUrl}${path}`, {
            method: 'GET', credentials: 'omit', headers: { Accept: 'application/json' },
          });
          throw new ApiError({ code: 'CATALYST_AUTHORIZATION_REQUEST_BLOCKED', status: 0 });
        } catch (probeError) {
          if (probeError instanceof ApiError) throw probeError;
        }
      }
      throw new ApiError({
        code: typeof token === 'string' && token.length > 0
          ? 'CATALYST_FUNCTION_UNREACHABLE' : 'CATALYST_AUTH_TOKEN_UNAVAILABLE',
        status: 0,
      });
    }
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error('api_response_failed', apiFailureDiagnostic({ status: response.status, payload }));
      throw new ApiError({ ...payload.error, status: response.status });
    }
    return payload;
  }
  return Object.freeze({
    get: path => request('GET', path),
    post: (path, body) => request('POST', path, body),
    patch: (path, body) => request('PATCH', path, body),
    put: (path, body) => request('PUT', path, body),
    delete: path => request('DELETE', path),
    workflow: (path, body) => request('POST', path, body, { 'Idempotency-Key': keyFactory() }),
    idempotent: (path, body, key) => request('POST', path, body, { 'Idempotency-Key': key }),
    idempotentPut: (path, body, key) => request('PUT', path, body, { 'Idempotency-Key': key }),
  });
}

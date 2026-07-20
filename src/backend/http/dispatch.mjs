import { API_OPERATIONS } from './api-contract.mjs';

const publicErrors = new Set([
  'UNAUTHENTICATED', 'INACTIVE_ACCESS_PROFILE', 'FORBIDDEN_ACTION', 'FORBIDDEN_SCOPE',
  'NOT_FOUND', 'INVALID_REQUEST', 'INVALID_STATE', 'IDEMPOTENCY_CONFLICT',
  'COMMAND_IN_PROGRESS', 'DATA_NOT_READY',
]);
const statusByCode = Object.freeze({
  UNAUTHENTICATED: 401, INACTIVE_ACCESS_PROFILE: 403, FORBIDDEN_ACTION: 403,
  FORBIDDEN_SCOPE: 403, NOT_FOUND: 404, INVALID_REQUEST: 400, INVALID_STATE: 409,
  IDEMPOTENCY_CONFLICT: 409, COMMAND_IN_PROGRESS: 409, DATA_NOT_READY: 503,
  INTERNAL_ERROR: 500,
});
const messageByCode = Object.freeze({
  UNAUTHENTICATED: 'Authentication is required.',
  INACTIVE_ACCESS_PROFILE: 'The access profile is inactive or unavailable.',
  FORBIDDEN_ACTION: 'The requested action is not permitted.',
  FORBIDDEN_SCOPE: 'The requested unit is outside the authorized scope.',
  NOT_FOUND: 'The requested resource was not found.',
  INVALID_REQUEST: 'The request is invalid.',
  INVALID_STATE: 'The alert state or version has changed.',
  IDEMPOTENCY_CONFLICT: 'The idempotency key was already used for a different request.',
  COMMAND_IN_PROGRESS: 'The command is still in progress.',
  DATA_NOT_READY: 'The requested intelligence is not ready.',
  INTERNAL_ERROR: 'The request could not be completed.',
});
const idPattern = '[A-Za-z0-9][A-Za-z0-9._:-]{0,63}';

function compile(operation) {
  const names = [];
  const escaped = operation.path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\\\{([A-Za-z][A-Za-z0-9]*)\\\}/g, (_, name) => {
      names.push(name);
      return `(${idPattern})`;
    });
  return { ...operation, names, regex: new RegExp(`^${escaped}$`) };
}
const compiled = API_OPERATIONS.map(compile);

function header(headers, name) {
  const entry = Object.entries(headers ?? {}).find(([key]) => key.toLowerCase() === name.toLowerCase());
  return entry?.[1];
}

function match(method, path) {
  for (const operation of compiled) {
    if (operation.method !== method) continue;
    const values = operation.regex.exec(path);
    if (!values) continue;
    return {
      operation,
      params: Object.fromEntries(operation.names.map((name, index) => [name, values[index + 1]])),
    };
  }
  return null;
}

function safeError(error, requestId) {
  let code = error?.code;
  if (code === 'INVALID_UNIT_HIERARCHY') code = 'DATA_NOT_READY';
  if (!publicErrors.has(code)) code = 'INTERNAL_ERROR';
  return {
    status: statusByCode[code],
    body: { error: { code, message: messageByCode[code], requestId } },
  };
}

function assignmentGrant(row) {
  const parse = (value) => {
    try { return JSON.parse(value); } catch { return []; }
  };
  return {
    alertId: row.AlertID,
    authorizedUnitIds: parse(row.AuthorizedUnitIDsJSON),
    authorizedCaseIds: parse(row.AuthorizedCaseIDsJSON),
    evidenceAccessLevel: row.EvidenceAccessLevel,
    active: true,
  };
}

function workflowBody(body) {
  const keys = body && typeof body === 'object' && !Array.isArray(body) ? Object.keys(body).sort() : [];
  if (!body || typeof body !== 'object' || Array.isArray(body)
    || keys.join(',') !== 'expectedState,expectedVersion,payload'
    || typeof body.expectedState !== 'string'
    || !Number.isInteger(body.expectedVersion)
    || !body.payload || typeof body.payload !== 'object' || Array.isArray(body.payload)) {
    const error = new Error('invalid workflow body'); error.code = 'INVALID_REQUEST'; throw error;
  }
  return body;
}

export function createDispatcher({
  readServices, commandService, accessResolver, profileRepository, environment = 'Development',
}) {
  return async function dispatch({ request, currentUser }) {
    const requestId = typeof request?.requestId === 'string' ? request.requestId : 'REQ-UNAVAILABLE';
    try {
      const method = String(request?.method ?? '').toUpperCase();
      const path = request?.path;
      if (typeof path !== 'string') { const error = new Error(); error.code = 'NOT_FOUND'; throw error; }
      const route = match(method, path);
      if (!route) { const error = new Error(); error.code = 'NOT_FOUND'; throw error; }

      const profile = currentUser?.user_id
        ? await profileRepository.getAccessProfile(currentUser.user_id) : undefined;
      const [units, rawAssignments] = await Promise.all([
        profileRepository.getUnits(),
        profile?.EmployeeID ? profileRepository.getAssignmentsForEmployee(profile.EmployeeID) : [],
      ]);
      const access = await accessResolver({
        currentUser, profile, units,
        assignments: rawAssignments.map(assignmentGrant),
        requestedPersona: header(request.headers, 'X-Demo-Persona'), environment,
      });

      if (route.operation.method === 'GET') {
        const service = readServices[route.operation.service];
        if (typeof service !== 'function') throw new Error('unconfigured read operation');
        const body = await service({ access, params: route.params, query: request.query ?? {} });
        return { status: 200, body };
      }

      const body = workflowBody(request.body);
      const idempotencyKey = header(request.headers, 'Idempotency-Key');
      if (typeof idempotencyKey !== 'string' || !idempotencyKey.trim()) {
        const error = new Error(); error.code = 'INVALID_REQUEST'; throw error;
      }
      const result = await commandService.execute({
        access, route: route.operation.path, commandType: route.operation.commandType,
        alertId: route.params.alertId, idempotencyKey,
        expectedState: body.expectedState, expectedVersion: body.expectedVersion,
        payload: body.payload,
      });
      return { status: 200, body: result };
    } catch (error) {
      return safeError(error, requestId);
    }
  };
}

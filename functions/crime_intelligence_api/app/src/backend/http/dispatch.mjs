import { API_OPERATIONS } from './api-contract.mjs';

const publicErrors = new Set([
  'UNAUTHENTICATED', 'INACTIVE_ACCESS_PROFILE', 'FORBIDDEN_ACTION', 'FORBIDDEN_SCOPE',
  'NOT_FOUND', 'INVALID_REQUEST', 'INVALID_STATE', 'IDEMPOTENCY_CONFLICT',
  'COMMAND_IN_PROGRESS', 'DATA_NOT_READY',
  'VERSION_CONFLICT', 'RESOURCE_IN_USE',
]);
const statusByCode = Object.freeze({
  UNAUTHENTICATED: 401, INACTIVE_ACCESS_PROFILE: 403, FORBIDDEN_ACTION: 403,
  FORBIDDEN_SCOPE: 403, NOT_FOUND: 404, INVALID_REQUEST: 400, INVALID_STATE: 409,
  IDEMPOTENCY_CONFLICT: 409, COMMAND_IN_PROGRESS: 409, DATA_NOT_READY: 503,
  VERSION_CONFLICT: 409, RESOURCE_IN_USE: 409,
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
  VERSION_CONFLICT: 'The resource version has changed.',
  RESOURCE_IN_USE: 'The resource is currently in use.',
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

export function isDeclaredApiRoute(method, path) {
  return Boolean(match(String(method ?? '').toUpperCase(), path));
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
  readServices, resourceServices = {}, commandService, accessResolver, profileRepository, auditService,
  environment = 'Development',
}) {
  if (typeof auditService?.record !== 'function') throw new TypeError('auditService is required');
  return async function dispatch({ request, currentUser }) {
    const requestId = typeof request?.requestId === 'string' ? request.requestId : 'REQ-UNAVAILABLE';
    let access;
    let route;
    let phase = 'ROUTE_MATCH';
    try {
      const method = String(request?.method ?? '').toUpperCase();
      const path = request?.path;
      if (typeof path !== 'string') { const error = new Error(); error.code = 'NOT_FOUND'; throw error; }
      route = match(method, path);
      if (!route) { const error = new Error(); error.code = 'NOT_FOUND'; throw error; }

      phase = 'ACCESS_PROFILE';
      const profile = currentUser?.user_id
        ? await profileRepository.getAccessProfile(currentUser.user_id) : undefined;
      phase = 'ACCESS_INPUTS';
      const [units, rawAssignments] = await Promise.all([
        profileRepository.getUnits(),
        profile?.EmployeeID ? profileRepository.getAssignmentsForEmployee(profile.EmployeeID) : [],
      ]);
      phase = 'ACCESS_RESOLUTION';
      access = await accessResolver({
        currentUser, profile, units,
        assignments: rawAssignments.map(assignmentGrant),
        requestedPersona: header(request.headers, 'X-Demo-Persona'), environment,
      });
      if (access.demoPersona) {
        phase = 'DEMO_PERSONA_AUDIT';
        await auditService.record({ access, currentUser, eventType: 'DEMO_PERSONA_ASSUMED', requestId, route: route.operation.path, outcome: 'ALLOWED' });
      }

      if (route.operation.kind === 'resource') {
        phase = 'RESOURCE_EXECUTION';
        const service = resourceServices[route.operation.service];
        if (typeof service !== 'function') throw new Error('unconfigured resource operation');
        const result = await service({
          access, params: route.params, query: request.query ?? {}, body: request.body ?? null,
          headers: request.headers ?? {}, requestId,
        });
        const { auditDetails, auditMode, ...body } = result;
        if (auditMode !== 'COALESCED_UNCHANGED') {
          phase = 'RESOURCE_AUDIT';
          await auditService.record({
            access, currentUser,
            eventType: route.operation.auditEventType ?? (route.operation.method === 'GET' ? 'SENSITIVE_READ' : 'CONFIGURATION_CHANGED'),
            requestId, route: route.operation.path, outcome: 'ALLOWED', details: auditDetails,
          });
        }
        return { status: route.operation.successStatus ?? 200, body };
      }

      if (route.operation.method === 'GET') {
        phase = 'READ_EXECUTION';
        const service = readServices[route.operation.service];
        if (typeof service !== 'function') throw new Error('unconfigured read operation');
        const body = await service({ access, params: route.params, query: request.query ?? {} });
        phase = 'READ_AUDIT';
        await auditService.record({ access, currentUser, eventType: 'SENSITIVE_READ', requestId, route: route.operation.path, outcome: 'ALLOWED' });
        return { status: 200, body };
      }

      phase = 'WORKFLOW_EXECUTION';
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
      if (currentUser?.user_id && ['UNAUTHENTICATED', 'INACTIVE_ACCESS_PROFILE', 'FORBIDDEN_ACTION', 'FORBIDDEN_SCOPE'].includes(error?.code)) {
        try {
          await auditService.record({ access, currentUser, eventType: 'SECURITY_DECISION_DENIED', requestId, route: route?.operation?.path ?? request?.path ?? 'UNKNOWN', outcome: 'DENIED', code: error.code });
        } catch { /* Preserve the original authorization failure; audit health is reconciled separately. */ }
      }
      const response = safeError(error, requestId);
      if (response.status >= 500) {
        response.diagnostic = {
          phase,
          operation: typeof error?.operation === 'string' ? error.operation : 'UNCLASSIFIED',
        };
      }
      return response;
    }
  };
}

const statusByCode = {
  FORBIDDEN_ACTION: 403,
  FORBIDDEN_SCOPE: 403,
  NOT_FOUND: 404,
  INVALID_REQUEST: 400,
  INVALID_STATE: 409,
  IDEMPOTENCY_CONFLICT: 409,
  LEGACY_IDENTITY_CONFLICT: 409,
  COMMAND_IN_PROGRESS: 409,
  VERSION_CONFLICT: 409,
  RESOURCE_IN_USE: 409,
  DATA_NOT_READY: 503,
};

export class ServiceError extends Error {
  constructor(code, message = code) {
    super(message);
    this.name = 'ServiceError';
    this.code = code;
    this.status = statusByCode[code] ?? 500;
  }
}

export const fail = (code, message) => { throw new ServiceError(code, message); };

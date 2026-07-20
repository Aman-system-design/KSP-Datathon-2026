const statusByCode = {
  FORBIDDEN_ACTION: 403,
  FORBIDDEN_SCOPE: 403,
  NOT_FOUND: 404,
  INVALID_REQUEST: 400,
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

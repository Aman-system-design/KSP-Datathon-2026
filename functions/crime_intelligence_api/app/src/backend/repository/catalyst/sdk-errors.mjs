export class CatalystSdkError extends Error {
  constructor(code = 'CATALYST_UNAVAILABLE', status = 503) {
    super('Catalyst service is temporarily unavailable.');
    this.name = 'CatalystSdkError';
    this.code = code;
    this.status = status;
  }

  toJSON() {
    return { code: this.code, status: this.status, message: this.message };
  }
}

export function sanitizeCatalystSdkError(_error, _context = {}) {
  return new CatalystSdkError();
}

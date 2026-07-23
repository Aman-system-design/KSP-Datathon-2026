const EXPECTED_PROJECT = '43492000000013049';
const EXPECTED_PERMISSION_VERSION = '1.0.0';
const EXPECTED_ORGANIZATION = 'ORG-KSP';

export function loadRuntimeConfig(environment = process.env) {
  if (environment.KSP_ENVIRONMENT !== 'Development') throw new Error('Runtime config must target Development.');
  if (environment.KSP_PROJECT_ID !== EXPECTED_PROJECT) throw new Error('Runtime project config is invalid.');
  if (environment.KSP_PERMISSION_VERSION !== EXPECTED_PERMISSION_VERSION) throw new Error('Runtime permission config is invalid.');
  if (typeof environment.KSP_AUDIT_KEY !== 'string' || environment.KSP_AUDIT_KEY.length < 32) throw new Error('Runtime audit config is invalid.');
  if (!/^[A-Za-z0-9._-]{1,32}$/u.test(environment.KSP_AUDIT_KEY_VERSION ?? '')) throw new Error('Runtime audit key version is invalid.');
  if (!/^[A-Za-z0-9._-]{1,100}$/u.test(environment.KSP_INTELLIGENCE_JOB_POOL ?? '')) throw new Error('Runtime job pool config is invalid.');
  return Object.freeze({
    environment: 'Development', projectId: EXPECTED_PROJECT,
    organizationId: EXPECTED_ORGANIZATION,
    permissionVersion: EXPECTED_PERMISSION_VERSION,
    auditKey: environment.KSP_AUDIT_KEY, auditKeyVersion: environment.KSP_AUDIT_KEY_VERSION,
    intelligenceJobPool: environment.KSP_INTELLIGENCE_JOB_POOL,
  });
}

export const repositoryMethods = Object.freeze([
  'getCurrentRunGroup',
  'getBrief',
  'listPatterns',
  'getPattern',
  'listHotspots',
  'listAnomalies',
  'getAreaRisk',
  'getNetwork',
  'getDistrictContext',
  'getAccessProfile',
  'getUnits',
  'getAlert',
  'createCommand',
  'getCommand',
  'getCommandByIdempotencyHash',
  'updateCommand',
  'insertDomainArtifact',
  'findDomainArtifactByCommand',
  'getAssignmentsForAlert',
  'compareAndSwapAlert',
  'appendAuditEvent',
  'findAuditByCommand',
  'getAuditStream',
  'reconcileCommand',
]);

export function assertRepository(repository) {
  for (const method of repositoryMethods) {
    if (typeof repository?.[method] !== 'function') throw new TypeError(`repository missing ${method}`);
  }
  return repository;
}

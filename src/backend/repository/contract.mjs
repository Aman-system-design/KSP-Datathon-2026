export const repositoryMethods = Object.freeze([
  'getCurrentRunGroup',
  'listAnalysisRuns',
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
  'listCommands',
  'listAuditEvents',
  'getRefreshBatch',
  'createRefreshBatch',
  'updateRefreshBatch',
  'publishRefreshBatch',
]);

export function assertRepository(repository) {
  for (const method of repositoryMethods) {
    if (typeof repository?.[method] !== 'function') throw new TypeError(`repository missing ${method}`);
  }
  return repository;
}

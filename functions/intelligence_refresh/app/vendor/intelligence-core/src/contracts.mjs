export function createAnalysisRun({ id, type, method, version, observedFrom, observedTo, parameters = {} }) {
  if (![id, type, method, version, observedFrom, observedTo].every(Boolean)) throw new Error('analysis run fields are required');
  return Object.freeze({ id, type, method, version, observedFrom, observedTo, parameters: structuredClone(parameters), synthetic: true });
}

export function createFinding({ id, run, evidenceCaseIds, confidence, limitations }) {
  if (!id || !run?.id) throw new Error('finding id and run are required');
  return Object.freeze({
    id,
    runId: run.id,
    method: run.method,
    version: run.version,
    observationWindow: { from: run.observedFrom, to: run.observedTo },
    evidenceCaseIds: [...new Set(evidenceCaseIds)].sort(),
    confidence,
    limitations: [...limitations],
    synthetic: true,
  });
}

export function assertFindingEvidence(finding) {
  if (!finding.runId || !finding.method || !finding.version) throw new Error('finding lacks analysis lineage');
  if (!Array.isArray(finding.evidenceCaseIds) || finding.evidenceCaseIds.length === 0) throw new Error('finding lacks evidence');
  if (!Array.isArray(finding.limitations)) throw new Error('finding lacks limitations');
  return true;
}

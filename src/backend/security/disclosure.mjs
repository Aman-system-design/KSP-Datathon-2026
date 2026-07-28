import { deny } from './identity.mjs';

const localEvidenceRoles = new Set([
  'DISTRICT_LEADERSHIP', 'CRIME_ANALYST', 'STATION_OPERATIONS',
]);

function activeGrant(access, pattern, row) {
  if (access.role !== 'CRIME_ANALYST') return false;
  return (access.assignments ?? []).some(assignment => assignment.active === true
    && assignment.alertId === pattern.alertId
    && assignment.evidenceAccessLevel === 'CASE_EVIDENCE'
    && assignment.authorizedUnitIds.includes(row.unitId)
    && assignment.authorizedCaseIds.includes(row.caseId));
}

const canSeeEvidence = (access, pattern, row) => (
  (localEvidenceRoles.has(access.role) && access.authorizedUnitIds.has(row.unitId))
  || activeGrant(access, pattern, row)
);

const rejectRetiredRole = access => {
  if (access?.role === 'REGIONAL_LEADERSHIP') deny('NOT_FOUND');
};

export function projectPattern({ pattern, access }) {
  rejectRetiredRole(access);
  const { evidence = [], evidenceCaseIds, pairEvidence = [], unitSummaries = [], ...safePattern } = pattern;
  const visibleEvidence = evidence.filter(row => canSeeEvidence(access, pattern, row));
  const visibleUnitIds = new Set([
    ...[...access.authorizedUnitIds].filter(unitId => unitSummaries.some(row => row.unitId === unitId)),
    ...visibleEvidence.map(({ unitId }) => unitId),
  ]);
  if (visibleUnitIds.size === 0) deny('NOT_FOUND');

  const hiddenEvidence = evidence.filter(row => !canSeeEvidence(access, pattern, row));
  const visibleCaseIds = new Set(visibleEvidence.map(({ caseId }) => caseId));
  const hiddenByUnit = new Set(hiddenEvidence.map(({ unitId }) => unitId));
  const aggregateUnits = unitSummaries
    .filter(({ unitId }) => hiddenByUnit.has(unitId))
    .map(({ unitId, unitName, caseCount, observationPeriod }) => ({
      unitId, unitName, caseCount, observationPeriod, accessLevel: 'AGGREGATE',
    }));

  return Object.freeze({
    ...structuredClone(safePattern),
    evidence: structuredClone(visibleEvidence),
    evidenceCaseIds: visibleEvidence.map(({ caseId }) => caseId),
    pairEvidence: structuredClone(pairEvidence.filter(row => visibleCaseIds.has(row.left) && visibleCaseIds.has(row.right))),
    aggregateUnits,
    redactedEvidenceCount: hiddenEvidence.length,
    redactedUnitCount: aggregateUnits.length,
    redactionReason: hiddenEvidence.length ? 'CROSS_UNIT_SCOPE' : null,
  });
}

export function projectNetwork({ network, access }) {
  rejectRetiredRole(access);
  const assignmentAllows = edge => access.role === 'CRIME_ANALYST'
    && (access.assignments ?? []).some(assignment => assignment.active === true
      && assignment.evidenceAccessLevel === 'CASE_EVIDENCE'
      && assignment.authorizedUnitIds.includes(edge.unitId)
      && assignment.authorizedCaseIds.includes(edge.sourceCaseId));
  const visible = (network?.edges ?? []).filter(edge => (
    (localEvidenceRoles.has(access.role) && access.authorizedUnitIds.has(edge.unitId))
    || assignmentAllows(edge)
  ));
  if (visible.length === 0) deny('NOT_FOUND');
  const hidden = network.edges.filter(edge => !visible.includes(edge));
  const visibleCases = new Set(visible
    .filter(edge => edge.type === 'CASE_HAS_ACCUSED'
      && (edge.from === network.node.id || edge.to === network.node.id))
    .map(({ sourceCaseId }) => sourceCaseId));
  const { edges, node, evidenceCaseIds, ...metadata } = network;
  const visibleEvidenceCaseIds = [...new Set(visible.map(({ sourceCaseId }) => sourceCaseId))].sort();
  return Object.freeze({
    ...structuredClone(metadata),
    node: { id: node.id, type: node.type, unitIds: [...new Set(visible.map(({ unitId }) => unitId))] },
    edges: structuredClone(visible),
    evidenceCaseIds: visibleEvidenceCaseIds,
    repeatAppearanceCount: visibleCases.size,
    redactedEvidenceCount: hidden.length,
    redactionReason: hidden.length ? 'CROSS_UNIT_SCOPE' : null,
  });
}

import { deny } from './identity.mjs';

const localEvidenceRoles = new Set([
  'REGIONAL_LEADERSHIP', 'DISTRICT_LEADERSHIP', 'CRIME_ANALYST', 'STATION_OPERATIONS',
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

export function projectPattern({ pattern, access }) {
  const { evidence = [], unitSummaries = [], ...safePattern } = pattern;
  const visibleEvidence = evidence.filter(row => canSeeEvidence(access, pattern, row));
  const visibleUnitIds = new Set([
    ...[...access.authorizedUnitIds].filter(unitId => unitSummaries.some(row => row.unitId === unitId)),
    ...visibleEvidence.map(({ unitId }) => unitId),
  ]);
  if (visibleUnitIds.size === 0) deny('NOT_FOUND');

  const hiddenEvidence = evidence.filter(row => !canSeeEvidence(access, pattern, row));
  const hiddenByUnit = new Set(hiddenEvidence.map(({ unitId }) => unitId));
  const aggregateUnits = unitSummaries
    .filter(({ unitId }) => hiddenByUnit.has(unitId))
    .map(({ unitId, unitName, caseCount, observationPeriod }) => ({
      unitId, unitName, caseCount, observationPeriod, accessLevel: 'AGGREGATE',
    }));

  return Object.freeze({
    ...structuredClone(safePattern),
    evidence: structuredClone(visibleEvidence),
    aggregateUnits,
    redactedEvidenceCount: hiddenEvidence.length,
    redactedUnitCount: aggregateUnits.length,
    redactionReason: hiddenEvidence.length ? 'CROSS_UNIT_SCOPE' : null,
  });
}

export function projectNetwork({ network, access }) {
  const localAllowed = localEvidenceRoles.has(access.role)
    && access.authorizedUnitIds.has(network?.node?.unitId);
  if (!localAllowed) deny('NOT_FOUND');
  return structuredClone(network);
}

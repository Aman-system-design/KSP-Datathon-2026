import { identityCandidatePairs, normalizeIdentityName } from './candidates.mjs';

export function resolveIdentityPair(left, right) {
  if (left.personId && right.personId && left.personId === right.personId) {
    return Object.freeze({
      left: left.appearanceId,
      right: right.appearanceId,
      status: 'CONFIRMED',
      method: 'AUTHORITATIVE_PERSON_ID',
      confidence: 1,
      evidence: ['PERSON_ID_MATCH'],
      synthetic: true,
    });
  }
  const conflictingIds = left.personId && right.personId && left.personId !== right.personId;
  const nameMatch = normalizeIdentityName(left.name) === normalizeIdentityName(right.name);
  const ageClose = Math.abs(Number(left.age) - Number(right.age)) <= 2;
  const genderMatch = left.gender === right.gender;
  const confidence = (nameMatch ? 0.5 : 0) + (ageClose ? 0.2 : 0) + (genderMatch ? 0.1 : 0);
  return Object.freeze({
    left: left.appearanceId,
    right: right.appearanceId,
    status: conflictingIds ? 'REJECTED' : confidence >= 0.7 ? 'CANDIDATE' : 'REJECTED',
    method: 'ATTRIBUTE_CANDIDATE',
    confidence,
    evidence: [nameMatch && 'NAME_MATCH', ageClose && 'AGE_CLOSE', genderMatch && 'GENDER_MATCH', conflictingIds && 'PERSON_ID_CONFLICT'].filter(Boolean),
    synthetic: true,
  });
}

export function resolveIdentities(features) {
  const appearances = features.flatMap(row => row.accused.map(accused => ({ ...accused, caseId: row.caseId })));
  const candidates = identityCandidatePairs(appearances);
  const resolutions = candidates.pairs.map(([left, right]) => resolveIdentityPair(left, right));
  return Object.freeze({ resolutions, diagnostics: candidates.diagnostics });
}

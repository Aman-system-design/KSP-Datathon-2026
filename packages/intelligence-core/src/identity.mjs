const normalize = value => value.toLocaleLowerCase('en-IN').normalize('NFKD').replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();

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
  const nameMatch = normalize(left.name) === normalize(right.name);
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
  const resolutions = [];
  for (let left = 0; left < appearances.length; left += 1) {
    for (let right = left + 1; right < appearances.length; right += 1) {
      const samePersonId = appearances[left].personId && appearances[left].personId === appearances[right].personId;
      const sameName = normalize(appearances[left].name) === normalize(appearances[right].name);
      if (!samePersonId && !sameName) continue;
      resolutions.push(resolveIdentityPair(appearances[left], appearances[right]));
    }
  }
  return resolutions;
}

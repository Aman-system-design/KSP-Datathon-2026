import { haversineKm } from './math.mjs';

const earthRadiusKm = 6371.0088;
const radians = degrees => degrees * Math.PI / 180;
const pairKey = (left, right) => left < right ? `${left}:${right}` : `${right}:${left}`;
const diagnostics = (eligibleCount, candidatePairCount) => Object.freeze({
  eligibleCount,
  fullPairCount: eligibleCount * (eligibleCount - 1) / 2,
  candidatePairCount,
});

export const normalizeIdentityName = value => String(value ?? '')
  .toLocaleLowerCase('en-IN').normalize('NFKD').replace(/[^a-z0-9 ]/gu, '')
  .replace(/\s+/gu, ' ').trim();

function sphereCell(row, cellSizeKm) {
  const latitude = radians(Number(row.latitude));
  const longitude = radians(Number(row.longitude));
  const scale = earthRadiusKm / cellSizeKm;
  return [
    Math.floor(Math.cos(latitude) * Math.cos(longitude) * scale),
    Math.floor(Math.cos(latitude) * Math.sin(longitude) * scale),
    Math.floor(Math.sin(latitude) * scale),
  ];
}

export function spatialCandidatePairs(features, { radiusKm, maximumDays } = {}) {
  if (!Number.isFinite(radiusKm) || radiusKm <= 0) throw new TypeError('radiusKm must be positive');
  if (maximumDays !== undefined && (!Number.isFinite(maximumDays) || maximumDays <= 0)) throw new TypeError('maximumDays must be positive');
  const eligible = features.filter(row => row.eligible === true);
  const buckets = new Map();
  const pairs = [];
  const timeCellMs = maximumDays ? maximumDays * 86_400_000 : null;
  for (let right = 0; right < eligible.length; right += 1) {
    const cell = sphereCell(eligible[right], radiusKm);
    const timeCell = timeCellMs ? Math.floor(new Date(eligible[right].incidentAt).getTime() / timeCellMs) : null;
    const timeOffsets = timeCellMs ? [-1, 0, 1] : [0];
    for (const timeOffset of timeOffsets) for (let x = -1; x <= 1; x += 1) for (let y = -1; y <= 1; y += 1) for (let z = -1; z <= 1; z += 1) {
      const key = `${timeCellMs ? timeCell + timeOffset : 'all'}:${cell[0] + x}:${cell[1] + y}:${cell[2] + z}`;
      for (const left of buckets.get(key) ?? []) {
        const withinTime = !maximumDays
          || Math.abs(new Date(eligible[left].incidentAt) - new Date(eligible[right].incidentAt)) / 86_400_000 <= maximumDays;
        if (withinTime && haversineKm(eligible[left].latitude, eligible[left].longitude,
          eligible[right].latitude, eligible[right].longitude) <= radiusKm) {
          pairs.push([eligible[left], eligible[right]]);
        }
      }
    }
    const key = `${timeCellMs ? timeCell : 'all'}:${cell.join(':')}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(right);
  }
  return Object.freeze({ pairs, diagnostics: diagnostics(eligible.length, pairs.length) });
}

export function identityCandidatePairs(appearances) {
  const buckets = new Map();
  const indexedPairs = new Map();
  for (let index = 0; index < appearances.length; index += 1) {
    const appearance = appearances[index];
    const keys = [
      appearance.personId ? `person:${appearance.personId}` : null,
      normalizeIdentityName(appearance.name) ? `name:${normalizeIdentityName(appearance.name)}` : null,
    ].filter(Boolean);
    for (const key of keys) {
      for (const prior of buckets.get(key) ?? []) indexedPairs.set(pairKey(prior, index), [prior, index]);
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(index);
    }
  }
  const pairs = [...indexedPairs.values()]
    .sort(([leftA, rightA], [leftB, rightB]) => leftA - leftB || rightA - rightB)
    .map(([left, right]) => [appearances[left], appearances[right]]);
  return Object.freeze({ pairs, diagnostics: diagnostics(appearances.length, pairs.length) });
}

export function patternCandidatePairs(features, { maximumDays = 180, spatialRadiusKm = 50 } = {}) {
  if (!Number.isFinite(maximumDays) || maximumDays <= 0) throw new TypeError('maximumDays must be positive');
  const eligible = features.filter(row => row.eligible === true);
  const indexes = new Map(eligible.map((row, index) => [row, index]));
  const indexedPairs = new Map();
  const addPair = (left, right) => {
    if (left !== right) indexedPairs.set(pairKey(left, right), left < right ? [left, right] : [right, left]);
  };
  const addBucket = (buckets, key, index) => {
    for (const prior of buckets.get(key) ?? []) addPair(prior, index);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(index);
  };

  const maximumLegalBucketSize = 200;
  const evidenceMembers = new Map();
  for (let index = 0; index < eligible.length; index += 1) {
    const row = eligible[index];
    const keys = [
      ...(row.acts ?? []).map(value => `act:${value}`),
      ...(row.sections ?? []).map(value => `section:${value}`),
      ...(row.accused ?? []).flatMap(person => person.personId ? [`person:${person.personId}`] : []),
    ];
    for (const key of new Set(keys)) {
      if (!evidenceMembers.has(key)) evidenceMembers.set(key, []);
      evidenceMembers.get(key).push(index);
    }
  }
  for (const [key, members] of evidenceMembers) {
    const commonLegalProvision = (key.startsWith('act:') || key.startsWith('section:'))
      && members.length > maximumLegalBucketSize;
    if (commonLegalProvision) continue;
    const bucket = new Map();
    for (const index of members) addBucket(bucket, key, index);
  }
  for (const [left, right] of spatialCandidatePairs(eligible, { radiusKm: spatialRadiusKm, maximumDays }).pairs) {
    addPair(indexes.get(left), indexes.get(right));
  }

  const pairs = [...indexedPairs.values()]
    .filter(([left, right]) => Math.abs(new Date(eligible[left].incidentAt) - new Date(eligible[right].incidentAt)) / 86_400_000 <= maximumDays)
    .sort(([leftA, rightA], [leftB, rightB]) => leftA - leftB || rightA - rightB)
    .map(([left, right]) => [eligible[left], eligible[right]]);
  return Object.freeze({ pairs, diagnostics: diagnostics(eligible.length, pairs.length) });
}

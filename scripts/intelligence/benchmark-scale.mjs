import { performance } from 'node:perf_hooks';
import { pathToFileURL } from 'node:url';

import { detectHotspots } from '@ksp/intelligence-core/hotspot';
import { resolveIdentities } from '@ksp/intelligence-core/identity';
import { discoverPatterns } from '@ksp/intelligence-core/pattern-fusion';

const plantedIds = Object.freeze(Array.from({ length: 6 }, (_, index) => `BENCH-PATTERN-${index + 1}`));
const crimes = Object.freeze(['THEFT', 'BURGLARY', 'FRAUD', 'ROBBERY', 'ASSAULT', 'CYBER', 'NARCOTICS', 'OTHER']);

function randomGenerator(seed) {
  let value = seed >>> 0;
  return () => {
    value += 0x6D2B79F5;
    let next = value;
    next = Math.imul(next ^ next >>> 15, next | 1);
    next ^= next + Math.imul(next ^ next >>> 7, next | 61);
    return ((next ^ next >>> 14) >>> 0) / 4_294_967_296;
  };
}

function plantedFeature(index) {
  return Object.freeze({
    caseId: plantedIds[index], districtId: index % 2 ? 102 : 101, stationId: 1001 + index,
    crimeMajor: 'THEFT', crimeMinor: 'VEHICLE_THEFT', gravity: 3,
    incidentAt: new Date(Date.UTC(2026, 0, 1 + index * 5, 2)).toISOString(),
    latitude: 12.9716 + index * 0.001, longitude: 77.5946 + index * 0.001,
    acts: ['IPC'], sections: ['379'],
    accused: [{ appearanceId: `BENCH-APP-${index + 1}`, personId: 'BENCH-PERSON-1', name: 'Synthetic Pattern', age: 30, gender: 'M' }],
    briefFacts: 'synthetic motorcycle theft by two riders using a duplicate key at night',
    timeBand: 'NIGHT', ageDays: index * 5, completeness: 1, eligible: true, synthetic: true,
  });
}

export function generateBenchmarkFeatures({ count, seed = 20260721 }) {
  if (!Number.isSafeInteger(count) || count < plantedIds.length) throw new TypeError('count must be a safe integer of at least six');
  const random = randomGenerator(seed);
  return Array.from({ length: count }, (_, index) => {
    if (index < plantedIds.length) return plantedFeature(index);
    const sequence = index - plantedIds.length;
    const location = sequence % 35;
    const year = 1976 + Math.floor(sequence / 35) % 50;
    const month = Math.floor(sequence / (35 * 50)) % 12;
    const crimeMajor = crimes[Math.floor(random() * crimes.length)];
    const incidentAt = new Date(Date.UTC(year, month, 1 + index % 27, index % 24));
    return Object.freeze({
      caseId: `BENCH-${String(index + 1).padStart(6, '0')}`,
      districtId: 200 + location % 10, stationId: 2000 + location,
      crimeMajor, crimeMinor: `${crimeMajor}_OTHER`, gravity: 1 + index % 5,
      incidentAt: incidentAt.toISOString(),
      latitude: 12 + location % 7, longitude: 74 + Math.floor(location / 7),
      acts: [`ACT-${index}`], sections: [`SECTION-${index}`],
      accused: [{ appearanceId: `BENCH-APP-${index}`, personId: `BENCH-PERSON-${index}`, name: `Synthetic Person ${index}`, age: 18 + index % 60, gender: index % 2 ? 'F' : 'M' }],
      briefFacts: `synthetic unrelated benchmark incident ${index}`,
      timeBand: ['NIGHT', 'MORNING', 'AFTERNOON', 'EVENING'][index % 4],
      ageDays: Math.max(0, (Date.UTC(2026, 6, 21) - incidentAt.getTime()) / 86_400_000),
      completeness: 1, eligible: true, synthetic: true,
    });
  });
}

export function benchmarkScale({ count, seed = 20260721 }) {
  const features = generateBenchmarkFeatures({ count, seed });
  const started = performance.now();
  const hotspot = detectHotspots(features, { radiusKm: 1.5, minCases: 5, runId: `BENCH-${count}`, maximumAgeDays: 180 });
  const identity = resolveIdentities(features);
  const pattern = discoverPatterns(features, { threshold: 0.65, minimumCases: 4, minimumEvidenceFamilies: 3 });
  const elapsedMs = performance.now() - started;
  const fullPairCount = count * (count - 1) / 2;
  const plantedPatternFound = pattern.patterns.some(item => plantedIds.every(id => item.evidenceCaseIds.includes(id)));
  if (!plantedPatternFound || pattern.diagnostics.candidatePairCount >= fullPairCount) {
    throw new Error('Scale benchmark failed its correctness or candidate-reduction gate.');
  }
  return Object.freeze({
    count,
    elapsedMs: Number(elapsedMs.toFixed(2)),
    heapUsedBytes: process.memoryUsage().heapUsed,
    fullPairCount,
    patternCandidates: pattern.diagnostics.candidatePairCount,
    reductionRatio: Number((1 - pattern.diagnostics.candidatePairCount / fullPairCount).toFixed(6)),
    findings: { hotspots: hotspot.findings.length, identityResolutions: identity.resolutions.length, patterns: pattern.patterns.length },
    plantedPatternFound,
    synthetic: true,
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log(JSON.stringify([1000, 10_000, 50_000].map(count => benchmarkScale({ count })), null, 2));
}

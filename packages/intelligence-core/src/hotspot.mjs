import { mean, clamp01 } from './math.mjs';
import { spatialCandidatePairs } from './candidates.mjs';

export function detectHotspots(features, { radiusKm, minCases, runId, maximumAgeDays }) {
  if (maximumAgeDays !== undefined && (!Number.isFinite(maximumAgeDays) || maximumAgeDays < 0)) throw new TypeError('maximumAgeDays must be non-negative');
  const points = features.filter(row => row.eligible && (maximumAgeDays === undefined || row.ageDays <= maximumAgeDays));
  const labels = Array(points.length).fill(undefined);
  let clusterId = 0;
  const candidates = spatialCandidatePairs(points, { radiusKm });
  const indexes = new Map(points.map((point, index) => [point, index]));
  const adjacency = points.map((_, index) => [index]);
  for (const [left, right] of candidates.pairs) {
    const leftIndex = indexes.get(left);
    const rightIndex = indexes.get(right);
    adjacency[leftIndex].push(rightIndex);
    adjacency[rightIndex].push(leftIndex);
  }
  const neighbours = index => adjacency[index];

  for (let index = 0; index < points.length; index += 1) {
    if (labels[index] !== undefined) continue;
    const queue = [...neighbours(index)];
    const queued = new Set(queue);
    if (queue.length < minCases) {
      labels[index] = -1;
      continue;
    }
    labels[index] = clusterId;
    for (let cursor = 0; cursor < queue.length; cursor += 1) {
      const candidate = queue[cursor];
      if (labels[candidate] === -1) labels[candidate] = clusterId;
      if (labels[candidate] !== undefined) continue;
      labels[candidate] = clusterId;
      const expanded = neighbours(candidate);
      if (expanded.length >= minCases) {
        for (const item of expanded) if (!queued.has(item)) { queued.add(item); queue.push(item); }
      }
    }
    clusterId += 1;
  }

  const findings = [...Array(clusterId).keys()].map(id => {
    const members = points.filter((_, index) => labels[index] === id);
    return Object.freeze({
      id: `HOT-${runId}-${id + 1}`,
      runId,
      method: 'HAVERSINE_DBSCAN',
      version: '1.0.0',
      evidenceCaseIds: members.map(row => row.caseId).sort(),
      centroid: {
        latitude: mean(members.map(row => row.latitude)),
        longitude: mean(members.map(row => row.longitude)),
      },
      magnitude: members.length,
      confidence: clamp01(mean(members.map(row => row.completeness))),
      parameters: { radiusKm, minCases, ...(maximumAgeDays === undefined ? {} : { maximumAgeDays }) },
      limitations: ['SYNTHETIC_DATA'],
      synthetic: true,
    });
  });
  return Object.freeze({ findings, diagnostics: candidates.diagnostics });
}

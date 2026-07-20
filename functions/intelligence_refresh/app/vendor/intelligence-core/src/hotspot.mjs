import { haversineKm, mean, clamp01 } from './math.mjs';

export function detectHotspots(features, { radiusKm, minCases, runId }) {
  const points = features.filter(row => row.eligible);
  const labels = Array(points.length).fill(undefined);
  let clusterId = 0;
  const neighbours = index => points.flatMap((point, candidate) =>
    haversineKm(point.latitude, point.longitude, points[index].latitude, points[index].longitude) <= radiusKm ? [candidate] : []);

  for (let index = 0; index < points.length; index += 1) {
    if (labels[index] !== undefined) continue;
    const queue = neighbours(index);
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
        for (const item of expanded) if (!queue.includes(item)) queue.push(item);
      }
    }
    clusterId += 1;
  }

  return [...Array(clusterId).keys()].map(id => {
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
      parameters: { radiusKm, minCases },
      limitations: ['SYNTHETIC_DATA'],
      synthetic: true,
    });
  });
}

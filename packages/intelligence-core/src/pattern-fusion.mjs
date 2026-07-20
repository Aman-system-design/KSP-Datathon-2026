import { haversineKm, clamp01, mean } from './math.mjs';
import { textSimilarity } from './text-similarity.mjs';

const weights = { spatial: 0.20, temporal: 0.15, crime: 0.15, legal: 0.10, text: 0.20, network: 0.20 };

const jaccard = (left, right) => {
  const a = new Set(left);
  const b = new Set(right);
  const union = new Set([...a, ...b]);
  return union.size ? [...a].filter(value => b.has(value)).length / union.size : 0;
};

export function scoreCasePair(left, right) {
  const distance = haversineKm(left.latitude, left.longitude, right.latitude, right.longitude);
  const hours = Math.abs(new Date(left.incidentAt) - new Date(right.incidentAt)) / 3_600_000;
  const sharedPeople = left.accused.some(a => a.personId && right.accused.some(b => b.personId === a.personId));
  const components = {
    spatial: clamp01(1 - distance / 50),
    temporal: 0.6 * clamp01(1 - hours / (24 * 180)) + 0.4 * Number(left.timeBand === right.timeBand),
    crime: 0.6 * Number(left.crimeMajor === right.crimeMajor) + 0.4 * Number(left.crimeMinor === right.crimeMinor),
    legal: 0.5 * jaccard(left.acts, right.acts) + 0.5 * jaccard(left.sections, right.sections),
    text: textSimilarity(left.briefFacts, right.briefFacts),
    network: Number(sharedPeople),
  };
  const available = Object.keys(components).filter(name => Number.isFinite(components[name]));
  const totalWeight = available.reduce((sum, name) => sum + weights[name], 0);
  const score = available.reduce((sum, name) => sum + components[name] * weights[name], 0) / totalWeight;
  const evidenceFamilies = available.filter(name => components[name] >= 0.5);
  return { left: left.caseId, right: right.caseId, score, components, evidenceFamilies };
}

export function discoverPatterns(features, { threshold, minimumCases, minimumEvidenceFamilies }) {
  const eligible = features.filter(row => row.eligible);
  const edges = [];
  for (let left = 0; left < eligible.length; left += 1) {
    for (let right = left + 1; right < eligible.length; right += 1) {
      const separationDays = Math.abs(new Date(eligible[left].incidentAt) - new Date(eligible[right].incidentAt)) / 86_400_000;
      if (separationDays > 180) continue;
      const pair = scoreCasePair(eligible[left], eligible[right]);
      if (pair.score >= threshold && pair.evidenceFamilies.length >= minimumEvidenceFamilies) edges.push(pair);
    }
  }

  const adjacency = new Map(eligible.map(row => [row.caseId, new Set()]));
  for (const edge of edges) {
    adjacency.get(edge.left).add(edge.right);
    adjacency.get(edge.right).add(edge.left);
  }
  const byId = new Map(eligible.map(row => [row.caseId, row]));
  const visited = new Set();
  const patterns = [];
  for (const row of eligible) {
    if (visited.has(row.caseId)) continue;
    const queue = [row.caseId];
    const members = [];
    while (queue.length) {
      const id = queue.shift();
      if (visited.has(id)) continue;
      visited.add(id);
      members.push(id);
      for (const next of adjacency.get(id)) queue.push(next);
    }
    const districts = [...new Set(members.map(id => byId.get(id).districtId))].sort();
    if (members.length < minimumCases || districts.length < 2) continue;
    const memberEdges = edges.filter(edge => members.includes(edge.left) && members.includes(edge.right));
    const componentSummary = Object.fromEntries(Object.keys(weights).map(name => [name, mean(memberEdges.map(edge => edge.components[name]))]));
    patterns.push(Object.freeze({
      id: `PATTERN-${patterns.length + 1}`,
      evidenceCaseIds: members.sort(),
      districtIds: districts,
      confidence: mean(memberEdges.map(edge => edge.score)),
      componentSummary,
      pairEvidence: memberEdges,
      method: 'EXPLAINABLE_MULTI_SIGNAL_FUSION',
      version: '1.0.0',
      status: 'REQUIRES_HUMAN_VERIFICATION',
      limitations: ['SYNTHETIC_DATA', 'SIMILARITY_IS_NOT_PROOF'],
      synthetic: true,
    }));
  }
  return patterns;
}

import { createAnalysisRun } from './contracts.mjs';
import { buildCaseFeatures } from './features.mjs';
import { detectHotspots } from './hotspot.mjs';
import { detectAnomaly } from './anomaly.mjs';
import { buildEvidenceGraph } from './network.mjs';
import { resolveIdentities } from './identity.mjs';
import { calculateAreaRisk } from './area-risk.mjs';
import { discoverPatterns } from './pattern-fusion.mjs';
import { mean } from './math.mjs';

export function runIntelligencePipeline(input) {
  const version = '1.0.0';
  const observedFrom = input.cases.map(row => row.incidentAt).sort()[0].slice(0, 10);
  const observedTo = input.asOf.slice(0, 10);
  const analysisRuns = [
    createAnalysisRun({ id: `RUN-HOT-${input.fixtureVersion}`, type: 'HOTSPOT', method: 'HAVERSINE_DBSCAN', version, observedFrom, observedTo, parameters: { radiusKm: 1.5, minCases: 5 } }),
    createAnalysisRun({ id: `RUN-ANOM-${input.fixtureVersion}`, type: 'ANOMALY', method: 'MEDIAN_MAD', version, observedFrom, observedTo }),
    createAnalysisRun({ id: `RUN-PAT-${input.fixtureVersion}`, type: 'PATTERN', method: 'EXPLAINABLE_MULTI_SIGNAL_FUSION', version, observedFrom, observedTo, parameters: { threshold: 0.65, minimumCases: 4, minimumEvidenceFamilies: 3 } }),
    createAnalysisRun({ id: `RUN-RISK-${input.fixtureVersion}`, type: 'AREA_RISK', method: 'EXPLAINABLE_WEIGHTED_SCORE', version, observedFrom, observedTo, parameters: { horizonDays: 7 } }),
  ];
  const [hotspotRun, anomalyRun, patternRun, riskRun] = analysisRuns;
  const features = buildCaseFeatures(input.cases, version, new Date(input.asOf));
  const hotspots = detectHotspots(features, { radiusKm: 1.5, minCases: 5, runId: hotspotRun.id });
  const anomalies = input.weeklySeries.map(series => Object.freeze({ ...detectAnomaly(series), runId: anomalyRun.id }));
  const identityResolutions = resolveIdentities(features);
  const network = buildEvidenceGraph(features);
  const patterns = discoverPatterns(features, { threshold: 0.65, minimumCases: 4, minimumEvidenceFamilies: 3 })
    .map(pattern => Object.freeze({ ...pattern, runId: patternRun.id }));
  const hotspotEvidenceIds = hotspots.flatMap(row => row.evidenceCaseIds);
  const riskFeatures = features.filter(row => hotspotEvidenceIds.includes(row.caseId));
  const riskPopulation = riskFeatures.length ? riskFeatures : features.filter(row => row.eligible);
  const anomalyEvidence = [...anomalies].sort((left, right) => right.deviation - left.deviation)[0];
  const expected = Math.max(1, anomalyEvidence?.expected ?? 1);
  const observed = Math.max(0, anomalyEvidence?.observed ?? 0);
  const riskInputs = {
    frequency: Math.min(100, observed / expected * 40),
    severity: Math.min(100, mean(riskPopulation.map(row => row.gravity)) / 5 * 100),
    recency: Math.max(0, mean(riskPopulation.map(row => 100 * (1 - Math.min(1, row.ageDays / 60))))),
    trend: Math.max(0, Math.min(100, 50 + (observed - expected) / expected * 25)),
    anomaly: Math.max(0, Math.min(100, (anomalyEvidence?.deviation ?? 0) * 20)),
    hotspot: Math.min(100, hotspots.reduce((sum, row) => sum + row.magnitude, 0) / 5 * 80),
    completeness: mean(riskPopulation.map(row => row.completeness)),
  };
  const areaRisk = Object.freeze({
    ...calculateAreaRisk(riskInputs),
    runId: riskRun.id,
    inputs: riskInputs,
    evidenceCaseIds: [...new Set([...hotspotEvidenceIds, ...(anomalyEvidence?.evidenceCaseIds ?? [])])].sort(),
  });
  return Object.freeze({
    fixtureVersion: input.fixtureVersion,
    featureVersion: version,
    analysisRuns,
    features,
    hotspots,
    anomalies,
    identityResolutions,
    network,
    patterns,
    areaRisk,
    synthetic: true,
  });
}

import { createAnalysisRun } from './contracts.mjs';
import { buildCaseFeatures } from './features.mjs';
import { detectHotspots } from './hotspot.mjs';
import { detectAnomaly } from './anomaly.mjs';
import { buildEvidenceGraph } from './network.mjs';
import { resolveIdentities } from './identity.mjs';
import { calculateAreaRisk } from './area-risk.mjs';
import { discoverPatterns } from './pattern-fusion.mjs';

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
  const strongestAnomaly = Math.max(0, ...anomalies.filter(row => row.isAnomaly).map(row => Math.min(100, row.deviation * 20)));
  const areaRisk = Object.freeze({
    ...calculateAreaRisk({ frequency: 80, severity: 60, recency: 70, trend: 50, anomaly: strongestAnomaly, hotspot: hotspots.length ? 100 : 0, completeness: 0.9 }),
    runId: riskRun.id,
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

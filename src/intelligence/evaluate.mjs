const containsAll = (actual, expected) => expected.every(value => actual.includes(value));
const intersectionCount = (left, right) => left.filter(value => right.includes(value)).length;

export function evaluatePipeline(output, truth) {
  const bestPattern = output.patterns
    .map(pattern => ({ pattern, overlap: intersectionCount(pattern.evidenceCaseIds, truth.pattern.caseIds) }))
    .sort((left, right) => right.overlap - left.overlap)[0];
  const patternPrecision = bestPattern ? bestPattern.overlap / bestPattern.pattern.evidenceCaseIds.length : 0;
  const patternRecall = bestPattern ? bestPattern.overlap / truth.pattern.caseIds.length : 0;
  const significantFindings = [
    ...output.hotspots,
    ...output.patterns,
    ...output.anomalies.filter(row => row.isAnomaly),
  ];
  const runIds = new Set(output.analysisRuns.map(run => run.id));
  const repeatedAppearances = new Set(truth.repeatIdentity.appearanceIds);
  const falseAppearances = new Set(['APP-FALSE-A', 'APP-FALSE-B']);
  const gates = {
    hotspot: output.hotspots.some(row => containsAll(row.evidenceCaseIds, truth.hotspot.caseIds)),
    anomaly: output.anomalies.some(row => row.seriesId === truth.anomaly.seriesId && row.isAnomaly),
    seasonalNegativeControl: output.anomalies.some(row => row.seriesId === truth.seasonalNegativeControl.seriesId && !row.isAnomaly),
    crossDistrictPattern: output.patterns.some(row => containsAll(row.evidenceCaseIds, truth.pattern.caseIds) && row.districtIds.length >= 2),
    patternMetricThreshold: patternPrecision >= 0.8 && patternRecall >= 0.8,
    repeatIdentity: output.identityResolutions.some(row => row.status === 'CONFIRMED' && repeatedAppearances.has(row.left) && repeatedAppearances.has(row.right)),
    falseNameNotConfirmed: !output.identityResolutions.some(row => row.status === 'CONFIRMED' && falseAppearances.has(row.left) && falseAppearances.has(row.right)),
    evidenceLineage: significantFindings.every(row => row.method && row.version && runIds.has(row.runId) && row.evidenceCaseIds.length > 0),
    syntheticLabels: output.synthetic === true && output.features.every(row => row.synthetic === true) && significantFindings.every(row => row.synthetic === true),
    areaOnlyRisk: output.areaRisk.scope === 'AREA_TIME_ONLY' && runIds.has(output.areaRisk.runId),
  };
  return Object.freeze({
    fixtureVersion: truth.fixtureVersion,
    metrics: { patternPrecision, patternRecall },
    gates,
    pass: Object.values(gates).every(Boolean),
  });
}

const numericUnitId = districtId => Number(String(districtId).replace(/^D-/, ''));

function evidenceUnitMap(row, unitByCase) {
  return Object.fromEntries((row.evidenceCaseIds ?? []).map(id => [id, unitByCase.get(id)]));
}

function patternProjection(row, cases) {
  const evidence = row.evidenceCaseIds.map((id) => {
    const caseRow = cases.find(({ caseId }) => caseId === id);
    return {
      unitId: numericUnitId(caseRow.districtId), caseId: id, stationId: caseRow.stationId,
      personId: caseRow.accused[0]?.personId ?? null, name: caseRow.accused[0]?.name ?? null,
      briefFacts: caseRow.briefFacts, exactCoordinates: [caseRow.latitude, caseRow.longitude],
      evidenceObjectPath: `synthetic/cases/${id}`,
    };
  });
  const unitIds = [...new Set(evidence.map(({ unitId }) => unitId))];
  return {
    ...structuredClone(row), title: 'Synthetic cross-district property pattern',
    recommendation: 'Review the linked synthetic cases and confirm or reject the proposed connection.',
    alertId: `ALT-${row.id}`,
    unitSummaries: unitIds.map(unitId => ({
      unitId, unitName: `Synthetic District ${unitId}`,
      caseCount: evidence.filter(item => item.unitId === unitId).length,
      observationPeriod: { from: '2026-06-01', to: '2026-06-30' },
    })),
    evidence,
  };
}

function correlation(rows) {
  const xs = rows.map(row => row.indicators.urbanizationIndex);
  const ys = rows.map(row => row.crimeCount);
  const mean = values => values.reduce((sum, value) => sum + value, 0) / values.length;
  const mx = mean(xs); const my = mean(ys);
  const numerator = xs.reduce((sum, value, index) => sum + (value - mx) * (ys[index] - my), 0);
  const denominator = Math.sqrt(
    xs.reduce((sum, value) => sum + (value - mx) ** 2, 0)
      * ys.reduce((sum, value) => sum + (value - my) ** 2, 0),
  );
  return denominator === 0 ? null : Number((numerator / denominator).toFixed(4));
}

function districtContexts(cases, version) {
  const counts = new Map();
  for (const row of cases) {
    const unitId = numericUnitId(row.districtId);
    counts.set(unitId, (counts.get(unitId) ?? 0) + 1);
  }
  const rows = [
    { unitId: 101, urbanizationIndex: 0.82 },
    { unitId: 102, urbanizationIndex: 0.58 },
    { unitId: 103, urbanizationIndex: 0.48 },
  ].map(row => ({
    unitId: row.unitId, sourceLabel: 'Synthetic district context', period: '2026-Q2',
    indicators: { urbanizationIndex: row.urbanizationIndex }, crimeCount: counts.get(row.unitId) ?? 0,
  }));
  const coefficient = correlation(rows);
  return rows.map(row => ({
    ...row,
    correlation: {
      method: 'PEARSON_CORRELATION', version, scope: 'AGGREGATE_DISTRICT_ONLY',
      crimeMeasure: 'SYNTHETIC_FIR_COUNT', contextVariable: 'urbanizationIndex',
      coefficient, sampleSize: rows.length,
      recommendation: 'Use only as a contextual comparison for human analysis.',
      limitations: ['CORRELATION_IS_NOT_CAUSATION', 'SMALL_SYNTHETIC_SAMPLE'],
    },
    limitation: 'CORRELATION_IS_NOT_CAUSATION', synthetic: true,
  }));
}

function networkProjections(output, input, unitByCase) {
  const observationWindow = output.analysisRuns[0]
    ? { from: output.analysisRuns[0].observedFrom, to: output.analysisRuns[0].observedTo } : null;
  return output.network.nodes.map((node) => {
    const edges = output.network.edges
      .filter(edge => edge.sourceCaseId === node.id || edge.from === node.id || edge.to === node.id)
      .map(edge => ({ ...structuredClone(edge), unitId: unitByCase.get(edge.sourceCaseId) }));
    const unitIds = [...new Set(edges.map(({ unitId }) => unitId).filter(Number.isInteger))];
    const appearances = new Set(edges
      .filter(edge => edge.type === 'CASE_HAS_ACCUSED' && (edge.from === node.id || edge.to === node.id))
      .map(({ sourceCaseId }) => sourceCaseId));
    return {
      node: { ...structuredClone(node), unitId: unitIds[0], unitIds }, edges,
      method: 'EVIDENCE_GRAPH', version: output.featureVersion, confidence: 1,
      observationWindow, evidenceCaseIds: [...new Set(edges.map(({ sourceCaseId }) => sourceCaseId))],
      repeatAppearanceCount: appearances.size,
      recommendation: 'Review source-linked appearances and co-accused paths before drawing conclusions.',
      limitations: ['SYNTHETIC_DATA', 'LINK_IS_INVESTIGATIVE_SIGNAL_NOT_PROOF'], synthetic: true,
    };
  });
}

export function projectPipelineFindings({ output, input }) {
  const unitByCase = new Map(input.cases.map(row => [row.caseId, numericUnitId(row.districtId)]));
  const withUnits = row => ({ ...structuredClone(row), evidenceUnits: evidenceUnitMap(row, unitByCase) });
  const patterns = output.patterns.map(row => patternProjection(row, input.cases));
  return {
    brief: {
      activeCaseCount: input.cases.length, patternCount: patterns.length,
      hotspotCount: output.hotspots.length,
      anomalyCount: output.anomalies.filter(({ isAnomaly }) => isAnomaly).length,
      syntheticData: true,
    },
    features: structuredClone(output.features), patterns,
    hotspots: output.hotspots.map(row => ({
      ...withUnits(row), recommendation: 'Review the synthetic hotspot area and contributing cases before operational prioritization.',
    })),
    anomalies: output.anomalies.map(row => ({
      ...withUnits(row), confidence: Math.min(1, Math.max(0, row.deviation / 5)),
      recommendation: 'Review the observed change against local context and data-quality limitations.',
    })),
    areaRisks: [{
      ...withUnits(output.areaRisk), method: 'EXPLAINABLE_WEIGHTED_SCORE',
      recommendation: 'Use as an area-attention signal for human review, not as an individual prediction.',
    }],
    networks: networkProjections(output, input, unitByCase),
    districtContexts: districtContexts(input.cases, output.featureVersion),
    alerts: patterns.map(pattern => ({
      AlertID: pattern.alertId, PatternID: pattern.id,
      ScopeUnitID: pattern.unitSummaries[0]?.unitId, Status: 'GENERATED', AlertVersion: 0,
      LastCommandID: null, OriginalFindingJSON: JSON.stringify(pattern), SyntheticData: true,
    })),
  };
}

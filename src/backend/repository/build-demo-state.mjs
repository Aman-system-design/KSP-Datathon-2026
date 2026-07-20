import { runIntelligencePipeline } from '@ksp/intelligence-core';

import { toIntelligenceInput } from '../../ingestion/to-intelligence-input.mjs';
import { validateSourceSeed } from '../../ingestion/validate-source-seed.mjs';
import { generateSourceSeed } from '../../synthetic/source-seed.mjs';

const analysisTypes = [
  'FEATURE_BUILD', 'HOTSPOT', 'ANOMALY', 'PATTERN', 'AREA_RISK', 'NETWORK',
  'IDENTITY_RESOLUTION',
];
const numericUnitId = districtId => Number(String(districtId).replace(/^D-/, ''));

function buildPattern(row, cases) {
  const evidence = row.evidenceCaseIds.map((id) => {
    const caseRow = cases.find(({ caseId }) => caseId === id);
    return {
      unitId: numericUnitId(caseRow.districtId),
      caseId: id,
      stationId: caseRow.stationId,
      personId: caseRow.accused[0]?.personId ?? null,
      name: caseRow.accused[0]?.name ?? null,
      briefFacts: caseRow.briefFacts,
      exactCoordinates: [caseRow.latitude, caseRow.longitude],
      evidenceObjectPath: `synthetic/cases/${id}`,
    };
  });
  const unitIds = [...new Set(evidence.map(({ unitId }) => unitId))];
  return {
    ...structuredClone(row),
    title: 'Synthetic cross-district property pattern',
    alertId: `ALT-${row.id}`,
    unitSummaries: unitIds.map(unitId => ({
      unitId,
      unitName: `Synthetic District ${unitId}`,
      caseCount: evidence.filter(row => row.unitId === unitId).length,
      observationPeriod: { from: '2026-06-01', to: '2026-06-30' },
    })),
    evidence,
  };
}

export function buildDemoState() {
  const source = generateSourceSeed(20260720);
  const accepted = validateSourceSeed(source).accepted;
  const input = toIntelligenceInput(accepted);
  const output = runIntelligencePipeline(input);
  const runGroupId = 'RUN-GROUP-DEMO-1';
  const inputHash = 'a'.repeat(64);
  const publishedAt = '2026-07-01T01:00:00Z';
  const runs = analysisTypes.map((AnalysisType, index) => ({
    AnalysisRunID: `RUN-DEMO-${index + 1}`,
    RunGroupID: runGroupId,
    AnalysisType,
    RunTypeKey: `${runGroupId}:${AnalysisType}`,
    Status: 'COMPLETED',
    PublishStatus: 'PUBLISHED',
    InputManifestHash: inputHash,
    ObservationStart: '2026-05-01T00:00:00Z',
    ObservationEnd: '2026-07-01T00:00:00Z',
    EngineVersion: '1.0.0',
    PublishedAt: publishedAt,
    SyntheticData: true,
  }));
  const patterns = output.patterns.map(row => buildPattern(row, input.cases));
  const alert = patterns[0];

  return {
    syntheticData: true,
    source,
    features: structuredClone(output.features),
    runGroups: [{ RunGroupID: runGroupId, PublishedAt: publishedAt, runs }],
    brief: {
      activeCaseCount: input.cases.length,
      patternCount: patterns.length,
      hotspotCount: output.hotspots.length,
      anomalyCount: output.anomalies.filter(({ isAnomaly }) => isAnomaly).length,
      syntheticData: true,
    },
    patterns,
    hotspots: structuredClone(output.hotspots),
    anomalies: structuredClone(output.anomalies),
    areaRisks: [structuredClone(output.areaRisk)],
    networks: [{
      node: { id: 'CASE-001', unitId: 101, type: 'CASE' },
      edges: structuredClone(output.network.edges.filter(({ sourceCaseId }) => sourceCaseId === 'CASE-001')),
    }],
    districtContexts: [
      { unitId: 101, sourceLabel: 'Synthetic district context', period: '2026-Q2', indicators: { urbanizationIndex: 0.82 }, limitation: 'CORRELATION_IS_NOT_CAUSATION' },
      { unitId: 102, sourceLabel: 'Synthetic district context', period: '2026-Q2', indicators: { urbanizationIndex: 0.58 }, limitation: 'CORRELATION_IS_NOT_CAUSATION' },
    ],
    profiles: [
      { CatalystUserID: 'CAT-DEMO', DefaultRole: 'DEMO_PRESENTER', ScopeUnitID: 1, Active: true, DemoPersonaAllowed: true, PermissionVersion: '1.0.0', SyntheticData: true },
      { CatalystUserID: 'CAT-DISTRICT', EmployeeID: 9001, DefaultRole: 'DISTRICT_LEADERSHIP', ScopeUnitID: 101, Active: true, DemoPersonaAllowed: false, PermissionVersion: '1.0.0', SyntheticData: true },
      { CatalystUserID: 'CAT-ANALYST', EmployeeID: 9003, DefaultRole: 'CRIME_ANALYST', ScopeUnitID: 101, Active: true, DemoPersonaAllowed: false, PermissionVersion: '1.0.0', SyntheticData: true },
    ],
    units: structuredClone(accepted.Unit),
    alerts: alert ? [{
      AlertID: alert.alertId,
      PatternID: alert.id,
      ScopeUnitID: 101,
      Status: 'GENERATED',
      AlertVersion: 0,
      LastCommandID: null,
      OriginalFindingJSON: JSON.stringify(alert),
      SyntheticData: true,
    }] : [],
    commands: [], assignments: [], conclusions: [], outcomes: [], auditEvents: [],
  };
}

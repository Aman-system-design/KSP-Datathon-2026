import { runIntelligencePipeline } from '@ksp/intelligence-core';

import { toIntelligenceInput } from '../../ingestion/to-intelligence-input.mjs';
import { validateSourceSeed } from '../../ingestion/validate-source-seed.mjs';
import { generateSourceSeed } from '../../synthetic/source-seed.mjs';
import { projectPipelineFindings } from '../refresh/finding-projection.mjs';

const analysisTypes = [
  'FEATURE_BUILD', 'HOTSPOT', 'ANOMALY', 'PATTERN', 'AREA_RISK', 'NETWORK',
  'IDENTITY_RESOLUTION',
];
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
  const projected = projectPipelineFindings({ output, input });

  return {
    syntheticData: true,
    source,
    features: projected.features,
    runGroups: [{ RunGroupID: runGroupId, PublishedAt: publishedAt, runs }],
    brief: projected.brief,
    patterns: projected.patterns,
    hotspots: projected.hotspots,
    anomalies: projected.anomalies,
    areaRisks: projected.areaRisks,
    networks: projected.networks,
    districtContexts: projected.districtContexts,
    profiles: [
      { CatalystUserID: 'CAT-DEMO', DefaultRole: 'DEMO_PRESENTER', ScopeUnitID: 1, Active: true, DemoPersonaAllowed: true, PermissionVersion: '1.0.0', SyntheticData: true },
      { CatalystUserID: 'CAT-DISTRICT', EmployeeID: 9001, DefaultRole: 'DISTRICT_LEADERSHIP', ScopeUnitID: 101, Active: true, DemoPersonaAllowed: false, PermissionVersion: '1.0.0', SyntheticData: true },
      { CatalystUserID: 'CAT-ANALYST', EmployeeID: 9003, DefaultRole: 'CRIME_ANALYST', ScopeUnitID: 101, Active: true, DemoPersonaAllowed: false, PermissionVersion: '1.0.0', SyntheticData: true },
    ],
    units: structuredClone(accepted.Unit),
    alerts: projected.alerts,
    commands: [], assignments: [], conclusions: [], outcomes: [], auditEvents: [],
    refreshBatches: [],
  };
}

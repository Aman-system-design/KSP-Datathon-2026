import assert from 'node:assert/strict';
import test from 'node:test';

import { buildDemoState } from '../../src/backend/repository/build-demo-state.mjs';
import { CatalystIntelligenceRepository } from '../../src/backend/repository/catalyst/catalyst-repository.mjs';

function catalystRows() {
  const state = buildDemoState();
  const runRows = state.runGroups[0].runs.map((run, index) => ({ ...run, ROWID: `RUN-ROW-${index + 1}` }));
  const runRef = type => runRows.find(row => row.AnalysisType === type).ROWID;
  const pattern = state.patterns[0];
  const hotspot = state.hotspots[0];
  const anomaly = state.anomalies.find(row => row.isAnomaly);
  const risk = state.areaRisks[0];
  const network = state.networks.find(row => row.node.id === 'PERSON:PERSON-007');
  const nodeRows = [network.node, ...network.edges.flatMap(edge => [
    { id: edge.from, type: edge.from.startsWith('PERSON:') ? 'PERSON' : 'CASE' },
    { id: edge.to, type: edge.to.startsWith('PERSON:') ? 'PERSON' : 'CASE' },
  ])].filter((node, index, rows) => rows.findIndex(other => other.id === node.id) === index)
    .map((node, index) => ({
      ROWID: `NODE-ROW-${index + 1}`, NetworkNodeID: `NODE-${index + 1}`,
      AnalysisRunRef: runRef('NETWORK'), NodeType: node.type, SourceEntity: node.type,
      SourceBusinessID: node.id, EvidenceLabel: 'SOURCE_LINK', MethodVersion: '1.0.0', SyntheticData: true,
    }));
  const nodeRef = id => nodeRows.find(row => row.SourceBusinessID === id).ROWID;

  return {
    state,
    tables: {
      TRN_CaseFeature: state.features.map((feature, index) => ({ ROWID: `FEATURE-${index}`, CaseFeatureID: `FEATURE-${index}`, SourceCaseMasterID: index + 1, SyntheticData: true })),
      INT_AnalysisRun: [...runRows, { ...runRows[0], ROWID: 'PARTIAL-ROW', RunGroupID: 'PARTIAL-NEW', AnalysisRunID: 'PARTIAL-1', RunTypeKey: 'PARTIAL-NEW:HOTSPOT', PublishedAt: '2026-07-30T00:00:00Z' }],
      INT_Pattern: [{ ROWID: 'PAT-ROW', PatternID: pattern.id, AnalysisRunRef: runRef('PATTERN'), PatternType: pattern.method, Title: pattern.title, Confidence: pattern.confidence, SignalComponentsJSON: JSON.stringify(pattern), Recommendation: pattern.recommendation, MethodVersion: pattern.version, Limitation: pattern.limitations.join('|'), SyntheticData: true }],
      INT_Hotspot: [{ ROWID: 'HOT-ROW', HotspotID: hotspot.id, AnalysisRunRef: runRef('HOTSPOT'), AreaID: 'AREA-101', CentroidLatitude: hotspot.centroid.latitude, CentroidLongitude: hotspot.centroid.longitude, CaseCount: hotspot.magnitude, Severity: hotspot.confidence, MethodVersion: hotspot.version, Limitation: hotspot.limitations.join('|'), SyntheticData: true }],
      INT_Anomaly: [{ ROWID: 'ANOM-ROW', AnomalyID: anomaly.id, AnalysisRunRef: runRef('ANOMALY'), AreaID: anomaly.seriesId, SignalType: anomaly.method, ObservedValue: anomaly.observed, BaselineValue: anomaly.expected, Severity: anomaly.confidence, MethodVersion: anomaly.version, Limitation: anomaly.limitations.join('|'), SyntheticData: true }],
      INT_AreaRisk: [{ ROWID: 'RISK-ROW', AreaRiskID: 'RISK-1', AnalysisRunRef: runRef('AREA_RISK'), AreaType: 'DISTRICT', AreaID: '101', PeriodStart: '2026-06-01', PeriodEnd: '2026-07-01', Score: risk.score, Completeness: risk.inputs.completeness, ComponentsJSON: JSON.stringify(risk), MethodVersion: risk.version, Limitation: risk.limitations.join('|'), SyntheticData: true }],
      INT_FindingEvidence: pattern.evidence.map((evidence, index) => ({ ROWID: `EVID-${index}`, FindingEvidenceID: `EVID-${index}`, AnalysisRunRef: runRef('PATTERN'), FindingType: 'PATTERN', FindingBusinessID: pattern.id, SourceEntity: 'CaseMaster', SourceBusinessID: evidence.caseId, EvidenceLabel: 'SOURCE_CASE', EvidenceSummary: JSON.stringify(evidence), MethodVersion: pattern.version, SyntheticData: true })),
      INT_NetworkNode: nodeRows,
      INT_NetworkEdge: network.edges.map((edge, index) => ({ ROWID: `EDGE-${index}`, NetworkEdgeID: `EDGE-${index}`, AnalysisRunRef: runRef('NETWORK'), FromNodeRef: nodeRef(edge.from), ToNodeRef: nodeRef(edge.to), EdgeType: edge.type, EvidenceLabel: JSON.stringify(edge), Weight: edge.confidence, MethodVersion: network.version, Limitation: network.limitations.join('|'), SyntheticData: true })),
      INT_RepeatOffenderSignal: [{ ROWID: 'REPEAT-1', RepeatSignalID: 'REPEAT-1', AnalysisRunRef: runRef('IDENTITY_RESOLUTION'), CanonicalPersonKey: 'PERSON:PERSON-007', ResolutionStatus: 'CONFIRMED', CaseCount: 2, Confidence: 1, EvidenceJSON: JSON.stringify({ evidenceCaseIds: ['CASE-001', 'CASE-021'] }), MethodVersion: '1.0.0', Limitation: 'SOURCE_ID_REQUIRED', SyntheticData: true }],
      TRN_DistrictContext: state.districtContexts.map((row, index) => ({ ROWID: `CTX-${index}`, DistrictContextID: `CTX-${index}`, UnitID: row.unitId, PeriodStart: '2026-04-01', PeriodEnd: '2026-06-30', IndicatorsJSON: JSON.stringify(row), SourceLabel: row.sourceLabel, ContextVersion: '1.0.0', Limitation: row.limitation, SyntheticData: true })),
      CFG_UserAccess: state.profiles.map((row, index) => ({ ROWID: `PROFILE-${index}`, AccessProfileID: `PROFILE-${index}`, ...row })),
      SRC_Unit: state.units.map((row, index) => ({ ROWID: `UNIT-${index}`, ...row, IsSynthetic: true })),
      WF_Alert: state.alerts.map((row, index) => ({ ROWID: `ALERT-${index}`, ...row, FindingType: 'PATTERN', FindingBusinessID: row.PatternID, LastCommandRef: 'CMD-ROW-1', MethodVersion: '1.0.0', CreatedAt: '2026-07-01T00:00:00Z' })),
      WF_Command: [{ ROWID: 'CMD-ROW-1', CommandID: 'CMD-1', AlertRef: 'ALERT-0', Status: 'COMPLETED', SyntheticData: true }],
      WF_Assignment: [{ ROWID: 'ASN-ROW-1', AssignmentID: 'ASN-1', AlertRef: 'ALERT-0', CommandRef: 'CMD-ROW-1', AssignedUnitID: 101, AssignedEmployeeID: 9003, AssignedByEmployeeID: 9001, Reason: 'Synthetic review', AuthorizedUnitIDsJSON: '[101]', AuthorizedCaseIDsJSON: '["CASE-001"]', EvidenceAccessLevel: 'ASSIGNED_CASES', AssignedAt: '2026-07-01T00:00:00Z', SyntheticData: true }],
    },
  };
}

function fakeApplication(tableRows, { failureTable } = {}) {
  const calls = [];
  return {
    calls,
    datastore: () => ({ table: name => ({
      async getPagedRows(options) {
        calls.push({ name, options });
        if (name === failureTable) throw new Error('secret token ROWID 999');
        const rows = tableRows[name] ?? [];
        const offset = options.nextToken ? Number(options.nextToken) : 0;
        const data = rows.slice(offset, offset + 2);
        const next = offset + data.length;
        return { data, more_records: next < rows.length, next_token: next < rows.length ? String(next) : undefined };
      },
      getAllRows() { throw new Error('getAllRows is forbidden'); },
    }) }),
  };
}

test('selects only the newest complete seven-run publication and derives the brief', async () => {
  const fixture = catalystRows();
  const app = fakeApplication(fixture.tables);
  const repository = new CatalystIntelligenceRepository({ application: app });
  const current = await repository.getCurrentRunGroup();
  assert.equal(current.RunGroupID, 'RUN-GROUP-DEMO-1');
  assert.equal(current.runs.length, 7);
  assert.deepEqual(await repository.getBrief(), fixture.state.brief);
  assert.ok(app.calls.every(call => call.options.maxRows <= 200));
});

test('reconstructs paged findings, evidence, network/repeat appearances and district context', async () => {
  const fixture = catalystRows();
  const repository = new CatalystIntelligenceRepository({ application: fakeApplication(fixture.tables) });
  const patterns = await repository.listPatterns({ limit: 1 });
  assert.equal(patterns.data[0].id, fixture.state.patterns[0].id);
  assert.ok(patterns.nextToken === null);
  const pattern = await repository.getPattern(fixture.state.patterns[0].id);
  assert.deepEqual(pattern.evidence, fixture.state.patterns[0].evidence);
  assert.equal((await repository.listHotspots()).data[0].magnitude, fixture.state.hotspots[0].magnitude);
  assert.equal((await repository.listAnomalies()).data[0].isAnomaly, true);
  assert.deepEqual((await repository.getAreaRisk()).components, fixture.state.areaRisks[0].components);
  const network = await repository.getNetwork('PERSON:PERSON-007');
  assert.equal(network.node.id, 'PERSON:PERSON-007');
  assert.equal(network.repeatAppearanceCount, 2);
  assert.deepEqual(await repository.getDistrictContext(101), fixture.state.districtContexts.filter(row => row.unitId === 101));
});

test('reads access profile, unit hierarchy and alerts without exposing Catalyst metadata', async () => {
  const fixture = catalystRows();
  const repository = new CatalystIntelligenceRepository({ application: fakeApplication(fixture.tables) });
  assert.deepEqual(await repository.getAccessProfile('CAT-DEMO'), fixture.state.profiles[0]);
  assert.deepEqual(await repository.getUnits(), fixture.state.units);
  assert.equal((await repository.getAlert('ALT-PATTERN-1')).LastCommandID, 'CMD-1');
  const [assignment] = await repository.getAssignmentsForAlert('ALT-PATTERN-1');
  assert.equal(assignment.AlertID, 'ALT-PATTERN-1');
  assert.equal(assignment.CommandID, 'CMD-1');
  assert.deepEqual(assignment.AuthorizedCaseIDs, ['CASE-001']);
  assert.equal((await repository.getAssignmentsForEmployee(9003)).length, 1);
  assert.equal(JSON.stringify(await repository.getUnits()).includes('ROWID'), false);
});

test('sanitizes Catalyst read failures without leaking SDK details', async () => {
  const fixture = catalystRows();
  const repository = new CatalystIntelligenceRepository({ application: fakeApplication(fixture.tables, { failureTable: 'INT_Pattern' }) });
  await assert.rejects(repository.listPatterns(), error => {
    assert.equal(error.code, 'CATALYST_UNAVAILABLE');
    assert.equal(error.message.includes('secret'), false);
    assert.equal(error.message.includes('ROWID'), false);
    return true;
  });
});

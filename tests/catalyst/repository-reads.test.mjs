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
      INT_PublicationState: [{
        ROWID: '9001', PublicationStateID: 'CURRENT', PublicationGeneration: 1,
        CurrentRunGroupID: state.runGroups[0].RunGroupID, CurrentRunsJSON: JSON.stringify(runRows),
        PointerVersion: 1, PublishedAt: state.runGroups[0].PublishedAt,
        LatestAttemptStatus: 'COMPLETED', LatestAttemptRunGroupID: state.runGroups[0].RunGroupID,
        LatestAttemptAt: state.runGroups[0].PublishedAt, SyntheticData: true,
      }],
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
      CFG_UtilityAlertRule: [{
        ROWID: 'RULE-ROW-1', CREATORID: 'CATALYST-METADATA', RuleID: 'RULE-1',
        IdempotencyKeyHash: 'a'.repeat(64), RequestHash: 'b'.repeat(64),
        UtilityKey: 'patterns', UtilityVersion: '1.0.0', Enabled: true, ScopeUnitID: 101,
        ThresholdsJSON: '{"threshold":0.8}', EvaluationWindowDays: 30, Severity: 'HIGH',
        RecipientRolesJSON: '["CRIME_ANALYST"]', Version: 1, CreatedByUserID: 'USER-1',
        CreatedAt: '2026-07-26 00:00:00', UpdatedAt: '2026-07-26 00:00:00', SyntheticData: true,
      }],
      SRC_Unit: state.units.map((row, index) => ({ ROWID: `UNIT-${index}`, ...row, IsSynthetic: true })),
      WF_Alert: state.alerts.map((row, index) => ({ ROWID: `ALERT-${index}`, ...row, FindingType: 'PATTERN', FindingBusinessID: row.PatternID, LastCommandRef: 'CMD-ROW-1', MethodVersion: '1.0.0', CreatedAt: '2026-07-01T00:00:00Z' })),
      WF_Command: [{ ROWID: 'CMD-ROW-1', CommandID: 'CMD-1', AlertRef: 'ALERT-0', Status: 'COMPLETED', SyntheticData: true }],
      WF_Assignment: [{ ROWID: 'ASN-ROW-1', AssignmentID: 'ASN-1', AlertRef: 'ALERT-0', CommandRef: 'CMD-ROW-1', AssignedUnitID: 101, AssignedEmployeeID: 9003, AssignedByEmployeeID: 9001, Reason: 'Synthetic review', AuthorizedUnitIDsJSON: '[101]', AuthorizedCaseIDsJSON: '["CASE-001"]', EvidenceAccessLevel: 'ASSIGNED_CASES', AssignedAt: '2026-07-01T00:00:00Z', SyntheticData: true }],
    },
  };
}

function fakeApplication(tableRows, { failureTable } = {}) {
  const calls = [];
  const zcqlCalls = [];
  return {
    calls, zcqlCalls,
    zcql: () => ({ async executeZCQLQuery(query) {
      zcqlCalls.push(query);
      const match = query.match(/^SELECT \* FROM ([A-Za-z0-9_]+) WHERE ([A-Za-z0-9_]+) = (?:'((?:''|[^'])*)'|(\d+)) LIMIT (\d+), (\d+)$/u);
      if (!match) throw new Error(`unexpected ZCQL: ${query}`);
      const [, tableName, column, textValue, numberValue, offset, limit] = match;
      if (tableName === failureTable) throw new Error('secret token ROWID 999');
      const value = textValue === undefined ? numberValue : textValue.replaceAll("''", "'");
      return (tableRows[tableName] ?? []).filter(row => String(row[column]) === String(value))
        .slice(Number(offset), Number(offset) + Number(limit))
        .map(row => ({ [tableName]: structuredClone(row) }));
    } }),
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
  assert.equal(app.calls.some(call => call.name === 'INT_AnalysisRun'), false);
});

test('current pointer and hotspot evidence stay indexed with more than ten thousand historical runs', async () => {
  const fixture = catalystRows();
  fixture.tables.INT_AnalysisRun.push(...Array.from({ length: 10_001 }, (_, index) => ({
    ROWID: `HIST-${index}`, AnalysisRunID: `HIST-${index}`, BatchKey: `OLD-${index}`,
  })));
  const app = fakeApplication(fixture.tables);
  const repository = new CatalystIntelligenceRepository({ application: app });
  assert.equal((await repository.getCurrentRunGroup()).RunGroupID, 'RUN-GROUP-DEMO-1');
  const hotspots = await repository.listHotspots({ limit: 50, runGroup: await repository.getCurrentRunGroup() });
  assert.equal(hotspots.data.length, 1);
  assert.equal(app.calls.some(call => ['INT_AnalysisRun', 'INT_Hotspot', 'INT_FindingEvidence'].includes(call.name)), false);
  assert.ok(app.zcqlCalls.some(query => query.includes('INT_PublicationState WHERE PublicationStateID')));
  assert.ok(app.zcqlCalls.some(query => query.includes('INT_Hotspot WHERE AnalysisRunRef')));
  assert.ok(app.zcqlCalls.some(query => query.includes('INT_FindingEvidence WHERE AnalysisRunRef')));
});

test('refresh freshness is reconstructed from exactly one captured publication pointer', async () => {
  const fixture = catalystRows();
  const app = fakeApplication(fixture.tables);
  const repository = new CatalystIntelligenceRepository({ application: app });
  const freshness = await repository.getRefreshStatus();
  assert.equal(freshness.currentRunGroup.RunGroupID, 'RUN-GROUP-DEMO-1');
  assert.equal(app.zcqlCalls.filter(query => query.includes('INT_PublicationState WHERE PublicationStateID')).length, 1);
});

test('station case reads join the governed source masters into an allowlisted projection', async () => {
  const fixture = catalystRows();
  Object.assign(fixture.tables, {
    SRC_CaseMaster: [{
      ROWID: 'CASE-ROW-1', CaseMasterID: 200000001, CaseNo: '202600015', CrimeNo: 'restricted-raw-number',
      PoliceStationID: 1001, CaseStatusID: 1, CrimeRegisteredDate: '2026-06-02',
      IncidentFromDate: '2026-06-02T21:01:00+05:30', CrimeMajorHeadID: 10, CrimeMinorHeadID: 11,
      BriefFacts: 'restricted narrative', latitude: 12.9716, longitude: 77.5946,
      SourceFileName: 'restricted-source.csv', SourceBatchRef: 'BATCH-ROW-1',
      ValidationStatus: 'ACCEPTED', IsSynthetic: true,
    }],
    SRC_Unit: [{ ROWID: 'UNIT-ROW-1', UnitID: 1001, UnitName: 'Central PS', SourceBatchRef: 'BATCH-ROW-1', ValidationStatus: 'ACCEPTED', IsSynthetic: true }],
    SRC_CaseStatusMaster: [{ ROWID: 'STATUS-ROW-1', CaseStatusID: 1, CaseStatusName: 'Under Investigation', SourceBatchRef: 'BATCH-ROW-1', ValidationStatus: 'ACCEPTED', IsSynthetic: true }],
    SRC_CrimeHead: [{ ROWID: 'MAJOR-ROW-1', CrimeHeadID: 10, CrimeGroupName: 'Property', SourceBatchRef: 'BATCH-ROW-1', ValidationStatus: 'ACCEPTED', IsSynthetic: true }],
    SRC_CrimeSubHead: [{ ROWID: 'MINOR-ROW-1', CrimeSubHeadID: 11, CrimeHeadName: 'Burglary', SourceBatchRef: 'BATCH-ROW-1', ValidationStatus: 'ACCEPTED', IsSynthetic: true }],
    TRN_IngestionBatch: [{ ROWID: 'BATCH-ROW-1', BatchID: 'BATCH-1', Status: 'COMPLETED', CompletedAt: '2026-07-01', SourceRowCount: 5, AcceptedRowCount: 5, RejectedRowCount: 0, IsSynthetic: true }],
  });
  const app = fakeApplication(fixture.tables);
  const repository = new CatalystIntelligenceRepository({ application: app });

  const expected = {
    caseId: '200000001', caseNumber: '202600015', unitId: 1001, unitName: 'Central PS',
    status: 'Under Investigation', registeredAt: '2026-06-02', incidentAt: '2026-06-02T21:01:00+05:30',
    majorHead: 'Property', minorHead: 'Burglary', syntheticData: true,
  };
  assert.deepEqual(await repository.listStationCaseRows({ unitIds: [1001] }), [expected]);
  assert.deepEqual(await repository.getStationCaseRow(200000001), expected);
  assert.equal(app.calls.some(call => call.name === 'SRC_CaseMaster'), false);
  assert.ok(app.zcqlCalls.some(query => query.includes('SRC_CaseMaster WHERE PoliceStationID')));
  assert.ok(app.zcqlCalls.some(query => query.includes('SRC_CaseMaster WHERE CaseMasterID')));
  assert.doesNotMatch(JSON.stringify(expected), /BriefFacts|restricted|latitude|longitude|ROWID|SourceFileName/u);
});

test('station case reads use Unknown labels for missing master joins', async () => {
  const fixture = catalystRows();
  Object.assign(fixture.tables, {
    SRC_CaseMaster: [{
      ROWID: 'CASE-ROW-2', CaseMasterID: 200000002, CrimeNo: '101011001202600016',
      PoliceStationID: 9999, CaseStatusID: 9999, InfoReceivedPSDate: '2026-06-03',
      IncidentFromDate: '2026-06-03T21:02:00+05:30', CrimeMajorHeadID: 9999,
      CrimeMinorHeadID: 9999, SourceBatchRef: 'BATCH-ROW-1', ValidationStatus: 'ACCEPTED', IsSynthetic: true,
    }],
    SRC_Unit: [], SRC_CaseStatusMaster: [], SRC_CrimeHead: [], SRC_CrimeSubHead: [],
    TRN_IngestionBatch: [{ ROWID: 'BATCH-ROW-1', BatchID: 'BATCH-1', Status: 'COMPLETED', CompletedAt: '2026-07-01', SourceRowCount: 1, AcceptedRowCount: 1, RejectedRowCount: 0, IsSynthetic: true }],
  });
  const repository = new CatalystIntelligenceRepository({ application: fakeApplication(fixture.tables) });

  assert.deepEqual(await repository.listStationCaseRows({ unitIds: [9999] }), [{
    caseId: '200000002', caseNumber: '101011001202600016', unitId: 9999, unitName: 'Unknown',
    status: 'Unknown', registeredAt: '2026-06-03', incidentAt: '2026-06-03T21:02:00+05:30',
    majorHead: 'Unknown', minorHead: 'Unknown', syntheticData: true,
  }]);
  assert.equal(await repository.getStationCaseRow('missing'), undefined);
});

test('station case reads exclude rejected, non-synthetic, and incomplete-batch source rows', async () => {
  const fixture = catalystRows();
  const base = {
    CaseNo: '202600015', PoliceStationID: 1001, CaseStatusID: 1, CrimeRegisteredDate: '2026-06-02',
    IncidentFromDate: '2026-06-02T21:01:00+05:30', CrimeMajorHeadID: 10, CrimeMinorHeadID: 11,
  };
  Object.assign(fixture.tables, {
    SRC_CaseMaster: [
      { ROWID: 'CASE-OK', CaseMasterID: 1, ...base, SourceBatchRef: 'BATCH-COMPLETE', ValidationStatus: 'ACCEPTED', IsSynthetic: true },
      { ROWID: 'CASE-REJECTED', CaseMasterID: 2, ...base, SourceBatchRef: 'BATCH-COMPLETE', ValidationStatus: 'REJECTED', IsSynthetic: true },
      { ROWID: 'CASE-REAL', CaseMasterID: 3, ...base, SourceBatchRef: 'BATCH-COMPLETE', ValidationStatus: 'ACCEPTED', IsSynthetic: false },
      { ROWID: 'CASE-INCOMPLETE', CaseMasterID: 4, ...base, SourceBatchRef: 'BATCH-LOADING', ValidationStatus: 'ACCEPTED', IsSynthetic: true },
    ],
    SRC_Unit: [{ ROWID: 'UNIT-1', UnitID: 1001, UnitName: 'Central PS', SourceBatchRef: 'BATCH-COMPLETE', ValidationStatus: 'ACCEPTED', IsSynthetic: true }],
    SRC_CaseStatusMaster: [], SRC_CrimeHead: [], SRC_CrimeSubHead: [],
    TRN_IngestionBatch: [
      { ROWID: 'BATCH-COMPLETE', BatchID: 'COMPLETE', Status: 'COMPLETED', CompletedAt: '2026-07-01', SourceRowCount: 5, AcceptedRowCount: 5, RejectedRowCount: 0, IsSynthetic: true },
      { ROWID: 'BATCH-LOADING', BatchID: 'LOADING', Status: 'LOADING', IsSynthetic: true },
      { ROWID: 'BATCH-NON-SYNTHETIC', BatchID: 'REAL', Status: 'COMPLETED', CompletedAt: '2026-07-01', IsSynthetic: false },
    ],
  });
  const repository = new CatalystIntelligenceRepository({ application: fakeApplication(fixture.tables) });

  assert.deepEqual((await repository.listStationCaseRows({ unitIds: [1001] })).map(row => row.caseId), ['1']);
  assert.equal((await repository.listStationCaseRows({ unitIds: [1001] }))[0].syntheticData, true);
  assert.equal(await repository.getStationCaseRow('2'), undefined);
  assert.equal(await repository.getStationCaseRow('3'), undefined);
  assert.equal(await repository.getStationCaseRow('4'), undefined);
});

test('station case detail rejects malformed IDs before issuing any Catalyst query', async () => {
  const fixture = catalystRows();
  const app = fakeApplication(fixture.tables);
  const repository = new CatalystIntelligenceRepository({ application: app });

  for (const caseId of ['not-a-case', '01', '-1', '9007199254740992']) {
    assert.equal(await repository.getStationCaseRow(caseId), undefined);
  }
  assert.deepEqual(app.zcqlCalls, []);
  assert.deepEqual(app.calls, []);
});

test('station case lists use indexed station queries instead of scanning a source table over ten thousand rows', async () => {
  const fixture = catalystRows();
  const accepted = (row) => ({
    ...row, SourceBatchRef: 'BATCH-ROW-1', ValidationStatus: 'ACCEPTED', IsSynthetic: true,
  });
  fixture.tables.SRC_CaseMaster = [
    accepted({ ROWID: 'LOCAL-1', CaseMasterID: 1, CaseNo: '1', PoliceStationID: 1001 }),
    accepted({ ROWID: 'LOCAL-2', CaseMasterID: 2, CaseNo: '2', PoliceStationID: 1001 }),
    ...Array.from({ length: 10_001 }, (_, index) => accepted({
      ROWID: `REMOTE-${index}`, CaseMasterID: index + 10, CaseNo: `R-${index}`, PoliceStationID: 2001,
    })),
  ];
  Object.assign(fixture.tables, {
    SRC_Unit: [accepted({ ROWID: 'UNIT-1', UnitID: 1001, UnitName: 'Central PS' })],
    SRC_CaseStatusMaster: [], SRC_CrimeHead: [], SRC_CrimeSubHead: [],
    TRN_IngestionBatch: [{ ROWID: 'BATCH-ROW-1', BatchID: 'BATCH-1', Status: 'COMPLETED', CompletedAt: '2026-07-01', SourceRowCount: 10_005, AcceptedRowCount: 10_005, RejectedRowCount: 0, IsSynthetic: true }],
  });
  const app = fakeApplication(fixture.tables);
  const repository = new CatalystIntelligenceRepository({ application: app });

  assert.deepEqual((await repository.listStationCaseRows({ unitIds: [1001] })).map(row => row.caseId), ['1', '2']);
  assert.equal(app.calls.some(call => call.name === 'SRC_CaseMaster'), false);
});

test('station case analytics permit exactly 5,000 cases when later authorized stations are empty', async () => {
  const fixture = catalystRows();
  const accepted = row => ({
    ...row, SourceBatchRef: 'BATCH-ROW-1', ValidationStatus: 'ACCEPTED', IsSynthetic: true,
  });
  fixture.tables.SRC_CaseMaster = Array.from({ length: 5000 }, (_, index) => accepted({
    ROWID: `CASE-${index + 1}`, CaseMasterID: index + 1,
    CaseNo: `${index + 1}/2026`, PoliceStationID: 1001,
  }));
  Object.assign(fixture.tables, {
    SRC_Unit: [
      accepted({ ROWID: 'UNIT-1', UnitID: 1001, UnitName: 'Central PS' }),
      accepted({ ROWID: 'UNIT-2', UnitID: 2001, UnitName: 'North PS' }),
    ],
    SRC_CaseStatusMaster: [], SRC_CrimeHead: [], SRC_CrimeSubHead: [],
    TRN_IngestionBatch: [{
      ROWID: 'BATCH-ROW-1', BatchID: 'BATCH-1', Status: 'COMPLETED', CompletedAt: '2026-07-01',
      SourceRowCount: 5002, AcceptedRowCount: 5002, RejectedRowCount: 0, IsSynthetic: true,
    }],
  });
  const app = fakeApplication(fixture.tables);
  const repository = new CatalystIntelligenceRepository({ application: app });

  assert.equal((await repository.listStationCaseRows({ unitIds: [1001, 2001] })).length, 5000);
  assert.ok(app.zcqlCalls.some(query => query.includes('PoliceStationID = 2001')));
});

test('station case analytics probe remaining stations and reject a 5,001st case', async () => {
  const fixture = catalystRows();
  const accepted = row => ({
    ...row, SourceBatchRef: 'BATCH-ROW-1', ValidationStatus: 'ACCEPTED', IsSynthetic: true,
  });
  fixture.tables.SRC_CaseMaster = [
    ...Array.from({ length: 5000 }, (_, index) => accepted({
      ROWID: `CASE-${index + 1}`, CaseMasterID: index + 1,
      CaseNo: `${index + 1}/2026`, PoliceStationID: 1001,
    })),
    accepted({ ROWID: 'CASE-5001', CaseMasterID: 5001, CaseNo: '5001/2026', PoliceStationID: 2001 }),
  ];
  Object.assign(fixture.tables, {
    SRC_Unit: [], SRC_CaseStatusMaster: [], SRC_CrimeHead: [], SRC_CrimeSubHead: [],
    TRN_IngestionBatch: [{
      ROWID: 'BATCH-ROW-1', BatchID: 'BATCH-1', Status: 'COMPLETED', CompletedAt: '2026-07-01',
      SourceRowCount: 5001, AcceptedRowCount: 5001, RejectedRowCount: 0, IsSynthetic: true,
    }],
  });
  const app = fakeApplication(fixture.tables);
  const repository = new CatalystIntelligenceRepository({ application: app });

  await assert.rejects(
    repository.listStationCaseRows({ unitIds: [1001, 2001] }),
    { code: 'DATA_NOT_READY' },
  );
  assert.ok(app.zcqlCalls.some(query => query.includes('PoliceStationID = 2001')));
});

test('station case analytics count only eligible cases while scanning bounded raw rows', async () => {
  const fixture = catalystRows();
  const eligible = row => ({
    ...row, SourceBatchRef: 'BATCH-ROW-1', ValidationStatus: 'ACCEPTED', IsSynthetic: true,
  });
  const ineligible = (row, index) => ({
    ...row,
    SourceBatchRef: index % 3 === 0 ? 'BATCH-INCOMPLETE' : 'BATCH-ROW-1',
    ValidationStatus: index % 3 === 1 ? 'REJECTED' : 'ACCEPTED',
    IsSynthetic: index % 3 !== 2,
  });
  fixture.tables.SRC_CaseMaster = [
    ...Array.from({ length: 5000 }, (_, index) => eligible({
      ROWID: `ELIGIBLE-${index + 1}`, CaseMasterID: index + 1,
      CaseNo: `${index + 1}/2026`, PoliceStationID: 1001,
    })),
    ...Array.from({ length: 1001 }, (_, index) => ineligible({
      ROWID: `INELIGIBLE-${index + 1}`, CaseMasterID: 6000 + index,
      CaseNo: `X-${index + 1}/2026`, PoliceStationID: 1001,
    }, index)),
  ];
  Object.assign(fixture.tables, {
    SRC_Unit: [], SRC_CaseStatusMaster: [], SRC_CrimeHead: [], SRC_CrimeSubHead: [],
    TRN_IngestionBatch: [{
      ROWID: 'BATCH-ROW-1', BatchID: 'BATCH-1', Status: 'COMPLETED', CompletedAt: '2026-07-01',
      SourceRowCount: 6001, AcceptedRowCount: 5667, RejectedRowCount: 334, IsSynthetic: true,
    }],
  });
  const repository = new CatalystIntelligenceRepository({ application: fakeApplication(fixture.tables) });

  assert.equal((await repository.listStationCaseRows({ unitIds: [1001] })).length, 5000);
});

test('station case analytics fail safely when eligibility cannot be proven within 10,000 raw rows', async () => {
  const fixture = catalystRows();
  fixture.tables.SRC_CaseMaster = Array.from({ length: 10_001 }, (_, index) => ({
    ROWID: `INELIGIBLE-${index + 1}`, CaseMasterID: index + 1,
    CaseNo: `X-${index + 1}/2026`, PoliceStationID: 1001,
    SourceBatchRef: 'BATCH-INCOMPLETE', ValidationStatus: 'ACCEPTED', IsSynthetic: true,
  }));
  Object.assign(fixture.tables, {
    SRC_Unit: [], SRC_CaseStatusMaster: [], SRC_CrimeHead: [], SRC_CrimeSubHead: [],
    TRN_IngestionBatch: [],
  });
  const repository = new CatalystIntelligenceRepository({ application: fakeApplication(fixture.tables) });

  await assert.rejects(
    repository.listStationCaseRows({ unitIds: [1001] }),
    { code: 'DATA_NOT_READY' },
  );
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

test('pattern and anomaly reads stay on the explicitly captured Catalyst run group', async () => {
  const fixture = catalystRows();
  const app = fakeApplication(fixture.tables);
  const repository = new CatalystIntelligenceRepository({ application: app });
  const captured = await repository.getCurrentRunGroup();
  fixture.tables.INT_Pattern.push({
    ...fixture.tables.INT_Pattern[0], ROWID: 'PAT-NEW', PatternID: 'PATTERN-NEW', AnalysisRunRef: 'RUN-PAT-NEW',
  });
  fixture.tables.INT_Anomaly.push({
    ...fixture.tables.INT_Anomaly[0], ROWID: 'ANOM-NEW', AnomalyID: 'ANOMALY-NEW', AnalysisRunRef: 'RUN-ANOM-NEW',
  });
  const nextRuns = JSON.parse(fixture.tables.INT_PublicationState[0].CurrentRunsJSON).map(run => ({
    ...run,
    ...(run.AnalysisType === 'PATTERN' ? { ROWID: 'RUN-PAT-NEW', AnalysisRunRef: 'RUN-PAT-NEW' } : {}),
    ...(run.AnalysisType === 'ANOMALY' ? { ROWID: 'RUN-ANOM-NEW', AnalysisRunRef: 'RUN-ANOM-NEW' } : {}),
  }));
  fixture.tables.INT_PublicationState[0].CurrentRunsJSON = JSON.stringify(nextRuns);

  assert.equal((await repository.listPatterns({ runGroup: captured })).data[0].id, fixture.state.patterns[0].id);
  assert.equal((await repository.listAnomalies({ runGroup: captured })).data[0].id,
    fixture.state.anomalies.find(row => row.isAnomaly).id);
});

test('reads cloned physical utility rules with indexed filters and safe row mapping', async () => {
  const fixture = catalystRows();
  fixture.tables.CFG_UtilityAlertRule.push({
    ...fixture.tables.CFG_UtilityAlertRule[0], ROWID: 'RULE-ROW-2', RuleID: '12345',
    CreatedByUserID: '67890',
  });
  const app = fakeApplication(fixture.tables);
  const repository = new CatalystIntelligenceRepository({ application: app });

  const [rule] = await repository.listUtilityRules({ utilityKey: 'patterns', createdByUserId: 'USER-1' });
  assert.equal(rule.IdempotencyKeyHash, 'a'.repeat(64));
  assert.equal(rule.RequestHash, 'b'.repeat(64));
  assert.equal(rule.RuleID, 'RULE-1');
  assert.equal(rule.ThresholdsJSON, '{"threshold":0.8}');
  assert.equal(Object.hasOwn(rule, 'ROWID'), false);
  assert.equal(Object.hasOwn(rule, 'CREATORID'), false);
  rule.Enabled = false;
  assert.equal((await repository.getUtilityRule('RULE-1')).Enabled, true);
  assert.equal((await repository.listUtilityRules({ utilityKey: "patterns' OR '1'='1" })).length, 0);
  await repository.listUtilityRules({ createdByUserId: 'USER-1' });
  assert.equal((await repository.getUtilityRule('12345')).RuleID, '12345');
  assert.equal((await repository.listUtilityRules({ createdByUserId: '67890' })).length, 1);
  assert.ok(app.zcqlCalls.some(query => query.includes('CFG_UtilityAlertRule WHERE UtilityKey')));
  assert.ok(app.zcqlCalls.some(query => query.includes('CFG_UtilityAlertRule WHERE CreatedByUserID')));
  assert.ok(app.zcqlCalls.some(query => query.includes('CFG_UtilityAlertRule WHERE RuleID')));
  assert.ok(app.zcqlCalls.some(query => query.includes("patterns'' OR ''1''=''1")));
  assert.ok(app.zcqlCalls.some(query => query.includes("WHERE RuleID = '12345'")));
  assert.ok(app.zcqlCalls.some(query => query.includes("WHERE CreatedByUserID = '67890'")));
  await assert.rejects(
    repository.listUtilityRules({ utilityKey: true }),
    /text or a finite number/u,
  );
});

test('indexed numeric values remain unquoted ZCQL literals', async () => {
  const fixture = catalystRows();
  const pointer = fixture.tables.INT_PublicationState[0];
  const runs = JSON.parse(pointer.CurrentRunsJSON);
  const hotspotRun = runs.find(row => row.AnalysisType === 'HOTSPOT');
  hotspotRun.ROWID = 9001;
  pointer.CurrentRunsJSON = JSON.stringify(runs);
  fixture.tables.INT_Hotspot[0].AnalysisRunRef = 9001;
  const app = fakeApplication(fixture.tables);
  const repository = new CatalystIntelligenceRepository({ application: app });

  assert.equal((await repository.listHotspots()).data.length, 1);
  assert.ok(app.zcqlCalls.some(query => query.includes('INT_Hotspot WHERE AnalysisRunRef = 9001')));
  assert.equal(app.zcqlCalls.some(query => query.includes("INT_Hotspot WHERE AnalysisRunRef = '9001'")), false);
});

test('unfiltered utility rule reads fail closed at the governed pagination bound', async () => {
  const fixture = catalystRows();
  fixture.tables.CFG_UtilityAlertRule = Array.from({ length: 101 }, (_, index) => ({
    ...fixture.tables.CFG_UtilityAlertRule[0], ROWID: String(index + 1), RuleID: `RULE-${index + 1}`,
  }));
  const app = fakeApplication(fixture.tables);
  const repository = new CatalystIntelligenceRepository({ application: app });

  await assert.rejects(repository.listUtilityRules(), { code: 'DATA_NOT_READY' });
  assert.equal(app.calls.filter(call => call.name === 'CFG_UtilityAlertRule').length, 50);
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

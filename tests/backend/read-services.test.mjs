import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { buildDemoState } from '../../src/backend/repository/build-demo-state.mjs';
import { MemoryIntelligenceRepository } from '../../src/backend/repository/memory-repository.mjs';
import { createReadServices } from '../../src/backend/services/read-services.mjs';

const policy = JSON.parse(await readFile(
  new URL('../../config/access-policy.json', import.meta.url),
  'utf8',
));

const districtAccess = Object.freeze({
  actualUserId: 'CAT-DISTRICT', role: 'DISTRICT_LEADERSHIP', scopeUnitId: 101,
  authorizedUnitIds: new Set([101, 1001]), actions: policy.roles.DISTRICT_LEADERSHIP,
  assignments: [], syntheticData: true,
});

const createServices = (state = buildDemoState()) => createReadServices({
  repository: new MemoryIntelligenceRepository(state),
  policy,
  clock: () => new Date('2026-07-01T02:00:00Z'),
  idFactory: () => 'REQ-READ-1',
});

test('brief is deterministic, scoped, evidence-linked, and fully described', async () => {
  const response = await createServices().getBrief({ access: districtAccess, query: {} });
  assert.equal(response.meta.requestId, 'REQ-READ-1');
  assert.equal(response.meta.scopeUnitId, 101);
  assert.equal(response.meta.syntheticData, true);
  assert.equal(response.meta.dataQualityStatus, 'ACCEPTED');
  assert.equal(response.meta.analysisRunId, 'RUN-GROUP-DEMO-1');
  assert.deepEqual(response.meta.observationPeriod, { from: '2026-05-01T00:00:00Z', to: '2026-07-01T00:00:00Z' });
  assert.match(response.data.executiveSummary, /Synthetic/);
  assert.deepEqual(response.data.leadingPatternIds, ['PATTERN-1']);
});

test('pattern list and detail redact cross-district evidence', async () => {
  const services = createServices();
  const list = await services.listPatterns({ access: districtAccess, query: { limit: 50 } });
  assert.equal(list.data.items.length, 1);
  assert.equal(list.data.items[0].redactedEvidenceCount, 2);
  assert.deepEqual(list.data.items[0].evidence.map(({ caseId }) => caseId), ['CASE-001', 'CASE-002']);

  const detail = await services.getPattern({ access: districtAccess, params: { patternId: 'PATTERN-1' }, query: {} });
  for (const field of ['method', 'version', 'confidence', 'recommendation', 'limitations', 'evidence']) {
    assert.notEqual(detail.data[field], undefined, `pattern missing ${field}`);
  }
  assert.equal(detail.data.redactionReason, 'CROSS_UNIT_SCOPE');
});

test('explicit analyst assignment reveals only granted cross-unit cases', async () => {
  const analyst = {
    ...districtAccess,
    role: 'CRIME_ANALYST',
    actions: policy.roles.CRIME_ANALYST,
    assignments: [{
      alertId: 'ALT-PATTERN-1', authorizedUnitIds: [102],
      authorizedCaseIds: ['CASE-021'], evidenceAccessLevel: 'CASE_EVIDENCE', active: true,
    }],
  };
  const detail = await createServices().getPattern({
    access: analyst, params: { patternId: 'PATTERN-1' }, query: {},
  });
  assert.deepEqual(detail.data.evidence.map(({ caseId }) => caseId).sort(), ['CASE-001', 'CASE-002', 'CASE-021']);
  assert.equal(detail.data.redactedEvidenceCount, 1);
});

test('all remaining read services return governed envelopes', async () => {
  const services = createServices();
  const responses = await Promise.all([
    services.listHotspots({ access: districtAccess, query: {} }),
    services.listAnomalies({ access: districtAccess, query: {} }),
    services.getAreaRisk({ access: districtAccess, query: {} }),
    services.getNetwork({ access: districtAccess, params: { nodeId: 'CASE-001' }, query: {} }),
    services.getDistrictContext({ access: districtAccess, query: { unitId: 101 } }),
  ]);
  for (const response of responses) {
    assert.equal(response.meta.syntheticData, true);
    assert.equal(response.meta.requestId, 'REQ-READ-1');
    assert.notEqual(response.data, undefined);
  }

  const hotspot = responses[0].data.items[0];
  for (const field of ['method', 'version', 'confidence', 'limitations', 'evidenceCaseIds']) {
    assert.notEqual(hotspot[field], undefined, `hotspot missing ${field}`);
  }
  assert.equal(responses[2].data.scope, 'AREA_TIME_ONLY');
  assert.equal(responses[4].data.items[0].limitation, 'CORRELATION_IS_NOT_CAUSATION');
});

test('permissions, unit filters, direct identifiers, and limits fail closed', async () => {
  const services = createServices();
  const noPattern = { ...districtAccess, actions: [] };
  await assert.rejects(services.listPatterns({ access: noPattern, query: {} }), { code: 'FORBIDDEN_ACTION' });
  await assert.rejects(services.getPattern({ access: districtAccess, params: { patternId: 'MISSING' }, query: {} }), { code: 'NOT_FOUND' });
  await assert.rejects(services.getNetwork({ access: districtAccess, params: { nodeId: 'MISSING' }, query: {} }), { code: 'NOT_FOUND' });
  await assert.rejects(services.getDistrictContext({ access: districtAccess, query: { unitId: 102 } }), { code: 'FORBIDDEN_SCOPE' });
  await assert.rejects(services.listPatterns({ access: districtAccess, query: { limit: 201 } }), { code: 'INVALID_REQUEST' });
});

import assert from 'node:assert/strict';
import test from 'node:test';

import { runIntelligencePipeline } from '@ksp/intelligence-core';

import { buildCrimeIdentity } from '../../src/ingestion/pdf-semantic-rules.mjs';
import { toIntelligenceInput } from '../../src/ingestion/to-intelligence-input.mjs';
import { validateSourceSeed } from '../../src/ingestion/validate-source-seed.mjs';
import { createGeospatialLayerService } from '../../src/backend/geospatial/layer-service.mjs';
import { createMapViewService } from '../../src/backend/geospatial/map-view-service.mjs';
import { createRefreshService } from '../../src/backend/refresh/refresh-service.mjs';
import { buildDemoState } from '../../src/backend/repository/build-demo-state.mjs';
import { MemoryIntelligenceRepository } from '../../src/backend/repository/memory-repository.mjs';
import { createReadServices } from '../../src/backend/services/read-services.mjs';
import { generateSourceSeed } from '../../src/synthetic/source-seed.mjs';

const access = Object.freeze({
  actions: ['READ_HOTSPOT', 'CREATE_MAP_VIEW', 'EDIT_OWN_MAP_VIEW'], authorizedUnitIds: new Set([101]),
  scopeUnitId: 101, syntheticData: true, organizationId: 'ORG-KSP', employeeId: 9001,
});
const savedViewDefinition = Object.freeze({
  id: 'VIEW-HOTSPOTS', name: 'Verified hotspots', version: 1, visibility: 'PRIVATE',
  viewport: { bounds: [77, 12, 78, 14] },
  layers: [{ id: 'LAYER-HOTSPOTS', datasetId: 'hotspots', renderer: 'POINT', visible: true, order: 0 }],
});
const layerRequest = definition => ({
  layer: definition.layers[0], runtime: { viewport: definition.viewport, limit: 200 },
});

function appendAcceptedFir(source) {
  const next = structuredClone(source);
  const oldId = 200000001;
  const newId = 200000051;
  const original = next.tables.CaseMaster.find(row => row.CaseMasterID === oldId);
  const identity = buildCrimeIdentity({
    categoryCode: 1, districtId: 101, stationId: original.PoliceStationID,
    year: 2026, serial: 21,
  });
  next.tables.CaseMaster.push({
    ...original, ...identity, CaseMasterID: newId,
    IncidentFromDate: '2026-06-08T21:07:00+05:30', IncidentToDate: '2026-06-08T22:07:00+05:30',
    InfoReceivedPSDate: '2026-06-08T23:07:00+05:30', CrimeRegisteredDate: '2026-06-08',
    latitude: 12.9717, longitude: 77.5947, BriefFacts: 'Accepted incremental synthetic FIR near the verified cluster.',
  });
  const addCaseRow = (table, changes) => {
    const row = next.tables[table].find(item => item.CaseMasterID === oldId);
    next.tables[table].push({ ...row, CaseMasterID: newId, ...changes });
  };
  addCaseRow('ComplainantDetails', { ComplainantID: 300000051 });
  addCaseRow('ActSectionAssociation', {});
  addCaseRow('Victim', { VictimMasterID: 350000051 });
  addCaseRow('Accused', { AccusedMasterID: 410000051, AccusedName: 'Synthetic Incremental Accused' });
  addCaseRow('ArrestSurrender', {
    ArrestSurrenderID: 450000051, AccusedMasterID: 410000051, ArrestSurrenderDate: '2026-06-09',
  });
  addCaseRow('ChargesheetDetails', { CSID: 500000051, csdate: '2026-06-12T21:07:00+05:30' });
  for (const rows of Object.values(next.tables)) {
    if (Array.isArray(rows) && rows.some(row => Object.hasOwn(row, 'CaseMasterID'))) {
      const retained = rows.filter(row => row.CaseMasterID !== oldId);
      rows.splice(0, rows.length, ...retained);
    }
  }
  return next;
}

function services(repository, { failPublication = false } = {}) {
  let id = 0;
  let publicationFailure = failPublication;
  const wrapped = failPublication ? new MemoryIntelligenceRepository(buildDemoState(), {
    failureInjector(point) {
      if (point === 'beforeRefreshPublish' && publicationFailure) {
        publicationFailure = false;
        const error = new Error('injected publication failure'); error.code = 'INJECTED_FAILURE'; throw error;
      }
    },
  }) : repository;
  const clockValues = [
    '2026-07-22T10:00:00.000Z', '2026-07-22T10:00:01.000Z', '2026-07-22T10:00:02.000Z',
    '2026-07-22T10:00:03.000Z', '2026-07-22T10:00:04.000Z', '2026-07-22T10:00:05.000Z',
  ];
  let tick = 0;
  const clock = () => clockValues[Math.min(tick++, clockValues.length - 1)];
  const readServices = createReadServices({ wrapped: undefined, repository: wrapped, clock: () => new Date(clock()), idFactory: () => `READ-${++id}` });
  const geospatial = createGeospatialLayerService({ repository: wrapped, readServices, clock: () => new Date(clock()) });
  const mapViews = createMapViewService({ repository: wrapped, clock });
  const refresh = createRefreshService({
    repository: wrapped, sourceGenerator: generateSourceSeed, sourceValidator: validateSourceSeed,
    adapter: toIntelligenceInput, pipeline: runIntelligencePipeline, clock,
    idFactory: prefix => `${prefix}-${++id}`,
  });
  return { repository: wrapped, refresh, geospatial, mapViews };
}

test('full-batch source replacement removes absent contributions and an unchanged persisted view reads the new verified run', async () => {
  const state = buildDemoState();
  const repository = new MemoryIntelligenceRepository(state);
  const fixture = services(repository);
  const created = await fixture.mapViews.createMapView({
    access, requestId: 'REQ-VIEW-CREATE',
    body: { name: savedViewDefinition.name, visibility: savedViewDefinition.visibility, definition: savedViewDefinition },
  });
  const savedBefore = created.data.definition;
  const before = await fixture.geospatial.executeLayer({ access, body: layerRequest(savedBefore), requestId: 'REQ-BEFORE' });
  assert.equal(before.meta.runGroupId, 'RUN-GROUP-DEMO-1');

  const incoming = appendAcceptedFir(generateSourceSeed(20260720));
  const checked = validateSourceSeed(incoming);
  assert.equal(checked.reconciliation.rejectedRows, 0);
  await repository.persistValidatedSource({ batchKey: 'SOURCE-INCREMENT-1', source: incoming, ...checked });
  await fixture.refresh.execute({ operation: 'REFRESH_INTELLIGENCE', batchKey: 'SOURCE-INCREMENT-1' });

  const savedAfter = (await fixture.mapViews.getMapView({
    access, requestId: 'REQ-VIEW-AFTER', params: { mapViewId: savedViewDefinition.id },
  })).data.definition;
  const after = await fixture.geospatial.executeLayer({ access, body: layerRequest(savedAfter), requestId: 'REQ-AFTER' });
  assert.notEqual(after.meta.runGroupId, before.meta.runGroupId);
  assert.equal(after.data.features.some(feature => feature.properties.evidenceCaseIds.includes('CASE-051')), true);
  assert.equal(after.data.features.some(feature => feature.properties.evidenceCaseIds.includes('CASE-001')), false);
  assert.deepEqual(savedAfter, savedBefore);
  assert.equal(after.meta.sourceRecordCount, 1);
  assert.equal(after.meta.outputFeatureCount, 1);
  assert.equal(after.meta.omittedFeatureCount, 0);
  for (const key of ['publishedAt', 'generatedAt', 'observationStart', 'observationEnd', 'engineVersion']) {
    assert.equal(typeof after.meta[key], 'string', key);
  }
});

test('failed publication leaves the prior verified layer and freshness visible until retry atomically recovers', async () => {
  const fixture = services(undefined, { failPublication: true });
  const before = await fixture.geospatial.executeLayer({ access, body: layerRequest(savedViewDefinition), requestId: 'REQ-BEFORE' });
  const incoming = appendAcceptedFir(generateSourceSeed(20260720));
  const checked = validateSourceSeed(incoming);
  await fixture.repository.persistValidatedSource({ batchKey: 'SOURCE-FAIL-1', source: incoming, ...checked });

  await assert.rejects(fixture.refresh.execute({ operation: 'REFRESH_INTELLIGENCE', batchKey: 'SOURCE-FAIL-1' }), { code: 'INJECTED_FAILURE' });
  const afterFailure = await fixture.geospatial.executeLayer({ access, body: layerRequest(savedViewDefinition), requestId: 'REQ-FAILED' });
  assert.equal(afterFailure.meta.runGroupId, before.meta.runGroupId);
  const stale = await fixture.geospatial.getFreshness({ access, requestId: 'REQ-FRESH-FAILED' });
  assert.deepEqual(stale.data.layers.map(item => item.datasetId), ['hotspots']);
  assert.equal(stale.data.layers[0].runGroupId, before.meta.runGroupId);
  assert.equal(stale.data.layers[0].state, 'REFRESH_FAILED');

  await fixture.refresh.execute({ operation: 'REFRESH_INTELLIGENCE', batchKey: 'SOURCE-FAIL-1' });
  const recovered = await fixture.geospatial.getFreshness({ access, requestId: 'REQ-FRESH-RECOVERED' });
  assert.notEqual(recovered.data.layers[0].runGroupId, before.meta.runGroupId);
  assert.equal(recovered.data.layers[0].state, 'CURRENT');
});

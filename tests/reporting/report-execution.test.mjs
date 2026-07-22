import assert from 'node:assert/strict';
import test from 'node:test';

import { executeReportDefinition, projectMapReportExecution } from '../../src/backend/reporting/report-execution.mjs';

test('report execution filters, groups, aggregates, sorts and limits governed rows', () => {
  const result = executeReportDefinition({
    dimensions: ['unitId'], measures: [{ field: 'observed', aggregate: 'sum' }],
    filters: [{ field: 'severity', operator: 'gte', value: 0.5 }],
    sort: [{ field: 'observed_sum', direction: 'desc' }], limit: 1,
  }, [
    { unitId: 101, observed: 4, severity: 0.8 },
    { unitId: 101, observed: 6, severity: 0.7 },
    { unitId: 102, observed: 20, severity: 0.2 },
  ]);
  assert.deepEqual(result, [{ unitId: 101, observed_sum: 10 }]);
});

test('report execution calculates count and average without mutating source rows', () => {
  const rows = [{ type: 'A', value: 2 }, { type: 'A', value: 4 }];
  const result = executeReportDefinition({
    dimensions: ['type'], measures: [
      { field: 'value', aggregate: 'avg' }, { field: 'value', aggregate: 'count' },
    ], filters: [], sort: [], limit: 100,
  }, rows);
  assert.deepEqual(result, [{ type: 'A', value_avg: 3, value_count: 2 }]);
  assert.deepEqual(rows, [{ type: 'A', value: 2 }, { type: 'A', value: 4 }]);
});

test('map report projection returns a client-safe definition and bounded execution descriptors', () => {
  const result = projectMapReportExecution({
    id: 'MAP-1', organizationId: 'ORG-KSP', ownerEmployeeId: 9001,
    name: 'Hotspot posture', visibility: 'SHARED', version: 3,
    definition: {
      id: 'MAP-1', name: 'Hotspot posture', visibility: 'SHARED', version: 3,
      viewport: { center: [77.59, 12.97], zoom: 9 },
      layers: [
        { id: 'L-2', datasetId: 'hotspots', renderer: 'HEATMAP', visible: false, order: 1, limit: 5000 },
        { id: 'L-1', datasetId: 'hotspots', renderer: 'CLUSTER', visible: true, order: 0, limit: 5000 },
      ],
    },
  });

  assert.deepEqual(result.executions, [{
    layer: { id: 'L-1', datasetId: 'hotspots', renderer: 'CLUSTER', visible: true, order: 0, limit: 5000 },
    runtime: { viewport: { center: [77.59, 12.97], zoom: 9 }, limit: 5000 },
  }]);
  assert.equal(result.mapView.organizationId, undefined);
  assert.equal(result.mapView.ownerEmployeeId, undefined);
  assert.equal(JSON.stringify(result).includes('sourceReference'), false);
  assert.deepEqual(result.mapView, {
    id: 'MAP-1', name: 'Hotspot posture', visibility: 'SHARED', version: 3,
    definition: {
      id: 'MAP-1', name: 'Hotspot posture', visibility: 'SHARED', version: 3,
      viewport: { center: [77.59, 12.97], zoom: 9 },
      layers: [
        { id: 'L-1', datasetId: 'hotspots', renderer: 'CLUSTER', visible: true, order: 0, limit: 5000 },
        { id: 'L-2', datasetId: 'hotspots', renderer: 'HEATMAP', visible: false, order: 1, limit: 5000 },
      ],
    },
  });
});

test('map report projection rejects unbounded or private execution material', () => {
  const base = {
    id: 'MAP-1', name: 'Unsafe', visibility: 'PRIVATE', version: 1,
    definition: { id: 'MAP-1', name: 'Unsafe', visibility: 'PRIVATE', version: 1, layers: [] },
  };
  assert.throws(() => projectMapReportExecution({
    ...base, definition: { ...base.definition, layers: [{
      id: 'L-1', datasetId: 'hotspots', renderer: 'POINT', visible: true, order: 0, limit: 5001,
    }] },
  }), /limit/i);
  assert.throws(() => projectMapReportExecution({
    ...base, definition: { ...base.definition, sourceReference: 'private-source' },
  }), /definition/i);
});

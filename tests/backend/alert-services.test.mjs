import assert from 'node:assert/strict';
import test from 'node:test';

import { buildDemoState } from '../../src/backend/repository/build-demo-state.mjs';
import { MemoryIntelligenceRepository } from '../../src/backend/repository/memory-repository.mjs';
import { createAlertServices } from '../../src/backend/services/alert-services.mjs';

const access = (units) => ({
  actualUserId: 'USER-1', role: 'DISTRICT_LEADERSHIP', actions: ['READ_ALERT'],
  authorizedUnitIds: new Set(units), scopeUnitId: units[0], syntheticData: true,
});

test('alert discovery is scoped and exposes explainable immutable finding evidence', async () => {
  const repository = new MemoryIntelligenceRepository(buildDemoState());
  const alerts = createAlertServices({ repository });
  const list = await alerts.listAlerts({ access: access([101]), query: { status: 'GENERATED' } });
  assert.equal(list.data.items.length, 1);

  const detail = await alerts.getAlertDetail({ access: access([101]), params: { alertId: 'ALT-PATTERN-1' } });
  assert.equal(detail.data.syntheticData, true);
  assert.equal(detail.data.explanation.methodVersion, '1.0.0');
  assert.ok(detail.data.evidence.length > 0);
  assert.ok(detail.data.evidence.every(({ unitId }) => unitId === 101));
  assert.equal(detail.data.originalFinding.status, 'IMMUTABLE');
  assert.deepEqual(detail.data.limitations, ['SYNTHETIC_DATA', 'SIMILARITY_IS_NOT_PROOF']);
});

test('alert discovery rejects missing permission, invalid filters and hidden geography', async () => {
  const repository = new MemoryIntelligenceRepository(buildDemoState());
  const alerts = createAlertServices({ repository });
  await assert.rejects(alerts.listAlerts({ access: { ...access([101]), actions: [] }, query: {} }), { code: 'FORBIDDEN_ACTION' });
  await assert.rejects(alerts.listAlerts({ access: access([101]), query: { status: 'DROP TABLE' } }), { code: 'INVALID_REQUEST' });
  await assert.rejects(alerts.getAlertDetail({ access: access([999]), params: { alertId: 'ALT-PATTERN-1' } }), { code: 'NOT_FOUND' });
});

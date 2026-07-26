import assert from 'node:assert/strict';
import test from 'node:test';

import { createUtilityServices } from '../../src/backend/utilities/utility-services.mjs';

const services = createUtilityServices();

test('catalogue lists all four utility definitions and supports category filtering', async () => {
  const all = await services.listUtilities({ query: {} });
  assert.deepEqual(all.data.map(({ key }) => key), [
    'patterns', 'hotspots', 'anomalies', 'area-attention',
  ]);

  const filtered = await services.listUtilities({ query: { category: 'spatial-intelligence' } });
  assert.deepEqual(filtered.data.map(({ key }) => key), ['hotspots']);
});

test('catalogue lists unique utility categories in registry order', async () => {
  const result = await services.listUtilityCategories();
  const repeated = await services.listUtilityCategories();

  assert.deepEqual(result.data, [
    'patterns-networks',
    'spatial-intelligence',
    'trends-anomalies',
    'risk-prioritization',
  ]);
  assert.equal(new Set(result.data).size, result.data.length);
  assert.equal(Object.isFrozen(result.data), true);
  assert.equal(repeated.data, result.data);
});

test('catalogue returns one definition and keeps area-attention alerts disabled', async () => {
  const result = await services.getUtility({ params: { utilityKey: 'area-attention' } });

  assert.equal(result.data.key, 'area-attention');
  assert.deepEqual(result.data.alertPolicy, { enabled: false, fields: {} });
});

test('catalogue rejects an unknown utility with the stable NOT_FOUND service error', async () => {
  await assert.rejects(
    services.getUtility({ params: { utilityKey: 'unknown' } }),
    error => error?.code === 'NOT_FOUND' && error?.status === 404,
  );
});

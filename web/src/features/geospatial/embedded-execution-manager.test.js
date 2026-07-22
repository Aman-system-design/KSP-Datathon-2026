import { expect, test, vi } from 'vitest';

import { createEmbeddedExecutionManager } from './embedded-execution-manager.js';

const featureResponse = count => ({ data: {
  type: 'FeatureCollection', features: Array.from({ length: count }, (_, id) => ({ id })),
} });

test('shares catalog and bounds concurrency across 24 embedded widgets', async () => {
  let active = 0;
  let peak = 0;
  const api = {
    get: vi.fn(async () => ({ data: { items: [] } })),
    post: vi.fn(async () => {
      active += 1; peak = Math.max(peak, active);
      await new Promise(resolve => setTimeout(resolve, 2));
      active -= 1;
      return featureResponse(1);
    }),
  };
  const manager = createEmbeddedExecutionManager(api, { maxConcurrent: 4, maxLayers: 24, maxFeatures: 24 });
  const clients = Array.from({ length: 24 }, (_, index) => manager.client(`W-${index}`));
  await Promise.all(clients.map(client => client.get('/v1/geospatial/datasets')));
  const pending = clients.map((client, index) => client.post('/v1/geospatial/layers/execute', {
    layer: { id: `L-${index}` }, runtime: {},
  }));
  await Promise.all(pending);

  expect(api.get).toHaveBeenCalledTimes(1);
  expect(api.post).toHaveBeenCalledTimes(24);
  expect(peak).toBe(4);
});

test('fails honestly before exceeding aggregate layer or feature budgets', async () => {
  const api = { get: vi.fn(), post: vi.fn(async (_path, body) => featureResponse(body.runtime.count)) };
  const layers = createEmbeddedExecutionManager(api, { maxConcurrent: 2, maxLayers: 1, maxFeatures: 3 });
  await layers.client('W-1').post('/v1/geospatial/layers/execute', { layer: { id: 'L-1' }, runtime: { count: 2 } });
  await expect(layers.client('W-2').post('/v1/geospatial/layers/execute', {
    layer: { id: 'L-2' }, runtime: { count: 1 },
  })).rejects.toMatchObject({ code: 'EMBEDDED_MAP_BUDGET_EXCEEDED' });

  const features = createEmbeddedExecutionManager(api, { maxConcurrent: 2, maxLayers: 2, maxFeatures: 3 });
  await features.client('W-1').post('/v1/geospatial/layers/execute', { layer: { id: 'L-1' }, runtime: { count: 2 } });
  await expect(features.client('W-2').post('/v1/geospatial/layers/execute', {
    layer: { id: 'L-2' }, runtime: { count: 2 },
  })).rejects.toMatchObject({ code: 'EMBEDDED_MAP_BUDGET_EXCEEDED' });
});

test('serves queued widgets in FIFO order without starvation', async () => {
  const order = [];
  const api = {
    get: vi.fn(),
    post: vi.fn(async (_path, body) => {
      order.push(`start:${body.layer.id}`);
      await new Promise(resolve => setTimeout(resolve, 1));
      order.push(`end:${body.layer.id}`);
      return featureResponse(0);
    }),
  };
  const manager = createEmbeddedExecutionManager(api, { maxConcurrent: 1, maxLayers: 3, maxFeatures: 3 });
  await Promise.all(['L-1', 'L-2', 'L-3'].map((id, index) => manager.client(`W-${index}`).post(
    '/v1/geospatial/layers/execute', { layer: { id }, runtime: {} },
  )));

  expect(order).toEqual(['start:L-1', 'end:L-1', 'start:L-2', 'end:L-2', 'start:L-3', 'end:L-3']);
});

test('releases layer reservations on widget disposal and failed execution', async () => {
  const api = { get: vi.fn(), post: vi.fn(async () => featureResponse(1)) };
  const manager = createEmbeddedExecutionManager(api, { maxConcurrent: 1, maxLayers: 1, maxFeatures: 2 });
  await manager.client('W-1').post('/v1/geospatial/layers/execute', { layer: { id: 'L-1' }, runtime: {} });
  manager.release('W-1');
  await expect(manager.client('W-2').post('/v1/geospatial/layers/execute', {
    layer: { id: 'L-2' }, runtime: {},
  })).resolves.toEqual(featureResponse(1));

  const failingApi = {
    get: vi.fn(),
    post: vi.fn()
      .mockRejectedValueOnce(new Error('temporary failure'))
      .mockResolvedValueOnce(featureResponse(1)),
  };
  const afterFailure = createEmbeddedExecutionManager(failingApi, {
    maxConcurrent: 1, maxLayers: 1, maxFeatures: 2,
  });
  await expect(afterFailure.client('W-1').post('/v1/geospatial/layers/execute', {
    layer: { id: 'L-1' }, runtime: {},
  })).rejects.toThrow('temporary failure');
  await expect(afterFailure.client('W-2').post('/v1/geospatial/layers/execute', {
    layer: { id: 'L-2' }, runtime: {},
  })).resolves.toEqual(featureResponse(1));
});

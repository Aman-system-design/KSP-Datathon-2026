import { expect, test, vi } from 'vitest';

import { createEmbeddedExecutionManager } from './embedded-execution-manager.js';

const featureResponse = count => ({ data: {
  type: 'FeatureCollection', features: Array.from({ length: count }, (_, id) => ({ id })),
} });
const deferred = () => {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
};

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

test('release cancels in-flight work without resurrecting its reservation', async () => {
  const first = deferred();
  const api = { get: vi.fn(), post: vi.fn()
    .mockImplementationOnce(() => first.promise)
    .mockResolvedValueOnce(featureResponse(1)) };
  const manager = createEmbeddedExecutionManager(api, { maxConcurrent: 1, maxLayers: 1, maxFeatures: 2 });
  const stale = manager.client('W-1').post('/v1/geospatial/layers/execute', {
    layer: { id: 'L-1' }, runtime: {},
  });
  const staleResult = expect(stale).rejects.toMatchObject({ code: 'EMBEDDED_MAP_EXECUTION_CANCELLED' });
  await vi.waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
  manager.release('W-1');
  const current = manager.client('W-2').post('/v1/geospatial/layers/execute', {
    layer: { id: 'L-2' }, runtime: {},
  });
  first.resolve(featureResponse(1));

  await staleResult;
  await expect(current).resolves.toEqual(featureResponse(1));
  expect(api.post).toHaveBeenCalledTimes(2);
});

test('release rejects queued work before it can issue an API request', async () => {
  const first = deferred();
  const api = { get: vi.fn(), post: vi.fn().mockImplementationOnce(() => first.promise) };
  const manager = createEmbeddedExecutionManager(api, { maxConcurrent: 1, maxLayers: 2, maxFeatures: 2 });
  const active = manager.client('W-1').post('/v1/geospatial/layers/execute', {
    layer: { id: 'L-1' }, runtime: {},
  });
  await vi.waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
  const queued = manager.client('W-2').post('/v1/geospatial/layers/execute', {
    layer: { id: 'L-2' }, runtime: {},
  });
  const queuedResult = expect(queued).rejects.toMatchObject({ code: 'EMBEDDED_MAP_EXECUTION_CANCELLED' });
  manager.release('W-2');

  await queuedResult;
  expect(api.post).toHaveBeenCalledTimes(1);
  first.resolve(featureResponse(0));
  await active;
});

test('late large same-layer result cannot overwrite the accepted newer small result', async () => {
  const older = deferred();
  const newer = deferred();
  const api = { get: vi.fn(), post: vi.fn((_path, body) => {
    if (body.runtime.request === 'older') return older.promise;
    if (body.runtime.request === 'newer') return newer.promise;
    return Promise.resolve(featureResponse(8_999));
  }) };
  const manager = createEmbeddedExecutionManager(api, { maxConcurrent: 2, maxLayers: 2, maxFeatures: 9_000 });
  const client = manager.client('W-1');
  const oldRequest = client.post('/v1/geospatial/layers/execute', {
    layer: { id: 'L-1' }, runtime: { request: 'older' },
  });
  const oldResult = expect(oldRequest).rejects.toMatchObject({ code: 'EMBEDDED_MAP_EXECUTION_CANCELLED' });
  const newRequest = client.post('/v1/geospatial/layers/execute', {
    layer: { id: 'L-1' }, runtime: { request: 'newer' },
  });
  newer.resolve(featureResponse(1));
  await expect(newRequest).resolves.toEqual(featureResponse(1));
  older.resolve(featureResponse(9_000));
  await oldResult;
  await expect(manager.client('W-2').post('/v1/geospatial/layers/execute', {
    layer: { id: 'L-2' }, runtime: {},
  })).resolves.toEqual(featureResponse(8_999));
});

test('early small same-layer result cannot bypass the accepted newer large budget', async () => {
  const older = deferred();
  const newer = deferred();
  const api = { get: vi.fn(), post: vi.fn((_path, body) => {
    if (body.runtime.request === 'older') return older.promise;
    if (body.runtime.request === 'newer') return newer.promise;
    return Promise.resolve(featureResponse(1));
  }) };
  const manager = createEmbeddedExecutionManager(api, { maxConcurrent: 2, maxLayers: 2, maxFeatures: 9_000 });
  const client = manager.client('W-1');
  const oldRequest = client.post('/v1/geospatial/layers/execute', {
    layer: { id: 'L-1' }, runtime: { request: 'older' },
  });
  const oldResult = expect(oldRequest).rejects.toMatchObject({ code: 'EMBEDDED_MAP_EXECUTION_CANCELLED' });
  const newRequest = client.post('/v1/geospatial/layers/execute', {
    layer: { id: 'L-1' }, runtime: { request: 'newer' },
  });
  older.resolve(featureResponse(1));
  await oldResult;
  newer.resolve(featureResponse(9_000));
  await expect(newRequest).resolves.toEqual(featureResponse(9_000));
  await expect(manager.client('W-2').post('/v1/geospatial/layers/execute', {
    layer: { id: 'L-2' }, runtime: {},
  })).rejects.toMatchObject({ code: 'EMBEDDED_MAP_BUDGET_EXCEEDED' });
});

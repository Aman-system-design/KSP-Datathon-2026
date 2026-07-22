import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { LAYER_STATES, useGeospatialWorkspace } from './useGeospatialWorkspace.js';

const dataset = (overrides = {}) => ({
  id: 'hotspots', name: 'Crime hotspots', spatialStatus: 'AVAILABLE', geometryType: 'POINT',
  fields: { id: { type: 'string', uses: ['display', 'label'] } },
  labelFields: ['id'], access: { actions: ['READ_HOTSPOT'] }, ...overrides,
});

const execution = (runGroupId, featureId = 'HOT-1') => ({
  data: {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature', id: featureId,
      geometry: { type: 'Point', coordinates: [77.59, 12.97] },
      properties: { id: featureId, magnitude: 4 },
    }],
  },
  meta: {
    requestId: `REQ-${runGroupId}`, runGroupId, generatedAt: '2026-07-22T10:00:00.000Z',
    observationWindow: { from: '2026-07-01T00:00:00.000Z', to: '2026-07-22T00:00:00.000Z' },
    recordMethodVersion: 'DBSCAN-1', limitations: ['REQUIRES_HUMAN_REVIEW'],
  },
});

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function apiHarness({ datasets = [dataset()], views = [] } = {}) {
  const executions = [];
  const api = {
    get: vi.fn(path => {
      if (path === '/v1/geospatial/datasets') return Promise.resolve({ data: { items: datasets } });
      if (path === '/v1/geospatial/views') return Promise.resolve({ data: { items: views } });
      if (path === '/v1/geospatial/freshness') return Promise.resolve({ data: { layers: [] } });
      throw new Error(`unexpected GET ${path}`);
    }),
    post: vi.fn((path, body) => {
      if (path !== '/v1/geospatial/layers/execute') throw new Error(`unexpected POST ${path}`);
      const request = deferred();
      executions.push({ body, ...request });
      return request.promise;
    }),
  };
  return { api, executions };
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('useGeospatialWorkspace', () => {
  test('loads governed datasets and saved views, then executes only a visible spatial layer', async () => {
    const unavailable = dataset({ id: 'alerts', name: 'Alerts', spatialStatus: 'GEOMETRY_NOT_AVAILABLE' });
    const view = { id: 'MAP-1', name: 'Operations', definition: { layers: [] } };
    const { api, executions } = apiHarness({ datasets: [dataset(), unavailable], views: [view] });
    const { result } = renderHook(() => useGeospatialWorkspace({ api }));

    await waitFor(() => expect(result.current.catalogStatus).toBe('READY'));
    expect(result.current.datasets.map(item => item.id)).toEqual(['hotspots', 'alerts']);
    expect(result.current.savedViews).toEqual([view]);

    act(() => result.current.addDataset('alerts'));
    expect(result.current.layers[0].state).toBe('GEOMETRY_NOT_AVAILABLE');
    expect(executions).toHaveLength(0);

    act(() => result.current.addDataset('hotspots'));
    await waitFor(() => expect(executions).toHaveLength(1));
    expect(executions[0].body.layer).toMatchObject({ datasetId: 'hotspots', visible: true });
    await act(async () => { executions[0].resolve(execution('RUN-1')); await Promise.resolve(); });
    await waitFor(() => expect(result.current.layers.find(layer => layer.datasetId === 'hotspots')?.state).toBe('READY'));

    act(() => result.current.setLayerVisibility(result.current.layers.find(layer => layer.datasetId === 'hotspots').id, false));
    expect(result.current.renderLayers).toHaveLength(0);
  });

  test('ignores an older viewport response and commits only the latest generation', async () => {
    const { api, executions } = apiHarness();
    const { result } = renderHook(() => useGeospatialWorkspace({ api }));
    await waitFor(() => expect(result.current.catalogStatus).toBe('READY'));
    act(() => result.current.addDataset('hotspots'));
    await waitFor(() => expect(executions).toHaveLength(1));

    act(() => result.current.setViewport({ bounds: [77, 12, 78, 13], zoom: 8 }));
    await waitFor(() => expect(executions).toHaveLength(2));
    await act(async () => { executions[1].resolve(execution('RUN-NEW', 'HOT-NEW')); await Promise.resolve(); });
    await waitFor(() => expect(result.current.visibleFeatures[0]?.id).toBe('HOT-NEW'));
    await act(async () => { executions[0].resolve(execution('RUN-OLD', 'HOT-OLD')); await Promise.resolve(); });
    await act(async () => Promise.resolve());

    expect(result.current.visibleFeatures[0]?.id).toBe('HOT-NEW');
    expect(result.current.layers[0].meta.runGroupId).toBe('RUN-NEW');
  });

  test('retains last verified features and marks the layer stale after a transient refresh failure', async () => {
    const { api, executions } = apiHarness();
    const { result } = renderHook(() => useGeospatialWorkspace({ api }));
    await waitFor(() => expect(result.current.catalogStatus).toBe('READY'));
    act(() => result.current.addDataset('hotspots'));
    await waitFor(() => expect(executions).toHaveLength(1));
    await act(async () => { executions[0].resolve(execution('RUN-1')); await Promise.resolve(); });
    await waitFor(() => expect(result.current.layers[0].state).toBe('READY'));

    await act(async () => { void result.current.retryLayer(result.current.layers[0].id); await Promise.resolve(); });
    await waitFor(() => expect(executions).toHaveLength(2));
    await act(async () => {
      executions[1].reject(Object.assign(new Error('temporary outage'), { code: 'UPSTREAM_ERROR' }));
      await executions[1].promise.catch(() => undefined);
      await Promise.resolve();
    });
    await waitFor(() => expect(result.current.layers[0].state).toBe('STALE'));

    expect(result.current.visibleFeatures[0].id).toBe('HOT-1');
    expect(result.current.layers[0].error).toMatch(/temporary outage/i);

    act(() => result.current.reportLayerError(new Error('renderer rejected feature'), { id: result.current.layers[0].id }));
    expect(result.current.layers[0].state).toBe('STALE');
    expect(result.current.layers[0].error).toMatch(/renderer rejected/i);
  });

  test('holds a new run while evidence is open and replaces it only after explicit acceptance', async () => {
    const { api, executions } = apiHarness();
    const { result } = renderHook(() => useGeospatialWorkspace({ api }));
    await waitFor(() => expect(result.current.catalogStatus).toBe('READY'));
    act(() => result.current.addDataset('hotspots'));
    await waitFor(() => expect(executions).toHaveLength(1));
    await act(async () => { executions[0].resolve(execution('RUN-1', 'HOT-1')); await Promise.resolve(); });
    await waitFor(() => expect(result.current.layers[0].state).toBe('READY'));
    act(() => result.current.selectFeature({ layerId: result.current.layers[0].id, id: 'HOT-1', properties: { id: 'HOT-1' } }));

    await act(async () => { void result.current.retryLayer(result.current.layers[0].id); await Promise.resolve(); });
    await waitFor(() => expect(executions).toHaveLength(2));
    await act(async () => { executions[1].resolve(execution('RUN-2', 'HOT-2')); await Promise.resolve(); });
    await waitFor(() => expect(result.current.layers[0].pendingUpdate?.meta.runGroupId).toBe('RUN-2'));
    expect(result.current.visibleFeatures[0].id).toBe('HOT-1');
    expect(result.current.layers[0].meta.runGroupId).toBe('RUN-1');

    act(() => result.current.acceptLayerUpdate(result.current.layers[0].id));
    expect(result.current.layers[0].pendingUpdate).toBeNull();
    expect(result.current.layers[0].meta.runGroupId).toBe('RUN-2');
    expect(result.current.visibleFeatures[0].id).toBe('HOT-2');
    expect(result.current.selectedFeature).toBeNull();
  });

  test('polls freshness no faster than once per minute only while the document is visible', async () => {
    vi.useFakeTimers();
    const { api } = apiHarness();
    let visibility = 'visible';
    vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibility);
    renderHook(() => useGeospatialWorkspace({ api, pollIntervalMs: 60_000 }));
    await act(async () => Promise.resolve());

    expect(api.get).not.toHaveBeenCalledWith('/v1/geospatial/freshness');
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
    expect(api.get).toHaveBeenCalledWith('/v1/geospatial/freshness');
    const visibleCalls = api.get.mock.calls.filter(([path]) => path === '/v1/geospatial/freshness').length;

    visibility = 'hidden';
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    await act(async () => { await vi.advanceTimersByTimeAsync(120_000); });
    expect(api.get.mock.calls.filter(([path]) => path === '/v1/geospatial/freshness')).toHaveLength(visibleCalls);
  });

  test('exports the complete explicit layer state vocabulary', () => {
    expect(LAYER_STATES).toEqual([
      'IDLE', 'LOADING', 'READY', 'EMPTY', 'STALE',
      'UNAUTHORIZED', 'GEOMETRY_NOT_AVAILABLE', 'FAILED',
    ]);
  });
});

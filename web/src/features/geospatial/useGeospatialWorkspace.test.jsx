import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { LAYER_STATES, useGeospatialWorkspace } from './useGeospatialWorkspace.js';

const dataset = (overrides = {}) => ({
  id: 'hotspots', name: 'Crime hotspots', spatialStatus: 'AVAILABLE', geometryType: 'POINT',
  fields: { id: { type: 'string', uses: ['display', 'label'] } },
  labelFields: ['id'], access: { actions: ['READ_HOTSPOT'] }, ...overrides,
});

const execution = (runGroupId, featureId = 'HOT-1', properties = { id: featureId, magnitude: 4 }) => ({
  data: {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature', id: featureId,
      geometry: { type: 'Point', coordinates: [77.59, 12.97] },
      properties,
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

function apiHarness({
  datasets = [dataset()], views = [], viewLoader = () => Promise.resolve({ data: { items: views } }),
} = {}) {
  const executions = [];
  const api = {
    get: vi.fn(path => {
      if (path === '/v1/geospatial/datasets') return Promise.resolve({ data: { items: datasets } });
      if (path === '/v1/geospatial/views') return viewLoader();
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
  test('uses a neutral viewport unless organization configuration supplies one', async () => {
    const first = apiHarness();
    const neutral = renderHook(() => useGeospatialWorkspace({ api: first.api }));
    expect(neutral.result.current.viewport).toEqual({ center: [0, 0], zoom: 1.3 });
    neutral.unmount();

    const configured = apiHarness();
    const custom = renderHook(() => useGeospatialWorkspace({
      api: configured.api, initialViewport: { center: [10, 20], zoom: 5 },
    }));
    expect(custom.result.current.viewport).toEqual({ center: [10, 20], zoom: 5 });
  });

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

  test('requests only display-authorized fields for default tooltip and evidence projection', async () => {
    const governed = dataset({
      fields: {
        labelOnly: { type: 'string', uses: ['label'] },
        weightOnly: { type: 'number', uses: ['weight'] },
        colorOnly: { type: 'number', uses: ['color'] },
        displayEvidence: { type: 'string', uses: ['display'] },
      },
      labelFields: ['labelOnly'], weightField: 'weightOnly', severityField: 'colorOnly',
    });
    const { api, executions } = apiHarness({ datasets: [governed] });
    const { result } = renderHook(() => useGeospatialWorkspace({ api }));
    await waitFor(() => expect(result.current.catalogStatus).toBe('READY'));
    act(() => result.current.addDataset('hotspots'));
    await waitFor(() => expect(executions).toHaveLength(1));
    expect(executions[0].body.layer.tooltipFields).toEqual(['displayEvidence']);
  });

  test('projects visible table properties through dataset display permissions', async () => {
    const governed = dataset({ fields: {
      displayEvidence: { type: 'string', uses: ['display'] },
      rendererWeight: { type: 'number', uses: ['weight'] },
      rendererColor: { type: 'number', uses: ['color'] },
    } });
    const { api, executions } = apiHarness({ datasets: [governed] });
    const { result } = renderHook(() => useGeospatialWorkspace({ api }));
    await waitFor(() => expect(result.current.catalogStatus).toBe('READY'));
    act(() => result.current.addDataset('hotspots'));
    await waitFor(() => expect(executions).toHaveLength(1));
    await act(async () => {
      executions[0].resolve(execution('RUN-DISPLAY', 'HOT-1', {
        displayEvidence: 'Visible detail', rendererWeight: 19, rendererColor: 0.8,
      }));
      await executions[0].promise;
    });
    expect(result.current.visibleFeatures[0].properties).toMatchObject({ rendererWeight: 19, rendererColor: 0.8 });
    expect(result.current.visibleFeatures[0].displayProperties).toEqual({ displayEvidence: 'Visible detail' });
  });

  test('applies the global time window only to datasets declaring a time field', async () => {
    const timed = dataset({
      id: 'timed', name: 'Timed intelligence', timeField: 'observedAt',
      fields: {
        id: { type: 'string', uses: ['display', 'label'] },
        observedAt: { type: 'datetime', uses: ['time'] },
      },
    });
    const timeless = dataset({ id: 'timeless', name: 'Timeless boundaries' });
    const { api, executions } = apiHarness({ datasets: [timed, timeless] });
    const { result } = renderHook(() => useGeospatialWorkspace({ api }));
    await waitFor(() => expect(result.current.catalogStatus).toBe('READY'));

    act(() => {
      result.current.addDataset('timed');
      result.current.addDataset('timeless');
    });
    await waitFor(() => expect(executions).toHaveLength(2));
    await act(async () => {
      executions[0].resolve(execution('RUN-TIMED'));
      executions[1].resolve(execution('RUN-TIMELESS'));
      await Promise.all(executions.slice(0, 2).map(item => item.promise));
    });

    act(() => result.current.setTimeWindow({
      from: '2026-07-01T00:00:00.000Z', to: '2026-07-22T00:00:00.000Z',
    }));
    await waitFor(() => expect(executions).toHaveLength(4));
    const latestByDataset = new Map(executions.slice(2).map(item => [item.body.layer.datasetId, item.body]));
    expect(latestByDataset.get('timed').runtime.timeWindow).toEqual({
      from: '2026-07-01T00:00:00.000Z', to: '2026-07-22T00:00:00.000Z',
    });
    expect(latestByDataset.get('timeless').runtime).not.toHaveProperty('timeWindow');
  });

  test('allocates a unique layer ID after loading arbitrary saved-view IDs', async () => {
    const { api } = apiHarness();
    const { result } = renderHook(() => useGeospatialWorkspace({ api }));
    await waitFor(() => expect(result.current.catalogStatus).toBe('READY'));
    act(() => result.current.loadView({ definition: {
      layers: [{ id: 'hotspots-2', datasetId: 'hotspots', renderer: 'POINT', visible: false, order: 0 }],
    } }));
    act(() => result.current.addDataset('hotspots'));
    expect(result.current.layers.map(layer => layer.id)).toEqual(['hotspots-2', 'hotspots-3']);
    expect(new Set(result.current.layers.map(layer => layer.id)).size).toBe(2);
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

  test('ignores an in-flight response from the previous view even when layer IDs are reused', async () => {
    const { api, executions } = apiHarness();
    const { result } = renderHook(() => useGeospatialWorkspace({ api }));
    await waitFor(() => expect(result.current.catalogStatus).toBe('READY'));
    act(() => result.current.addDataset('hotspots'));
    await waitFor(() => expect(executions).toHaveLength(1));
    const reusedId = result.current.layers[0].id;

    act(() => result.current.loadView({ definition: {
      layers: [{ id: reusedId, datasetId: 'hotspots', renderer: 'POINT', visible: true, order: 0 }],
    } }));
    await waitFor(() => expect(executions).toHaveLength(2));
    await act(async () => { executions[1].resolve(execution('RUN-NEW-VIEW', 'NEW')); await executions[1].promise; });
    await act(async () => { executions[0].resolve(execution('RUN-OLD-VIEW', 'OLD')); await executions[0].promise; });
    expect(result.current.layers[0].meta.runGroupId).toBe('RUN-NEW-VIEW');
    expect(result.current.visibleFeatures[0].id).toBe('NEW');
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

  test('purges retained evidence and closes selection when a refresh loses authorization', async () => {
    const { api, executions } = apiHarness();
    const { result } = renderHook(() => useGeospatialWorkspace({ api }));
    await waitFor(() => expect(result.current.catalogStatus).toBe('READY'));
    act(() => result.current.addDataset('hotspots'));
    await waitFor(() => expect(executions).toHaveLength(1));
    await act(async () => { executions[0].resolve(execution('RUN-1')); await executions[0].promise; });
    act(() => result.current.selectFeature({
      layerId: result.current.layers[0].id, id: 'HOT-1', properties: { id: 'HOT-1' },
    }));

    act(() => { void result.current.retryLayer(result.current.layers[0].id); });
    await waitFor(() => expect(executions).toHaveLength(2));
    await act(async () => {
      executions[1].reject(Object.assign(new Error('revoked'), { status: 403 }));
      await executions[1].promise.catch(() => undefined);
    });
    await waitFor(() => expect(result.current.layers[0].state).toBe('UNAUTHORIZED'));
    expect(result.current.layers[0].featureCollection.features).toEqual([]);
    expect(result.current.layers[0].meta).toBeNull();
    expect(result.current.layers[0].pendingUpdate).toBeNull();
    expect(result.current.visibleFeatures).toEqual([]);
    expect(result.current.selectedFeature).toBeNull();
  });

  test('keeps old stale evidence labelled stale while a newer run awaits acceptance', async () => {
    const { api, executions } = apiHarness();
    const { result } = renderHook(() => useGeospatialWorkspace({ api }));
    await waitFor(() => expect(result.current.catalogStatus).toBe('READY'));
    act(() => result.current.addDataset('hotspots'));
    await waitFor(() => expect(executions).toHaveLength(1));
    await act(async () => { executions[0].resolve(execution('RUN-1')); await executions[0].promise; });
    act(() => { void result.current.retryLayer(result.current.layers[0].id); });
    await waitFor(() => expect(executions).toHaveLength(2));
    await act(async () => {
      executions[1].reject(new Error('temporary outage'));
      await executions[1].promise.catch(() => undefined);
    });
    await waitFor(() => expect(result.current.layers[0].state).toBe('STALE'));
    act(() => result.current.selectFeature({
      layerId: result.current.layers[0].id, id: 'HOT-1', properties: { id: 'HOT-1' },
    }));

    act(() => { void result.current.retryLayer(result.current.layers[0].id); });
    await waitFor(() => expect(executions).toHaveLength(3));
    await act(async () => { executions[2].resolve(execution('RUN-2', 'HOT-2')); await executions[2].promise; });
    expect(result.current.layers[0].state).toBe('STALE');
    expect(result.current.layers[0].pendingUpdate.meta.runGroupId).toBe('RUN-2');
    expect(result.current.visibleFeatures[0].id).toBe('HOT-1');
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

  test('keeps datasets usable when saved views fail and recovers views independently', async () => {
    let viewAttempt = 0;
    const view = { id: 'MAP-RECOVERED', name: 'Recovered view', definition: { layers: [] } };
    const viewLoader = vi.fn(() => {
      viewAttempt += 1;
      return viewAttempt === 1
        ? Promise.reject(new Error('saved views unavailable'))
        : Promise.resolve({ data: { items: [view] } });
    });
    const { api, executions } = apiHarness({ viewLoader });
    const { result } = renderHook(() => useGeospatialWorkspace({ api }));
    await waitFor(() => expect(result.current.catalogStatus).toBe('READY'));
    await waitFor(() => expect(result.current.viewsStatus).toBe('FAILED'));
    expect(result.current.datasets).toHaveLength(1);
    act(() => result.current.addDataset('hotspots'));
    await waitFor(() => expect(executions).toHaveLength(1));

    await act(async () => { await result.current.retryViews(); });
    expect(result.current.viewsStatus).toBe('READY');
    expect(result.current.viewsError).toBeNull();
    expect(result.current.savedViews).toEqual([view]);
  });

  test('exports the complete explicit layer state vocabulary', () => {
    expect(LAYER_STATES).toEqual([
      'IDLE', 'LOADING', 'READY', 'EMPTY', 'STALE',
      'UNAUTHORIZED', 'GEOMETRY_NOT_AVAILABLE', 'FAILED',
    ]);
  });
});

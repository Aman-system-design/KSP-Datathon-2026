import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export const LAYER_STATES = Object.freeze([
  'IDLE', 'LOADING', 'READY', 'EMPTY', 'STALE',
  'UNAUTHORIZED', 'GEOMETRY_NOT_AVAILABLE', 'FAILED',
]);

const EMPTY_COLLECTION = Object.freeze({ type: 'FeatureCollection', features: Object.freeze([]) });
const UNAUTHORIZED_CODES = new Set(['FORBIDDEN_ACTION', 'UNAUTHENTICATED', 'UNAUTHORIZED']);
const defaultIdFactory = () => `MAP-${crypto.randomUUID()}`;
const NEUTRAL_VIEWPORT = Object.freeze({ center: Object.freeze([0, 0]), zoom: 1.3 });
const MAX_DISPLAY_FIELDS = 100;

function messageOf(error) {
  return typeof error?.message === 'string' && error.message ? error.message : 'The layer could not be refreshed.';
}

function rendererFor(dataset) {
  if (dataset.geometryType === 'H3') return 'H3';
  if (['POLYGON', 'MULTI_POLYGON', 'ADMIN_BOUNDARY'].includes(dataset.geometryType)) return 'CHOROPLETH';
  return 'POINT';
}

function displayFieldsFor(dataset) {
  const declared = Object.entries(dataset.fields ?? {})
    .filter(([, definition]) => Array.isArray(definition?.uses) && definition.uses.includes('display'))
    .map(([field]) => field)
    .sort();
  return [...new Set([
    ...(dataset.labelFields ?? []), dataset.weightField, dataset.severityField, ...declared,
  ].filter(Boolean))].slice(0, MAX_DISPLAY_FIELDS);
}

function layerDefinition(layer) {
  return Object.fromEntries([
    ['id', layer.id], ['datasetId', layer.datasetId], ['renderer', layer.renderer],
    ['visible', layer.visible], ['order', layer.order], ['minZoom', layer.minZoom],
    ['maxZoom', layer.maxZoom], ['filter', layer.filter], ['limit', layer.limit],
    ['weightField', layer.weightField], ['colorField', layer.colorField],
    ['sizeField', layer.sizeField], ['labelField', layer.labelField],
    ['tooltipFields', layer.tooltipFields],
  ].filter(([, value]) => value !== undefined));
}

function nextStateFor(collection) {
  return collection.features.length === 0 ? 'EMPTY' : 'READY';
}

export function useGeospatialWorkspace({
  api, pollIntervalMs = 60_000, idFactory = defaultIdFactory, initialViewport = NEUTRAL_VIEWPORT,
} = {}) {
  if (!api || typeof api.get !== 'function' || typeof api.post !== 'function') {
    throw new TypeError('A geospatial API client is required');
  }
  const [datasets, setDatasets] = useState([]);
  const [savedViews, setSavedViews] = useState([]);
  const [catalogStatus, setCatalogStatus] = useState('LOADING');
  const [catalogError, setCatalogError] = useState(null);
  const [layers, setLayers] = useState([]);
  const initialViewportRef = useRef(structuredClone(initialViewport));
  const [viewport, setViewportState] = useState(() => structuredClone(initialViewportRef.current));
  const [timeWindow, setTimeWindow] = useState(null);
  const [selectedLayerId, setSelectedLayerId] = useState(null);
  const [selectedFeature, setSelectedFeature] = useState(null);
  const [freshnessError, setFreshnessError] = useState(null);
  const [mapError, setMapError] = useState(null);
  const layersRef = useRef(layers);
  const selectedFeatureRef = useRef(selectedFeature);
  const viewportRef = useRef(viewport);
  const timeWindowRef = useRef(timeWindow);
  const generations = useRef(new Map());
  const layerSequence = useRef(0);
  layersRef.current = layers;
  selectedFeatureRef.current = selectedFeature;
  viewportRef.current = viewport;
  timeWindowRef.current = timeWindow;

  useEffect(() => {
    let live = true;
    Promise.all([
      api.get('/v1/geospatial/datasets'),
      api.get('/v1/geospatial/views'),
    ]).then(([datasetResponse, viewResponse]) => {
      if (!live) return;
      setDatasets(Array.isArray(datasetResponse?.data?.items) ? datasetResponse.data.items : []);
      setSavedViews(Array.isArray(viewResponse?.data?.items) ? viewResponse.data.items : []);
      setCatalogStatus('READY');
      setCatalogError(null);
    }).catch(error => {
      if (!live) return;
      setCatalogStatus('FAILED');
      setCatalogError(messageOf(error));
    });
    return () => { live = false; };
  }, [api]);

  const executeLayer = useCallback(async layerId => {
    const current = layersRef.current.find(item => item.id === layerId);
    if (!current || !current.visible || current.spatialStatus !== 'AVAILABLE') return;
    const generation = (generations.current.get(layerId) ?? 0) + 1;
    generations.current.set(layerId, generation);
    setLayers(previous => previous.map(item => item.id === layerId ? {
      ...item, state: 'LOADING', error: null,
    } : item));
    try {
      const response = await api.post('/v1/geospatial/layers/execute', {
        layer: layerDefinition(current),
        runtime: Object.fromEntries([
          ['viewport', viewportRef.current],
          ['timeWindow', current.dataset?.timeField ? timeWindowRef.current : null],
        ].filter(([, value]) => value !== null && value !== undefined)),
      });
      if (generations.current.get(layerId) !== generation) return;
      const featureCollection = response?.data;
      if (featureCollection?.type !== 'FeatureCollection' || !Array.isArray(featureCollection.features)) {
        throw new Error('The geospatial service returned an invalid feature collection.');
      }
      const result = { featureCollection, meta: response?.meta ?? {} };
      setLayers(previous => previous.map(item => {
        if (item.id !== layerId) return item;
        const oldRun = item.meta?.runGroupId;
        const newRun = result.meta?.runGroupId;
        const evidenceOpen = selectedFeatureRef.current?.layerId === layerId;
        if (evidenceOpen && oldRun && newRun && oldRun !== newRun) {
          return { ...item, pendingUpdate: result, state: item.state === 'STALE' ? 'STALE' : nextStateFor(item.featureCollection) };
        }
        return { ...item, ...result, pendingUpdate: null, state: nextStateFor(featureCollection), error: null };
      }));
    } catch (error) {
      if (generations.current.get(layerId) !== generation) return;
      setLayers(previous => previous.map(item => {
        if (item.id !== layerId) return item;
        if (UNAUTHORIZED_CODES.has(error?.code) || error?.status === 401 || error?.status === 403) {
          return { ...item, state: 'UNAUTHORIZED', error: 'You are not authorized to view this layer.' };
        }
        return {
          ...item,
          state: item.featureCollection?.features?.length >= 0 && item.meta ? 'STALE' : 'FAILED',
          error: messageOf(error),
        };
      }));
    }
  }, [api]);

  const executionSignature = useMemo(() => JSON.stringify({
    viewport,
    timeWindow,
    layers: layers.filter(layer => layer.visible && layer.spatialStatus === 'AVAILABLE')
      .map(layer => layerDefinition(layer)),
  }), [layers, timeWindow, viewport]);
  const previousSignature = useRef(null);

  useEffect(() => {
    if (previousSignature.current === executionSignature) return;
    previousSignature.current = executionSignature;
    for (const layer of layersRef.current) {
      if (layer.visible && layer.spatialStatus === 'AVAILABLE') void executeLayer(layer.id);
    }
  }, [executeLayer, executionSignature]);

  const refreshFreshness = useCallback(async () => {
    if (document.visibilityState !== 'visible') return;
    try {
      const response = await api.get('/v1/geospatial/freshness');
      setFreshnessError(null);
      const updates = Array.isArray(response?.data?.layers) ? response.data.layers : [];
      for (const layer of layersRef.current) {
        const update = updates.find(item => item.datasetId === layer.datasetId);
        if (layer.visible && update && update.runGroupId !== layer.meta?.runGroupId) void executeLayer(layer.id);
      }
    } catch (error) {
      setFreshnessError(messageOf(error));
    }
  }, [api, executeLayer]);

  useEffect(() => {
    if (!Number.isFinite(pollIntervalMs) || pollIntervalMs < 60_000) return undefined;
    let timer;
    const start = () => {
      if (timer || document.visibilityState !== 'visible') return;
      timer = setInterval(() => { void refreshFreshness(); }, pollIntervalMs);
    };
    const stop = () => {
      if (timer) clearInterval(timer);
      timer = undefined;
    };
    const onVisibility = () => { stop(); start(); };
    document.addEventListener('visibilitychange', onVisibility);
    start();
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [pollIntervalMs, refreshFreshness]);

  const addDataset = useCallback(datasetId => {
    const dataset = datasets.find(item => item.id === datasetId);
    if (!dataset) return;
    let id;
    do {
      layerSequence.current += 1;
      id = `${dataset.id}-${layerSequence.current}`;
    } while (layersRef.current.some(layer => layer.id === id));
    const available = dataset.spatialStatus === 'AVAILABLE';
    const added = {
      id, datasetId: dataset.id, name: dataset.name, renderer: rendererFor(dataset), visible: true,
      order: layersRef.current.length, tooltipFields: displayFieldsFor(dataset),
      spatialStatus: dataset.spatialStatus, dataset, state: available ? 'IDLE' : 'GEOMETRY_NOT_AVAILABLE',
      featureCollection: EMPTY_COLLECTION, meta: null, pendingUpdate: null, error: null,
    };
    setLayers(previous => [...previous, added]);
    setSelectedLayerId(id);
  }, [datasets]);

  const setLayerVisibility = useCallback((layerId, visible) => {
    if (!visible) generations.current.set(layerId, (generations.current.get(layerId) ?? 0) + 1);
    setLayers(previous => previous.map(layer => layer.id === layerId ? { ...layer, visible } : layer));
  }, []);

  const moveLayer = useCallback((layerId, direction) => {
    setLayers(previous => {
      const ordered = [...previous].sort((a, b) => a.order - b.order);
      const index = ordered.findIndex(layer => layer.id === layerId);
      const target = direction === 'up' ? index - 1 : index + 1;
      if (index < 0 || target < 0 || target >= ordered.length) return previous;
      [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
      return ordered.map((layer, order) => ({ ...layer, order }));
    });
  }, []);

  const updateLayer = useCallback((layerId, changes) => {
    setLayers(previous => previous.map(layer => layer.id === layerId ? { ...layer, ...changes } : layer));
  }, []);

  const removeLayer = useCallback(layerId => {
    generations.current.set(layerId, (generations.current.get(layerId) ?? 0) + 1);
    setLayers(previous => previous.filter(layer => layer.id !== layerId)
      .sort((left, right) => left.order - right.order).map((layer, order) => ({ ...layer, order })));
    setSelectedLayerId(current => current === layerId ? null : current);
    setSelectedFeature(current => current?.layerId === layerId ? null : current);
  }, []);

  const reportLayerError = useCallback((error, layer) => {
    const errorMessage = messageOf(error);
    if (!layer?.id) {
      setMapError(errorMessage);
      return;
    }
    setLayers(previous => previous.map(item => item.id === layer.id ? {
      ...item, state: item.meta ? 'STALE' : 'FAILED', error: errorMessage,
    } : item));
  }, []);

  const acceptLayerUpdate = useCallback(layerId => {
    const pending = layersRef.current.find(layer => layer.id === layerId)?.pendingUpdate;
    const activeSelection = selectedFeatureRef.current;
    if (pending && activeSelection?.layerId === layerId) {
      const replacement = pending.featureCollection.features.find(feature => String(feature.id) === String(activeSelection.id));
      setSelectedFeature(replacement ? {
        layerId, id: replacement.id, properties: replacement.properties ?? {},
      } : null);
    }
    setLayers(previous => previous.map(layer => {
      if (layer.id !== layerId || !layer.pendingUpdate) return layer;
      const pending = layer.pendingUpdate;
      return { ...layer, ...pending, pendingUpdate: null, state: nextStateFor(pending.featureCollection), error: null };
    }));
  }, []);

  const selectFeature = useCallback(selection => setSelectedFeature(selection), []);
  const setViewport = useCallback(value => setViewportState(value), []);

  const loadView = useCallback(view => {
    const definition = view?.definition;
    if (!definition || !Array.isArray(definition.layers)) return;
    const loaded = definition.layers.map((candidate, index) => {
      const dataset = datasets.find(item => item.id === candidate.datasetId);
      const available = dataset?.spatialStatus === 'AVAILABLE';
      return {
        ...candidate, visible: candidate.visible !== false, order: candidate.order ?? index,
        name: dataset?.name ?? candidate.datasetId, dataset, spatialStatus: dataset?.spatialStatus ?? 'UNKNOWN',
        state: available ? 'IDLE' : dataset ? 'GEOMETRY_NOT_AVAILABLE' : 'FAILED',
        featureCollection: EMPTY_COLLECTION, meta: null, pendingUpdate: null,
        error: dataset ? null : 'This view references a dataset that is not available to the current user.',
      };
    });
    generations.current.clear();
    layerSequence.current = loaded.length;
    setLayers(loaded);
    setViewportState(structuredClone(definition.viewport ?? initialViewportRef.current));
    setTimeWindow(definition.timeWindow ?? null);
    setSelectedLayerId(loaded[0]?.id ?? null);
    setSelectedFeature(null);
  }, [datasets]);

  const saveView = useCallback(async ({ name, visibility = 'PRIVATE' }) => {
    const trimmed = typeof name === 'string' ? name.trim() : '';
    if (!trimmed) throw new Error('Map view name is required.');
    if (layers.length === 0 || layers.some(layer => layer.spatialStatus !== 'AVAILABLE')) {
      throw new Error('Resolve unavailable layers before saving this map view.');
    }
    const definition = {
      id: idFactory(), name: trimmed, version: 1, visibility,
      viewport,
      ...(timeWindow ? { timeWindow } : {}),
      layers: [...layers].sort((a, b) => a.order - b.order).map((layer, order) => ({
        ...layerDefinition(layer), order,
      })),
    };
    const response = await api.post('/v1/geospatial/views', { name: trimmed, visibility, definition });
    if (response?.data) setSavedViews(previous => [...previous, response.data]);
    return response;
  }, [api, idFactory, layers, timeWindow, viewport]);

  const renderLayers = useMemo(() => layers
    .filter(layer => layer.visible && (
      ['READY', 'EMPTY', 'STALE'].includes(layer.state) || (layer.state === 'LOADING' && layer.meta)
    ))
    .sort((a, b) => a.order - b.order)
    .map(layer => ({ layer: layerDefinition(layer), featureCollection: layer.featureCollection })), [layers]);
  const visibleFeatures = useMemo(() => renderLayers.flatMap(input => input.featureCollection.features
    .map(feature => ({ ...feature, layerId: input.layer.id, layerName: layers.find(layer => layer.id === input.layer.id)?.name }))), [layers, renderLayers]);
  const selectedLayer = layers.find(layer => layer.id === selectedLayerId) ?? null;

  return {
    datasets, savedViews, catalogStatus, catalogError, layers, renderLayers, visibleFeatures,
    viewport, timeWindow, selectedLayerId, selectedLayer, selectedFeature, freshnessError, mapError,
    addDataset, setLayerVisibility, moveLayer, updateLayer, removeLayer, reportLayerError,
    setSelectedLayerId, loadView, saveView,
    selectFeature, setViewport, setTimeWindow, acceptLayerUpdate,
    retryLayer: executeLayer, retryFreshness: refreshFreshness,
  };
}

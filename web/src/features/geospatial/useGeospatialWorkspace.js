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
  const fields = dataset?.fields ?? {};
  const declared = Object.entries(fields)
    .filter(([, definition]) => Array.isArray(definition?.uses) && definition.uses.includes('display'))
    .map(([field]) => field)
    .sort();
  const preferred = [
    ...(dataset?.labelFields ?? []), dataset?.weightField, dataset?.severityField,
  ].filter(field => field && fields[field]?.uses?.includes('display'));
  return [...new Set([...preferred, ...declared])].slice(0, MAX_DISPLAY_FIELDS);
}

function displayPropertiesFor(dataset, properties) {
  const allowed = new Set(displayFieldsFor(dataset));
  return Object.fromEntries(Object.entries(properties ?? {}).filter(([field]) => allowed.has(field)));
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
  loadSavedViews = true, executionDescriptors,
} = {}) {
  if (!api || typeof api.get !== 'function' || typeof api.post !== 'function') {
    throw new TypeError('A geospatial API client is required');
  }
  const [datasets, setDatasets] = useState([]);
  const [savedViews, setSavedViews] = useState([]);
  const [catalogStatus, setCatalogStatus] = useState('LOADING');
  const [catalogError, setCatalogError] = useState(null);
  const [viewsStatus, setViewsStatus] = useState(loadSavedViews ? 'LOADING' : 'IDLE');
  const [viewsError, setViewsError] = useState(null);
  const [layers, setLayers] = useState([]);
  const initialViewportRef = useRef(structuredClone(initialViewport));
  const [viewport, setViewportState] = useState(() => structuredClone(initialViewportRef.current));
  const [timeWindow, setTimeWindow] = useState(null);
  const [selectedLayerId, setSelectedLayerId] = useState(null);
  const [selectedFeature, setSelectedFeature] = useState(null);
  const [freshnessError, setFreshnessError] = useState(null);
  const [mapError, setMapError] = useState(null);
  const [executionEpoch, setExecutionEpoch] = useState(0);
  const layersRef = useRef(layers);
  const selectedFeatureRef = useRef(selectedFeature);
  const viewportRef = useRef(viewport);
  const timeWindowRef = useRef(timeWindow);
  const generations = useRef(new Map());
  const workspaceEpoch = useRef(0);
  const viewsRequestToken = useRef(0);
  const layerSequence = useRef(0);
  const executionDescriptorsRef = useRef(executionDescriptors);
  const freshnessRequest = useRef({ sequence: 0, inFlight: null, generation: undefined });
  layersRef.current = layers;
  selectedFeatureRef.current = selectedFeature;
  viewportRef.current = viewport;
  timeWindowRef.current = timeWindow;
  executionDescriptorsRef.current = executionDescriptors;

  const retryViews = useCallback(async () => {
    const token = viewsRequestToken.current + 1;
    viewsRequestToken.current = token;
    setViewsStatus('LOADING');
    setViewsError(null);
    try {
      const response = await api.get('/v1/geospatial/views');
      if (viewsRequestToken.current !== token) return;
      setSavedViews(Array.isArray(response?.data?.items) ? response.data.items : []);
      setViewsStatus('READY');
    } catch (error) {
      if (viewsRequestToken.current !== token) return;
      setViewsStatus('FAILED');
      setViewsError(messageOf(error));
    }
  }, [api]);

  useEffect(() => {
    let live = true;
    setCatalogStatus('LOADING');
    setCatalogError(null);
    api.get('/v1/geospatial/datasets').then(response => {
      if (!live) return;
      setDatasets(Array.isArray(response?.data?.items) ? response.data.items : []);
      setCatalogStatus('READY');
    }).catch(error => {
      if (!live) return;
      setCatalogStatus('FAILED');
      setCatalogError(messageOf(error));
    });
    if (loadSavedViews) void retryViews();
    return () => {
      live = false;
      viewsRequestToken.current += 1;
    };
  }, [api, loadSavedViews, retryViews]);

  const executeLayer = useCallback(async layerId => {
    const current = layersRef.current.find(item => item.id === layerId);
    if (!current || !current.visible || current.spatialStatus !== 'AVAILABLE') return;
    const generation = (generations.current.get(layerId) ?? 0) + 1;
    const epoch = workspaceEpoch.current;
    generations.current.set(layerId, generation);
    setLayers(previous => previous.map(item => item.id === layerId ? {
      ...item,
      refreshBaseState: item.state === 'LOADING' ? item.refreshBaseState : item.state,
      state: 'LOADING', error: null,
    } : item));
    try {
      const descriptors = executionDescriptorsRef.current;
      const descriptor = Array.isArray(descriptors)
        ? descriptors.find(item => item?.layer?.id === current.id) : null;
      if (Array.isArray(descriptors) && !descriptor) throw new Error('Authorized layer execution descriptor is unavailable.');
      const request = descriptor ? structuredClone(descriptor) : {
        layer: layerDefinition(current),
        runtime: Object.fromEntries([
          ['viewport', viewportRef.current],
          ['timeWindow', current.dataset?.timeField ? timeWindowRef.current : null],
        ].filter(([, value]) => value !== null && value !== undefined)),
      };
      const response = await api.post('/v1/geospatial/layers/execute', request);
      if (workspaceEpoch.current !== epoch || generations.current.get(layerId) !== generation) return;
      const featureCollection = response?.data;
      if (featureCollection?.type !== 'FeatureCollection' || !Array.isArray(featureCollection.features)) {
        throw new Error('The geospatial service returned an invalid feature collection.');
      }
      const result = { featureCollection, meta: response?.meta ?? {} };
      setLayers(previous => previous.map(item => {
        if (item.id !== layerId) return item;
        const { refreshBaseState, ...stableItem } = item;
        const oldRun = item.meta?.runGroupId;
        const newRun = result.meta?.runGroupId;
        const evidenceOpen = selectedFeatureRef.current?.layerId === layerId;
        if (evidenceOpen && oldRun && newRun && oldRun !== newRun) {
          return {
            ...stableItem, pendingUpdate: result,
            state: refreshBaseState === 'STALE' ? 'STALE' : nextStateFor(item.featureCollection),
          };
        }
        return { ...stableItem, ...result, pendingUpdate: null, state: nextStateFor(featureCollection), error: null };
      }));
    } catch (error) {
      if (workspaceEpoch.current !== epoch || generations.current.get(layerId) !== generation) return;
      const unauthorized = UNAUTHORIZED_CODES.has(error?.code) || error?.status === 401 || error?.status === 403;
      if (unauthorized) {
        setSelectedFeature(currentSelection => currentSelection?.layerId === layerId ? null : currentSelection);
      }
      setLayers(previous => previous.map(item => {
        if (item.id !== layerId) return item;
        const { refreshBaseState, ...stableItem } = item;
        if (unauthorized) {
          return {
            ...stableItem, state: 'UNAUTHORIZED', error: 'You are not authorized to view this layer.',
            featureCollection: EMPTY_COLLECTION, meta: null, pendingUpdate: null,
          };
        }
        return {
          ...stableItem,
          state: item.featureCollection?.features?.length >= 0 && item.meta ? 'STALE' : 'FAILED',
          error: messageOf(error),
        };
      }));
    }
  }, [api]);

  const executionSignature = useMemo(() => JSON.stringify({
    executionEpoch,
    viewport,
    timeWindow,
    layers: layers.filter(layer => layer.visible && layer.spatialStatus === 'AVAILABLE')
      .map(layer => layerDefinition(layer)),
  }), [executionEpoch, layers, timeWindow, viewport]);
  const previousSignature = useRef(null);

  useEffect(() => {
    if (previousSignature.current === executionSignature) return;
    previousSignature.current = executionSignature;
    for (const layer of layersRef.current) {
      if (layer.visible && layer.spatialStatus === 'AVAILABLE') void executeLayer(layer.id);
    }
  }, [executeLayer, executionSignature]);

  const refreshFreshness = useCallback(async ({ supersede = false } = {}) => {
    if (document.visibilityState !== 'visible') return;
    if (!supersede && freshnessRequest.current.inFlight) return freshnessRequest.current.inFlight;
    const sequence = freshnessRequest.current.sequence + 1;
    freshnessRequest.current.sequence = sequence;
    const known = freshnessRequest.current.generation;
    const path = known === undefined
      ? '/v1/geospatial/freshness'
      : `/v1/geospatial/freshness?knownGeneration=${known}`;
    const operation = (async () => {
      try {
      const response = await api.get(path);
      if (freshnessRequest.current.sequence !== sequence) return;
      const nextGeneration = response?.meta?.publicationGeneration;
      if (Number.isSafeInteger(nextGeneration) && nextGeneration >= 0) {
        freshnessRequest.current.generation = Math.max(known ?? 0, nextGeneration);
      }
      setFreshnessError(null);
      if (response?.meta?.unchanged === true) return;
      const updates = Array.isArray(response?.data?.layers) ? response.data.layers : [];
      setLayers(current => current.map(layer => {
        const update = updates.find(item => item.datasetId === layer.datasetId);
        if (!update) return layer;
        if (update.state === 'REFRESH_FAILED' && layer.featureCollection?.features?.length > 0) {
          return { ...layer, state: 'STALE', freshnessState: update.state };
        }
        if (update.state === 'CURRENT' && layer.freshnessState === 'REFRESH_FAILED') {
          return { ...layer, state: nextStateFor(layer.featureCollection), freshnessState: update.state };
        }
        return { ...layer, freshnessState: update.state };
      }));
      for (const layer of layersRef.current) {
        if (freshnessRequest.current.sequence !== sequence) return;
        const update = updates.find(item => item.datasetId === layer.datasetId);
        const effectiveRunGroupId = layer.pendingUpdate?.meta?.runGroupId ?? layer.meta?.runGroupId;
        if (layer.visible && update && update.runGroupId !== effectiveRunGroupId) void executeLayer(layer.id);
      }
      } catch (error) {
      if (freshnessRequest.current.sequence !== sequence) return;
      setFreshnessError(messageOf(error));
      }
    })();
    freshnessRequest.current.inFlight = operation;
    try { return await operation; } finally {
      if (freshnessRequest.current.inFlight === operation) freshnessRequest.current.inFlight = null;
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
    workspaceEpoch.current += 1;
    setExecutionEpoch(workspaceEpoch.current);
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
  const visibleFeatures = useMemo(() => renderLayers.flatMap(input => {
    const sourceLayer = layers.find(layer => layer.id === input.layer.id);
    return input.featureCollection.features.map(feature => ({
      ...feature, layerId: input.layer.id, layerName: sourceLayer?.name,
      displayProperties: displayPropertiesFor(sourceLayer?.dataset, feature.properties),
    }));
  }), [layers, renderLayers]);
  const selectedLayer = layers.find(layer => layer.id === selectedLayerId) ?? null;

  return {
    datasets, savedViews, catalogStatus, catalogError, viewsStatus, viewsError,
    layers, renderLayers, visibleFeatures,
    viewport, timeWindow, selectedLayerId, selectedLayer, selectedFeature, freshnessError, mapError,
    addDataset, setLayerVisibility, moveLayer, updateLayer, removeLayer, reportLayerError,
    setSelectedLayerId, loadView, saveView,
    selectFeature, setViewport, setTimeWindow, acceptLayerUpdate,
    retryLayer: executeLayer, retryFreshness: () => refreshFreshness({ supersede: true }), retryViews,
  };
}

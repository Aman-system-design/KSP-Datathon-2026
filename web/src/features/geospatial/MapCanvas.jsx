import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import { MapboxOverlay } from '@deck.gl/mapbox';
import { Protocol } from 'pmtiles';
import 'maplibre-gl/dist/maplibre-gl.css';
import { createDeckLayers } from './layer-adapters.js';
import { OPENFREEMAP_ATTRIBUTION, OPENFREEMAP_STYLE_URL } from './map-style.js';

const DEFAULT_CENTER = [0, 0];
const CAMERA_TOLERANCE = 1e-7;
const PMTILES_STATE_KEY = Symbol.for('ksp.geospatial.pmtiles-protocol');

function registerPmtilesProtocol() {
  const state = globalThis[PMTILES_STATE_KEY] ??= { protocol: null, registered: false };
  if (state.registered) return;
  state.protocol ??= new Protocol();
  maplibregl.addProtocol('pmtiles', state.protocol.tile);
  state.registered = true;
}

function normalizedViewport(viewport) {
  if (viewport === undefined || viewport === null) return null;
  const normalized = {};
  if (viewport.center !== undefined) {
    if (!Array.isArray(viewport.center) || viewport.center.length !== 2
      || !viewport.center.every(Number.isFinite)
      || viewport.center[0] < -180 || viewport.center[0] > 180
      || viewport.center[1] < -90 || viewport.center[1] > 90) {
      throw new Error('viewport center must be finite [longitude, latitude] values');
    }
    normalized.center = [...viewport.center];
  }
  if (viewport.zoom !== undefined) {
    if (!Number.isFinite(viewport.zoom) || viewport.zoom < 0 || viewport.zoom > 24) {
      throw new Error('viewport zoom must be finite and between 0 and 24');
    }
    normalized.zoom = viewport.zoom;
  }
  if (viewport.bounds !== undefined) {
    if (!Array.isArray(viewport.bounds) || viewport.bounds.length !== 4
      || !viewport.bounds.every(Number.isFinite)
      || viewport.bounds[0] < -180 || viewport.bounds[2] > 180
      || viewport.bounds[1] < -90 || viewport.bounds[3] > 90
      || viewport.bounds[0] >= viewport.bounds[2] || viewport.bounds[1] >= viewport.bounds[3]) {
      throw new Error('viewport bounds must be finite ordered west, south, east, north values');
    }
    normalized.bounds = [...viewport.bounds];
  }
  if (Object.keys(normalized).length === 0) throw new Error('viewport must define center, zoom, or bounds');
  return normalized;
}

function valuesMatch(left, right) {
  return Number.isFinite(left) && Number.isFinite(right) && Math.abs(left - right) <= CAMERA_TOLERANCE;
}

function currentCamera(map) {
  const center = map.getCenter();
  const zoom = map.getZoom();
  const camera = { center: [center?.lng, center?.lat], zoom };
  if (typeof map.getBounds === 'function') {
    const bounds = map.getBounds();
    const values = [bounds?.getWest?.(), bounds?.getSouth?.(), bounds?.getEast?.(), bounds?.getNorth?.()];
    if (values.every(Number.isFinite)) camera.bounds = values;
  }
  return camera;
}

function cameraMatches(camera, viewport) {
  if (viewport.bounds) {
    return Array.isArray(camera.bounds) && camera.bounds.every((value, index) => valuesMatch(value, viewport.bounds[index]));
  }
  return (!viewport.center || viewport.center.every((value, index) => valuesMatch(value, camera.center[index])))
    && (viewport.zoom === undefined || valuesMatch(viewport.zoom, camera.zoom));
}

function boundsSignature(bounds) {
  return bounds.map(value => Math.round(value / CAMERA_TOLERANCE)).join(':');
}

export function MapCanvas({
  layers = [],
  viewport,
  onViewportChange,
  onFeatureSelect,
  onLayerError,
}) {
  const [rendererLoading, setRendererLoading] = useState(false);
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const overlayRef = useRef(null);
  const layersRef = useRef(layers);
  const lastRequestedBoundsRef = useRef(null);
  const viewportCallbackRef = useRef(onViewportChange);
  const featureCallbackRef = useRef(onFeatureSelect);
  const errorCallbackRef = useRef(onLayerError);
  const overlayGenerationRef = useRef(0);
  const initialViewportRef = useRef(viewport);
  viewportCallbackRef.current = onViewportChange;
  featureCallbackRef.current = onFeatureSelect;
  errorCallbackRef.current = onLayerError;
  layersRef.current = layers;

  const updateOverlay = (map, overlay) => {
    const generation = overlayGenerationRef.current + 1;
    overlayGenerationRef.current = generation;
    const camera = currentCamera(map);
    if (!camera.bounds) return;
    const builtLayers = layersRef.current.map(input => {
      try {
        const result = createDeckLayers({
          ...input,
          viewport: camera,
          onFeatureSelect: selection => featureCallbackRef.current?.(selection),
        });
        return typeof result?.then === 'function' ? result.catch(error => {
          errorCallbackRef.current?.(error, input.layer);
          return [];
        }) : result;
      } catch (error) {
        errorCallbackRef.current?.(error, input.layer);
        return [];
      }
    });
    const apply = groups => {
      if (overlayGenerationRef.current !== generation || overlayRef.current !== overlay) return;
      try { overlay.setProps({ layers: groups.flat() }); } catch (error) { errorCallbackRef.current?.(error); }
    };
    if (builtLayers.some(group => typeof group?.then === 'function')) {
      setRendererLoading(true);
      Promise.all(builtLayers).then(apply).finally(() => {
        if (overlayGenerationRef.current === generation && overlayRef.current === overlay) setRendererLoading(false);
      });
    } else {
      setRendererLoading(false);
      apply(builtLayers);
    }
  };

  useEffect(() => {
    registerPmtilesProtocol();
    let initialViewport;
    try {
      initialViewport = normalizedViewport(initialViewportRef.current);
    } catch (error) {
      errorCallbackRef.current?.(error);
    }
    const options = {
      container: containerRef.current,
      style: OPENFREEMAP_STYLE_URL,
      center: initialViewport?.center ?? DEFAULT_CENTER,
      zoom: initialViewport?.zoom ?? 1.3,
      attributionControl: { compact: false, customAttribution: OPENFREEMAP_ATTRIBUTION },
    };
    if (initialViewport?.bounds) {
      const [west, south, east, north] = initialViewport.bounds;
      options.bounds = [[west, south], [east, north]];
      lastRequestedBoundsRef.current = boundsSignature(initialViewport.bounds);
    }
    const map = new maplibregl.Map(options);
    const overlay = new MapboxOverlay({
      interleaved: true,
      layers: [],
      onError: error => errorCallbackRef.current?.(error),
    });
    const handleMove = () => {
      const camera = currentCamera(map);
      if (!camera.center.every(Number.isFinite) || !Number.isFinite(camera.zoom)) {
        errorCallbackRef.current?.(new Error('map returned an invalid viewport'));
        return;
      }
      viewportCallbackRef.current?.(camera);
      updateOverlay(map, overlay);
    };
    const handleLoad = () => updateOverlay(map, overlay);
    const handleError = event => errorCallbackRef.current?.(event?.error ?? event);
    map.on('moveend', handleMove);
    map.on('error', handleError);
    map.on('load', handleLoad);
    map.addControl(new maplibregl.NavigationControl({ showCompass: true, showZoom: true, visualizePitch: true }), 'top-right');
    map.addControl(overlay);
    mapRef.current = map;
    overlayRef.current = overlay;
    updateOverlay(map, overlay);

    return () => {
      overlayGenerationRef.current += 1;
      map.off('moveend', handleMove);
      map.off('error', handleError);
      map.off('load', handleLoad);
      map.removeControl(overlay);
      map.remove();
      overlayRef.current = null;
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !viewport) return;
    let nextViewport;
    try {
      nextViewport = normalizedViewport(viewport);
    } catch (error) {
      errorCallbackRef.current?.(error);
      return;
    }
    const camera = currentCamera(map);
    if (nextViewport.bounds) {
      const signature = boundsSignature(nextViewport.bounds);
      if (lastRequestedBoundsRef.current === signature) return;
      lastRequestedBoundsRef.current = signature;
      if (cameraMatches(camera, nextViewport)) return;
      const [west, south, east, north] = nextViewport.bounds;
      map.fitBounds([[west, south], [east, north]]);
      return;
    }
    lastRequestedBoundsRef.current = null;
    if (cameraMatches(camera, nextViewport)) return;
    const next = {};
    if (nextViewport.center && !nextViewport.center.every((value, index) => valuesMatch(value, camera.center[index]))) {
      next.center = nextViewport.center;
    }
    if (nextViewport.zoom !== undefined && !valuesMatch(nextViewport.zoom, camera.zoom)) next.zoom = nextViewport.zoom;
    if (Object.keys(next).length > 0) map.jumpTo(next);
  }, [viewport]);

  useEffect(() => {
    if (mapRef.current && overlayRef.current) updateOverlay(mapRef.current, overlayRef.current);
  }, [layers]);

  return <div className="geospatial-map-frame">
    <div className="geospatial-map" ref={containerRef} role="region" aria-label="Geospatial intelligence map" />
    {rendererLoading ? <span className="geospatial-renderer-loading" role="status">Loading selected map renderer…</span> : null}
    <small className="geospatial-map-attribution">
      Basemap by <a href="https://openfreemap.org/">OpenFreeMap</a> ·
      {' '}<a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>
    </small>
  </div>;
}

import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import { MapboxOverlay } from '@deck.gl/mapbox';
import { Protocol } from 'pmtiles';
import 'maplibre-gl/dist/maplibre-gl.css';
import { createDeckLayers } from './layer-adapters.js';
import { OPENFREEMAP_ATTRIBUTION, OPENFREEMAP_STYLE_URL } from './map-style.js';

const DEFAULT_CENTER = [77.5946, 12.9716];
let pmtilesProtocol;
let pmtilesRegistered = false;

function registerPmtilesProtocol() {
  if (pmtilesRegistered) return;
  pmtilesProtocol ??= new Protocol();
  maplibregl.addProtocol('pmtiles', pmtilesProtocol.tile);
  pmtilesRegistered = true;
}

export function MapCanvas({
  layers = [],
  viewport,
  onViewportChange,
  onFeatureSelect,
  onLayerError,
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const overlayRef = useRef(null);
  const viewportCallbackRef = useRef(onViewportChange);
  const featureCallbackRef = useRef(onFeatureSelect);
  const errorCallbackRef = useRef(onLayerError);
  const initialViewportRef = useRef(viewport);
  viewportCallbackRef.current = onViewportChange;
  featureCallbackRef.current = onFeatureSelect;
  errorCallbackRef.current = onLayerError;

  useEffect(() => {
    registerPmtilesProtocol();
    const initialViewport = initialViewportRef.current;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: OPENFREEMAP_STYLE_URL,
      center: initialViewport?.center ?? DEFAULT_CENTER,
      zoom: initialViewport?.zoom ?? 6,
      attributionControl: { compact: false, customAttribution: OPENFREEMAP_ATTRIBUTION },
    });
    const overlay = new MapboxOverlay({
      interleaved: true,
      layers: [],
      onError: error => errorCallbackRef.current?.(error),
    });
    const handleMove = () => {
      const center = map.getCenter();
      viewportCallbackRef.current?.({ center: [center.lng, center.lat], zoom: map.getZoom() });
    };
    const handleError = event => errorCallbackRef.current?.(event?.error ?? event);
    map.on('moveend', handleMove);
    map.on('error', handleError);
    map.addControl(overlay);
    mapRef.current = map;
    overlayRef.current = overlay;

    return () => {
      map.off('moveend', handleMove);
      map.off('error', handleError);
      map.removeControl(overlay);
      map.remove();
      overlayRef.current = null;
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!overlayRef.current) return;
    const deckLayers = layers.flatMap(input => {
      try {
        return createDeckLayers({
          ...input,
          viewport,
          onFeatureSelect: selection => featureCallbackRef.current?.(selection),
        });
      } catch (error) {
        errorCallbackRef.current?.(error, input.layer);
        return [];
      }
    });
    try {
      overlayRef.current.setProps({ layers: deckLayers });
    } catch (error) {
      errorCallbackRef.current?.(error);
    }
  }, [layers, viewport]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !viewport) return;
    if (viewport.bounds) {
      const [west, south, east, north] = viewport.bounds;
      map.fitBounds([[west, south], [east, north]]);
      return;
    }
    const next = {};
    if (viewport.center) next.center = viewport.center;
    if (Number.isFinite(viewport.zoom)) next.zoom = viewport.zoom;
    if (Object.keys(next).length > 0) map.jumpTo(next);
  }, [viewport]);

  return <div className="geospatial-map-frame">
    <div className="geospatial-map" ref={containerRef} aria-label="Geospatial intelligence map" />
    <small className="geospatial-map-attribution">
      Basemap by <a href="https://openfreemap.org/">OpenFreeMap</a> ·
      {' '}<a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>
    </small>
  </div>;
}

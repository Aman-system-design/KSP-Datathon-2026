import { StrictMode, useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import Supercluster from 'supercluster';

const mocks = vi.hoisted(() => ({
  addProtocol: vi.fn(),
  maps: [],
  overlays: [],
  protocols: [],
  nextBounds: null,
  fitBoundsResult: null,
}));

vi.mock('maplibre-gl', () => {
  class Map {
    constructor(options) {
      this.options = options;
      this.handlers = {};
      this.center = { lng: options.center?.[0] ?? 77.5946, lat: options.center?.[1] ?? 12.9716 };
      this.zoom = options.zoom ?? 6;
      const optionBounds = options.bounds
        ? [options.bounds[0][0], options.bounds[0][1], options.bounds[1][0], options.bounds[1][1]] : null;
      this.bounds = mocks.nextBounds ?? optionBounds
        ?? [this.center.lng - 0.1, this.center.lat - 0.1, this.center.lng + 0.1, this.center.lat + 0.1];
      mocks.nextBounds = null;
      this.on = vi.fn((event, handler) => { this.handlers[event] = handler; });
      this.off = vi.fn((event, handler) => {
        if (this.handlers[event] === handler) delete this.handlers[event];
      });
      this.addControl = vi.fn();
      this.removeControl = vi.fn();
      this.jumpTo = vi.fn(next => {
        if (next.center) this.center = { lng: next.center[0], lat: next.center[1] };
        if (Number.isFinite(next.zoom)) this.zoom = next.zoom;
        this.bounds = [this.center.lng - 0.1, this.center.lat - 0.1, this.center.lng + 0.1, this.center.lat + 0.1];
        this.handlers.moveend?.();
      });
      this.fitBounds = vi.fn(bounds => {
        this.bounds = mocks.fitBoundsResult
          ?? [bounds[0][0], bounds[0][1], bounds[1][0], bounds[1][1]];
        this.center = { lng: (this.bounds[0] + this.bounds[2]) / 2, lat: (this.bounds[1] + this.bounds[3]) / 2 };
        this.handlers.moveend?.();
      });
      this.getCenter = vi.fn(() => this.center);
      this.getZoom = vi.fn(() => this.zoom);
      this.getBounds = vi.fn(() => ({
        getWest: () => this.bounds[0], getSouth: () => this.bounds[1],
        getEast: () => this.bounds[2], getNorth: () => this.bounds[3],
      }));
      this.remove = vi.fn();
      mocks.maps.push(this);
    }
  }
  return { default: { Map, addProtocol: mocks.addProtocol } };
});

vi.mock('@deck.gl/mapbox', () => ({
  MapboxOverlay: class MapboxOverlay {
    constructor(props) {
      this.props = props;
      this.setProps = vi.fn();
      mocks.overlays.push(this);
    }
  },
}));

vi.mock('@deck.gl/layers', () => ({
  ScatterplotLayer: class { constructor(props) { Object.assign(this, props, { kind: 'ScatterplotLayer' }); } },
  TextLayer: class { constructor(props) { Object.assign(this, props, { kind: 'TextLayer' }); } },
  HeatmapLayer: class { constructor(props) { Object.assign(this, props, { kind: 'HeatmapLayer' }); } },
  GeoJsonLayer: class { constructor(props) { Object.assign(this, props, { kind: 'GeoJsonLayer' }); } },
}));

vi.mock('@deck.gl/geo-layers', () => ({
  H3HexagonLayer: class { constructor(props) { Object.assign(this, props, { kind: 'H3HexagonLayer' }); } },
}));

vi.mock('pmtiles', () => ({
  Protocol: class Protocol {
    constructor() {
      this.tile = vi.fn();
      mocks.protocols.push(this);
    }
  },
}));

import { MapCanvas } from './MapCanvas.jsx';
import { OPENFREEMAP_STYLE_URL } from './map-style.js';

const featureCollection = (longitude = 77.5949) => ({
  type: 'FeatureCollection',
  features: [{
    type: 'Feature', id: 'HOT-1',
    geometry: { type: 'Point', coordinates: [longitude, 12.9718] },
    properties: { area: 'Central' },
  }],
});

const layerInput = (id = 'hotspots', longitude) => ({
  layer: { id, renderer: 'POINT' },
  featureCollection: featureCollection(longitude),
});

afterEach(() => {
  cleanup();
  mocks.nextBounds = null;
  mocks.fitBoundsResult = null;
});

test('creates one map and overlay, updates them imperatively, and shows attribution', () => {
  const onViewportChange = vi.fn();
  const { rerender } = render(<MapCanvas
    layers={[layerInput()]}
    viewport={{ center: [77.59, 12.97], zoom: 8 }}
    onViewportChange={onViewportChange}
  />);

  const map = mocks.maps.at(-1);
  const overlay = mocks.overlays.at(-1);
  expect(map.options.style).toBe(OPENFREEMAP_STYLE_URL);
  expect(map.options.attributionControl.customAttribution).toMatch(/OpenFreeMap/);
  expect(map.addControl).toHaveBeenCalledWith(overlay);
  expect(screen.getByRole('region', { name: 'Geospatial intelligence map' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'OpenFreeMap' })).toBeInTheDocument();
  expect(map.jumpTo).not.toHaveBeenCalled();

  rerender(<MapCanvas
    layers={[layerInput()]}
    viewport={{ center: [77.59000005, 12.97000005], zoom: 8.00000005 }}
    onViewportChange={onViewportChange}
  />);
  expect(map.jumpTo).not.toHaveBeenCalled();

  rerender(<MapCanvas
    layers={[layerInput('updated')]}
    viewport={{ center: [77.6, 12.98], zoom: 10 }}
    onViewportChange={onViewportChange}
  />);

  expect(mocks.maps).toHaveLength(1);
  expect(mocks.overlays).toHaveLength(1);
  expect(overlay.setProps.mock.calls.at(-1)[0].layers[0].id).toBe('updated:points');
  expect(map.jumpTo).toHaveBeenLastCalledWith({ center: [77.6, 12.98], zoom: 10 });
  map.handlers.moveend();
  expect(onViewportChange).toHaveBeenCalledWith({
    center: [77.6, 12.98], zoom: 10, bounds: [77.5, 12.88, 77.69999999999999, 13.08],
  });
});

test('uses current callbacks without recreating map subscriptions', () => {
  const first = vi.fn();
  const second = vi.fn();
  const { rerender } = render(<MapCanvas layers={[layerInput()]} onFeatureSelect={first} />);
  const map = mocks.maps.at(-1);
  const overlay = mocks.overlays.at(-1);
  const pointLayer = overlay.setProps.mock.calls.at(-1)[0].layers[0];

  rerender(<MapCanvas layers={[layerInput()]} onFeatureSelect={second} />);
  pointLayer.onClick({ object: featureCollection().features[0] });

  expect(first).not.toHaveBeenCalled();
  expect(second).toHaveBeenCalledWith({ layerId: 'hotspots', id: 'HOT-1', properties: { area: 'Central' } });
  expect(map.on).toHaveBeenCalledTimes(3);
});

test('registers PMTiles once and cleans up controls, listeners, and maps', () => {
  const first = render(<MapCanvas layers={[]} />);
  const firstMap = mocks.maps.at(-1);
  const firstOverlay = mocks.overlays.at(-1);
  first.unmount();

  render(<MapCanvas layers={[]} />);

  expect(mocks.addProtocol).toHaveBeenCalledTimes(1);
  expect(mocks.protocols).toHaveLength(1);
  expect(firstMap.removeControl).toHaveBeenCalledWith(firstOverlay);
  expect(firstMap.off).toHaveBeenCalledTimes(3);
  expect(firstMap.remove).toHaveBeenCalledOnce();
});

test('StrictMode remounts cleanly while retaining one global PMTiles registration', () => {
  const start = mocks.maps.length;
  const view = render(<StrictMode><MapCanvas layers={[]} /></StrictMode>);
  const created = mocks.maps.slice(start);
  expect(created).toHaveLength(2);
  expect(created[0].removeControl).toHaveBeenCalledWith(mocks.overlays.at(-2));
  expect(created[0].remove).toHaveBeenCalledOnce();
  view.unmount();
  expect(created[1].remove).toHaveBeenCalledOnce();
  expect(mocks.addProtocol).toHaveBeenCalledTimes(1);
  expect(mocks.protocols).toHaveLength(1);
});

test('an HMR-fresh module reuses the global PMTiles protocol and handler', async () => {
  const first = render(<MapCanvas layers={[]} />);
  const protocol = mocks.protocols.at(-1);
  const registrationCount = mocks.addProtocol.mock.calls.length;
  const protocolCount = mocks.protocols.length;
  const { MapCanvas: ReloadedMapCanvas } = await import('./MapCanvas.jsx?pmtiles-hmr');
  const view = render(<ReloadedMapCanvas layers={[]} />);
  expect(mocks.addProtocol).toHaveBeenCalledTimes(registrationCount);
  expect(mocks.protocols).toHaveLength(protocolCount);
  expect(mocks.protocols.at(-1)).toBe(protocol);
  first.unmount();
  view.unmount();
});

test('controlled viewport feedback converges without an initial or repeated camera update', () => {
  const layers = [layerInput()];
  function ControlledMap() {
    const [viewport, setViewport] = useState({ center: [77.59, 12.97], zoom: 8 });
    return <>
      <button type="button" onClick={() => setViewport({ center: [77.6, 12.98], zoom: 10 })}>Move map</button>
      <MapCanvas layers={layers} viewport={viewport} onViewportChange={setViewport} />
    </>;
  }
  render(<ControlledMap />);
  const map = mocks.maps.at(-1);
  expect(map.jumpTo).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole('button', { name: 'Move map' }));

  expect(map.jumpTo).toHaveBeenCalledOnce();
  expect(map.fitBounds).not.toHaveBeenCalled();
});

test('CLUSTER queries use actual MapLibre bounds initially and after map movement', () => {
  const getClusters = vi.spyOn(Supercluster.prototype, 'getClusters');
  mocks.nextBounds = [179.5, -1, 180, 1];
  render(<MapCanvas
    layers={[{
      layer: { id: 'edge-cluster', renderer: 'CLUSTER' },
      featureCollection: {
        type: 'FeatureCollection',
        features: [{
          type: 'Feature', id: 'EDGE-1', properties: {},
          geometry: { type: 'Point', coordinates: [179.8, 0] },
        }],
      },
    }]}
    viewport={{ center: [179.8, 0], zoom: 8 }}
  />);
  const map = mocks.maps.at(-1);
  expect(getClusters.mock.calls.at(-1)[0]).toEqual([179.5, -1, 180, 1]);

  map.bounds = [179.7, -0.5, 180, 0.5];
  map.handlers.moveend();
  expect(getClusters.mock.calls.at(-1)[0]).toEqual([179.7, -0.5, 180, 0.5]);
  getClusters.mockRestore();
});

test('semantically unchanged requested bounds do not repeat fitBounds on unrelated rerenders', () => {
  const requested = [77, 12, 78, 13];
  mocks.fitBoundsResult = [76.99, 11.99, 78.01, 13.01];
  const { rerender } = render(<MapCanvas layers={[]} viewport={{ center: [77.5, 12.5], zoom: 8 }} />);
  const map = mocks.maps.at(-1);
  rerender(<MapCanvas layers={[]} viewport={{ bounds: requested }} />);
  rerender(<MapCanvas layers={[layerInput()]} viewport={{ bounds: [...requested] }} />);
  expect(map.fitBounds).toHaveBeenCalledOnce();
});

test('initial requested bounds are applied only by the Map constructor', () => {
  const requested = [77, 12, 78, 13];
  mocks.nextBounds = [76.99, 11.99, 78.01, 13.01];
  render(<MapCanvas layers={[]} viewport={{ bounds: requested }} />);
  const map = mocks.maps.at(-1);
  expect(map.options.bounds).toEqual([[77, 12], [78, 13]]);
  expect(map.fitBounds).not.toHaveBeenCalled();
});

test('invalid controlled viewport reports an error without mutating the camera', () => {
  const onLayerError = vi.fn();
  const { rerender } = render(<MapCanvas
    layers={[]}
    viewport={{ center: [77.59, 12.97], zoom: 8 }}
    onLayerError={onLayerError}
  />);
  const map = mocks.maps.at(-1);
  rerender(<MapCanvas
    layers={[]}
    viewport={{ center: [Number.NaN, 12.97], zoom: 8 }}
    onLayerError={onLayerError}
  />);

  expect(onLayerError).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringMatching(/viewport/) }));
  expect(map.jumpTo).not.toHaveBeenCalled();
  expect(map.fitBounds).not.toHaveBeenCalled();
});

test('reports a bad layer while retaining the basemap and other layers', () => {
  const onLayerError = vi.fn();
  render(<MapCanvas layers={[layerInput('valid'), layerInput('invalid', Number.NaN)]} onLayerError={onLayerError} />);
  const map = mocks.maps.at(-1);
  const overlay = mocks.overlays.at(-1);

  expect(onLayerError).toHaveBeenCalledWith(expect.any(Error), { id: 'invalid', renderer: 'POINT' });
  expect(overlay.setProps.mock.calls.at(-1)[0].layers).toHaveLength(1);
  expect(map.remove).not.toHaveBeenCalled();
});

test('reports a synchronous overlay update failure without removing the basemap', () => {
  const onLayerError = vi.fn();
  const { rerender } = render(<MapCanvas layers={[layerInput()]} onLayerError={onLayerError} />);
  const map = mocks.maps.at(-1);
  const overlay = mocks.overlays.at(-1);
  overlay.setProps.mockImplementationOnce(() => { throw new Error('overlay update failed'); });

  expect(() => rerender(<MapCanvas layers={[layerInput('updated')]} onLayerError={onLayerError} />)).not.toThrow();
  expect(onLayerError).toHaveBeenCalledWith(expect.objectContaining({ message: 'overlay update failed' }));
  expect(map.remove).not.toHaveBeenCalled();
});

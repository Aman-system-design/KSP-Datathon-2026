import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  addProtocol: vi.fn(),
  maps: [],
  overlays: [],
  protocols: [],
}));

vi.mock('maplibre-gl', () => {
  class Map {
    constructor(options) {
      this.options = options;
      this.handlers = {};
      this.on = vi.fn((event, handler) => { this.handlers[event] = handler; });
      this.off = vi.fn((event, handler) => {
        if (this.handlers[event] === handler) delete this.handlers[event];
      });
      this.addControl = vi.fn();
      this.removeControl = vi.fn();
      this.jumpTo = vi.fn();
      this.fitBounds = vi.fn();
      this.getCenter = vi.fn(() => ({ lng: 77.59, lat: 12.97 }));
      this.getZoom = vi.fn(() => 9);
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

afterEach(() => cleanup());

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
  expect(screen.getByRole('link', { name: 'OpenFreeMap' })).toBeInTheDocument();

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
  expect(onViewportChange).toHaveBeenCalledWith({ center: [77.59, 12.97], zoom: 9 });
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
  expect(second).toHaveBeenCalledWith({ id: 'HOT-1', properties: { area: 'Central' } });
  expect(map.on).toHaveBeenCalledTimes(2);
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
  expect(firstMap.off).toHaveBeenCalledTimes(2);
  expect(firstMap.remove).toHaveBeenCalledOnce();
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

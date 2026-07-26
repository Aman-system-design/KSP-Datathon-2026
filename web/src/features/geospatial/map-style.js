export const OPENFREEMAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';
export const OPENFREEMAP_SUBDUED_STYLE_URL = 'https://tiles.openfreemap.org/styles/positron';

export const KARNATAKA_FOCUSED_STYLE = Object.freeze({
  version: 8,
  name: 'Karnataka focused boundary canvas',
  sources: {},
  layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#f3f6fa' } }],
});

export const OPENFREEMAP_ATTRIBUTION = [
  '<a href="https://openfreemap.org/">OpenFreeMap</a>',
  '<a href="https://openmaptiles.org/">OpenMapTiles</a>',
  '<a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',
].join(' · ');

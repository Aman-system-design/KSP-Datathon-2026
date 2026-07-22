import { isValidCell } from 'h3-js';
import Supercluster from 'supercluster';
import { GeoJsonLayer, HeatmapLayer, ScatterplotLayer, TextLayer } from '@deck.gl/layers';
import { H3HexagonLayer } from '@deck.gl/geo-layers';

const WORLD_BOUNDS = [-180, -90, 180, 90];
const POINT_COLOR = [30, 136, 229, 190];
const POLYGON_COLOR = [30, 136, 229, 150];

function featuresOf(featureCollection) {
  if (featureCollection?.type !== 'FeatureCollection' || !Array.isArray(featureCollection.features)) {
    throw new TypeError('featureCollection must be a GeoJSON FeatureCollection');
  }
  return featureCollection.features;
}

function pointPosition(feature) {
  const coordinates = feature?.geometry?.type === 'Point' && feature.geometry.coordinates;
  const [longitude, latitude] = Array.isArray(coordinates) ? coordinates : [];
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180
    || !Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    throw new Error('point feature coordinates must be finite [longitude, latitude] values');
  }
  return [longitude, latitude];
}

function safeSelection(feature) {
  if (!feature) return null;
  const id = feature.id ?? feature.properties?.id;
  return { id, properties: { ...(feature.properties ?? {}) } };
}

function clickHandler(onFeatureSelect) {
  return ({ object } = {}) => {
    const selection = safeSelection(object);
    if (selection && typeof onFeatureSelect === 'function') onFeatureSelect(selection);
  };
}

function weightAccessor(field) {
  if (!field) return () => 1;
  return feature => Number.isFinite(feature?.properties?.[field]) ? feature.properties[field] : 0;
}

function pointSpec(layer, data, onFeatureSelect) {
  return {
    kind: 'ScatterplotLayer',
    id: `${layer.id}:points`,
    data,
    pickable: true,
    getPosition: pointPosition,
    getRadius: layer.sizeField
      ? feature => Number.isFinite(feature?.properties?.[layer.sizeField]) ? feature.properties[layer.sizeField] : 1
      : 6,
    radiusMinPixels: 3,
    getFillColor: POINT_COLOR,
    onClick: clickHandler(onFeatureSelect),
  };
}

function clusterSpecs(layer, data, viewport, onFeatureSelect) {
  const sorted = [...data].sort((left, right) => String(left.id ?? '').localeCompare(String(right.id ?? '')));
  const points = sorted.map(feature => {
    const coordinates = pointPosition(feature);
    return {
      type: 'Feature',
      id: feature.id,
      geometry: { type: 'Point', coordinates },
      properties: { ...(feature.properties ?? {}), __sourceId: feature.id },
    };
  });
  const index = new Supercluster({ radius: 40, maxZoom: 16 }).load(points);
  const zoom = Math.max(0, Math.min(16, Math.floor(Number.isFinite(viewport?.zoom) ? viewport.zoom : 0)));
  const clusters = index.getClusters(WORLD_BOUNDS, zoom).map(feature => {
    if (!feature.properties.cluster) {
      const { __sourceId, ...properties } = feature.properties;
      return { ...feature, id: __sourceId, properties };
    }
    return {
      ...feature,
      id: `${layer.id}:cluster:${feature.properties.cluster_id}`,
      properties: {
        cluster: true,
        pointCount: feature.properties.point_count,
        pointCountAbbreviated: feature.properties.point_count_abbreviated,
      },
    };
  });
  const labels = clusters.filter(feature => feature.properties.cluster);
  const scatter = pointSpec({ ...layer, id: `${layer.id}:cluster` }, clusters, onFeatureSelect);
  scatter.id = `${layer.id}:cluster-points`;
  if (labels.length === 0) return [scatter];
  return [scatter, {
    kind: 'TextLayer',
    id: `${layer.id}:cluster-labels`,
    data: labels,
    getPosition: pointPosition,
    getText: feature => String(feature.properties.pointCountAbbreviated),
    getSize: 12,
    getColor: [255, 255, 255, 255],
  }];
}

function h3Spec(layer, data, onFeatureSelect) {
  const field = layer.h3Field ?? 'h3';
  const getHexagon = feature => feature?.properties?.[field] ?? feature?.id;
  for (const feature of data) {
    if (!isValidCell(getHexagon(feature))) throw new Error(`feature ${feature?.id ?? ''} has an invalid H3 cell`);
  }
  return {
    kind: 'H3HexagonLayer',
    id: `${layer.id}:h3`,
    data,
    pickable: true,
    getHexagon,
    getFillColor: POLYGON_COLOR,
    getElevation: weightAccessor(layer.weightField),
    onClick: clickHandler(onFeatureSelect),
  };
}

function validPosition(position) {
  return Array.isArray(position) && position.length >= 2
    && Number.isFinite(position[0]) && position[0] >= -180 && position[0] <= 180
    && Number.isFinite(position[1]) && position[1] >= -90 && position[1] <= 90;
}

function validPolygonGeometry(geometry) {
  const polygons = geometry?.type === 'Polygon' ? [geometry.coordinates]
    : geometry?.type === 'MultiPolygon' ? geometry.coordinates : null;
  return Array.isArray(polygons) && polygons.length > 0 && polygons.every(polygon =>
    Array.isArray(polygon) && polygon.length > 0 && polygon.every(ring =>
      Array.isArray(ring) && ring.length >= 4 && ring.every(validPosition)
      && ring[0][0] === ring.at(-1)[0] && ring[0][1] === ring.at(-1)[1]));
}

function choroplethSpec(layer, data, onFeatureSelect) {
  for (const feature of data) {
    if (!validPolygonGeometry(feature?.geometry)) throw new Error(`feature ${feature?.id ?? ''} must have valid polygon geometry`);
  }
  return {
    kind: 'GeoJsonLayer',
    id: `${layer.id}:choropleth`,
    data: { type: 'FeatureCollection', features: data },
    pickable: true,
    filled: true,
    stroked: true,
    getFillColor: POLYGON_COLOR,
    getLineColor: [16, 78, 139, 255],
    onClick: clickHandler(onFeatureSelect),
  };
}

export function buildDeckLayerSpecs({ layer, featureCollection, viewport, onFeatureSelect }) {
  if (!layer?.id || !layer.renderer) throw new TypeError('layer id and renderer are required');
  const features = featuresOf(featureCollection);
  if (layer.renderer === 'POINT') {
    features.forEach(pointPosition);
    return [pointSpec(layer, features, onFeatureSelect)];
  }
  if (layer.renderer === 'CLUSTER') return clusterSpecs(layer, features, viewport, onFeatureSelect);
  if (layer.renderer === 'HEATMAP') {
    features.forEach(pointPosition);
    return [{
      kind: 'HeatmapLayer',
      id: `${layer.id}:heatmap`,
      data: features,
      getPosition: pointPosition,
      getWeight: weightAccessor(layer.weightField),
      pickable: true,
      onClick: clickHandler(onFeatureSelect),
    }];
  }
  if (layer.renderer === 'H3') return [h3Spec(layer, features, onFeatureSelect)];
  if (layer.renderer === 'CHOROPLETH') return [choroplethSpec(layer, features, onFeatureSelect)];
  if (layer.renderer === 'PATH' || layer.renderer === 'ARC') {
    throw new Error(`${layer.renderer} renderer is not supported by the reusable canvas`);
  }
  throw new Error(`unknown renderer ${layer.renderer}`);
}

const CONSTRUCTORS = { ScatterplotLayer, TextLayer, HeatmapLayer, H3HexagonLayer, GeoJsonLayer };

export function createDeckLayers(options) {
  return buildDeckLayerSpecs(options).map(({ kind, ...props }) => {
    const Layer = CONSTRUCTORS[kind];
    if (!Layer) throw new Error(`unknown deck.gl layer kind ${kind}`);
    return new Layer(props);
  });
}

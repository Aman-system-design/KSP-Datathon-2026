import { isValidCell } from 'h3-js';
import Supercluster from 'supercluster';
import { GeoJsonLayer, HeatmapLayer, ScatterplotLayer, TextLayer } from '@deck.gl/layers';
import { H3HexagonLayer } from '@deck.gl/geo-layers';

const POINT_COLOR = [30, 136, 229, 190];
const POLYGON_COLOR = [30, 136, 229, 150];
const MINIMUM_BOUNDS_SPAN = 1e-9;
// Cluster inputs are immutable by reference: replace the features array for any structural change.
const clusterIndexes = new WeakMap();

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

function safeSelection(feature, layerId) {
  if (!feature) return null;
  const id = feature.id ?? feature.properties?.id;
  if (id === undefined || id === null) return null;
  const properties = feature.properties && typeof feature.properties === 'object'
    ? structuredClone(feature.properties) : {};
  return { layerId, id, properties };
}

function clickHandler(onFeatureSelect, layerId) {
  return ({ object } = {}) => {
    const selection = safeSelection(object, layerId);
    if (selection && typeof onFeatureSelect === 'function') onFeatureSelect(selection);
  };
}

function weightAccessor(field) {
  if (!field) return () => 1;
  return feature => Number.isFinite(feature?.properties?.[field]) ? feature.properties[field] : 0;
}

function pointSpec(layer, data, onFeatureSelect, selectionLayerId = layer.id) {
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
    onClick: clickHandler(onFeatureSelect, selectionLayerId),
  };
}

function clusterConfiguration(layer) {
  return {
    radius: Number.isFinite(layer.clusterRadius) ? layer.clusterRadius : 40,
    maxZoom: Number.isInteger(layer.clusterMaxZoom) ? layer.clusterMaxZoom : 16,
  };
}

function clusterIndex(data, layer) {
  const configuration = clusterConfiguration(layer);
  const key = `${configuration.radius}:${configuration.maxZoom}`;
  let cache = clusterIndexes.get(data);
  if (!cache) {
    cache = { snapshot: [...data], byConfiguration: new Map() };
    clusterIndexes.set(data, cache);
  } else if (cache.snapshot.length !== data.length
    || cache.snapshot.some((feature, index) => feature !== data[index])) {
    throw new Error('featureCollection.features array is immutable; replace it instead of mutating in place');
  }
  const cached = cache.byConfiguration.get(key);
  if (cached) return cached;
  const sorted = [...data].sort((left, right) => String(left.id ?? '').localeCompare(String(right.id ?? '')));
  const points = sorted.map((feature, index) => {
    const coordinates = pointPosition(feature);
    return {
      type: 'Feature',
      id: feature.id,
      geometry: { type: 'Point', coordinates },
      properties: { __kspLeafIndex: index, __kspFeatureId: feature.id },
    };
  });
  const index = new Supercluster(configuration).load(points);
  const compiled = { index, sorted };
  cache.byConfiguration.set(key, compiled);
  return compiled;
}

function clusterBounds(viewport, data) {
  if (Array.isArray(viewport?.bounds) && viewport.bounds.length === 4
    && viewport.bounds.every(Number.isFinite)
    && viewport.bounds[0] < viewport.bounds[2] && viewport.bounds[1] < viewport.bounds[3]) {
    return [...viewport.bounds];
  }
  const positions = data.map(pointPosition);
  if (positions.length === 0) return [0, 0, MINIMUM_BOUNDS_SPAN, MINIMUM_BOUNDS_SPAN];
  const longitudes = positions.map(position => position[0]);
  const latitudes = positions.map(position => position[1]);
  const west = Math.min(...longitudes);
  const south = Math.min(...latitudes);
  const east = Math.max(...longitudes);
  const north = Math.max(...latitudes);
  return [
    east === west ? Math.max(-180, west - MINIMUM_BOUNDS_SPAN) : west,
    north === south ? Math.max(-90, south - MINIMUM_BOUNDS_SPAN) : south,
    east === west ? Math.min(180, east + MINIMUM_BOUNDS_SPAN) : east,
    north === south ? Math.min(90, north + MINIMUM_BOUNDS_SPAN) : north,
  ];
}

function clusterSpecs(layer, data, viewport, onFeatureSelect) {
  const { index, sorted } = clusterIndex(data, layer);
  const zoom = Math.max(0, Math.min(clusterConfiguration(layer).maxZoom,
    Math.floor(Number.isFinite(viewport?.zoom) ? viewport.zoom : 0)));
  const aggregateFeatures = new WeakSet();
  const clusters = index.getClusters(clusterBounds(viewport, data), zoom).map(feature => {
    const isAggregate = feature.properties.cluster === true && Number.isInteger(feature.properties.cluster_id);
    if (!isAggregate) {
      const source = sorted[feature.properties.__kspLeafIndex];
      if (!source || source.id !== feature.properties.__kspFeatureId) {
        throw new Error('Supercluster returned an unknown leaf feature');
      }
      return { ...feature, id: source.id, properties: { ...(source.properties ?? {}) } };
    }
    const aggregate = {
      ...feature,
      id: `${layer.id}:cluster:${feature.properties.cluster_id}`,
      properties: {
        cluster: true,
        pointCount: feature.properties.point_count,
        pointCountAbbreviated: feature.properties.point_count_abbreviated,
      },
    };
    aggregateFeatures.add(aggregate);
    return aggregate;
  });
  const labels = clusters.filter(feature => aggregateFeatures.has(feature));
  const scatter = pointSpec({ ...layer, id: `${layer.id}:cluster` }, clusters, onFeatureSelect, layer.id);
  scatter.id = `${layer.id}:cluster-points`;
  const selectLeaf = scatter.onClick;
  scatter.onClick = info => {
    if (!aggregateFeatures.has(info?.object)) selectLeaf(info);
  };
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
    onClick: clickHandler(onFeatureSelect, layer.id),
  };
}

function validPosition(position) {
  return Array.isArray(position) && position.length >= 2
    && Number.isFinite(position[0]) && position[0] >= -180 && position[0] <= 180
    && Number.isFinite(position[1]) && position[1] >= -90 && position[1] <= 90;
}

function nonDegenerateRing(ring) {
  let doubledArea = 0;
  for (let index = 0; index < ring.length - 1; index += 1) {
    doubledArea += ring[index][0] * ring[index + 1][1] - ring[index + 1][0] * ring[index][1];
  }
  return Math.abs(doubledArea) > 1e-12;
}

// Full topology (self-intersections and hole relationships) belongs at the import-validation boundary.
function hasStructuralPolygonGeometry(geometry) {
  const polygons = geometry?.type === 'Polygon' ? [geometry.coordinates]
    : geometry?.type === 'MultiPolygon' ? geometry.coordinates : null;
  return Array.isArray(polygons) && polygons.length > 0 && polygons.every(polygon =>
    Array.isArray(polygon) && polygon.length > 0 && polygon.every(ring =>
      Array.isArray(ring) && ring.length >= 4 && ring.every(validPosition)
      && ring[0][0] === ring.at(-1)[0] && ring[0][1] === ring.at(-1)[1]
      && nonDegenerateRing(ring)));
}

function choroplethSpec(layer, data, onFeatureSelect) {
  for (const feature of data) {
    if (!hasStructuralPolygonGeometry(feature?.geometry)) {
      throw new Error(`feature ${feature?.id ?? ''} must have structural polygon geometry`);
    }
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
    onClick: clickHandler(onFeatureSelect, layer.id),
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
      onClick: clickHandler(onFeatureSelect, layer.id),
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

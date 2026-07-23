import { deepFreeze } from '../../../vendor/geospatial-core/index.mjs';

const unavailable = ({ id, name, sourceReference, service, requiredAction, missingRequiredFields }) => ({
  id, name, description: `${name} has no executable geometry in its current authorized read projection.`,
  sourceType: 'SEMANTIC_API', sourceReference, service, requiredAction,
  spatialStatus: 'GEOMETRY_NOT_AVAILABLE', missingRequiredFields,
});

const hotspotDataset = {
  id: 'hotspots', name: 'Crime hotspots', description: 'Authorized hotspot centroids from the current verified intelligence run.',
  sourceType: 'SEMANTIC_API', sourceReference: 'hotspots', service: 'listHotspots', requiredAction: 'READ_HOTSPOT',
  spatialStatus: 'AVAILABLE', geometryType: 'POINT',
  fields: {
    confidence: { type: 'number', uses: ['color', 'display', 'filter'] },
    id: { type: 'string', uses: ['display', 'filter', 'label'] },
    latitude: { type: 'number', uses: ['geometry'] },
    longitude: { type: 'number', uses: ['geometry'] },
    magnitude: { type: 'number', uses: ['display', 'filter', 'size', 'weight'] },
    method: { type: 'string', uses: ['display', 'filter'] },
    version: { type: 'string', uses: ['display', 'filter'] },
  },
  geometry: { longitudeField: 'longitude', latitudeField: 'latitude' },
  severityField: 'confidence', weightField: 'magnitude', labelFields: ['id'], sensitivity: 'RESTRICTED',
};

export const DATASET_CATALOG = deepFreeze([
  hotspotDataset,
  unavailable({
    id: 'anomalies', name: 'Trend anomalies', sourceReference: 'anomalies', service: 'listAnomalies',
    requiredAction: 'READ_ANOMALY', missingRequiredFields: ['latitude', 'longitude'],
  }),
  unavailable({
    id: 'areaRisk', name: 'Explainable area risk', sourceReference: 'areaRisk', service: 'getAreaRisk',
    requiredAction: 'READ_AREA_RISK', missingRequiredFields: ['boundaryId', 'h3Index', 'latitude', 'longitude'],
  }),
  unavailable({
    id: 'alerts', name: 'Intelligence alerts', sourceReference: 'alerts', service: 'listAlerts',
    requiredAction: 'READ_ALERT', missingRequiredFields: ['latitude', 'longitude'],
  }),
]);

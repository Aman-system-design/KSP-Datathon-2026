import { compileLayerExecution, deepFreeze } from '@ksp/geospatial-core';

import { fail } from '../services/errors.mjs';
import { DATASET_CATALOG } from './dataset-catalog.mjs';

const EXECUTION_KEYS = new Set(['layer', 'runtime']);
const RENDER_USES = new Set(['display', 'label', 'weight', 'color', 'size']);
const SEMANTIC_LIMIT = 200;

function plain(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
    && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}

function publicDataset(dataset) {
  const { sourceReference, service, requiredAction, ...visible } = dataset;
  return deepFreeze({ ...structuredClone(visible), access: { actions: [requiredAction] } });
}

function requireAction(access, action) {
  if (!access?.actions?.includes(action)) fail('FORBIDDEN_ACTION');
}

function normalizedExecution(body, dataset) {
  if (!plain(body) || Object.keys(body).some(key => !EXECUTION_KEYS.has(key)) || !plain(body.layer) || !plain(body.runtime)) {
    fail('INVALID_REQUEST');
  }
  try {
    const { service, spatialStatus, missingRequiredFields, ...definition } = dataset;
    const plan = compileLayerExecution({ dataset: definition, layer: body.layer, runtime: body.runtime });
    return deepFreeze({ ...plan, limit: Math.min(plan.limit, SEMANTIC_LIMIT) });
  } catch { fail('INVALID_REQUEST'); }
}

function valueAt(row, field) {
  if (field === 'latitude') return row.centroid?.latitude;
  if (field === 'longitude') return row.centroid?.longitude;
  return row[field];
}

function projectProperties(row, plan, dataset) {
  const properties = { id: row.id };
  for (const field of plan.fields) {
    if (field === 'id' || !dataset.fields[field]?.uses.some(use => RENDER_USES.has(use))) continue;
    const value = valueAt(row, field);
    if (value !== undefined) properties[field] = structuredClone(value);
  }
  return properties;
}

function predicate(actual, expected) {
  if (!plain(expected)) return Object.is(actual, expected);
  return Object.entries(expected).every(([operator, value]) => {
    if (operator === '$eq') return Object.is(actual, value);
    if (operator === '$ne') return !Object.is(actual, value);
    if (operator === '$gt') return actual > value;
    if (operator === '$gte') return actual >= value;
    if (operator === '$lt') return actual < value;
    if (operator === '$lte') return actual <= value;
    if (operator === '$in') return value.some(item => Object.is(actual, item));
    if (operator === '$nin') return value.every(item => !Object.is(actual, item));
    return false;
  });
}

function matches(row, filter) {
  return Object.entries(filter).every(([key, value]) => {
    if (key === '$and') return value.every(child => matches(row, child));
    if (key === '$or') return value.some(child => matches(row, child));
    if (key === '$not') return !matches(row, value);
    return predicate(valueAt(row, key), value);
  });
}

function inViewport(longitude, latitude, viewport) {
  const bounds = viewport?.bounds;
  return !bounds || (longitude >= bounds[0] && longitude <= bounds[2] && latitude >= bounds[1] && latitude <= bounds[3]);
}

function queryFor(plan, access) {
  return Object.fromEntries([
    ['limit', plan.limit],
    ['unitId', access.scopeUnitId],
    ['from', plan.timeWindow?.from], ['to', plan.timeWindow?.to],
    ['bounds', plan.viewport?.bounds?.join(',')],
  ].filter(([, value]) => value !== undefined));
}

function metadata({ envelope, rows, features, omittedFeatureCount, clock, idFactory }) {
  const sourceMeta = plain(envelope.meta) ? structuredClone(envelope.meta) : {};
  const limitations = [...new Set([
    ...(Array.isArray(sourceMeta.limitations) ? sourceMeta.limitations : []),
    ...rows.flatMap(row => Array.isArray(row.limitations) ? row.limitations : []),
  ])].sort();
  const recordMethodVersion = rows.find(row => typeof row.version === 'string')?.version;
  if (!sourceMeta.generatedAt) {
    const generatedAt = clock();
    if (!(generatedAt instanceof Date) || !Number.isFinite(generatedAt.getTime())) throw new TypeError('clock must return a valid Date');
    sourceMeta.generatedAt = generatedAt.toISOString();
  }
  return deepFreeze({
    ...sourceMeta,
    requestId: sourceMeta.requestId ?? idFactory(), runGroupId: sourceMeta.analysisRunId,
    observationWindow: sourceMeta.observationPeriod,
    ...(sourceMeta.methodVersion ? { engineVersion: sourceMeta.methodVersion } : {}),
    ...(recordMethodVersion ? { recordMethodVersion } : {}),
    sourceRecordCount: rows.length, outputFeatureCount: features.length, omittedFeatureCount, limitations,
  });
}

export function createGeospatialLayerService({ readServices, clock, idFactory }) {
  if (!readServices || typeof clock !== 'function' || typeof idFactory !== 'function') throw new TypeError('readServices, clock, and idFactory are required');
  const sources = new Map(DATASET_CATALOG.flatMap(dataset => (
    Object.hasOwn(readServices, dataset.service) && typeof readServices[dataset.service] === 'function'
      ? [[dataset.sourceReference, readServices[dataset.service].bind(readServices)]] : []
  )));

  return Object.freeze({
    async listDatasets({ access }) {
      const items = DATASET_CATALOG.filter(dataset => access?.actions?.includes(dataset.requiredAction)).map(publicDataset);
      const generatedAt = clock();
      return deepFreeze({
        data: { items }, meta: { requestId: idFactory(), generatedAt: generatedAt.toISOString() },
      });
    },

    async executeLayer({ access, body }) {
      const datasetId = plain(body?.layer) ? body.layer.datasetId : undefined;
      const dataset = DATASET_CATALOG.find(candidate => candidate.id === datasetId);
      if (!dataset) fail('INVALID_REQUEST');
      requireAction(access, dataset.requiredAction);
      if (dataset.spatialStatus !== 'AVAILABLE') fail('DATA_NOT_READY');
      const plan = normalizedExecution(body, dataset);
      const source = sources.get(plan.sourceReference);
      if (!source) throw new TypeError('unconfigured geospatial source');
      const envelope = await source({ access, params: {}, query: queryFor(plan, access) });
      const rows = Array.isArray(envelope?.data?.items) ? envelope.data.items : envelope?.data ? [envelope.data] : [];
      const features = [];
      let omittedFeatureCount = 0;
      for (const row of rows) {
        const longitude = valueAt(row, dataset.geometry.longitudeField);
        const latitude = valueAt(row, dataset.geometry.latitudeField);
        if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180
          || !Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
          omittedFeatureCount += 1; continue;
        }
        if (!inViewport(longitude, latitude, plan.viewport) || !matches(row, plan.filter)) continue;
        if (features.length >= plan.limit) continue;
        features.push(deepFreeze({
          type: 'Feature', id: row.id,
          geometry: { type: 'Point', coordinates: [longitude, latitude] },
          properties: projectProperties(row, plan, dataset),
        }));
      }
      if (features.length === 0 && omittedFeatureCount === rows.length && rows.length > 0) fail('DATA_NOT_READY');
      return deepFreeze({
        data: { type: 'FeatureCollection', features },
        meta: metadata({ envelope, rows, features, omittedFeatureCount, clock, idFactory }),
      });
    },
  });
}

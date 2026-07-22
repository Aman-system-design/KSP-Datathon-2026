export const RENDERERS = Object.freeze(['POINT', 'CLUSTER', 'HEATMAP', 'H3', 'CHOROPLETH', 'PATH', 'ARC']);
export const SOURCE_TYPES = Object.freeze(['SEMANTIC_API', 'DATASTORE_VIEW', 'CSV', 'GEOJSON', 'PMTILES']);
export const VISIBILITIES = Object.freeze(['PRIVATE', 'SHARED', 'ROLE_DEFAULT', 'ORGANIZATION_GLOBAL']);
export const MAX_FEATURES = 5000;

const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/;
const SOURCE_REFERENCE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const GEOMETRY_TYPES = new Set(['POINT', 'MULTI_POINT', 'LINE', 'MULTI_LINE', 'POLYGON', 'MULTI_POLYGON', 'H3', 'ADMIN_BOUNDARY']);
const FIELD_TYPES = new Set(['string', 'number', 'boolean', 'date', 'datetime']);
const FIELD_USES = new Set(['geometry', 'weight', 'color', 'size', 'label', 'display', 'filter', 'time', 'join']);
const AUTHORITY_KEYS = new Set(['organizationId', 'role', 'authorizedUnitIds', 'permissions']);
const POLLUTION_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
const RESERVED_IDENTIFIERS = new Set([...Object.getOwnPropertyNames(Object.prototype), 'prototype']);
const FILTER_OPERATORS = new Set(['$eq', '$ne', '$gt', '$gte', '$lt', '$lte', '$in', '$nin']);
const MAX_FILTER_DEPTH = 4;
const MAX_FILTER_ITEMS = 100;
const MAX_FILTER_STRING = 256;

const DATASET_KEYS = new Set([
  'id', 'name', 'description', 'sourceType', 'sourceReference', 'geometryType', 'fields', 'geometry',
  'timeField', 'severityField', 'weightField', 'labelFields', 'sensitivity', 'requiredAction',
]);
const FIELD_KEYS = new Set(['type', 'uses']);
const LAYER_KEYS = new Set([
  'id', 'datasetId', 'renderer', 'visible', 'order', 'minZoom', 'maxZoom', 'filter', 'limit',
  'weightField', 'colorField', 'sizeField', 'labelField', 'tooltipFields',
]);
const VIEW_KEYS = new Set(['id', 'name', 'description', 'version', 'visibility', 'viewport', 'timeWindow', 'globalFilters', 'layers']);

function isPlainObject(value) {
  if (value === null || typeof value !== 'object') return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function plain(value, label) {
  if (!isPlainObject(value)) throw new TypeError(`${label} must be a plain object`);
  return value;
}

function rejectUnknown(value, allowed, label) {
  for (const key of Object.keys(value)) {
    if (POLLUTION_KEYS.has(key)) throw new Error(`${label}.${key} is prohibited`);
    if (!allowed.has(key)) throw new Error(`${label}.${key} is unknown`);
  }
}

function requiredString(value, label, maxLength = 256) {
  if (typeof value !== 'string' || value.length === 0 || value.length > maxLength) {
    throw new Error(`${label} must be a non-empty string of at most ${maxLength} characters`);
  }
  return value;
}

function id(value, label) {
  if (typeof value !== 'string' || !ID_PATTERN.test(value)) throw new Error(`${label} is invalid`);
  return value;
}

function oneOf(value, allowed, label) {
  if (!allowed.includes?.(value) && !allowed.has?.(value)) throw new Error(`${label} is unsupported`);
  return value;
}

function optionalBoolean(value, label) {
  if (value === undefined) return undefined;
  if (typeof value !== 'boolean') throw new Error(`${label} must be boolean`);
  return value;
}

function boundedNumber(value, label, minimum, maximum) {
  if (!Number.isFinite(value) || value < minimum || value > maximum) throw new Error(`${label} is out of bounds`);
  return value;
}

function boundedInteger(value, label, minimum, maximum) {
  if (!Number.isInteger(value) || value < minimum || value > maximum) throw new Error(`${label} is out of bounds`);
  return value;
}

export function deepFreeze(value) {
  if (!value || typeof value !== 'object') return value;
  const pending = [value];
  const visited = new Set();
  const objects = [];
  while (pending.length > 0) {
    const current = pending.pop();
    if (!current || typeof current !== 'object' || visited.has(current)) continue;
    visited.add(current);
    objects.push(current);
    for (const child of Object.values(current)) pending.push(child);
  }
  for (let index = objects.length - 1; index >= 0; index -= 1) Object.freeze(objects[index]);
  return value;
}

function definedEntries(entries) {
  return Object.fromEntries(entries.filter(([, value]) => value !== undefined));
}

function sortedObject(entries) {
  return Object.fromEntries(entries.sort(([left], [right]) => left.localeCompare(right)));
}

function normalizeFieldDefinition(value, label) {
  plain(value, label);
  rejectUnknown(value, FIELD_KEYS, label);
  const type = oneOf(value.type, FIELD_TYPES, `${label}.type`);
  if (!Array.isArray(value.uses) || value.uses.length === 0) throw new Error(`${label}.uses must be a non-empty array`);
  const uses = [...new Set(value.uses.map((use, index) => oneOf(use, FIELD_USES, `${label}.uses[${index}]`)))].sort();
  return { type, uses };
}

function mappedField(fields, fieldName, use, label, alternateUse, expectedType) {
  id(fieldName, label);
  const definition = fields[fieldName];
  if (!definition) throw new Error(`${label} references undeclared field ${fieldName}`);
  if (expectedType && definition.type !== expectedType) throw new Error(`${label} field ${fieldName} must be ${expectedType}`);
  if (!definition.uses.includes(use) && !(alternateUse && definition.uses.includes(alternateUse))) {
    throw new Error(`${label} field ${fieldName} does not allow ${use}`);
  }
  return fieldName;
}

function normalizeGeometry(value, geometryType, fields) {
  plain(value, 'dataset.geometry');
  const shapes = {
    POINT: ['longitudeField', 'latitudeField'],
    MULTI_POINT: ['geometryField'],
    LINE: ['geometryField'],
    MULTI_LINE: ['geometryField'],
    POLYGON: ['geometryField'],
    MULTI_POLYGON: ['geometryField'],
    H3: ['h3Field'],
    ADMIN_BOUNDARY: ['boundaryField'],
  };
  const keys = shapes[geometryType];
  rejectUnknown(value, new Set(keys), 'dataset.geometry');
  for (const key of keys) {
    if (!(key in value)) throw new Error(`dataset.geometry.${key} is required`);
  }
  return Object.fromEntries(keys.map(key => [key, mappedField(
    fields,
    value[key],
    geometryType === 'ADMIN_BOUNDARY' ? 'join' : 'geometry',
    `dataset.geometry.${key}`,
    undefined,
    geometryType === 'POINT' ? 'number' : 'string',
  )]));
}

export function normalizeDatasetDefinition(value) {
  plain(value, 'dataset');
  rejectUnknown(value, DATASET_KEYS, 'dataset');
  const fieldsInput = plain(value.fields, 'dataset.fields');
  const fieldEntries = Object.keys(fieldsInput).sort().map(fieldId => {
    id(fieldId, `dataset.fields.${fieldId}`);
    if (POLLUTION_KEYS.has(fieldId)) throw new Error(`dataset.fields.${fieldId} is prohibited`);
    return [fieldId, normalizeFieldDefinition(fieldsInput[fieldId], `dataset.fields.${fieldId}`)];
  });
  if (fieldEntries.length === 0) throw new Error('dataset.fields must not be empty');
  const fields = Object.fromEntries(fieldEntries);
  const geometryType = oneOf(value.geometryType, GEOMETRY_TYPES, 'dataset.geometryType');
  if (typeof value.sourceReference !== 'string' || !SOURCE_REFERENCE_PATTERN.test(value.sourceReference)
    || RESERVED_IDENTIFIERS.has(value.sourceReference)) {
    throw new Error('dataset.sourceReference must be an opaque server identifier');
  }
  const sourceReference = value.sourceReference;
  const normalized = definedEntries([
    ['id', id(value.id, 'dataset.id')],
    ['name', requiredString(value.name, 'dataset.name')],
    ['description', value.description === undefined ? undefined : requiredString(value.description, 'dataset.description', 1000)],
    ['sourceType', oneOf(value.sourceType, SOURCE_TYPES, 'dataset.sourceType')],
    ['sourceReference', sourceReference],
    ['geometryType', geometryType],
    ['fields', fields],
    ['geometry', normalizeGeometry(value.geometry, geometryType, fields)],
    ['timeField', value.timeField === undefined ? undefined : mappedField(fields, value.timeField, 'time', 'dataset.timeField')],
    ['severityField', value.severityField === undefined ? undefined : mappedField(fields, value.severityField, 'color', 'dataset.severityField')],
    ['weightField', value.weightField === undefined ? undefined : mappedField(fields, value.weightField, 'weight', 'dataset.weightField')],
    ['labelFields', value.labelFields === undefined ? undefined : normalizeMappedArray(value.labelFields, fields, 'display', 'dataset.labelFields', 'label')],
    ['sensitivity', requiredString(value.sensitivity, 'dataset.sensitivity', 64)],
    ['requiredAction', id(value.requiredAction, 'dataset.requiredAction')],
  ]);
  return deepFreeze(normalized);
}

function normalizeMappedArray(value, fields, use, label, alternateUse) {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_FILTER_ITEMS) throw new Error(`${label} must be a non-empty bounded array`);
  return [...new Set(value.map((field, index) => mappedField(fields, field, use, `${label}[${index}]`, alternateUse)))].sort();
}

function rejectUnsafeKeys(value, label) {
  const stack = [{ value, depth: 0 }];
  const seen = new Set();
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current.value || typeof current.value !== 'object' || seen.has(current.value)) continue;
    if (current.depth > MAX_FILTER_DEPTH + 2) throw new Error(`${label} exceeds maximum filter depth`);
    seen.add(current.value);
    const keys = Object.keys(current.value);
    if (keys.length > MAX_FILTER_ITEMS) throw new Error(`${label} ${Array.isArray(current.value) ? 'array' : 'object'} has too many values`);
    for (const key of keys) {
      if (AUTHORITY_KEYS.has(key) || POLLUTION_KEYS.has(key)) throw new Error(`${label}.${key} is prohibited`);
      stack.push({ value: current.value[key], depth: current.depth + 1 });
    }
  }
}

function calendarPartsAreValid(year, month, day, hour = 0, minute = 0, second = 0) {
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(hour, minute, second, 0);
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
    && date.getUTCHours() === hour && date.getUTCMinutes() === minute && date.getUTCSeconds() === second;
}

function normalizeDate(value, label) {
  const match = typeof value === 'string' && /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match || !calendarPartsAreValid(...match.slice(1).map(Number))) throw new Error(`${label} must be a valid ISO date`);
  return value;
}

function normalizeIsoTimestamp(value, label) {
  const match = typeof value === 'string' && /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!match) throw new Error(`${label} must be a valid ISO timestamp`);
  const parts = match.slice(1, 7).map(Number);
  const offset = match[7];
  if (!calendarPartsAreValid(...parts) || (offset !== 'Z' && (Number(offset.slice(1, 3)) > 23 || Number(offset.slice(4, 6)) > 59))) {
    throw new Error(`${label} must be a valid ISO timestamp`);
  }
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds)) throw new Error(`${label} must be a valid ISO timestamp`);
  return new Date(milliseconds).toISOString();
}

function normalizeTypedScalar(value, definition, label) {
  if (definition.type === 'number') {
    if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`${label} must be a number`);
    return value;
  }
  if (definition.type === 'boolean') {
    if (typeof value !== 'boolean') throw new Error(`${label} must be a boolean`);
    return value;
  }
  if (definition.type === 'date') return normalizeDate(value, label);
  if (definition.type === 'datetime') return normalizeIsoTimestamp(value, label);
  if (typeof value !== 'string') throw new Error(`${label} must be a string`);
  if (value.length > MAX_FILTER_STRING) throw new Error(`${label} string exceeds ${MAX_FILTER_STRING} characters`);
  return value;
}

function normalizeOperatorValue(operator, value, definition, label) {
  if (['$gt', '$gte', '$lt', '$lte'].includes(operator) && !['number', 'date', 'datetime'].includes(definition.type)) {
    throw new Error(`${label} is incompatible with ${definition.type} fields`);
  }
  if (operator === '$in' || operator === '$nin') {
    if (!Array.isArray(value) || value.length === 0 || value.length > MAX_FILTER_ITEMS) throw new Error(`${label} array must contain 1-${MAX_FILTER_ITEMS} values`);
    return value.map((item, index) => normalizeTypedScalar(item, definition, `${label}[${index}]`));
  }
  return normalizeTypedScalar(value, definition, label);
}

function normalizeFieldPredicate(value, definition, label) {
  if (!isPlainObject(value)) return normalizeTypedScalar(value, definition, label);
  const entries = Object.keys(value).sort().map(operator => {
    if (!FILTER_OPERATORS.has(operator)) throw new Error(`${label}.${operator} is an unsupported filter operator`);
    return [operator, normalizeOperatorValue(operator, value[operator], definition, `${label}.${operator}`)];
  });
  if (entries.length === 0) throw new Error(`${label} must not be empty`);
  return Object.fromEntries(entries);
}

export function normalizeFilter(value, fields, label = 'filter', depth = 0) {
  if (value === undefined) return {};
  plain(value, label);
  rejectUnsafeKeys(value, label);
  if (depth > MAX_FILTER_DEPTH) throw new Error(`${label} exceeds maximum filter depth`);
  const keys = Object.keys(value).sort();
  if (keys.length > MAX_FILTER_ITEMS) throw new Error(`${label} has too many expressions`);
  const entries = keys.map(key => {
    if (key === '$and' || key === '$or') {
      const children = value[key];
      if (!Array.isArray(children) || children.length === 0 || children.length > MAX_FILTER_ITEMS) throw new Error(`${label}.${key} must contain a non-empty bounded array`);
      return [key, children.map((child, index) => normalizeFilter(child, fields, `${label}.${key}[${index}]`, depth + 1))];
    }
    if (key === '$not') return [key, normalizeFilter(value[key], fields, `${label}.$not`, depth + 1)];
    if (key.startsWith('$')) throw new Error(`${label}.${key} is an unsupported filter operator`);
    mappedField(fields, key, 'filter', `${label}.${key}`);
    return [key, normalizeFieldPredicate(value[key], fields[key], `${label}.${key}`)];
  });
  return deepFreeze(Object.fromEntries(entries));
}

const RENDERERS_BY_GEOMETRY = {
  POINT: new Set(['POINT', 'CLUSTER', 'HEATMAP', 'ARC']),
  MULTI_POINT: new Set(['POINT', 'CLUSTER', 'HEATMAP']),
  LINE: new Set(['PATH']),
  MULTI_LINE: new Set(['PATH']),
  POLYGON: new Set(['CHOROPLETH']),
  MULTI_POLYGON: new Set(['CHOROPLETH']),
  H3: new Set(['H3', 'CHOROPLETH']),
  ADMIN_BOUNDARY: new Set(['CHOROPLETH']),
};

function resolveDataset(catalog, datasetId) {
  if (!(catalog instanceof Map)) throw new TypeError('dataset catalog must be a Map');
  const dataset = catalog.get(datasetId);
  if (!dataset) throw new Error(`layer.datasetId references unknown dataset ${datasetId}`);
  const normalized = normalizeDatasetDefinition(dataset);
  if (normalized.id !== datasetId) throw new Error(`dataset catalog key ${datasetId} does not match dataset ID ${normalized.id}`);
  return normalized;
}

export function normalizeLayerDefinition(value, catalog) {
  plain(value, 'layer');
  rejectUnknown(value, LAYER_KEYS, 'layer');
  const datasetId = id(value.datasetId, 'layer.datasetId');
  const dataset = resolveDataset(catalog, datasetId);
  const renderer = oneOf(value.renderer, RENDERERS, 'layer.renderer');
  if (!RENDERERS_BY_GEOMETRY[dataset.geometryType].has(renderer)) {
    throw new Error(`layer renderer ${renderer} is incompatible with geometry ${dataset.geometryType}`);
  }
  const minZoom = value.minZoom === undefined ? undefined : boundedNumber(value.minZoom, 'layer.minZoom', 0, 24);
  const maxZoom = value.maxZoom === undefined ? undefined : boundedNumber(value.maxZoom, 'layer.maxZoom', 0, 24);
  if (minZoom !== undefined && maxZoom !== undefined && minZoom > maxZoom) throw new Error('layer minZoom must not exceed maxZoom');
  const normalized = definedEntries([
    ['id', id(value.id, 'layer.id')],
    ['datasetId', datasetId],
    ['renderer', renderer],
    ['visible', optionalBoolean(value.visible, 'layer.visible')],
    ['order', value.order === undefined ? undefined : boundedInteger(value.order, 'layer.order', 0, 1000)],
    ['minZoom', minZoom],
    ['maxZoom', maxZoom],
    ['filter', normalizeFilter(value.filter, dataset.fields, 'layer.filter')],
    ['limit', value.limit === undefined ? undefined : boundedInteger(value.limit, 'layer.limit', 1, MAX_FEATURES)],
    ['weightField', value.weightField === undefined ? undefined : mappedField(dataset.fields, value.weightField, 'weight', 'layer.weightField')],
    ['colorField', value.colorField === undefined ? undefined : mappedField(dataset.fields, value.colorField, 'color', 'layer.colorField')],
    ['sizeField', value.sizeField === undefined ? undefined : mappedField(dataset.fields, value.sizeField, 'size', 'layer.sizeField')],
    ['labelField', value.labelField === undefined ? undefined : mappedField(dataset.fields, value.labelField, 'label', 'layer.labelField', 'display')],
    ['tooltipFields', value.tooltipFields === undefined ? undefined : normalizeMappedArray(value.tooltipFields, dataset.fields, 'display', 'layer.tooltipFields')],
  ]);
  return deepFreeze(normalized);
}

export function normalizeViewport(value) {
  if (value === undefined || value === null) return null;
  plain(value, 'viewport');
  rejectUnknown(value, new Set(['center', 'zoom', 'bounds']), 'viewport');
  const entries = [];
  if (value.center !== undefined) {
    if (!Array.isArray(value.center) || value.center.length !== 2) throw new Error('viewport.center must contain longitude and latitude');
    entries.push(['center', [boundedNumber(value.center[0], 'viewport.center longitude', -180, 180), boundedNumber(value.center[1], 'viewport.center latitude', -90, 90)]]);
  }
  if (value.zoom !== undefined) entries.push(['zoom', boundedNumber(value.zoom, 'viewport.zoom', 0, 24)]);
  if (value.bounds !== undefined) {
    if (!Array.isArray(value.bounds) || value.bounds.length !== 4) throw new Error('viewport.bounds must contain west, south, east, north');
    const bounds = [
      boundedNumber(value.bounds[0], 'viewport.bounds west', -180, 180),
      boundedNumber(value.bounds[1], 'viewport.bounds south', -90, 90),
      boundedNumber(value.bounds[2], 'viewport.bounds east', -180, 180),
      boundedNumber(value.bounds[3], 'viewport.bounds north', -90, 90),
    ];
    if (bounds[0] >= bounds[2] || bounds[1] >= bounds[3]) throw new Error('viewport.bounds must be ordered west, south, east, north');
    entries.push(['bounds', bounds]);
  }
  if (entries.length === 0) throw new Error('viewport must define center, zoom, or bounds');
  return deepFreeze(sortedObject(entries));
}

export function normalizeTimeWindow(value) {
  if (value === undefined || value === null) return null;
  plain(value, 'timeWindow');
  rejectUnknown(value, new Set(['from', 'to']), 'timeWindow');
  const from = normalizeIsoTimestamp(value.from, 'timeWindow.from');
  const to = normalizeIsoTimestamp(value.to, 'timeWindow.to');
  if (Date.parse(from) > Date.parse(to)) throw new Error('timeWindow.from must not be after timeWindow.to');
  return deepFreeze({ from, to });
}

export function normalizeMapViewDefinition(value, catalog) {
  plain(value, 'mapView');
  rejectUnknown(value, VIEW_KEYS, 'mapView');
  if (!Array.isArray(value.layers) || value.layers.length > MAX_FILTER_ITEMS) throw new Error('mapView.layers must be a bounded array');
  const globalFilters = value.globalFilters === undefined ? undefined : Object.fromEntries(
    Object.keys(plain(value.globalFilters, 'mapView.globalFilters')).sort().map(datasetId => {
      id(datasetId, `mapView.globalFilters.${datasetId}`);
      return [datasetId, normalizeFilter(value.globalFilters[datasetId], resolveDataset(catalog, datasetId).fields, `mapView.globalFilters.${datasetId}`)];
    }),
  );
  const layers = value.layers.map(layer => normalizeLayerDefinition(layer, catalog));
  const layerIds = new Set();
  for (const layer of layers) {
    if (layerIds.has(layer.id)) throw new Error(`mapView has duplicate layer ID ${layer.id}`);
    layerIds.add(layer.id);
  }
  const normalized = definedEntries([
    ['id', id(value.id, 'mapView.id')],
    ['name', requiredString(value.name, 'mapView.name')],
    ['description', value.description === undefined ? undefined : requiredString(value.description, 'mapView.description', 1000)],
    ['version', boundedInteger(value.version, 'mapView.version', 1, Number.MAX_SAFE_INTEGER)],
    ['visibility', oneOf(value.visibility, VISIBILITIES, 'mapView.visibility')],
    ['viewport', value.viewport === undefined ? undefined : normalizeViewport(value.viewport)],
    ['timeWindow', value.timeWindow === undefined ? undefined : normalizeTimeWindow(value.timeWindow)],
    ['globalFilters', globalFilters],
    ['layers', layers],
  ]);
  return deepFreeze(normalized);
}

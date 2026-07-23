const ALLOWED_KEYS = new Set([
  'name', 'description', 'sourceKey', 'dimensions', 'measures', 'filters', 'sort',
  'visualization', 'limit',
]);
const FILTER_OPERATORS = new Set(['eq', 'neq', 'in', 'gte', 'lte', 'between']);
const MAP_VIEW_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/u;

function requireObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
}

function requireField(source, name, { dimension = false } = {}) {
  const definition = source.fields[name];
  if (!definition) throw new TypeError(`Unknown field: ${name}`);
  if (dimension && !definition.dimension) throw new TypeError(`Field is not a dimension: ${name}`);
  return definition;
}

export function normalizeReportDefinition(input, source) {
  requireObject(input, 'Report definition');
  requireObject(source, 'Report source');
  for (const key of Object.keys(input)) {
    if (!ALLOWED_KEYS.has(key)) throw new TypeError(`Unexpected field: ${key}`);
  }

  const name = String(input.name ?? '').trim();
  if (!name || name.length > 128) throw new TypeError('Report name is required and must be at most 128 characters');
  const sourceKey = String(input.sourceKey ?? '');
  if (sourceKey !== source.key) {
    throw new TypeError('Report source does not match the governed source');
  }

  const dimensions = input.dimensions ?? [];
  if (!Array.isArray(dimensions)) throw new TypeError('Dimensions must be an array');
  if (new Set(dimensions).size !== dimensions.length) throw new TypeError('Duplicate dimensions are not allowed');
  dimensions.forEach((name) => requireField(source, name, { dimension: true }));

  const measures = input.measures ?? [];
  if (!Array.isArray(measures)) throw new TypeError('Measures must be an array');
  const normalizedMeasures = measures.map((measure) => {
    requireObject(measure, 'Measure');
    const definition = requireField(source, measure.field);
    if (!definition.aggregates?.includes(measure.aggregate)) {
      throw new TypeError(`Unsupported aggregate for ${measure.field}`);
    }
    return { field: measure.field, aggregate: measure.aggregate };
  });

  const filters = input.filters ?? [];
  if (!Array.isArray(filters)) throw new TypeError('Filters must be an array');
  const normalizedFilters = filters.map((filter) => {
    requireObject(filter, 'Filter');
    requireField(source, filter.field);
    if (!FILTER_OPERATORS.has(filter.operator)) throw new TypeError('Unsupported filter operator');
    if (filter.value === undefined) throw new TypeError('Filter value is required');
    return { field: filter.field, operator: filter.operator, value: structuredClone(filter.value) };
  });

  const sort = input.sort ?? [];
  if (!Array.isArray(sort)) throw new TypeError('Sort must be an array');
  const sortableFields = new Set([
    ...dimensions,
    ...normalizedMeasures.map(({ field, aggregate }) => `${field}_${aggregate}`),
  ]);
  const normalizedSort = sort.map((entry) => {
    requireObject(entry, 'Sort');
    if (!sortableFields.has(entry.field)) throw new TypeError(`Invalid sort field: ${entry.field}`);
    if (!['asc', 'desc'].includes(entry.direction)) throw new TypeError('Sort direction must be asc or desc');
    return { field: entry.field, direction: entry.direction };
  });

  const visualization = input.visualization ?? { type: 'table' };
  requireObject(visualization, 'Visualization');
  if (!source.visualizations.includes(visualization.type)) {
    throw new TypeError('Unsupported visualization for report source');
  }
  const visualizationKeys = Object.keys(visualization);
  let normalizedVisualization;
  if (visualization.type === 'map') {
    if (visualizationKeys.length !== 2 || !visualizationKeys.includes('mapViewId')
      || typeof visualization.mapViewId !== 'string' || !MAP_VIEW_ID.test(visualization.mapViewId)) {
      throw new TypeError('Map visualization must reference exactly one governed map view');
    }
    normalizedVisualization = { type: 'map', mapViewId: visualization.mapViewId };
    if (dimensions.length > 0 || normalizedMeasures.length > 0 || normalizedFilters.length > 0 || normalizedSort.length > 0) {
      throw new TypeError('Map visualization cannot include report transforms');
    }
  } else {
    if (visualizationKeys.length !== 1) throw new TypeError('Visualization contains unsupported fields');
    normalizedVisualization = { type: visualization.type };
  }
  const limit = input.limit ?? 100;
  if (!Number.isInteger(limit) || limit < 1 || limit > 200) {
    throw new TypeError('Report limit must be an integer from 1 to 200');
  }

  return Object.freeze({
    name,
    description: String(input.description ?? '').trim(),
    sourceKey,
    dimensions: Object.freeze([...dimensions]),
    measures: Object.freeze(normalizedMeasures),
    filters: Object.freeze(normalizedFilters),
    sort: Object.freeze(normalizedSort),
    visualization: Object.freeze(normalizedVisualization),
    limit,
  });
}

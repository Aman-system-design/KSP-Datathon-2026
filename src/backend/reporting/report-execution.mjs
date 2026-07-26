import { MAX_FEATURES } from '@ksp/geospatial-core';

function matches(row, { field, operator, value }) {
  const actual = row[field];
  if (operator === 'eq') return actual === value;
  if (operator === 'neq') return actual !== value;
  if (operator === 'in') return Array.isArray(value) && value.includes(actual);
  if (operator === 'gte') return actual >= value;
  if (operator === 'lte') return actual <= value;
  if (operator === 'between') return Array.isArray(value) && value.length === 2 && actual >= value[0] && actual <= value[1];
  return false;
}

function aggregate(values, operation) {
  const numbers = values.map(Number).filter(Number.isFinite);
  if (operation === 'count') return values.length;
  if (numbers.length === 0) return null;
  if (operation === 'sum') return numbers.reduce((total, value) => total + value, 0);
  if (operation === 'avg') return numbers.reduce((total, value) => total + value, 0) / numbers.length;
  if (operation === 'min') return Math.min(...numbers);
  if (operation === 'max') return Math.max(...numbers);
  throw new TypeError(`Unsupported aggregate: ${operation}`);
}

const VIEW_KEYS = new Set(['id', 'name', 'description', 'version', 'visibility', 'viewport', 'timeWindow', 'globalFilters', 'layers']);
const LAYER_KEYS = new Set([
  'id', 'datasetId', 'renderer', 'visible', 'order', 'minZoom', 'maxZoom', 'filter', 'limit',
  'weightField', 'colorField', 'sizeField', 'labelField', 'tooltipFields',
]);
const plain = value => value && typeof value === 'object' && !Array.isArray(value)
  && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);

function clientSafeMapDefinition(value) {
  if (!plain(value) || Object.keys(value).some(key => !VIEW_KEYS.has(key)) || !Array.isArray(value.layers)) {
    throw new TypeError('Invalid normalized map view definition');
  }
  const layers = value.layers.map(layer => {
    if (!plain(layer) || Object.keys(layer).some(key => !LAYER_KEYS.has(key))) {
      throw new TypeError('Invalid normalized map layer definition');
    }
    if (layer.limit !== undefined && (!Number.isInteger(layer.limit) || layer.limit < 1 || layer.limit > MAX_FEATURES)) {
      throw new TypeError('Map layer limit must be bounded');
    }
    return structuredClone(layer);
  }).sort((left, right) => (left.order ?? 0) - (right.order ?? 0));
  return { ...structuredClone(value), layers };
}

function effectiveFilter(globalFilter, layerFilter) {
  const hasGlobal = plain(globalFilter) && Object.keys(globalFilter).length > 0;
  const hasLayer = plain(layerFilter) && Object.keys(layerFilter).length > 0;
  if (hasGlobal && hasLayer) return { $and: [structuredClone(globalFilter), structuredClone(layerFilter)] };
  if (hasGlobal) return structuredClone(globalFilter);
  return hasLayer ? structuredClone(layerFilter) : {};
}

export function projectMapReportExecution(mapView) {
  if (!plain(mapView) || typeof mapView.id !== 'string' || typeof mapView.name !== 'string'
    || !Number.isInteger(mapView.version)) throw new TypeError('Invalid governed map view');
  const definition = clientSafeMapDefinition(mapView.definition);
  const executions = definition.layers.filter(layer => layer.visible !== false).map(layer => ({
    layer: {
      ...structuredClone(layer),
      filter: effectiveFilter(definition.globalFilters?.[layer.datasetId], layer.filter),
    },
    runtime: Object.fromEntries([
      ['viewport', definition.viewport ? structuredClone(definition.viewport) : undefined],
      ['timeWindow', definition.timeWindow ? structuredClone(definition.timeWindow) : undefined],
      ['limit', layer.limit ?? 1000],
    ].filter(([, value]) => value !== undefined)),
  }));
  return Object.freeze({
    mapView: Object.freeze({
      id: mapView.id, name: mapView.name, visibility: mapView.visibility,
      version: mapView.version, definition,
    }),
    executions: Object.freeze(executions),
  });
}

export function executeReportDefinition(definition, sourceRows) {
  if (!Array.isArray(sourceRows)) throw new TypeError('Report source rows must be an array');
  const filtered = sourceRows.filter(row => (definition.filters ?? []).every(filter => matches(row, filter)));
  const dimensions = definition.dimensions ?? [];
  const groups = new Map();
  for (const row of filtered) {
    const key = JSON.stringify(dimensions.map(field => row[field]));
    const group = groups.get(key) ?? [];
    group.push(row); groups.set(key, group);
  }
  if (groups.size === 0 && dimensions.length === 0) groups.set('[]', []);
  const result = [...groups.values()].map(rows => {
    const output = Object.fromEntries(dimensions.map(field => [field, rows[0]?.[field]]));
    for (const measure of definition.measures ?? []) {
      output[`${measure.field}_${measure.aggregate}`] = aggregate(rows.map(row => row[measure.field]), measure.aggregate);
    }
    return output;
  });
  for (const sort of [...(definition.sort ?? [])].reverse()) {
    result.sort((left, right) => {
      const comparison = left[sort.field] < right[sort.field] ? -1 : left[sort.field] > right[sort.field] ? 1 : 0;
      return sort.direction === 'desc' ? -comparison : comparison;
    });
  }
  return result.slice(0, definition.limit ?? 100);
}

export function reportRowsFromEnvelope(envelope) {
  const data = envelope?.data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data)) return data;
  return data && typeof data === 'object' ? [data] : [];
}

const periodOf = envelope => envelope?.meta?.observationPeriod?.to;
const unitOf = envelope => String(envelope?.meta?.scopeUnitId);

export function projectReportRows(sourceKey, envelope) {
  const rows = reportRowsFromEnvelope(envelope);
  const period = periodOf(envelope);
  const unitId = unitOf(envelope);
  if (sourceKey === 'brief') {
    return ['activeCaseCount', 'patternCount', 'hotspotCount', 'anomalyCount']
      .filter(metric => Number.isFinite(Number(envelope?.data?.[metric])))
      .map(metric => ({ unitId, metric, value: envelope.data[metric], period }));
  }
  if (sourceKey === 'patterns') return rows.map(row => ({
    patternId: row.id, patternType: row.method, unitId,
    caseCount: (row.evidenceCaseIds?.length ?? 0) + (row.redactedEvidenceCount ?? 0),
    confidence: row.confidence, period,
  }));
  if (sourceKey === 'hotspots') return rows.map(row => ({
    areaId: row.areaId ?? row.id, unitId,
    latitude: row.centroid?.latitude, longitude: row.centroid?.longitude,
    caseCount: row.magnitude, severity: row.confidence, period,
  }));
  if (sourceKey === 'anomalies') return rows.map(row => ({
    anomalyId: row.id, unitId, signalType: row.method,
    observed: row.observed, expected: row.expected, severity: row.confidence, period,
  }));
  if (sourceKey === 'areaRisk') return rows.map(row => ({
    areaId: row.areaId ?? `UNIT-${unitId}`, unitId, areaType: row.scope,
    score: row.score, period,
  }));
  if (sourceKey === 'districtContext') return rows.flatMap(row => Object.entries(row.indicators ?? {}).map(([indicator, value]) => ({
    unitId: String(row.unitId), indicator, value, period: row.period ?? period,
  })));
  if (sourceKey === 'alerts') return rows.map(row => ({
    alertId: row.id, alertType: row.type, state: row.status, unitId: String(row.scopeUnitId),
    severity: row.severity, createdAt: row.createdAt, recordCount: 1,
  }));
  if (sourceKey === 'stationCases') return rows.map(row => ({
    caseId: row.caseId,
    caseNumber: row.caseNumber,
    unitId: row.unitId,
    unitName: row.unitName,
    status: row.status,
    registeredAt: row.registeredAt,
    incidentAt: row.incidentAt,
    majorHead: row.majorHead,
    minorHead: row.minorHead,
    ageDays: row.ageDays,
    ageingBucket: row.ageingBucket,
    isOpen: row.isOpen,
    recordCount: 1,
  }));
  throw new TypeError(`Unsupported report source: ${sourceKey}`);
}

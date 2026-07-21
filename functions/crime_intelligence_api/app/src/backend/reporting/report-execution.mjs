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
const unitOf = envelope => envelope?.meta?.scopeUnitId;

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
    unitId: row.unitId, indicator, value, period: row.period ?? period,
  })));
  if (sourceKey === 'alerts') return rows.map(row => ({
    alertId: row.id, alertType: row.type, state: row.status, unitId: row.scopeUnitId,
    severity: row.severity, createdAt: row.createdAt,
  }));
  throw new TypeError(`Unsupported report source: ${sourceKey}`);
}

import {
  MAX_FEATURES,
  deepFreeze,
  normalizeDatasetDefinition,
  normalizeLayerDefinition,
  normalizeTimeWindow,
  normalizeViewport,
} from './contracts.mjs';

const RUNTIME_KEYS = new Set(['viewport', 'timeWindow', 'limit']);

function plain(value, label) {
  if (value === null || typeof value !== 'object' || (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)) {
    throw new TypeError(`${label} must be a plain object`);
  }
}

function requiredFields(dataset, layer) {
  const fields = new Set(Object.values(dataset.geometry));
  for (const key of ['weightField', 'colorField', 'sizeField', 'labelField']) {
    if (layer[key]) fields.add(layer[key]);
  }
  for (const field of layer.tooltipFields ?? []) fields.add(field);
  const visitFilter = filter => {
    for (const [key, value] of Object.entries(filter)) {
      if (key === '$and' || key === '$or') value.forEach(visitFilter);
      else if (key === '$not') visitFilter(value);
      else fields.add(key);
    }
  };
  visitFilter(layer.filter);
  return [...fields].sort();
}

export function compileLayerExecution({ dataset, layer, runtime }) {
  plain(runtime, 'runtime');
  for (const key of Object.keys(runtime)) {
    if (!RUNTIME_KEYS.has(key)) throw new Error(`runtime.${key} is unknown`);
  }
  const normalizedDataset = normalizeDatasetDefinition(dataset);
  const normalizedLayer = normalizeLayerDefinition(layer, new Map([[normalizedDataset.id, normalizedDataset]]));
  const requestedLimit = runtime.limit ?? normalizedLayer.limit ?? 1000;
  if (!Number.isInteger(requestedLimit) || requestedLimit < 1) throw new Error('runtime.limit must be a positive integer');
  return deepFreeze({
    datasetId: normalizedDataset.id,
    sourceReference: normalizedDataset.sourceReference,
    renderer: normalizedLayer.renderer,
    fields: requiredFields(normalizedDataset, normalizedLayer),
    filter: normalizedLayer.filter,
    viewport: normalizeViewport(runtime.viewport),
    timeWindow: normalizeTimeWindow(runtime.timeWindow),
    limit: Math.min(requestedLimit, MAX_FEATURES),
  });
}

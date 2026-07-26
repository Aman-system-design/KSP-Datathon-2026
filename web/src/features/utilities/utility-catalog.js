const utilityPresentation = Object.freeze({
  network: Object.freeze({ icon: 'network', tone: 'purple' }),
  'map-pin': Object.freeze({ icon: 'map', tone: 'blue' }),
  'chart-no-axes-combined': Object.freeze({ icon: 'intelligence', tone: 'amber' }),
  'scan-search': Object.freeze({ icon: 'utilities', tone: 'green' }),
});

const categoryPresentation = Object.freeze({
  'patterns-networks': 'Patterns & networks',
  'spatial-intelligence': 'Spatial intelligence',
  'trends-anomalies': 'Trends & anomalies',
  'risk-prioritization': 'Risk prioritization',
});

const fallbackPresentation = Object.freeze({ icon: 'utilities', tone: 'blue' });
const lifecycleStages = Object.freeze(['Data', 'Analyze', 'Explain', 'Alert', 'Deliver']);
const inFlightByApi = new WeakMap();

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function normalizeStages(value) {
  if (!Array.isArray(value) || value.length !== lifecycleStages.length) return null;
  const stages = value.map((item, index) => isRecord(item)
    && item.stage === lifecycleStages[index]
    && nonEmptyString(item.label)
    ? { stage: item.stage, label: item.label }
    : null);
  return stages.every(Boolean) ? stages : null;
}

function normalizeCatalogueDefinition(value) {
  if (!isRecord(value)
    || !nonEmptyString(value.key)
    || !nonEmptyString(value.name)
    || !nonEmptyString(value.description)
    || !nonEmptyString(value.category)
    || !nonEmptyString(value.availability)
    || !nonEmptyString(value.icon)) return null;
  const stages = normalizeStages(value.stages);
  return stages ? { ...value, stages } : null;
}

function normalizeStringList(value) {
  return Array.isArray(value) && value.length > 0 && value.every(nonEmptyString) ? [...value] : null;
}

function normalizeAlertPolicy(value) {
  if (!isRecord(value) || typeof value.enabled !== 'boolean' || !isRecord(value.fields)) return null;
  const entries = Object.entries(value.fields);
  if (!entries.every(([name, bounds]) => nonEmptyString(name)
    && isRecord(bounds)
    && (bounds.kind === 'integer' || bounds.kind === 'number')
    && Number.isFinite(bounds.min)
    && Number.isFinite(bounds.max))) return null;
  return { enabled: value.enabled, fields: Object.fromEntries(entries.map(([name, bounds]) => [name, { kind: bounds.kind, min: bounds.min, max: bounds.max }])) };
}

function normalizeUtilityDefinition(value, requestedKey) {
  const base = normalizeCatalogueDefinition(value);
  if (!base || base.key !== requestedKey || !nonEmptyString(value.analyticalMethod)) return null;
  const outputs = normalizeStringList(value.outputs);
  const limitations = normalizeStringList(value.limitations);
  const alertPolicy = normalizeAlertPolicy(value.alertPolicy);
  return outputs && limitations && alertPolicy
    ? { ...base, analyticalMethod: value.analyticalMethod, outputs, limitations, alertPolicy }
    : null;
}

function contractError() {
  return Object.assign(new Error('The utility definition is invalid.'), { code: 'UTILITY_CONTRACT_INVALID' });
}

function loadOnce(api, cacheKey, path, normalize) {
  let requests = inFlightByApi.get(api);
  if (!requests) {
    requests = new Map();
    inFlightByApi.set(api, requests);
  }
  const existing = requests.get(cacheKey);
  if (existing) return existing;

  const pending = Promise.resolve()
    .then(() => api.get(path))
    .then(result => normalize(result?.data));
  requests.set(cacheKey, pending);
  const clear = () => {
    if (requests.get(cacheKey) === pending) requests.delete(cacheKey);
  };
  pending.then(clear, clear);
  return pending;
}

export function loadUtilities(api) {
  return loadOnce(api, 'catalogue', '/v1/utilities', data => Array.isArray(data)
    ? data.map(normalizeCatalogueDefinition).filter(Boolean)
    : []);
}

export function loadUtility(api, key) {
  return loadOnce(api, `utility:${key}`, `/v1/utilities/${encodeURIComponent(key)}`, data => {
    const utility = normalizeUtilityDefinition(data, key);
    if (!utility) throw contractError();
    return utility;
  });
}

export function getUtilityPresentation(icon) {
  return utilityPresentation[icon] ?? fallbackPresentation;
}

export function getCategoryLabel(category) {
  return categoryPresentation[category] ?? category.replaceAll('-', ' ');
}

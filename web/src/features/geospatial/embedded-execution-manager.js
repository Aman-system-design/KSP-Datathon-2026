const BUDGET_CODE = 'EMBEDDED_MAP_BUDGET_EXCEEDED';

function budgetError(message) {
  const error = new Error(message);
  error.code = BUDGET_CODE;
  return error;
}

export function createEmbeddedExecutionManager(api, {
  maxConcurrent = 4, maxLayers = 48, maxFeatures = 10_000,
} = {}) {
  if (!api || typeof api.get !== 'function' || typeof api.post !== 'function') throw new TypeError('api is required');
  if (![maxConcurrent, maxLayers, maxFeatures].every(value => Number.isInteger(value) && value > 0)) {
    throw new TypeError('embedded execution budgets must be positive integers');
  }
  let catalogPromise;
  let active = 0;
  const queue = [];
  const featureCounts = new Map();

  const schedule = operation => new Promise((resolve, reject) => {
    const run = () => {
      active += 1;
      Promise.resolve().then(operation).then(resolve, reject).finally(() => {
        active -= 1;
        queue.shift()?.();
      });
    };
    if (active < maxConcurrent) run(); else queue.push(run);
  });

  function client(scope) {
    if (typeof scope !== 'string' || !scope) throw new TypeError('execution scope is required');
    return Object.freeze({
      get(path) {
        if (path !== '/v1/geospatial/datasets') return api.get(path);
        catalogPromise ??= api.get(path).catch(error => { catalogPromise = undefined; throw error; });
        return catalogPromise;
      },
      async post(path, body) {
        if (path !== '/v1/geospatial/layers/execute') return api.post(path, body);
        const layerId = body?.layer?.id;
        if (typeof layerId !== 'string' || !layerId) throw budgetError('Map layer descriptor is invalid.');
        const key = `${scope}:${layerId}`;
        const existing = featureCounts.has(key);
        if (!existing && featureCounts.size >= maxLayers) {
          throw budgetError('Dashboard map layer budget exceeded.');
        }
        if (!existing) featureCounts.set(key, 0);
        return schedule(async () => {
          try {
            const response = await api.post(path, body);
            const features = response?.data?.features;
            if (!Array.isArray(features)) return response;
            const previous = featureCounts.get(key) ?? 0;
            const total = [...featureCounts.values()].reduce((sum, value) => sum + value, 0) - previous + features.length;
            if (total > maxFeatures) throw budgetError('Dashboard map feature budget exceeded.');
            featureCounts.set(key, features.length);
            return response;
          } catch (error) {
            if (!existing) featureCounts.delete(key);
            throw error;
          }
        });
      },
    });
  }

  function release(scope) {
    for (const key of featureCounts.keys()) if (key.startsWith(`${scope}:`)) featureCounts.delete(key);
  }

  return Object.freeze({ client, release });
}

const BUDGET_CODE = 'EMBEDDED_MAP_BUDGET_EXCEEDED';
const CANCELLATION_CODE = 'EMBEDDED_MAP_EXECUTION_CANCELLED';

function typedError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

const budgetError = message => typedError(BUDGET_CODE, message);
const cancellationError = () => typedError(CANCELLATION_CODE, 'Embedded map execution was cancelled.');

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
  const scopeGenerations = new Map();
  const layerStates = new Map();
  const scopeGeneration = scope => scopeGenerations.get(scope) ?? 0;
  const taskIsCurrent = task => scopeGeneration(task.scope) === task.scopeGeneration
    && layerStates.get(task.key)?.scopeGeneration === task.scopeGeneration
    && layerStates.get(task.key)?.generation === task.layerGeneration;

  function drain() {
    while (active < maxConcurrent && queue.length > 0) {
      const task = queue.shift();
      if (!taskIsCurrent(task)) {
        task.reject(cancellationError());
        continue;
      }
      active += 1;
      Promise.resolve().then(() => {
        if (!taskIsCurrent(task)) throw cancellationError();
        return task.operation();
      }).then(task.resolve, task.reject).finally(() => {
        active -= 1;
        drain();
      });
    }
  }

  function schedule(task) {
    return new Promise((resolve, reject) => {
      queue.push({ ...task, resolve, reject });
      drain();
    });
  }

  function cancelQueued(predicate) {
    for (let index = queue.length - 1; index >= 0; index -= 1) {
      if (!predicate(queue[index])) continue;
      const [task] = queue.splice(index, 1);
      task.reject(cancellationError());
    }
    drain();
  }

  function client(scope) {
    if (typeof scope !== 'string' || !scope) throw new TypeError('execution scope is required');
    const clientScopeGeneration = scopeGeneration(scope);
    const scopeIsCurrent = () => scopeGeneration(scope) === clientScopeGeneration;
    return Object.freeze({
      get(path) {
        if (path !== '/v1/geospatial/datasets') return api.get(path);
        catalogPromise ??= api.get(path).catch(error => { catalogPromise = undefined; throw error; });
        return catalogPromise;
      },
      async post(path, body) {
        if (path !== '/v1/geospatial/layers/execute') return api.post(path, body);
        if (!scopeIsCurrent()) throw cancellationError();
        const layerId = body?.layer?.id;
        if (typeof layerId !== 'string' || !layerId) throw budgetError('Map layer descriptor is invalid.');
        const key = `${scope}:${layerId}`;
        let state = layerStates.get(key);
        if (!state) {
          if (layerStates.size >= maxLayers) throw budgetError('Dashboard map layer budget exceeded.');
          state = { scope, scopeGeneration: clientScopeGeneration, generation: 0, features: 0, accepted: false };
          layerStates.set(key, state);
        }
        state.generation += 1;
        const layerGeneration = state.generation;
        cancelQueued(task => task.key === key && task.layerGeneration < layerGeneration);
        const task = { scope, scopeGeneration: clientScopeGeneration, key, layerGeneration };
        const current = () => scopeIsCurrent() && taskIsCurrent(task);

        try {
          return await schedule({ ...task, operation: async () => {
            if (!current()) throw cancellationError();
            const response = await api.post(path, body);
            if (!current()) throw cancellationError();
            const features = response?.data?.features;
            if (!Array.isArray(features)) return response;
            const total = [...layerStates.values()].reduce((sum, item) => sum + item.features, 0)
              - state.features + features.length;
            if (total > maxFeatures) throw budgetError('Dashboard map feature budget exceeded.');
            if (!current()) throw cancellationError();
            state.features = features.length;
            state.accepted = true;
            return response;
          } });
        } catch (error) {
          const latest = layerStates.get(key);
          if (latest === state && latest.generation === layerGeneration && !latest.accepted) layerStates.delete(key);
          throw error;
        }
      },
    });
  }

  function release(scope) {
    scopeGenerations.set(scope, scopeGeneration(scope) + 1);
    for (const [key, state] of layerStates) if (state.scope === scope) layerStates.delete(key);
    cancelQueued(task => task.scope === scope);
  }

  return Object.freeze({ client, release });
}

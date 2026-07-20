function normalize(value, seen) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('numbers must be finite');
    return value;
  }
  if (typeof value !== 'object') throw new TypeError('unsupported canonical JSON value');
  if (seen.has(value)) throw new TypeError('cyclic canonical JSON value');
  seen.add(value);
  let result;
  if (Array.isArray(value)) {
    result = value.map(item => normalize(item, seen));
  } else {
    result = {};
    for (const key of Object.keys(value).sort()) result[key] = normalize(value[key], seen);
  }
  seen.delete(value);
  return result;
}

export function canonicalStringify(value) {
  return JSON.stringify(normalize(value, new Set()));
}

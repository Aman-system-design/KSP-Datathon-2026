const DEVELOPMENT_API = 'https://kspdatathon2026-60077844198.development.catalystserverless.in/server/crime_intelligence_api';

export function readRuntime(environment = import.meta.env) {
  const apiBase = environment.VITE_API_BASE ?? '/server/crime_intelligence_api';
  const relative = apiBase.startsWith('/') && !apiBase.startsWith('//');
  if (!relative && apiBase !== DEVELOPMENT_API) throw new TypeError('VITE_API_BASE is not an approved Catalyst endpoint');
  return Object.freeze({ apiBase, authOrigin: relative ? '' : new URL(apiBase).origin });
}

const demoPersonas = new Set(['STATE_LEADERSHIP', 'REGIONAL_LEADERSHIP', 'DISTRICT_LEADERSHIP', 'CRIME_ANALYST', 'STATION_OPERATIONS']);

export function readDemoPersona(search = globalThis.location?.search ?? '') {
  const persona = new URLSearchParams(search).get('persona');
  return demoPersonas.has(persona) ? persona : null;
}

export function personaSearch(search, persona) {
  const params = new URLSearchParams(search);
  if (persona) params.set('persona', persona); else params.delete('persona');
  const value = params.toString();
  return value ? `?${value}` : '';
}

export function governedAppLocation(pathname, location = {}, { preserveHash = false } = {}) {
  if (typeof pathname !== 'string' || !pathname.startsWith('/') || pathname.startsWith('//')) {
    throw new TypeError('A relative application pathname is required');
  }
  const persona = readDemoPersona(location.search ?? '');
  return Object.freeze({
    pathname,
    search: persona ? `?persona=${encodeURIComponent(persona)}` : '',
    ...(preserveHash && typeof location.hash === 'string' && location.hash ? { hash: location.hash } : {}),
  });
}

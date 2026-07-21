export function readRuntime(environment = import.meta.env) {
  const apiBase = environment.VITE_API_BASE ?? '/server/crime_intelligence_api';
  if (!apiBase.startsWith('/') || apiBase.startsWith('//')) throw new TypeError('VITE_API_BASE must be a relative application path');
  return Object.freeze({ apiBase });
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

export function readRuntime(environment = import.meta.env) {
  const authOrigin = 'https://kspdatathon2026-60077844198.development.catalystserverless.in';
  const approvedApi = `${authOrigin}/server/crime_intelligence_api`;
  const apiBase = environment.VITE_API_BASE ?? approvedApi;
  if (apiBase !== approvedApi) throw new TypeError('VITE_API_BASE must be the approved Catalyst endpoint');
  return Object.freeze({ apiBase, authOrigin });
}

const demoPersonas = new Set(['COMMAND_CENTER', 'STATE_LEADERSHIP', 'REGIONAL_LEADERSHIP', 'DISTRICT_LEADERSHIP', 'CRIME_ANALYST', 'STATION_OPERATIONS']);

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
  const queryIndex = typeof pathname === 'string' ? pathname.indexOf('?') : -1;
  const applicationPathname = queryIndex >= 0 ? pathname.slice(0, queryIndex) : pathname;
  if (typeof applicationPathname !== 'string' || !applicationPathname.startsWith('/') || applicationPathname.startsWith('//')) {
    throw new TypeError('A relative application pathname is required');
  }
  const explicitPersona = queryIndex >= 0 ? readDemoPersona(pathname.slice(queryIndex)) : null;
  const persona = explicitPersona ?? readDemoPersona(location.search ?? '');
  return Object.freeze({
    pathname: applicationPathname,
    search: persona ? `?persona=${encodeURIComponent(persona)}` : '',
    ...(preserveHash && typeof location.hash === 'string' && location.hash ? { hash: location.hash } : {}),
  });
}

export function readRuntime(environment = import.meta.env) {
  const apiBase = environment.VITE_API_BASE ?? '/server/crime_intelligence_api';
  if (!apiBase.startsWith('/') || apiBase.startsWith('//')) throw new TypeError('VITE_API_BASE must be a relative application path');
  return Object.freeze({ apiBase });
}

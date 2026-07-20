export const API_OPERATIONS = Object.freeze([
  Object.freeze({ method: 'GET', path: '/v1/intelligence/brief', service: 'getBrief' }),
  Object.freeze({ method: 'GET', path: '/v1/patterns', service: 'listPatterns' }),
  Object.freeze({ method: 'GET', path: '/v1/patterns/{patternId}', service: 'getPattern' }),
  Object.freeze({ method: 'GET', path: '/v1/hotspots', service: 'listHotspots' }),
  Object.freeze({ method: 'GET', path: '/v1/anomalies', service: 'listAnomalies' }),
  Object.freeze({ method: 'GET', path: '/v1/area-risk', service: 'getAreaRisk' }),
  Object.freeze({ method: 'GET', path: '/v1/networks/{nodeId}', service: 'getNetwork' }),
  Object.freeze({ method: 'GET', path: '/v1/district-context', service: 'getDistrictContext' }),
  Object.freeze({ method: 'POST', path: '/v1/alerts/{alertId}/acknowledge', commandType: 'ACKNOWLEDGE' }),
  Object.freeze({ method: 'POST', path: '/v1/alerts/{alertId}/assign', commandType: 'ASSIGN' }),
  Object.freeze({ method: 'POST', path: '/v1/alerts/{alertId}/analyst-conclusion', commandType: 'CONCLUDE' }),
  Object.freeze({ method: 'POST', path: '/v1/alerts/{alertId}/outcome', commandType: 'CLOSE' }),
]);

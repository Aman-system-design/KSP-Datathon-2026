import { expect, test } from 'vitest';

import { governedAppLocation, personaSearch, readDemoPersona, readRuntime } from './runtime.js';

const developmentApi = 'https://kspdatathon2026-60077844198.development.catalystserverless.in/server/crime_intelligence_api';

test('Slate runtime uses the approved cross-origin Catalyst Function route', () => {
  expect(readRuntime({})).toEqual({
    apiBase: developmentApi,
    authOrigin: 'https://kspdatathon2026-60077844198.development.catalystserverless.in',
  });
  expect(readRuntime({ VITE_API_BASE: developmentApi }).apiBase).toBe(developmentApi);
  expect(() => readRuntime({ VITE_API_BASE: 'https://example.com/server/crime_intelligence_api' })).toThrow(TypeError);
});

test('persona search preserves other parameters and can return to presenter', () => {
  expect(personaSearch('?review=1', 'CRIME_ANALYST')).toBe('?review=1&persona=CRIME_ANALYST');
  expect(personaSearch('?review=1&persona=CRIME_ANALYST', null)).toBe('?review=1');
  expect(personaSearch('?persona=STATE_LEADERSHIP', null)).toBe('');
});

test('command center is an allowlisted client presentation persona', () => {
  expect(readDemoPersona('?persona=COMMAND_CENTER')).toBe('COMMAND_CENTER');
  expect(readDemoPersona('?persona=REGIONAL_LEADERSHIP')).toBeNull();
  expect(readDemoPersona('?persona=COMMAND%20CENTER')).toBeNull();
  expect(readDemoPersona('?persona=NOT_ALLOWED')).toBeNull();
});

test('governed app links preserve only an allowlisted persona and optionally the hash', () => {
  expect(governedAppLocation('/geospatial', {
    search: '?persona=CRIME_ANALYST&token=unsafe&review=1', hash: '#evidence',
  })).toEqual({ pathname: '/geospatial', search: '?persona=CRIME_ANALYST' });
  expect(governedAppLocation('/geospatial', {
    search: '?persona=NOT_ALLOWED&token=unsafe', hash: '#evidence',
  }, { preserveHash: true })).toEqual({ pathname: '/geospatial', search: '', hash: '#evidence' });
});

test('governed app links separate an explicit persona from the pathname during workspace transitions', () => {
  expect(governedAppLocation('/?persona=COMMAND_CENTER', {
    search: '?persona=STATION_OPERATIONS&token=unsafe',
  })).toEqual({ pathname: '/', search: '?persona=COMMAND_CENTER' });
});

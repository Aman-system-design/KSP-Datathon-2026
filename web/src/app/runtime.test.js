import { expect, test } from 'vitest';

import { governedAppLocation, personaSearch } from './runtime.js';

test('persona search preserves other parameters and can return to presenter', () => {
  expect(personaSearch('?review=1', 'CRIME_ANALYST')).toBe('?review=1&persona=CRIME_ANALYST');
  expect(personaSearch('?review=1&persona=CRIME_ANALYST', null)).toBe('?review=1');
  expect(personaSearch('?persona=STATE_LEADERSHIP', null)).toBe('');
});

test('governed app links preserve only an allowlisted persona and optionally the hash', () => {
  expect(governedAppLocation('/geospatial', {
    search: '?persona=CRIME_ANALYST&token=unsafe&review=1', hash: '#evidence',
  })).toEqual({ pathname: '/geospatial', search: '?persona=CRIME_ANALYST' });
  expect(governedAppLocation('/geospatial', {
    search: '?persona=NOT_ALLOWED&token=unsafe', hash: '#evidence',
  }, { preserveHash: true })).toEqual({ pathname: '/geospatial', search: '', hash: '#evidence' });
});

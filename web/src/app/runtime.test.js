import { expect, test } from 'vitest';

import { personaSearch } from './runtime.js';

test('persona search preserves other parameters and can return to presenter', () => {
  expect(personaSearch('?review=1', 'CRIME_ANALYST')).toBe('?review=1&persona=CRIME_ANALYST');
  expect(personaSearch('?review=1&persona=CRIME_ANALYST', null)).toBe('?review=1');
  expect(personaSearch('?persona=STATE_LEADERSHIP', null)).toBe('');
});

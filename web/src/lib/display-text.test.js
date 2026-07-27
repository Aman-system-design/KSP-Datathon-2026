import { expect, test } from 'vitest';

import { demonstrationLabel } from './display-text.js';

test.each([
  ['Synthetic Bagalkot District', 'Bagalkot District'],
  ['synthetic   Property Crime', 'Property Crime'],
  ['Non-synthetic evidence', 'Non-synthetic evidence'],
  [42, 42],
])('normalizes frontend demonstration label %j', (value, expected) => {
  expect(demonstrationLabel(value)).toBe(expected);
});

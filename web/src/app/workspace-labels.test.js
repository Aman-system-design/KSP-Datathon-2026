import { describe, expect, test } from 'vitest';

import { roleLabel } from './workspace-labels.js';

describe('roleLabel', () => {
  test('uses the product label for the internal presenter role', () => {
    expect(roleLabel('DEMO_PRESENTER')).toBe('KSP Intelligence');
  });

  test('keeps ordinary role labels human-readable', () => {
    expect(roleLabel('CRIME_ANALYST')).toBe('Crime Analyst');
  });
});

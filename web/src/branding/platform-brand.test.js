import { describe, expect, test } from 'vitest';

import { DEFAULT_PLATFORM_BRAND, resolvePlatformBrand } from './platform-brand.js';

describe('platform branding', () => {
  test('provides the approved KSP ACE tenant defaults', () => {
    expect(DEFAULT_PLATFORM_BRAND).toMatchObject({
      productName: 'ACE',
      instanceName: 'KSP ACE',
      organizationName: 'Karnataka State Police',
      organizationShortName: 'KSP',
      productTagline: 'Analytics · Crime · Enforcement',
      showProductTagline: true,
      documentTitle: 'KSP ACE | Karnataka State Police',
    });
  });

  test('accepts known safe overrides and rejects unsafe branding values', () => {
    const brand = resolvePlatformBrand({
      organizationName: ' Telangana State Police ',
      showProductTagline: false,
      primaryLogo: 'javascript:alert(1)',
      compactLogo: 'https://assets.example/police.svg',
      unknown: 'ignored',
    });

    expect(brand.organizationName).toBe('Telangana State Police');
    expect(brand.showProductTagline).toBe(false);
    expect(brand.primaryLogo).toBe(DEFAULT_PLATFORM_BRAND.primaryLogo);
    expect(brand.compactLogo).toBe('https://assets.example/police.svg');
    expect(brand).not.toHaveProperty('unknown');
    expect(Object.isFrozen(brand)).toBe(true);
  });
});

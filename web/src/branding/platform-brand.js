const TEXT_FIELDS = ['productName', 'instanceName', 'organizationName', 'organizationShortName', 'productTagline', 'documentTitle'];
const ASSET_FIELDS = ['primaryLogo', 'compactLogo', 'loadingLogo'];

export const DEFAULT_PLATFORM_BRAND = Object.freeze({
  productName: 'ACE',
  instanceName: 'KSP ACE',
  organizationName: 'Karnataka State Police',
  organizationShortName: 'KSP',
  productTagline: 'Analytics · Crime · Enforcement',
  showProductTagline: true,
  primaryLogo: '/brand/karnataka-state-police.webp',
  compactLogo: '/brand/karnataka-seal.webp',
  loadingLogo: '/brand/karnataka-state-emblem.png',
  documentTitle: 'KSP ACE | Karnataka State Police',
});

const safeAsset = value => typeof value === 'string' && (value.startsWith('/') || /^https:\/\//u.test(value));

export function resolvePlatformBrand(override = {}) {
  const brand = { ...DEFAULT_PLATFORM_BRAND };
  for (const field of TEXT_FIELDS) {
    if (typeof override?.[field] === 'string' && override[field].trim()) brand[field] = override[field].trim();
  }
  for (const field of ASSET_FIELDS) {
    if (safeAsset(override?.[field])) brand[field] = override[field];
  }
  if (typeof override?.showProductTagline === 'boolean') brand.showProductTagline = override.showProductTagline;
  return Object.freeze(brand);
}

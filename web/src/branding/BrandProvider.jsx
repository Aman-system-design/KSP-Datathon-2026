import { createContext, useContext, useEffect, useMemo } from 'react';

import { DEFAULT_PLATFORM_BRAND, resolvePlatformBrand } from './platform-brand.js';

const BrandContext = createContext(DEFAULT_PLATFORM_BRAND);

export function BrandProvider({ children, override }) {
  const brand = useMemo(() => resolvePlatformBrand(override ?? globalThis.__ACE_BRAND__), [override]);
  useEffect(() => { document.title = brand.documentTitle; }, [brand.documentTitle]);
  return <BrandContext.Provider value={brand}>{children}</BrandContext.Provider>;
}

export const usePlatformBrand = () => useContext(BrandContext);

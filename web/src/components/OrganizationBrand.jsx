import { usePlatformBrand } from '../branding/BrandProvider.jsx';

export function OrganizationBrand({ compact = false }) {
  const brand = usePlatformBrand();
  if (compact) return <div className="organization-brand organization-brand--compact">
    <img src={brand.compactLogo} alt={`${brand.organizationName} emblem`} />
    <span>{brand.organizationShortName}</span>
  </div>;

  return <div className="organization-brand">
    <img src={brand.primaryLogo} alt={`${brand.organizationName} emblem`} />
    <span className="organization-brand__copy">
      <strong>{brand.organizationName}</strong>
      {brand.showProductTagline && <small>{brand.productTagline}</small>}
    </span>
  </div>;
}

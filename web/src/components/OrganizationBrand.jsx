export function OrganizationBrand({ compact = false }) {
  if (compact) return <div className="organization-brand organization-brand--compact">
    <img src="/brand/karnataka-seal.webp" alt="Government of Karnataka seal" />
    <span>KSP</span>
  </div>;

  return <div className="organization-brand">
    <img src="/brand/ksp-logo.webp" alt="Karnataka State Police emblem" />
    <span className="organization-brand__copy">
      <strong>KSP Crime Decision Intelligence</strong>
      <small>Karnataka State Police</small>
    </span>
  </div>;
}

import { OrganizationBrand } from '../components/OrganizationBrand.jsx';

export function AccessNotProvisioned({ requestId }) {
  return <main className="auth-screen">
    <section className="auth-card">
      <OrganizationBrand />
      <div className="auth-card__content">
        <span className="eyebrow">Access control</span>
        <h1>Access is not provisioned</h1>
        <p>Your Catalyst account is authenticated, but no active KSP role and geographic scope are assigned. Contact the platform administrator.</p>
        {requestId && <small>Reference: <strong>{requestId}</strong></small>}
        <a className="secondary-button" href="/__catalyst/auth/login">Return to sign in</a>
      </div>
    </section>
  </main>;
}

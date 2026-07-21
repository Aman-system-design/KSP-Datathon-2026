import { OrganizationBrand } from '../components/OrganizationBrand.jsx';

export function SignInRequired({ loginUrl = '/__catalyst/auth/login' }) {
  return <main className="auth-screen">
    <section className="auth-card">
      <OrganizationBrand />
      <div className="auth-card__content">
        <span className="eyebrow">Secure police workspace</span>
        <h1>Sign in to continue</h1>
        <p>Your Catalyst identity determines your authorized role, geographic scope, dashboards, alerts and evidence access.</p>
        <a className="primary-button" href={loginUrl}>Sign in with Catalyst</a>
        <small>Credentials and session security are handled by Catalyst Authentication.</small>
      </div>
    </section>
  </main>;
}

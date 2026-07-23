import { useEffect } from 'react';

import { OrganizationBrand } from '../components/OrganizationBrand.jsx';

export function SignInRequired({ auth }) {
  useEffect(() => { auth.openSignIn(); }, [auth]);

  return <main className="auth-screen">
    <section className="auth-card">
      <OrganizationBrand />
      <div className="auth-card__content">
        <span className="eyebrow">Secure police workspace</span>
        <h1>Opening secure sign in…</h1>
        <p>Authentication is handled by Catalyst on this domain.</p>
        <a href="/login.html">Continue to sign in</a>
      </div>
    </section>
  </main>;
}

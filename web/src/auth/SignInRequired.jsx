import { useEffect, useState } from 'react';

import { OrganizationBrand } from '../components/OrganizationBrand.jsx';

export function SignInRequired({ auth }) {
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    Promise.resolve(auth.embeddedSignIn('loginDivElementId'))
      .catch(() => { if (active) setError('Catalyst sign in is temporarily unavailable.'); });
    return () => { active = false; };
  }, [auth]);

  return <main className="auth-screen">
    <section className="auth-card">
      <OrganizationBrand />
      <div className="auth-card__content">
        <span className="eyebrow">Secure police workspace</span>
        <h1>Sign in to continue</h1>
        <p>Your Catalyst identity determines your authorized role, geographic scope, dashboards, alerts and evidence access.</p>
        <div id="loginDivElementId" aria-label="Catalyst sign in" />
        {error ? <p role="alert">{error}</p> : null}
        <small>Credentials and session security are handled by Catalyst Authentication.</small>
      </div>
    </section>
  </main>;
}

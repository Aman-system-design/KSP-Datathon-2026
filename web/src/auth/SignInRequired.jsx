import { useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { usePlatformBrand } from '../branding/BrandProvider.jsx';

export function SignInRequired({ auth }) {
  const brand = usePlatformBrand();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const host = document.getElementById('catalystLogin');
    if (!host || host.dataset.authMounted === 'true') return undefined;
    host.dataset.authMounted = 'true';
    const normalizeFrame = () => {
      const frame = host.querySelector('iframe');
      if (!frame) return;
      frame.title = `${brand.organizationName} secure sign in`;
      frame.scrolling = 'no';
    };
    const observer = new MutationObserver(normalizeFrame);
    observer.observe(host, { childList: true, subtree: true });
    auth.mountSignIn('catalystLogin', {
      cssUrl: '/auth/catalyst-sign-in-v4.css', serviceUrl: '/',
    }).then(normalizeFrame).catch(() => setFailed(true));
    return () => observer.disconnect();
  }, [auth, brand.organizationName]);

  return <main className="secure-login">
    <div className="secure-login__ambient" aria-hidden="true" />
    <section className="secure-login__shell">
      <aside className="secure-login__identity">
        <img src={brand.primaryLogo} alt={`${brand.organizationName} emblem`} />
        <div>
          <h1>{brand.organizationName}</h1>
          {brand.showProductTagline && <p>{brand.productTagline}</p>}
        </div>
      </aside>
      <div className="secure-login__access">
        <header className="secure-login__access-header">
          <ShieldCheck aria-hidden="true" />
          <span>Secure access protected by Catalyst</span>
        </header>
        <div id="catalystLogin" className="secure-login__catalyst" />
        {failed && <p className="secure-login__error" role="alert">Secure sign in could not be loaded. Refresh the page or contact the platform administrator.</p>}
        <p className="secure-login__managed"><ShieldCheck aria-hidden="true" />Authentication managed by Catalyst</p>
      </div>
    </section>
  </main>;
}

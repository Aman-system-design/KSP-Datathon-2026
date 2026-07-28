import { useEffect, useState } from 'react';
import { Copy, ShieldCheck } from 'lucide-react';
import { usePlatformBrand } from '../branding/BrandProvider.jsx';
import { toCatalystHostedSignInUrl } from './catalyst-hosted-sign-in.js';

const DEMO_EMAIL = 'ksp.tech@zohomail.in';
const DEMO_PASSWORD = 'Mail@2026';

export function SignInRequired({ auth }) {
  const brand = usePlatformBrand();
  const [failed, setFailed] = useState(false);
  const [hostedSignInUrl, setHostedSignInUrl] = useState('');
  const [copiedMessage, setCopiedMessage] = useState('');

  useEffect(() => {
    const host = document.getElementById('catalystLogin');
    if (!host || host.dataset.authMounted === 'true') return undefined;
    host.dataset.authMounted = 'true';
    let active = true;
    let settled = false;
    let discoveryTimeout;

    const discoverHostedUrl = () => {
      if (!active) return false;
      const frame = host.querySelector('iframe');
      if (!frame) return false;

      const hostedUrl = toCatalystHostedSignInUrl(frame.src);
      frame.remove();
      settled = true;
      window.clearTimeout(discoveryTimeout);
      if (!hostedUrl) {
        setFailed(true);
        return true;
      }
      setHostedSignInUrl(hostedUrl);
      return true;
    };

    const observer = new MutationObserver(discoverHostedUrl);
    observer.observe(host, { childList: true, subtree: true });
    discoveryTimeout = window.setTimeout(() => {
      if (active && !settled) setFailed(true);
    }, 5000);
    auth.mountSignIn('catalystLogin', {
      cssUrl: '/auth/catalyst-sign-in-v4.css', serviceUrl: '/',
    }).then(discoverHostedUrl).catch(() => {
      if (active) setFailed(true);
    });
    return () => {
      active = false;
      observer.disconnect();
      window.clearTimeout(discoveryTimeout);
      delete host.dataset.authMounted;
    };
  }, [auth]);

  useEffect(() => {
    if (!copiedMessage) return undefined;
    const timer = window.setTimeout(() => setCopiedMessage(''), 1200);
    return () => window.clearTimeout(timer);
  }, [copiedMessage]);

  const copyCredential = async (value, message) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedMessage(message);
    } catch {
      setCopiedMessage('Copy unavailable — select the value manually');
    }
  };

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
        <div id="catalystLogin" className="secure-login__catalyst-discovery" aria-hidden="true" />
        {!failed && !hostedSignInUrl && <p className="secure-login__auth-loading" role="status">Preparing secure sign in…</p>}
        {hostedSignInUrl && <a className="secure-login__auth-link" href={hostedSignInUrl}>Continue to secure sign in</a>}
        {failed && <p className="secure-login__error" role="alert">Secure sign in could not be loaded. Refresh the page or contact the platform administrator.</p>}
        <aside className="secure-login__demo" aria-label="Demo access credentials">
          <div className="secure-login__demo-heading">
            <strong>Demo access for judges</strong><span>Demo</span>
          </div>
          <div className="secure-login__demo-row">
            <span>Email</span><code>{DEMO_EMAIL}</code>
            <button type="button" aria-label="Copy demo email" onClick={() => copyCredential(DEMO_EMAIL, 'Email copied')}>
              <Copy aria-hidden="true" />
            </button>
          </div>
          <div className="secure-login__demo-row">
            <span>Password</span><code>{DEMO_PASSWORD}</code>
            <button type="button" aria-label="Copy demo password" onClick={() => copyCredential(DEMO_PASSWORD, 'Password copied')}>
              <Copy aria-hidden="true" />
            </button>
          </div>
          <small>For evaluation use only.</small>
          <p className="secure-login__copy-status" role="status" aria-live="polite">{copiedMessage}</p>
        </aside>
        <p className="secure-login__managed"><ShieldCheck aria-hidden="true" />Authentication managed by Catalyst</p>
      </div>
    </section>
  </main>;
}

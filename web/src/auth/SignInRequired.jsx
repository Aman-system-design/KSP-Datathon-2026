import { useEffect, useState } from 'react';
import { Copy, ShieldCheck } from 'lucide-react';
import { usePlatformBrand } from '../branding/BrandProvider.jsx';
import { applyCatalystFrameHeight } from './catalyst-frame-height.js';
import { normalizeCatalystSignInFrame } from './catalyst-sign-in-frame.js';

const DEMO_EMAIL = 'ksp.tech@zohomail.in';
const DEMO_PASSWORD = 'Mail@2026';

export function SignInRequired({ auth }) {
  const brand = usePlatformBrand();
  const [failed, setFailed] = useState(false);
  const [copiedMessage, setCopiedMessage] = useState('');

  useEffect(() => {
    const host = document.getElementById('catalystLogin');
    if (!host || host.dataset.authMounted === 'true') return undefined;
    host.dataset.authMounted = 'true';
    const frameCleanups = new Map();

    const bindFrame = (frame) => {
      if (frameCleanups.has(frame)) return;

      const syncHeight = () => applyCatalystFrameHeight(host, frame);
      let contentObserver;
      let resizeObserver;

      const observeContent = () => {
        contentObserver?.disconnect();
        resizeObserver?.disconnect();
        syncHeight();

        try {
          const root = frame.contentDocument?.documentElement;
          if (!root) return;

          contentObserver = new MutationObserver(syncHeight);
          contentObserver.observe(root, { childList: true, subtree: true, attributes: true });
          if (typeof ResizeObserver === 'function') {
            resizeObserver = new ResizeObserver(syncHeight);
            resizeObserver.observe(root);
          }
        } catch {
          syncHeight();
        }
      };

      frame.addEventListener('load', observeContent);
      observeContent();
      frameCleanups.set(frame, () => {
        frame.removeEventListener('load', observeContent);
        contentObserver?.disconnect();
        resizeObserver?.disconnect();
      });
    };

    const normalizeFrame = () => {
      const frame = host.querySelector('iframe');
      if (!frame) return;
      frame.title = `${brand.organizationName} secure sign in`;
      frame.scrolling = 'no';
      normalizeCatalystSignInFrame(frame);
      bindFrame(frame);
    };
    const observer = new MutationObserver(normalizeFrame);
    observer.observe(host, { childList: true, subtree: true });
    auth.mountSignIn('catalystLogin', {
      cssUrl: '/auth/catalyst-sign-in-v4.css', serviceUrl: '/',
    }).then(normalizeFrame).catch(() => setFailed(true));
    return () => {
      observer.disconnect();
      frameCleanups.forEach(cleanupFrame => cleanupFrame());
      frameCleanups.clear();
    };
  }, [auth, brand.organizationName]);

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
        <div id="catalystLogin" className="secure-login__catalyst" />
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
          <p className="secure-login__managed"><ShieldCheck aria-hidden="true" />Authentication managed by Catalyst</p>
        </aside>
      </div>
    </section>
  </main>;
}

import { useEffect, useState } from 'react';
import { Copy, ShieldCheck } from 'lucide-react';
import { usePlatformBrand } from '../branding/BrandProvider.jsx';
import { applyCatalystFrameHeight } from './catalyst-frame-height.js';

const DEMO_EMAIL = 'ksp.tech@zohomail.in';
const DEMO_PASSWORD = 'Mail@2026';

export function SignInRequired({ auth }) {
  const brand = usePlatformBrand();
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [copiedMessage, setCopiedMessage] = useState('');

  useEffect(() => {
    const host = document.getElementById('catalystLogin');
    if (!host || host.dataset.authMounted === 'true') return undefined;
    host.dataset.authMounted = 'true';
    let active = true;
    let loaded = false;
    let boundFrame;
    let frameCleanup = () => {};

    setFailed(false);
    setReady(false);

    const discoveryTimeout = window.setTimeout(() => {
      if (active && !loaded) setFailed(true);
    }, 5000);

    const bindFrame = frame => {
      if (frame === boundFrame) return;
      frameCleanup();
      boundFrame = frame;
      frame.title = `${brand.organizationName} secure sign in`;
      frame.setAttribute('scrolling', 'no');

      let documentObserver;
      let resizeObserver;
      const syncHeight = () => applyCatalystFrameHeight(host, frame);
      const observeDocument = () => {
        documentObserver?.disconnect();
        resizeObserver?.disconnect();
        try {
          const frameDocument = frame.contentDocument;
          if (!frameDocument) return;
          documentObserver = new MutationObserver(syncHeight);
          documentObserver.observe(frameDocument.documentElement, {
            childList: true, subtree: true, attributes: true,
          });
          if (typeof ResizeObserver === 'function' && frameDocument.body) {
            resizeObserver = new ResizeObserver(syncHeight);
            resizeObserver.observe(frameDocument.body);
          }
        } catch {
          // Cross-origin Catalyst content remains usable with the fallback height.
        }
      };
      const onLoad = () => {
        if (!active) return;
        loaded = true;
        window.clearTimeout(discoveryTimeout);
        syncHeight();
        observeDocument();
        setFailed(false);
        setReady(true);
      };

      frame.addEventListener('load', onLoad);
      syncHeight();
      frameCleanup = () => {
        frame.removeEventListener('load', onLoad);
        documentObserver?.disconnect();
        resizeObserver?.disconnect();
        boundFrame = undefined;
      };
    };

    const discoverFrame = () => {
      if (!active) return;
      const frame = host.querySelector('iframe');
      if (frame) bindFrame(frame);
    };

    const observer = new MutationObserver(discoverFrame);
    observer.observe(host, { childList: true, subtree: true });

    Promise.resolve(auth.mountSignIn('catalystLogin', {
      cssUrl: '/auth/catalyst-sign-in-v4.css', serviceUrl: '/',
    })).then(discoverFrame).catch(() => {
      if (active) setFailed(true);
    });

    return () => {
      active = false;
      observer.disconnect();
      frameCleanup();
      window.clearTimeout(discoveryTimeout);
      delete host.dataset.authMounted;
    };
  }, [attempt, auth, brand.organizationName]);

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

  const retrySignIn = () => {
    document.getElementById('catalystLogin')?.replaceChildren();
    setFailed(false);
    setReady(false);
    setAttempt(value => value + 1);
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
        {!failed && !ready && <p className="secure-login__auth-loading" role="status">Preparing secure sign in…</p>}
        {failed && <div className="secure-login__auth-failure">
          <p className="secure-login__error" role="alert">Secure sign in could not be loaded.</p>
          <button className="secure-login__retry" type="button" onClick={retrySignIn}>Refresh sign in</button>
        </div>}
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

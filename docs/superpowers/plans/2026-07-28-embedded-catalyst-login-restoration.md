# Embedded Catalyst Login Restoration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore the Catalyst-owned Email, Next, and Password flow inside the branded ACE login page, with an in-page retry if the SDK form fails to load.

**Architecture:** `SignInRequired` will retain the SDK iframe instead of translating it into a hosted Zoho Portal link. The component will observe the iframe, wait for its load event, reuse the existing bounded height helper, and expose an explicit retry that performs one fresh SDK mount per click; authenticated routing and every persona/dashboard remain unchanged.

**Tech Stack:** React 18, Catalyst Web SDK, Vitest, Testing Library, CSS, Vite

---

## File map

- Modify `web/src/auth/SignInRequired.jsx`: embedded iframe lifecycle, five-second failure state, and same-page retry.
- Modify `web/src/auth/SignInRequired.test.jsx`: embedded, sizing, timeout, retry, credentials, and layout regression tests.
- Modify `web/src/styles/app.css`: visible iframe host plus compact loading, error, and retry presentation.
- Reuse unchanged `web/src/auth/catalyst-frame-height.js`: bounded iframe measurement and CSS custom-property synchronization.
- Keep unchanged `web/public/auth/catalyst-sign-in-v4.css`: Catalyst-owned form customization.

### Task 1: Specify the embedded SDK lifecycle with failing tests

**Files:**
- Modify: `web/src/auth/SignInRequired.test.jsx`
- Test: `web/src/auth/SignInRequired.test.jsx`

- [ ] **Step 1: Replace hosted-link test scaffolding with an embedded-frame helper**

Import `waitFor`, retain `StrictMode`, and replace `hostedAuth` with:

```jsx
const embeddedAuth = source => ({
  mountSignIn: vi.fn(async elementId => {
    const frame = document.createElement('iframe');
    frame.src = source;
    document.getElementById(elementId).append(frame);
  }),
});
```

- [ ] **Step 2: Write the failing embedded-frame test**

```jsx
test('keeps the Catalyst sign-in iframe embedded and sizes it after load', async () => {
  const source = `${window.location.origin}/accounts/p/70/signin`;
  const auth = embeddedAuth(source);

  render(<SignInRequired auth={auth} />);

  const frame = await waitFor(() => document.querySelector('#catalystLogin iframe'));
  fireEvent.load(frame);
  expect(frame).toHaveAttribute('src', source);
  expect(frame).toHaveAttribute('title', 'Karnataka State Police secure sign in');
  expect(frame).toHaveAttribute('scrolling', 'no');
  expect(document.getElementById('catalystLogin')).toHaveStyle('--catalyst-frame-height: 360px');
  expect(screen.queryByRole('link', { name: 'Continue to secure sign in' })).not.toBeInTheDocument();
  expect(screen.queryByText('Preparing secure sign in…')).not.toBeInTheDocument();
});
```

- [ ] **Step 3: Write the failing timeout and retry tests**

```jsx
test('shows a bounded same-page retry when Catalyst creates no iframe', async () => {
  vi.useFakeTimers();
  render(<SignInRequired auth={{ mountSignIn: vi.fn(async () => {}) }} />);

  await act(async () => vi.advanceTimersByTimeAsync(5000));
  expect(screen.getByRole('alert')).toHaveTextContent('Secure sign in could not be loaded');
  expect(screen.getByRole('button', { name: 'Refresh sign in' })).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: /secure sign in/i })).not.toBeInTheDocument();
});

test('performs one fresh SDK mount and clears the error after a successful retry', async () => {
  vi.useFakeTimers();
  const auth = {
    mountSignIn: vi.fn(async elementId => {
      if (auth.mountSignIn.mock.calls.length !== 2) return;
      const frame = document.createElement('iframe');
      frame.src = `${window.location.origin}/accounts/p/70/signin`;
      document.getElementById(elementId).append(frame);
    }),
  };
  render(<SignInRequired auth={auth} />);
  await act(async () => vi.advanceTimersByTimeAsync(5000));

  fireEvent.click(screen.getByRole('button', { name: 'Refresh sign in' }));
  const frame = await waitFor(() => document.querySelector('#catalystLogin iframe'));
  fireEvent.load(frame);

  expect(auth.mountSignIn).toHaveBeenCalledTimes(2);
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Refresh sign in' })).not.toBeInTheDocument();
  expect(frame).toBeInTheDocument();
});
```

- [ ] **Step 4: Replace the hosted-link CSS assertion with embedded/retry assertions**

```jsx
test('keeps the embedded form and retry inside the premium access column', () => {
  const css = readFileSync('src/styles/app.css', 'utf8');
  expect(css).toMatch(/\.secure-login__catalyst\s*{[^}]*height:\s*var\(--catalyst-frame-height,\s*360px\)[^}]*overflow:\s*hidden/s);
  expect(css).toMatch(/\.secure-login__catalyst iframe\s*{[^}]*width:\s*100%!important[^}]*border:\s*0!important/s);
  expect(css).toMatch(/\.secure-login__retry\s*{[^}]*min-height:\s*44px[^}]*border-radius:\s*12px/s);
  expect(css).toMatch(/\.secure-login__managed\s*{[^}]*border-top:/s);
});
```

Delete tests asserting URL conversion, unsafe hosted URLs, hidden discovery CSS, and the hosted action. Retain credential-copy, Catalyst footer, responsive shell, iframe-CSS, and Strict Mode regression coverage.

- [ ] **Step 5: Run the focused test and confirm the new expectations fail**

Run from `web`:

```powershell
npm.cmd test -- src/auth/SignInRequired.test.jsx --reporter=verbose
```

Expected: failures for retained iframe, title/scrolling/height, `Refresh sign in`, and new CSS selectors because the current component removes the iframe and renders a hosted link.

- [ ] **Step 6: Commit the red tests**

```powershell
git add web/src/auth/SignInRequired.test.jsx
git commit -m "test: specify embedded Catalyst login retry"
```

### Task 2: Implement the embedded frame and explicit retry

**Files:**
- Modify: `web/src/auth/SignInRequired.jsx`
- Modify: `web/src/styles/app.css`
- Test: `web/src/auth/SignInRequired.test.jsx`

- [ ] **Step 1: Replace hosted URL state with ready and attempt state**

Remove the `toCatalystHostedSignInUrl` import and use:

```jsx
import { applyCatalystFrameHeight } from './catalyst-frame-height.js';

const [failed, setFailed] = useState(false);
const [ready, setReady] = useState(false);
const [attempt, setAttempt] = useState(0);
```

- [ ] **Step 2: Replace the sign-in effect with a bounded embedded-frame lifecycle**

Use this effect in `SignInRequired`:

```jsx
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

  const timeout = window.setTimeout(() => {
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
        documentObserver.observe(frameDocument.documentElement, { childList: true, subtree: true, attributes: true });
        if (typeof ResizeObserver === 'function' && frameDocument.body) {
          resizeObserver = new ResizeObserver(syncHeight);
          resizeObserver.observe(frameDocument.body);
        }
      } catch {
        // Cross-origin Catalyst content is still usable; fallback sizing is applied below.
      }
    };
    const onLoad = () => {
      if (!active) return;
      loaded = true;
      window.clearTimeout(timeout);
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
    window.clearTimeout(timeout);
    delete host.dataset.authMounted;
  };
}, [attempt, auth, brand.organizationName]);
```

- [ ] **Step 3: Add the explicit same-page retry and render states**

Add:

```jsx
const retrySignIn = () => {
  document.getElementById('catalystLogin')?.replaceChildren();
  setFailed(false);
  setReady(false);
  setAttempt(value => value + 1);
};
```

Replace the hidden host/link/error region with:

```jsx
<div id="catalystLogin" className="secure-login__catalyst" />
{!failed && !ready && <p className="secure-login__auth-loading" role="status">Preparing secure sign in…</p>}
{failed && <div className="secure-login__auth-failure">
  <p className="secure-login__error" role="alert">Secure sign in could not be loaded.</p>
  <button className="secure-login__retry" type="button" onClick={retrySignIn}>Refresh sign in</button>
</div>}
```

Do not add a hosted-link fallback and do not touch the demo card, copy handlers, footer, routing, persona code, or backend.

- [ ] **Step 4: Replace discovery/link CSS with visible iframe and retry CSS**

In `web/src/styles/app.css`, remove `.secure-login__catalyst-discovery` and `.secure-login__auth-link` rules and add:

```css
.secure-login__catalyst {
  width: 100%;
  height: var(--catalyst-frame-height, 360px);
  overflow: hidden;
}

.secure-login__catalyst iframe {
  display: block;
  width: 100%!important;
  height: var(--catalyst-frame-height, 360px)!important;
  border: 0!important;
}

.secure-login__auth-failure {
  display: grid;
  justify-items: center;
  gap: 12px;
  padding: 24px 0;
}

.secure-login__retry {
  min-height: 44px;
  padding: 0 22px;
  border: 1px solid #a9cbe8;
  border-radius: 12px;
  background: #fff;
  color: #0b5fa5;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}

.secure-login__retry:hover,
.secure-login__retry:focus-visible {
  background: #edf6fd;
}
```

- [ ] **Step 5: Run focused tests and fix only lifecycle defects**

Run from `web`:

```powershell
npm.cmd test -- src/auth/SignInRequired.test.jsx src/auth/catalyst-frame-height.test.js --reporter=verbose
```

Expected: all tests pass; the embedded iframe remains under `#catalystLogin`, one explicit retry adds exactly one mount call, and credentials/footer assertions remain green.

- [ ] **Step 6: Commit the implementation**

```powershell
git add web/src/auth/SignInRequired.jsx web/src/styles/app.css
git commit -m "fix: restore embedded Catalyst login"
```

### Task 3: Regression verification and Development-only release

**Files:**
- Verify only; no Production configuration changes.

- [ ] **Step 1: Run the authentication and routing regression set**

Run from `web`:

```powershell
npm.cmd test -- src/auth/SignInRequired.test.jsx src/auth/catalyst-frame-height.test.js src/auth/catalyst-auth.test.js src/app/router.test.jsx --reporter=verbose
```

Expected: every selected test passes with no hosted-link assertion remaining.

- [ ] **Step 2: Run the complete frontend suite**

```powershell
npm.cmd test
```

Expected: all test files and tests pass; in particular persona switching and dashboard/report suites stay green.

- [ ] **Step 3: Build the deployable bundle**

```powershell
npm.cmd run build
```

Expected: Vite exits 0 and writes the production bundle without unresolved imports or chunk errors.

- [ ] **Step 4: Record the Production asset before deploying Development**

Use a read-only request to `https://acep.onslate.in/` and record its `/assets/index-*.js` value. This baseline must remain identical after Development deployment.

- [ ] **Step 5: Deploy only the Catalyst Development client**

Run the repository's established Catalyst Development deployment command from the isolated worktree. Do not migrate or deploy Production resources, environment variables, functions, or client assets.

Expected: deployment succeeds and `https://ace.onslate.in/` serves the new frontend asset.

- [ ] **Step 6: Verify the live embedded flow in the browser**

On `https://ace.onslate.in/` in a signed-out session:

1. Confirm there is no `Continue to secure sign in` link.
2. Confirm Email, Next, Forgot Password, demo credentials, copy buttons, divider, and gold Catalyst footer are visible together inside the branded page.
3. Enter the displayed demo email and click Next; confirm the Password stage remains inside the same ACE page.
4. Enter the displayed demo password and submit; confirm Catalyst returns to the authenticated ACE application.
5. Switch between Command Center, State Leadership, District Leadership, and Station Operations; confirm no blank page.
6. Confirm dashboard/report content is unchanged.

- [ ] **Step 7: Recheck Production isolation**

Request `https://acep.onslate.in/` again and confirm its asset filename matches Step 4. Do not authenticate or mutate Production.

- [ ] **Step 8: Commit any verification-only test adjustment, then report evidence**

If no files changed, create no empty commit. Report focused-test, full-suite, build, live Development login, persona-switch, and Production-isolation results with exact pass/fail evidence.

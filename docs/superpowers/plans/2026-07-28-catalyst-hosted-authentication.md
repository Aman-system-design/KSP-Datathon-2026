# Catalyst Hosted Authentication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the broken same-origin Catalyst iframe login on `ace.onslate.in` with a safe same-tab handoff to Catalyst hosted authentication while preserving the branded login page.

**Architecture:** Continue using the official Catalyst Web SDK to generate the project-specific sign-in URL, but mount it only in a visually hidden discovery host. A focused URL helper accepts only the application origin's `/accounts/p/` URL, changes only its origin to `https://accounts.zohoportal.in`, and exposes it through a normal same-tab link; React never handles credentials or tokens.

**Tech Stack:** React 19, Catalyst Web SDK 4.6.2, Vitest, Testing Library, CSS.

---

## File map

- Create `web/src/auth/catalyst-hosted-sign-in.js`: strict conversion of an SDK-generated same-origin account URL into the hosted Catalyst URL.
- Create `web/src/auth/catalyst-hosted-sign-in.test.js`: allow-list and query-preservation tests for the converter.
- Modify `web/src/auth/SignInRequired.jsx`: discover the official URL, suppress the iframe, and render loading, link, or error states.
- Modify `web/src/auth/SignInRequired.test.jsx`: replace iframe-height expectations with hosted-handoff behavior and preserve branding/demo/footer regressions.
- Modify `web/src/styles/app.css`: visually hide discovery infrastructure and style the compact hosted-authentication action without changing the shell.

### Task 1: Strict hosted URL conversion

**Files:**
- Create: `web/src/auth/catalyst-hosted-sign-in.js`
- Create: `web/src/auth/catalyst-hosted-sign-in.test.js`

- [ ] **Step 1: Write failing converter tests**

```js
import { expect, test } from 'vitest';
import { toCatalystHostedSignInUrl } from './catalyst-hosted-sign-in.js';

test('moves only an SDK-generated account URL to the Catalyst auth origin', () => {
  const source = 'https://ace.onslate.in/accounts/p/70-50043872568/signin?service_url=%2F__catalyst%2Fauth%2Fsignin-redirect&css_url=%2Fauth%2Fcatalyst.css';
  expect(toCatalystHostedSignInUrl(source, { applicationOrigin: 'https://ace.onslate.in' })).toBe(
    'https://accounts.zohoportal.in/accounts/p/70-50043872568/signin?service_url=%2F__catalyst%2Fauth%2Fsignin-redirect&css_url=%2Fauth%2Fcatalyst.css',
  );
});

test.each([
  'https://evil.example/accounts/p/70/signin',
  'https://ace.onslate.in/reports',
  'javascript:alert(1)',
])('rejects a non-Catalyst discovery URL: %s', source => {
  expect(toCatalystHostedSignInUrl(source, { applicationOrigin: 'https://ace.onslate.in' })).toBeNull();
});
```

- [ ] **Step 2: Run the new test and verify it fails**

Run: `npm.cmd test -- --run src/auth/catalyst-hosted-sign-in.test.js`

Expected: FAIL because `catalyst-hosted-sign-in.js` does not exist.

- [ ] **Step 3: Implement the minimal strict converter**

```js
export const CATALYST_AUTH_ORIGIN = 'https://accounts.zohoportal.in';

export function toCatalystHostedSignInUrl(source, {
  applicationOrigin = globalThis.location?.origin,
  authOrigin = CATALYST_AUTH_ORIGIN,
} = {}) {
  try {
    const url = new URL(source);
    if (url.origin !== applicationOrigin || !url.pathname.startsWith('/accounts/p/')) return null;
    const destination = new URL(authOrigin);
    url.protocol = destination.protocol;
    url.hostname = destination.hostname;
    url.port = destination.port;
    return url.href;
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run the converter tests and verify they pass**

Run: `npm.cmd test -- --run src/auth/catalyst-hosted-sign-in.test.js`

Expected: 4 tests PASS.

- [ ] **Step 5: Commit the converter**

```powershell
git add -- web/src/auth/catalyst-hosted-sign-in.js web/src/auth/catalyst-hosted-sign-in.test.js
git commit -m "fix: validate Catalyst hosted sign-in URLs"
```

### Task 2: Replace the visible iframe with the hosted handoff

**Files:**
- Modify: `web/src/auth/SignInRequired.jsx`
- Modify: `web/src/auth/SignInRequired.test.jsx`

- [ ] **Step 1: Replace iframe behavior tests with failing hosted-handoff tests**

Add an auth fixture which appends the SDK iframe:

```jsx
const hostedAuth = source => ({
  mountSignIn: vi.fn(async elementId => {
    const frame = document.createElement('iframe');
    frame.src = source;
    document.getElementById(elementId).append(frame);
  }),
});
```

Replace the adaptive-height and visible-iframe tests with:

```jsx
test('offers the official Catalyst hosted sign in without displaying its iframe', async () => {
  const source = `${window.location.origin}/accounts/p/70-50043872568/signin?service_url=%2F__catalyst%2Fauth%2Fsignin-redirect&css_url=%2Fauth%2Fcatalyst-sign-in-v4.css`;
  const auth = hostedAuth(source);
  render(<SignInRequired auth={auth} />);

  const link = await screen.findByRole('link', { name: 'Continue to secure sign in' });
  expect(link).toHaveAttribute('href', source.replace(window.location.origin, 'https://accounts.zohoportal.in'));
  expect(link).not.toHaveAttribute('target');
  expect(document.querySelector('#catalystLogin iframe')).toBeNull();
  expect(auth.mountSignIn).toHaveBeenCalledWith('catalystLogin', {
    cssUrl: '/auth/catalyst-sign-in-v4.css', serviceUrl: '/',
  });
});

test('keeps the sign-in action unavailable when the SDK emits an unsafe URL', async () => {
  render(<SignInRequired auth={hostedAuth('https://evil.example/accounts/p/70/signin')} />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Secure sign in could not be loaded');
  expect(screen.queryByRole('link', { name: 'Continue to secure sign in' })).not.toBeInTheDocument();
});

test('reports a bounded error when Catalyst does not create a sign-in URL', async () => {
  vi.useFakeTimers();
  render(<SignInRequired auth={{ mountSignIn: vi.fn(async () => {}) }} />);
  expect(screen.getByText('Preparing secure sign in…')).toBeInTheDocument();
  await act(async () => vi.advanceTimersByTimeAsync(5000));
  expect(screen.getByRole('alert')).toHaveTextContent('Secure sign in could not be loaded');
});
```

Retain the demo-copy, shell, mobile, emblem and premium footer tests. Remove tests specific to `--catalyst-frame-height`, iframe load listeners, and embedded Catalyst form CSS.

- [ ] **Step 2: Run the component test and verify the new tests fail**

Run: `npm.cmd test -- --run src/auth/SignInRequired.test.jsx`

Expected: FAIL because the component still displays the iframe and has no hosted link.

- [ ] **Step 3: Implement URL discovery and the same-tab link**

In `SignInRequired.jsx`, replace the frame-height import with:

```jsx
import { toCatalystHostedSignInUrl } from './catalyst-hosted-sign-in.js';
```

Add state:

```jsx
const [hostedSignInUrl, setHostedSignInUrl] = useState('');
```

Replace the iframe measurement effect with this bounded discovery effect:

```jsx
useEffect(() => {
  const host = document.getElementById('catalystLogin');
  if (!host || host.dataset.authMounted === 'true') return undefined;
  host.dataset.authMounted = 'true';
  let settled = false;

  const discover = () => {
    const frame = host.querySelector('iframe');
    if (!frame) return false;
    const hostedUrl = toCatalystHostedSignInUrl(frame.src);
    frame.remove();
    settled = true;
    if (!hostedUrl) {
      setFailed(true);
      return true;
    }
    setHostedSignInUrl(hostedUrl);
    return true;
  };

  const observer = new MutationObserver(discover);
  observer.observe(host, { childList: true, subtree: true });
  const timeout = window.setTimeout(() => {
    if (!settled) setFailed(true);
  }, 5000);
  auth.mountSignIn('catalystLogin', {
    cssUrl: '/auth/catalyst-sign-in-v4.css', serviceUrl: '/',
  }).then(discover).catch(() => setFailed(true));

  return () => {
    observer.disconnect();
    window.clearTimeout(timeout);
  };
}, [auth]);
```

Render the discovery host and visible state:

```jsx
<div id="catalystLogin" className="secure-login__catalyst-discovery" aria-hidden="true" />
{!failed && !hostedSignInUrl && <p className="secure-login__auth-loading" role="status">Preparing secure sign in…</p>}
{hostedSignInUrl && <a className="secure-login__auth-link" href={hostedSignInUrl}>Continue to secure sign in</a>}
{failed && <p className="secure-login__error" role="alert">Secure sign in could not be loaded. Refresh the page or contact the platform administrator.</p>}
```

- [ ] **Step 4: Run component and auth tests**

Run: `npm.cmd test -- --run src/auth/SignInRequired.test.jsx src/auth/catalyst-auth.test.js src/auth/catalyst-hosted-sign-in.test.js`

Expected: all tests PASS; no iframe remains in the rendered login page.

- [ ] **Step 5: Commit the hosted handoff**

```powershell
git add -- web/src/auth/SignInRequired.jsx web/src/auth/SignInRequired.test.jsx
git commit -m "fix: hand off sign in to Catalyst hosted authentication"
```

### Task 3: Fit the hosted action into the existing premium login shell

**Files:**
- Modify: `web/src/styles/app.css`
- Test: `web/src/auth/SignInRequired.test.jsx`

- [ ] **Step 1: Add failing CSS contract assertions**

```js
test('keeps URL discovery hidden and the hosted action inside the premium access column', () => {
  const css = readFileSync('src/styles/app.css', 'utf8');
  expect(css).toMatch(/\.secure-login__catalyst-discovery\s*{[^}]*position:\s*absolute[^}]*width:\s*1px[^}]*height:\s*1px[^}]*overflow:\s*hidden/s);
  expect(css).toMatch(/\.secure-login__auth-link\s*{[^}]*display:\s*grid[^}]*min-height:\s*48px[^}]*border-radius:\s*12px/s);
  expect(css).toMatch(/\.secure-login__managed\s*{[^}]*border-top:/s);
}
```

- [ ] **Step 2: Run the CSS contract test and verify it fails**

Run: `npm.cmd test -- --run src/auth/SignInRequired.test.jsx`

Expected: FAIL because hosted-action selectors do not exist.

- [ ] **Step 3: Replace only the embedded-frame CSS**

Replace `.secure-login__catalyst` rules with:

```css
.secure-login__catalyst-discovery { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
.secure-login__auth-loading { min-height: 48px; display: grid; place-items: center; margin: 0; color: #60748a; font-size: 13px; }
.secure-login__auth-link { min-height: 48px; display: grid; place-items: center; padding: 0 20px; color: #fff; background: linear-gradient(180deg, #2b83c4, #176eae); border: 1px solid #1769aa; border-radius: 12px; box-shadow: 0 8px 18px rgb(23 105 170 / 16%); font-size: 14px; font-weight: 700; text-align: center; text-decoration: none; }
.secure-login__auth-link:hover { background: linear-gradient(180deg, #277bb8, #12639f); }
.secure-login__auth-link:focus-visible { outline: 3px solid #58bff4; outline-offset: 3px; }
```

Remove the negative desktop margin from `.secure-login__demo` and use `margin-top: 16px`; retain its existing mobile margin. Do not change `.secure-login__shell`, `.secure-login__identity`, `.secure-login__managed`, persona, dashboard, or workspace selectors.

- [ ] **Step 4: Run login regressions and production build**

Run: `npm.cmd test -- --run src/auth src/styles/viewport-layout.test.js`

Expected: all relevant auth and viewport tests PASS.

Run: `npm.cmd run build`

Expected: Vite exits 0 and emits `dist/` assets.

- [ ] **Step 5: Commit the isolated visual integration**

```powershell
git add -- web/src/styles/app.css web/src/auth/SignInRequired.test.jsx
git commit -m "style: fit hosted authentication into login shell"
```

### Task 4: Browser verification before any deployment

**Files:**
- No source changes expected.

- [ ] **Step 1: Start the isolated frontend**

Run: `npm.cmd run dev -- --host 127.0.0.1`

Expected: Vite prints a localhost URL and remains running.

- [ ] **Step 2: Verify the unauthenticated login page**

Open the local URL and confirm:

```text
KSP emblem and organization name are visible.
Demo access card and both copy buttons are visible.
Gold shield attribution remains below its divider.
No iframe or broken grey surface is visible.
Continue to secure sign in is visible and points to accounts.zohoportal.in.
```

- [ ] **Step 3: Verify hosted sign-in return in the live candidate**

After deploying only with explicit approval, click `Continue to secure sign in`, authenticate with the demo account on the Catalyst-hosted page, and confirm the browser returns to the unchanged ACE root and shows the workspace selector.

- [ ] **Step 4: Verify scope and repository state**

Run: `git diff origin/main -- web/src/auth web/src/styles/app.css docs/superpowers`

Expected: only authentication/login styling and the design/plan documents differ; no persona, dashboard, backend, datastore, or Catalyst console files appear.

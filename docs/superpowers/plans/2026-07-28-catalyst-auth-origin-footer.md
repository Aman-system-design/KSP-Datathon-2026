# Catalyst Authentication Origin and Footer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Route the generated Catalyst account iframe through its configured Zoho authentication origin and keep the Catalyst attribution inside the visible login card.

**Architecture:** Add a pure URL normalizer dedicated to the Catalyst sign-in iframe, then call it from the existing iframe normalization boundary before height/listener setup. Preserve the SDK mount call and all redirect parameters. Move attribution and transient copy feedback into the existing demo card using compact CSS.

**Tech Stack:** React 19, JavaScript, CSS, Vitest, Testing Library, Vite

---

## File Structure

- Create `web/src/auth/catalyst-sign-in-frame.js`: pure, testable iframe-origin normalization.
- Create `web/src/auth/catalyst-sign-in-frame.test.js`: URL rewrite and no-op contracts.
- Modify `web/src/auth/SignInRequired.jsx`: invoke the normalizer and relocate attribution markup.
- Modify `web/src/auth/SignInRequired.test.jsx`: integration and compact-footer contracts.
- Modify `web/src/styles/app.css`: compact in-card attribution and transient feedback.

### Task 1: Normalize the Catalyst account iframe origin

**Files:**
- Create: `web/src/auth/catalyst-sign-in-frame.js`
- Create: `web/src/auth/catalyst-sign-in-frame.test.js`

- [ ] **Step 1: Write failing unit tests**

Create `web/src/auth/catalyst-sign-in-frame.test.js`:

```js
import { expect, test } from 'vitest';
import { normalizeCatalystSignInUrl } from './catalyst-sign-in-frame.js';

const AUTH_ORIGIN = 'https://accounts.zohoportal.in';

test('moves ACE account routes to the configured Catalyst auth origin', () => {
  const source = 'https://ace.onslate.in/accounts/p/50043872568/signin?css_url=%2Fauth.css&serviceurl=%2F';
  expect(normalizeCatalystSignInUrl(source, {
    applicationOrigin: 'https://ace.onslate.in', authOrigin: AUTH_ORIGIN,
  })).toBe('https://accounts.zohoportal.in/accounts/p/50043872568/signin?css_url=%2Fauth.css&serviceurl=%2F');
});

test('preserves non-account and already-normalized URLs', () => {
  expect(normalizeCatalystSignInUrl('https://ace.onslate.in/reports', {
    applicationOrigin: 'https://ace.onslate.in', authOrigin: AUTH_ORIGIN,
  })).toBe('https://ace.onslate.in/reports');
  expect(normalizeCatalystSignInUrl('https://accounts.zohoportal.in/accounts/p/1/signin', {
    applicationOrigin: 'https://ace.onslate.in', authOrigin: AUTH_ORIGIN,
  })).toBe('https://accounts.zohoportal.in/accounts/p/1/signin');
});

test('leaves malformed URLs unchanged', () => {
  expect(normalizeCatalystSignInUrl('not a url', {
    applicationOrigin: 'https://ace.onslate.in', authOrigin: AUTH_ORIGIN,
  })).toBe('not a url');
});
```

- [ ] **Step 2: Run the unit test and verify RED**

Run:

```powershell
cd web
npm.cmd test -- --run src/auth/catalyst-sign-in-frame.test.js
```

Expected: FAIL because `catalyst-sign-in-frame.js` does not exist.

- [ ] **Step 3: Implement the minimal normalizer**

Create `web/src/auth/catalyst-sign-in-frame.js`:

```js
export const CATALYST_AUTH_ORIGIN = 'https://accounts.zohoportal.in';

export function normalizeCatalystSignInUrl(source, {
  applicationOrigin = globalThis.location?.origin,
  authOrigin = CATALYST_AUTH_ORIGIN,
} = {}) {
  try {
    const url = new URL(source);
    if (url.origin !== applicationOrigin || !url.pathname.startsWith('/accounts/')) return source;
    const destination = new URL(authOrigin);
    url.protocol = destination.protocol;
    url.host = destination.host;
    return url.href;
  } catch {
    return source;
  }
}

export function normalizeCatalystSignInFrame(frame, options) {
  const normalized = normalizeCatalystSignInUrl(frame?.src, options);
  if (frame && normalized && normalized !== frame.src) frame.src = normalized;
  return normalized;
}
```

- [ ] **Step 4: Run the unit test and verify GREEN**

Run `npm.cmd test -- --run src/auth/catalyst-sign-in-frame.test.js` from `web`.

Expected: 3 tests PASS.

- [ ] **Step 5: Commit Task 1**

```powershell
git add web/src/auth/catalyst-sign-in-frame.js web/src/auth/catalyst-sign-in-frame.test.js
git commit -m "fix: normalize Catalyst sign-in origin"
```

### Task 2: Integrate origin normalization at the iframe boundary

**Files:**
- Modify: `web/src/auth/SignInRequired.jsx`
- Modify: `web/src/auth/SignInRequired.test.jsx`

- [ ] **Step 1: Write the failing integration test**

Add a test that mounts an iframe with the failing ACE account URL and asserts its final origin:

```jsx
test('routes generated Catalyst account frames through the configured auth origin', async () => {
  const auth = {
    mountSignIn: vi.fn(async elementId => {
      const frame = document.createElement('iframe');
      frame.src = `${window.location.origin}/accounts/p/50043872568/signin?serviceurl=%2F`;
      document.getElementById(elementId).append(frame);
    }),
  };

  render(<SignInRequired auth={auth} />);

  await waitFor(() => expect(document.querySelector('#catalystLogin iframe')).not.toBeNull());
  const frame = document.querySelector('#catalystLogin iframe');
  await waitFor(() => expect(frame.src).toBe(
    'https://accounts.zohoportal.in/accounts/p/50043872568/signin?serviceurl=%2F',
  ));
  expect(auth.mountSignIn).toHaveBeenCalledOnce();
});
```

- [ ] **Step 2: Run the integration test and verify RED**

Run `npm.cmd test -- --run src/auth/SignInRequired.test.jsx` from `web`.

Expected: FAIL because the iframe remains on `ace.onslate.in`.

- [ ] **Step 3: Integrate the helper**

Import `normalizeCatalystSignInFrame` and call it in `normalizeFrame` after setting title/scrolling and before `bindFrame(frame)`:

```jsx
import { normalizeCatalystSignInFrame } from './catalyst-sign-in-frame.js';

// inside normalizeFrame
normalizeCatalystSignInFrame(frame);
bindFrame(frame);
```

- [ ] **Step 4: Run auth tests and verify GREEN**

Run:

```powershell
npm.cmd test -- --run src/auth/catalyst-sign-in-frame.test.js src/auth/SignInRequired.test.jsx src/auth/catalyst-auth.test.js
```

Expected: all auth tests PASS and `mountSignIn` remains called once.

- [ ] **Step 5: Commit Task 2**

```powershell
git add web/src/auth/SignInRequired.jsx web/src/auth/SignInRequired.test.jsx
git commit -m "fix: use Catalyst authentication origin"
```

### Task 3: Fit the Catalyst attribution inside the demo card

**Files:**
- Modify: `web/src/auth/SignInRequired.jsx`
- Modify: `web/src/auth/SignInRequired.test.jsx`
- Modify: `web/src/styles/app.css`

- [ ] **Step 1: Write failing markup and CSS contract tests**

Add assertions to the demo-access test:

```jsx
const demo = screen.getByRole('complementary', { name: 'Demo access credentials' });
expect(within(demo).getByText('Authentication managed by Catalyst')).toBeInTheDocument();
expect(screen.getByRole('status')).toBeEmptyDOMElement();
```

Import `within` from Testing Library. Add CSS assertions:

```jsx
expect(css).toMatch(/\.secure-login__managed\s*{[^}]*padding-top:\s*8px/s);
expect(css).toMatch(/\.secure-login__copy-status:empty\s*{[^}]*display:\s*none/s);
```

- [ ] **Step 2: Run the component test and verify RED**

Run `npm.cmd test -- --run src/auth/SignInRequired.test.jsx` from `web`.

Expected: FAIL because attribution is outside the demo card and empty status still reserves height.

- [ ] **Step 3: Move attribution and status markup into the demo card**

Place the live status and managed attribution immediately after `For evaluation use only.` inside the demo `aside`:

```jsx
<p className="secure-login__copy-status" role="status" aria-live="polite">{copiedMessage}</p>
<p className="secure-login__managed"><ShieldCheck aria-hidden="true" />Authentication managed by Catalyst</p>
```

Remove their former siblings below the demo `aside`.

- [ ] **Step 4: Compact the in-card CSS**

Use:

```css
.secure-login__copy-status { margin: 5px 0 0; color: #1769aa; font-size: 10px; text-align: left; }
.secure-login__copy-status:empty { display: none; }
.secure-login__managed { display: flex; align-items: center; gap: 6px; margin: 8px 0 0; padding-top: 8px; color: #6a7b8e; border-top: 1px solid rgb(196 209 222 / 58%); font-size: 10px; }
.secure-login__managed svg { width: 12px; height: 12px; color: #1769aa; }
```

- [ ] **Step 5: Run component and viewport tests**

Run:

```powershell
npm.cmd test -- --run src/auth/SignInRequired.test.jsx src/styles/viewport-layout.test.js
```

Expected: all tests PASS.

- [ ] **Step 6: Run complete regression and production build**

Run:

```powershell
npm.cmd test -- --run src/auth src/app/router.test.jsx src/styles/viewport-layout.test.js
npm.cmd run build
```

Expected: all tests PASS and Vite build exits 0.

- [ ] **Step 7: Verify end to end**

On the deployed app:

- generated iframe origin is `https://accounts.zohoportal.in`;
- email advances to password without the encryption-script crash;
- demo password authenticates and redirects to the ACE workspace selector;
- the attribution stays inside the demo card at constrained desktop height;
- mobile retains normal flow without overlap.

- [ ] **Step 8: Commit Task 3**

```powershell
git add web/src/auth/SignInRequired.jsx web/src/auth/SignInRequired.test.jsx web/src/styles/app.css
git commit -m "fix: fit Catalyst attribution in login card"
```

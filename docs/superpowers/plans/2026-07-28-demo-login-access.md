# Demo Login Access Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add judge-facing demo credentials with compact copy controls to the existing Catalyst sign-in screen without changing authentication behavior.

**Architecture:** Keep the feature inside `SignInRequired`: static presentation constants, a small clipboard handler, transient accessible feedback, and scoped CSS. Catalyst remains responsible for all credential input and submission; the new controls never prefill or invoke authentication.

**Tech Stack:** React 19, Lucide React, Testing Library, Vitest, CSS, Vite

---

## File map

- Modify `web/src/auth/SignInRequired.jsx`: render the demo card and handle clipboard feedback.
- Modify `web/src/auth/SignInRequired.test.jsx`: prove rendering, copying, feedback, and Catalyst regression behavior.
- Modify `web/src/styles/app.css`: compact responsive styling for the additive card and buttons.

### Task 1: Demo credential presentation and copy behavior

**Files:**
- Modify: `web/src/auth/SignInRequired.test.jsx`
- Modify: `web/src/auth/SignInRequired.jsx`

- [ ] **Step 1: Write the failing rendering and clipboard tests**

Add imports and tests:

```jsx
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

test('shows judge demo credentials without changing Catalyst sign in', async () => {
  const auth = { mountSignIn: vi.fn(async () => {}) };
  render(<SignInRequired auth={auth} />);

  expect(screen.getByRole('complementary', { name: 'Demo access credentials' })).toBeInTheDocument();
  expect(screen.getByText('ksp.tech@zohomail.in')).toBeInTheDocument();
  expect(screen.getByText('Mail@2026')).toBeInTheDocument();
  expect(auth.mountSignIn).toHaveBeenCalledWith('catalystLogin', {
    cssUrl: '/auth/catalyst-sign-in-v4.css', serviceUrl: '/',
  });
});

test('copies each demo credential and announces success', async () => {
  const writeText = vi.fn(async () => {});
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText },
  });
  render(<SignInRequired auth={{ mountSignIn: vi.fn(async () => {}) }} />);

  fireEvent.click(screen.getByRole('button', { name: 'Copy demo email' }));
  await waitFor(() => expect(writeText).toHaveBeenCalledWith('ksp.tech@zohomail.in'));
  expect(screen.getByRole('status')).toHaveTextContent('Email copied');

  fireEvent.click(screen.getByRole('button', { name: 'Copy demo password' }));
  await waitFor(() => expect(writeText).toHaveBeenCalledWith('Mail@2026'));
  expect(screen.getByRole('status')).toHaveTextContent('Password copied');
});
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run:

```powershell
npm.cmd test -- SignInRequired.test.jsx
```

Expected: FAIL because the demo access region and copy buttons do not exist.

- [ ] **Step 3: Implement the minimal React behavior**

Update imports and add constants:

```jsx
import { Copy, ShieldCheck } from 'lucide-react';

const DEMO_EMAIL = 'ksp.tech@zohomail.in';
const DEMO_PASSWORD = 'Mail@2026';
```

Add component state and handler:

```jsx
const [copiedMessage, setCopiedMessage] = useState('');

const copyCredential = async (value, message) => {
  try {
    await navigator.clipboard.writeText(value);
    setCopiedMessage(message);
  } catch {
    setCopiedMessage('Copy unavailable — select the value manually');
  }
};
```

Render this after the Catalyst error and before the existing managed-authentication label:

```jsx
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
</aside>
<p className="secure-login__copy-status" role="status" aria-live="polite">{copiedMessage}</p>
```

- [ ] **Step 4: Run the focused tests and verify GREEN**

Run:

```powershell
npm.cmd test -- SignInRequired.test.jsx
```

Expected: all `SignInRequired` tests PASS.

- [ ] **Step 5: Commit the behavior**

```powershell
git add web/src/auth/SignInRequired.jsx web/src/auth/SignInRequired.test.jsx
git commit -m "feat: show judge demo login access"
```

### Task 2: Compact responsive styling

**Files:**
- Modify: `web/src/auth/SignInRequired.test.jsx`
- Modify: `web/src/styles/app.css`

- [ ] **Step 1: Write a failing scoped-style regression test**

Add this test:

```jsx
test('keeps judge demo access compact inside the existing access column', () => {
  const css = readFileSync('src/styles/app.css', 'utf8');
  expect(css).toMatch(/\.secure-login__demo\s*{[^}]*border-radius:\s*12px/s);
  expect(css).toMatch(/\.secure-login__demo-row\s*{[^}]*grid-template-columns:\s*60px\s+minmax\(0,\s*1fr\)\s+28px/s);
  expect(css).toMatch(/\.secure-login__demo-row button\s*{[^}]*width:\s*26px/s);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```powershell
npm.cmd test -- SignInRequired.test.jsx
```

Expected: FAIL because the scoped demo styles do not exist.

- [ ] **Step 3: Add minimal scoped CSS**

Append the following beside the existing `.secure-login__managed` rules:

```css
.secure-login__demo { margin-top: 14px; padding: 13px 14px; color: #10233d; background: #f4f9fe; border: 1px solid #b8d6ee; border-radius: 12px; }
.secure-login__demo-heading { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; font-size: 12px; }
.secure-login__demo-heading span { padding: 3px 6px; color: #125b94; background: #d8edff; border-radius: 999px; font-size: 9px; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; }
.secure-login__demo-row { min-height: 34px; display: grid; grid-template-columns: 60px minmax(0, 1fr) 28px; align-items: center; gap: 7px; border-top: 1px solid #dceaf6; font-size: 11px; }
.secure-login__demo-row > span { color: #60748a; }
.secure-login__demo-row code { overflow: hidden; color: #10233d; font-size: 11px; font-weight: 600; text-overflow: ellipsis; }
.secure-login__demo-row button { width: 26px; height: 26px; display: grid; place-items: center; padding: 0; color: #1769aa; background: #fff; border: 1px solid #bdd4e8; border-radius: 7px; cursor: pointer; transition: background 150ms ease, transform 150ms ease; }
.secure-login__demo-row button:hover { background: #e7f3fd; }
.secure-login__demo-row button:active { transform: scale(.94); }
.secure-login__demo-row button svg { width: 12px; height: 12px; }
.secure-login__demo small { color: #526a82; font-size: 10px; }
.secure-login__copy-status { min-height: 16px; margin: 5px 0 0; color: #1769aa; font-size: 10px; text-align: center; }
```

- [ ] **Step 4: Run the focused tests and verify GREEN**

Run:

```powershell
npm.cmd test -- SignInRequired.test.jsx
```

Expected: all focused tests PASS.

- [ ] **Step 5: Commit the styles**

```powershell
git add web/src/auth/SignInRequired.test.jsx web/src/styles/app.css
git commit -m "style: keep demo login access compact"
```

### Task 3: Regression verification and deployment readiness

**Files:**
- Verify only; no production file changes expected.

- [ ] **Step 1: Run authentication and router regression suites**

```powershell
npm.cmd test -- SignInRequired.test.jsx catalyst-auth.test.js router.test.jsx
```

Expected: all selected tests PASS with zero failures.

- [ ] **Step 2: Run the complete frontend suite**

```powershell
npm.cmd test
```

Expected: all frontend tests PASS with zero failures.

- [ ] **Step 3: Build the Slate frontend**

From the repository root:

```powershell
npm.cmd run web:build
```

Expected: Vite build and bundle-budget verification complete successfully.

- [ ] **Step 4: Verify the isolated diff**

```powershell
git status --short
git diff origin/main...HEAD -- web/src/auth/SignInRequired.jsx web/src/auth/SignInRequired.test.jsx web/src/styles/app.css
```

Expected: only the approved sign-in files and planning documents differ from `origin/main`.

- [ ] **Step 5: Perform live post-deployment checks**

After fast-forwarding `main` and deploying only Slate, open the unauthenticated application and verify:

1. Catalyst sign-in still renders and accepts its normal interaction flow.
2. Both demo credentials are visible.
3. Both small copy buttons copy the correct corresponding value.
4. Mobile-sized layout remains scrollable and Catalyst recovery/OTP content stays reachable.
5. No persona dashboard or API deployment is included.

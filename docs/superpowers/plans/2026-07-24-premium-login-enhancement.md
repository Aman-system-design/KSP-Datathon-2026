# Premium Login Enhancement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the existing KSP Catalyst login as a light, premium Frosted Command Glass experience without changing authentication behavior.

**Architecture:** Preserve `SignInRequired` as the authentication boundary and keep `auth.mountSignIn` unchanged. Enhance only its presentational markup, the shell rules in `app.css`, and the Catalyst-supplied iframe stylesheet, with contract tests locking down authentication arguments, viewport reachability, responsive behavior, and reduced motion.

**Tech Stack:** React 18, Vite, Vitest, Testing Library, CSS, Zoho Catalyst embedded authentication, Lucide React.

---

## File Map

- Modify `web/src/auth/SignInRequired.jsx`: add presentation-only structure needed for premium surface depth; preserve the mount effect and error behavior.
- Modify `web/src/auth/SignInRequired.test.jsx`: lock authentication arguments, permitted visible copy, premium design tokens, and iframe dimensions.
- Modify `web/src/styles/app.css`: implement the responsive Frosted Command Glass outer shell and reduced-motion behavior.
- Modify `web/public/auth/catalyst-sign-in-v4.css`: refine embedded inputs, button, recovery link, focus, and responsive states without hiding Catalyst controls.
- Modify `web/src/styles/viewport-layout.test.js`: protect dynamic-viewport containment and recovery-action reachability.

### Task 1: Lock down behavior and visual contracts

**Files:**
- Modify: `web/src/auth/SignInRequired.test.jsx`
- Modify: `web/src/styles/viewport-layout.test.js`

- [ ] **Step 1: Add failing preservation and presentation tests**

Extend the component test so it continues to assert the exact mount call:

```jsx
expect(auth.mountSignIn).toHaveBeenCalledWith('catalystLogin', {
  cssUrl: '/auth/catalyst-sign-in-v4.css', serviceUrl: '/',
});
expect(document.getElementById('catalystLogin')).toBeInTheDocument();
```

Add CSS contract assertions for a 22px shell radius, translucent shell background, backdrop blur, 48px Catalyst controls, visible focus rings, and reduced-motion handling:

```jsx
expect(css).toMatch(/\.secure-login__shell\s*{[^}]*border-radius:\s*22px/s);
expect(css).toMatch(/\.secure-login__shell\s*{[^}]*backdrop-filter:\s*blur\(/s);
expect(css).toMatch(/@media \(prefers-reduced-motion:\s*reduce\)/);
expect(catalystCss).toMatch(/#login_id:focus[^}]*box-shadow:/s);
expect(catalystCss).toMatch(/#nextbtn[^}]*height:\s*48px/s);
```

- [ ] **Step 2: Run the focused tests and confirm the new visual assertions fail**

Run: `npm test -- --run src/auth/SignInRequired.test.jsx src/styles/viewport-layout.test.js`

Working directory: `web`

Expected: existing behavior assertions pass; new 22px radius, blur, and reduced-motion assertions fail.

- [ ] **Step 3: Commit the red tests**

```powershell
git add -- web/src/auth/SignInRequired.test.jsx web/src/styles/viewport-layout.test.js
git commit -m "test: define premium login contracts"
```

### Task 2: Implement the premium outer login shell

**Files:**
- Modify: `web/src/auth/SignInRequired.jsx`
- Modify: `web/src/styles/app.css`
- Test: `web/src/auth/SignInRequired.test.jsx`
- Test: `web/src/styles/viewport-layout.test.js`

- [ ] **Step 1: Add presentation-only shell elements**

Keep the effect body and `mountSignIn` call byte-for-byte equivalent. Add only decorative, hidden markup where required:

```jsx
<main className="secure-login">
  <div className="secure-login__ambient" aria-hidden="true" />
  <section className="secure-login__shell">
    {/* existing identity and access regions remain in the same order */}
  </section>
</main>
```

- [ ] **Step 2: Replace only the `.secure-login*` CSS block with the approved system**

Implement these exact surface constraints:

```css
.secure-login__shell {
  width: min(980px, 100%);
  height: min(600px, calc(100dvh - 48px));
  max-height: calc(100dvh - 48px);
  grid-template-columns: 360px minmax(0, 1fr);
  background: rgb(255 255 255 / 82%);
  border: 1px solid rgb(255 255 255 / 86%);
  border-radius: 22px;
  box-shadow: 0 32px 80px rgb(24 49 83 / 14%), 0 4px 16px rgb(24 49 83 / 6%), inset 0 1px 0 rgb(255 255 255 / 92%);
  backdrop-filter: blur(28px) saturate(130%);
}
```

Keep `.secure-login__access` scrollable, keep the iframe host and iframe at 360px height, retain the single-column breakpoint, and include:

```css
@media (prefers-reduced-motion: reduce) {
  .secure-login *, .secure-login *::before, .secure-login *::after {
    animation-duration: .01ms !important;
    transition-duration: .01ms !important;
  }
}
```

- [ ] **Step 3: Run focused tests**

Run: `npm test -- --run src/auth/SignInRequired.test.jsx src/styles/viewport-layout.test.js`

Working directory: `web`

Expected: PASS.

- [ ] **Step 4: Commit the outer shell**

```powershell
git add -- web/src/auth/SignInRequired.jsx web/src/styles/app.css web/src/auth/SignInRequired.test.jsx web/src/styles/viewport-layout.test.js
git commit -m "style: add premium login shell"
```

### Task 3: Refine the embedded Catalyst form

**Files:**
- Modify: `web/public/auth/catalyst-sign-in-v4.css`
- Test: `web/src/auth/SignInRequired.test.jsx`
- Test: `web/src/styles/viewport-layout.test.js`

- [ ] **Step 1: Implement the form design tokens without changing Catalyst structure**

Retain the upstream `@import`, 340px form maximum, natural vertical overflow, and all Catalyst selectors. Use these control rules as the baseline:

```css
.textbox, #login_id, #password {
  height: 48px;
  padding: 0 16px;
  color: #12233a;
  background: rgb(255 255 255 / 88%);
  border: 1px solid #cbd8e6;
  border-radius: 12px;
  box-shadow: inset 0 1px 2px rgb(15 38 68 / 3%);
  transition: border-color 180ms ease, box-shadow 180ms ease, background 180ms ease;
}

.textbox:focus, #login_id:focus, #password:focus {
  border-color: #2478c5;
  background: #fff;
  box-shadow: 0 0 0 4px rgb(36 120 197 / 13%), 0 8px 20px rgb(29 82 132 / 7%);
}

.btn, #nextbtn {
  height: 48px;
  border-radius: 12px;
  box-shadow: 0 10px 24px rgb(25 103 171 / 20%), inset 0 1px 0 rgb(255 255 255 / 22%);
  transition: transform 180ms ease, box-shadow 180ms ease, background 180ms ease;
}
```

Add hover, active, focus-visible, disabled, validation, recovery-link, and mobile variants. Do not use `display: none` on Catalyst form, error, recovery, password, OTP, or federated-auth elements.

- [ ] **Step 2: Run the focused tests**

Run: `npm test -- --run src/auth/SignInRequired.test.jsx src/styles/viewport-layout.test.js`

Working directory: `web`

Expected: PASS.

- [ ] **Step 3: Commit the embedded form styling**

```powershell
git add -- web/public/auth/catalyst-sign-in-v4.css web/src/auth/SignInRequired.test.jsx web/src/styles/viewport-layout.test.js
git commit -m "style: refine Catalyst sign-in controls"
```

### Task 4: Verify functionality, responsiveness, and visual fidelity

**Files:**
- Modify only if verification finds a concrete issue: `web/src/styles/app.css`, `web/public/auth/catalyst-sign-in-v4.css`, or their direct tests.

- [ ] **Step 1: Run authentication and viewport tests**

Run: `npm test -- --run src/auth/SignInRequired.test.jsx src/auth/catalyst-auth.test.js src/app/router.test.jsx src/styles/viewport-layout.test.js`

Working directory: `web`

Expected: PASS with no changed authentication call or route behavior.

- [ ] **Step 2: Run the complete web test suite**

Run: `npm test -- --run`

Working directory: `web`

Expected: PASS.

- [ ] **Step 3: Build the production bundle**

Run: `npm run build`

Working directory: `web`

Expected: Vite exits successfully and writes the production bundle.

- [ ] **Step 4: Start the local app and inspect the rendered login**

Run: `npm run dev -- --host 127.0.0.1`

Working directory: `web`

Use Browser/IAB to inspect 1440×900, 1280×720, and 390×844 viewports. Confirm the shell is unclipped, the left emblem remains prominent on desktop, the mobile brand header is compact, the access panel can scroll when required, and keyboard focus remains visible.

- [ ] **Step 5: Exercise the authentication surface**

Confirm the Catalyst iframe mounts, the email field accepts input, Next remains available, Forgot Password remains reachable, and the frame has the title `Karnataka State Police secure sign in`. Where the local Catalyst environment exposes password/OTP steps, confirm they fit within the same frame without loss of controls.

- [ ] **Step 6: Record the fidelity ledger**

Compare the implementation with the approved design on at least: split layout, light palette, typography hierarchy, 22px glass shell, emblem treatment, control radius/focus, background subtlety, desktop containment, mobile collapse, and reduced motion. Fix any mismatch in the scoped files and rerun Steps 1–3.

- [ ] **Step 7: Commit verified adjustments as the rollback boundary**

```powershell
git add -- web/src/auth/SignInRequired.jsx web/src/styles/app.css web/public/auth/catalyst-sign-in-v4.css web/src/auth/SignInRequired.test.jsx web/src/styles/viewport-layout.test.js
git commit -m "test: verify premium login experience"
```

The implementation can then be rolled back by reverting the dedicated login commits without affecting Catalyst session logic or unrelated worktree changes.

# Compact Premium Login Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Catalyst-embedded KSP login fit within the first viewport and present a compact, premium white enterprise authentication surface.

**Architecture:** Keep Catalyst Authentication as the sole identity provider and preserve its embedded form behavior. Refine only the React login composition and its isolated application/Catalyst styles, with regression tests protecting viewport fit, form dimensions, and removal of detached decorative status elements.

**Tech Stack:** React 19, Catalyst Web SDK v4, shadcn Badge primitives, Lucide icons, CSS, Vitest, Testing Library, Vite, Catalyst Slate.

---

## File Map

- Modify `web/src/auth/SignInRequired.jsx`: consolidate security context and preserve the real Catalyst mount point.
- Modify `web/src/auth/SignInRequired.test.jsx`: specify the approved visible copy and viewport-fit CSS contract.
- Modify `web/src/styles/app.css`: implement the 900px × 520px viewport-aware shell and 300px identity column.
- Modify `web/public/auth/catalyst-sign-in-v4.css`: set the embedded Catalyst form width to 340px while retaining accessible 48px controls.

### Task 1: Lock the approved composition with failing tests

**Files:**
- Modify: `web/src/auth/SignInRequired.test.jsx`

- [ ] **Step 1: Replace the detached status expectations with the consolidated security context**

```jsx
expect(screen.getByText('Secure access protected by Catalyst')).toBeInTheDocument();
expect(screen.queryByText('Catalyst secure access')).not.toBeInTheDocument();
expect(screen.queryByText('Identity protected')).not.toBeInTheDocument();
```

- [ ] **Step 2: Add the viewport-fit and dimension contract**

```jsx
test('fits the secure shell inside the dynamic viewport', () => {
  const css = readFileSync('src/styles/app.css', 'utf8');
  const shellRule = css.match(/\.secure-login__shell\s*\{([^}]*)\}/)?.[1] ?? '';

  expect(shellRule).toMatch(/width:\s*min\(900px,\s*100%\)/);
  expect(shellRule).toMatch(/height:\s*min\(520px,\s*calc\(100dvh\s*-\s*32px\)\)/);
  expect(shellRule).toMatch(/grid-template-columns:\s*300px\s+minmax\(0,\s*1fr\)/);
});
```

- [ ] **Step 3: Update the embedded form-width expectation**

```jsx
expect(css).toMatch(/max-width:\s*340px/);
```

- [ ] **Step 4: Run the focused test and confirm the red state**

Run: `npm.cmd test -- src/auth/SignInRequired.test.jsx`

Expected: FAIL because the current component has two status labels, the shell is 960px × 560px, and the Catalyst form is 320px.

- [ ] **Step 5: Commit the failing specification**

```powershell
git add -- web/src/auth/SignInRequired.test.jsx
git commit -m "test: specify compact secure login"
```

### Task 2: Implement the compact premium shell

**Files:**
- Modify: `web/src/auth/SignInRequired.jsx`
- Modify: `web/src/styles/app.css`
- Modify: `web/public/auth/catalyst-sign-in-v4.css`

- [ ] **Step 1: Consolidate the security context in the React composition**

Replace the two detached indicators with one restrained row:

```jsx
<header className="secure-login__access-header">
  <ShieldCheck aria-hidden="true" />
  <span>Secure access protected by Catalyst</span>
</header>
```

Remove the unused `Badge` import. Keep `auth.mountSignIn`, the real `catalystLogin` host, failure handling, and the Catalyst-managed footer unchanged.

- [ ] **Step 2: Implement the viewport-aware shell dimensions**

Use these rules in `web/src/styles/app.css`:

```css
.secure-login { min-height: 100vh; min-height: 100dvh; padding: 16px; }
.secure-login__shell {
  width: min(900px, 100%);
  height: min(520px, calc(100dvh - 32px));
  min-height: 480px;
  grid-template-columns: 300px minmax(0, 1fr);
}
.secure-login__identity { padding: 36px 28px; }
.secure-login__identity img { width: 180px; height: 180px; margin-bottom: 26px; }
.secure-login__access { width: min(340px, calc(100% - 48px)); padding: 20px 0 16px; }
.secure-login__access-header { justify-content: flex-start; margin-bottom: 2px; }
.secure-login__catalyst,
.secure-login__catalyst iframe { height: 360px !important; }
```

The actual source may keep equivalent declarations on separate selectors so the iframe-only `!important` requirement remains scoped correctly.

- [ ] **Step 3: Preserve a responsive stacked mobile shell**

In the existing `@media (max-width: 760px)` rule, set the shell to `height: auto; min-height: 0`, retain the 72px emblem, and use `width: min(340px, calc(100% - 40px))` for the access region.

- [ ] **Step 4: Set the Catalyst form width**

In `web/public/auth/catalyst-sign-in-v4.css`:

```css
.signin_container,
.signin_box {
  width: 100%;
  max-width: 340px;
}
```

Retain the current 48px input/button height, eight-pixel radius, focus ring, validation colours, and forgot-password styling.

- [ ] **Step 5: Run the focused test**

Run: `npm.cmd test -- src/auth/SignInRequired.test.jsx`

Expected: 6 tests pass.

- [ ] **Step 6: Commit the implementation**

```powershell
git add -- web/src/auth/SignInRequired.jsx web/src/styles/app.css web/public/auth/catalyst-sign-in-v4.css
git commit -m "feat: refine compact secure login"
```

### Task 3: Verify and release the Slate frontend

**Files:**
- Verify: `web/src/auth/SignInRequired.jsx`
- Verify: `web/src/styles/app.css`
- Verify: `web/public/auth/catalyst-sign-in-v4.css`

- [ ] **Step 1: Run the complete frontend test suite**

Run: `npm.cmd test`

Expected: all test files and tests pass with no failures.

- [ ] **Step 2: Create the production bundle**

Run: `npm.cmd run build`

Expected: Vite completes successfully. Existing non-blocking Catalyst script and MapLibre chunk-size warnings may remain.

- [ ] **Step 3: Deploy only Slate**

Run from the repository worktree root:

```powershell
catalyst.cmd deploy slate ksp-crime-intelligence -m "Release compact premium secure access"
```

Expected: Catalyst reports `Build completed successfully` and `Catalyst Slate Deploy is Live`. Do not deploy Functions.

- [ ] **Step 4: Verify the live root URL**

Open `https://aiksp.onslate.in/?release=<timestamp>` in the in-app browser and confirm:

- the card bottom is visible without scrolling at the current desktop viewport;
- there is one security context row;
- the emblem, organization name, sign-in form, forgot-password action, and Catalyst footer are visible;
- email and Next controls are 340px wide;
- the embedded email/password transition remains functional;
- the approved loading screen is unchanged.

- [ ] **Step 5: Verify narrow layout**

At a 375px × 812px viewport, confirm the identity panel stacks above the form, no horizontal scrolling appears, controls remain at least 44px high, and all sign-in actions remain reachable.

- [ ] **Step 6: Record release completion**

Commit only if verification requires a corrective source change. Otherwise report the deployed URL, passing test count, successful build, and live visual verification.

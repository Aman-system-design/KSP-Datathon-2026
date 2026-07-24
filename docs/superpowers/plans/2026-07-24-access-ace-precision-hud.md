# Access ACE Precision HUD Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a light Precision HUD treatment and visible `Access ACE` heading to the embedded Catalyst login without changing authentication behavior.

**Architecture:** Implement the effect exclusively in the existing Catalyst authentication stylesheet using CSS pseudo-elements, layered backgrounds, and state selectors. Extend direct CSS contract tests so the original Catalyst controls remain visible and reachable, reduced-motion remains enforced, and the React mount boundary is untouched.

**Tech Stack:** CSS, Zoho Catalyst hosted authentication, Vitest, React Testing Library, Vite.

---

## File Map

- Modify `web/public/auth/catalyst-sign-in-v4.css`: visible Access ACE label, HUD framing, trace texture, focus scan, button shimmer, mobile and reduced-motion rules.
- Modify `web/src/auth/SignInRequired.test.jsx`: CSS contracts for the approved visual primitives and preserved iframe dimensions.
- Modify `web/src/styles/viewport-layout.test.js`: guarantee Catalyst password, OTP, recovery, error and federated surfaces are not hidden.

### Task 1: Define failing Precision HUD contracts

**Files:**
- Modify: `web/src/auth/SignInRequired.test.jsx`
- Modify: `web/src/styles/viewport-layout.test.js`

- [ ] **Step 1: Add the failing visual contract test**

Add assertions that require the visible replacement label, HUD pseudo-elements, focus scan animation, button shimmer, pointer-safe decoration, and reduced motion:

```jsx
test('gives the Catalyst form a light Access ACE precision HUD treatment', () => {
  const css = readFileSync('public/auth/catalyst-sign-in-v4.css', 'utf8');

  expect(css).toMatch(/content:\s*"Access ACE"/);
  expect(css).toMatch(/\.signin_box::before/);
  expect(css).toMatch(/\.signin_box::after/);
  expect(css).toMatch(/pointer-events:\s*none/);
  expect(css).toMatch(/@keyframes\s+ace-scan/);
  expect(css).toMatch(/@keyframes\s+ace-button-glint/);
  expect(css).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)/);
});
```

Extend the viewport contract with:

```js
expect(catalystAuthCss).not.toMatch(/(?:#password|#forgotpassword|\.errorlabel|\.field_error|\.fed_div)[^{]*{[^}]*display:\s*none/s);
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run from `web`: `npm.cmd test -- --run src/auth/SignInRequired.test.jsx src/styles/viewport-layout.test.js`

Expected: the new Access ACE/HUD test fails because those CSS primitives do not yet exist; preservation tests pass.

### Task 2: Implement the light Precision HUD stylesheet

**Files:**
- Modify: `web/public/auth/catalyst-sign-in-v4.css`
- Test: `web/src/auth/SignInRequired.test.jsx`
- Test: `web/src/styles/viewport-layout.test.js`

- [ ] **Step 1: Add a pointer-safe HUD canvas around `.signin_box`**

Use `position: relative`, a faint dual-axis trace background, 14px radius, and pseudo-elements that create four thin blue corner brackets plus a segmented status rail. Both pseudo-elements use `pointer-events: none` and sit behind interactive content.

- [ ] **Step 2: Present `Access ACE` without altering Catalyst semantics**

Target the Catalyst heading element already rendered inside `.signin_box`, visually suppress its glyphs with `font-size: 0`, and render:

```css
.signin_box h2::after,
.signin_box .signin_head::after {
  content: "Access ACE";
  color: #10233d;
  font-size: 28px;
  font-weight: 500;
  letter-spacing: -.035em;
}
```

The source heading remains in the accessibility tree as `Sign in`; no JavaScript or iframe mutation is introduced.

- [ ] **Step 3: Add restrained focus and button motion**

Add an `ace-scan` keyframe used only while a supported form region contains focus, and an `ace-button-glint` highlight for button hover. Durations stay between 180ms and 250ms for state transitions; decorative scans are disabled under reduced motion. Preserve existing focus outlines and disabled states.

- [ ] **Step 4: Add mobile restraint**

At `max-width: 600px`, reduce HUD inset spacing and corner lengths without shrinking 48px controls or hiding recovery/validation content.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run from `web`: `npm.cmd test -- --run src/auth/SignInRequired.test.jsx src/styles/viewport-layout.test.js`

Expected: 12 or more tests pass with zero failures.

- [ ] **Step 6: Commit the scoped implementation**

```powershell
git add -- web/public/auth/catalyst-sign-in-v4.css web/src/auth/SignInRequired.test.jsx web/src/styles/viewport-layout.test.js
git commit -m "style: add Access ACE precision HUD"
```

### Task 3: Verify, merge, and deploy the Slate client

**Files:**
- Modify only if verification reveals a scoped defect: the three Task 2 files.

- [ ] **Step 1: Run authentication-focused verification**

Run from `web`: `npm.cmd test -- --run src/auth/SignInRequired.test.jsx src/auth/catalyst-auth.test.js src/app/router.test.jsx src/styles/viewport-layout.test.js`

Expected: all tests pass and the exact `auth.mountSignIn` call remains unchanged.

- [ ] **Step 2: Run complete web verification**

Run from `web`: `npm.cmd test -- --run`

Expected: all web tests pass.

- [ ] **Step 3: Build production assets**

Run from `web`: `npm.cmd run build`

Expected: Vite exits zero; existing Catalyst script and bundle-size warnings may remain.

- [ ] **Step 4: Browser-check desktop and mobile**

Verify the light outer shell is unchanged; Access ACE is visible; brackets and traces do not overlap controls; email, password, Next and Forgot Password remain visible; keyboard focus activates the restrained scan; and mobile has no horizontal overflow.

- [ ] **Step 5: Merge and push `main` after user-approved branch completion**

Preserve unrelated dirty files through the existing isolated-worktree workflow. The HUD commit is the rollback boundary.

- [ ] **Step 6: Run clean Catalyst Development preflight and deploy Slate only**

Run: `npm.cmd run catalyst:preflight:remote`

Then run: `catalyst.cmd deploy slate ksp-crime-intelligence -m "Access ACE Precision HUD"`

Expected: preflight reports `remoteMutationAuthorized: true`; Catalyst reports the Slate build live. Do not deploy Functions, data, Jobs, API Gateway, Authentication configuration, or Production.

- [ ] **Step 7: Verify the live deployment**

At `https://ace.onslate.in`, confirm visible Access ACE treatment, preserved form controls, iframe title, 980px × 600px outer shell, 22px radius and 28px blur. Record deployment and rollback evidence in the existing Development ledger and project memory.

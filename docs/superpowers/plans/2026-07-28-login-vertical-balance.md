# Login Vertical Balance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the excessive desktop gap below Catalyst's recovery action while preserving the left-aligned sign-in heading and safe authentication frame height.

**Architecture:** Keep the cross-origin Catalyst iframe at its existing safe 360px height. Use only outer-page CSS to pull the demo card 40px into unused iframe whitespace on desktop, while restoring normal positive spacing on mobile so vertically flowing content cannot overlap.

**Tech Stack:** React 18, CSS, Vitest, Vite

---

## File Structure

- Modify `web/src/styles/app.css`: own the desktop visual offset and mobile reset.
- Modify `web/src/auth/SignInRequired.test.jsx`: enforce the compact desktop spacing contract and safe mobile fallback.

### Task 1: Add the login spacing contract

**Files:**
- Modify: `web/src/auth/SignInRequired.test.jsx`

- [ ] **Step 1: Write the failing CSS contract test**

Extend `keeps judge demo access compact inside the existing access column` with:

```jsx
expect(css).toMatch(/\.secure-login__demo\s*{[^}]*margin-top:\s*-26px/s);
expect(css).toMatch(/@media \(max-width:\s*760px\)[^{]*{[\s\S]*\.secure-login__demo\s*{[^}]*margin-top:\s*14px/s);
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```powershell
cd web
npm.cmd test -- --run src/auth/SignInRequired.test.jsx
```

Expected: FAIL because the demo card still uses `margin-top: 14px` on desktop and has no mobile reset.

- [ ] **Step 3: Commit the failing test**

```powershell
git add web/src/auth/SignInRequired.test.jsx
git commit -m "test: define balanced login spacing"
```

### Task 2: Apply safe responsive spacing

**Files:**
- Modify: `web/src/styles/app.css`
- Test: `web/src/auth/SignInRequired.test.jsx`
- Test: `web/src/styles/viewport-layout.test.js`

- [ ] **Step 1: Pull the desktop demo card into the unused iframe space**

Change the desktop demo rule to:

```css
.secure-login__demo { margin-top: -26px; padding: 13px 14px; color: #10233d; background: #f4f9fe; border: 1px solid #b8d6ee; border-radius: 12px; }
```

This changes visual spacing by exactly 40px while leaving the iframe, Catalyst form, and left-aligned heading untouched.

- [ ] **Step 2: Restore normal spacing in the mobile breakpoint**

Inside the existing `@media (max-width: 760px)` block, add:

```css
.secure-login__demo { margin-top: 14px; }
```

- [ ] **Step 3: Run the focused auth and viewport tests**

Run:

```powershell
cd web
npm.cmd test -- --run src/auth/SignInRequired.test.jsx src/styles/viewport-layout.test.js
```

Expected: all tests PASS.

- [ ] **Step 4: Run the complete auth/router regression set and production build**

Run:

```powershell
cd web
npm.cmd test -- --run src/auth src/app/router.test.jsx src/styles/viewport-layout.test.js
npm.cmd run build
```

Expected: all tests PASS and Vite completes a production build without errors.

- [ ] **Step 5: Verify the rendered result**

At 1920x1080, verify both Catalyst email and password stages:

- document `scrollHeight` equals `clientHeight`;
- demo card does not overlap the Catalyst form;
- visible gap after “Forgot Password?” is compact;
- “Sign in” remains left-aligned;
- mobile width at 390px retains normal positive spacing and vertical flow.

- [ ] **Step 6: Commit the implementation**

```powershell
git add web/src/styles/app.css
git commit -m "fix: balance login vertical spacing"
```


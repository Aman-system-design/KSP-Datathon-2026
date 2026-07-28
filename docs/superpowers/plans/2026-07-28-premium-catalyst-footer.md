# Premium Catalyst Footer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore a compact, separate, gold-accented Catalyst attribution below the credentials card without clipping the login shell.

**Architecture:** Keep the existing Catalyst iframe and credentials elements unchanged. Move only the attribution paragraph outside the demo aside, then apply compact centered divider styling and verify placement and viewport contracts.

**Tech Stack:** React, CSS, Vitest, Testing Library, Vite

---

### Task 1: Restore the separate premium attribution

**Files:**
- Modify: `web/src/auth/SignInRequired.jsx`
- Modify: `web/src/auth/SignInRequired.test.jsx`
- Modify: `web/src/styles/app.css`
- Test: `web/src/styles/viewport-layout.test.js`

- [ ] **Step 1: Write failing placement and style tests**

Add assertions that the demo card does not contain the attribution, the access panel does contain it, the empty copy status remains hidden, and the CSS uses centered compact divider styling with a gold icon.

```jsx
const demo = screen.getByRole('complementary', { name: 'Demo access credentials' });
expect(within(demo).queryByText('Authentication managed by Catalyst')).not.toBeInTheDocument();
expect(screen.getByText('Authentication managed by Catalyst')).toBeInTheDocument();
```

```js
expect(appCss).toMatch(/\.secure-login__managed\s*{[^}]*justify-content:\s*center[^}]*padding-top:\s*8px/s);
expect(appCss).toMatch(/\.secure-login__managed svg\s*{[^}]*color:\s*#b88719/s);
```

- [ ] **Step 2: Run the focused tests and confirm failure**

Run:

```powershell
npm.cmd test -- --run src/auth/SignInRequired.test.jsx src/styles/viewport-layout.test.js
```

Expected: FAIL because the attribution is still nested inside the credentials card and the icon is blue.

- [ ] **Step 3: Move only the attribution and apply compact premium styling**

Place the attribution immediately after the demo `aside`, leaving the copy status in the demo card.

```jsx
</aside>
<p className="secure-login__managed">
  <ShieldCheck aria-hidden="true" />Authentication managed by Catalyst
</p>
```

Use compact centered styling:

```css
.secure-login__managed {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  margin: 8px 0 0;
  padding-top: 8px;
  color: #6a7b8e;
  border-top: 1px solid rgb(196 209 222 / 58%);
  font-size: 10px;
}
.secure-login__managed svg { width: 12px; height: 12px; color: #b88719; }
```

- [ ] **Step 4: Run focused and regression verification**

Run:

```powershell
npm.cmd test -- --run src/auth src/app/router.test.jsx src/styles/viewport-layout.test.js
npm.cmd run build
```

Expected: all tests PASS and Vite build succeeds. Existing bundle-size warnings are informational.

- [ ] **Step 5: Commit the isolated implementation**

```powershell
git add web/src/auth/SignInRequired.jsx web/src/auth/SignInRequired.test.jsx web/src/styles/app.css web/src/styles/viewport-layout.test.js
git commit -m "fix: restore premium Catalyst footer"
```

### Task 2: Deploy and verify Slate only

**Files:**
- No source changes

- [ ] **Step 1: Deploy only the Slate client**

```powershell
catalyst.cmd deploy --only slate -p 43492000000013049
```

Expected: Catalyst reports the Slate deployment initiated successfully; no Functions or datastore resources are deployed.

- [ ] **Step 2: Verify the live hashed assets and login surface**

Open `https://ace.onslate.in/?release=<commit>` after propagation and confirm the original Catalyst embedded form renders, the credentials card remains unchanged, and the separate centered gold attribution is fully visible inside the shell.

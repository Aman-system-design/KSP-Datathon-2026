# Command Center Compact Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the oversized desktop Command Center search field with a fixed 270-pixel utility search positioned directly beside the profile avatar.

**Architecture:** Keep the existing React header markup and responsive behavior unchanged. Express the approved desktop width and utility spacing in the isolated Command Center CSS, protected by the existing CSS contract test.

**Tech Stack:** React 19, CSS media queries, Vitest, Testing Library, Vite, Catalyst Slate

---

## File Structure

- Modify `web/src/features/command-center/CommandCenterResponsive.test.js` to lock the desktop search width and utility gap.
- Modify `web/src/styles/app.css` to apply the compact desktop utility layout while retaining the existing narrow breakpoints.

### Task 1: Compact the Desktop Header Search

**Files:**
- Modify: `web/src/features/command-center/CommandCenterResponsive.test.js`
- Modify: `web/src/styles/app.css`
- Test: `web/src/features/command-center/CommandCenterResponsive.test.js`

- [ ] **Step 1: Write the failing desktop layout assertions**

Add a second test to `CommandCenterResponsive.test.js`:

```js
test('keeps desktop search compact beside the account utilities', () => {
  expect(css).toContain('.command-center-header__utilities { display:flex; align-items:center; justify-content:flex-end; gap:10px;');
  expect(css).toContain('.command-center-search { display:flex; align-items:center; gap:10px; width:270px;');
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```powershell
npm.cmd test -- CommandCenterResponsive.test.js
```

Working directory: `web`

Expected: FAIL because the current desktop rules contain an 18-pixel utility gap and `width:min(460px,45vw)`.

- [ ] **Step 3: Apply the minimal desktop CSS change**

In `web/src/styles/app.css`, change only the desktop utility and search declarations:

```css
.command-center-header__utilities { display:flex; align-items:center; justify-content:flex-end; gap:10px; min-width:0; flex:1; }
.command-center-search { display:flex; align-items:center; gap:10px; width:270px; height:54px; padding:0 16px; border:1px solid #dce3ec; border-radius:10px; background:#f6f8fa; color:#8491a5; }
```

Do not alter the `max-width:720px` or `max-width:520px` rules; they continue to override the desktop width and spacing.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run:

```powershell
npm.cmd test -- CommandCenterResponsive.test.js
```

Expected: 2 tests pass in `CommandCenterResponsive.test.js`.

- [ ] **Step 5: Commit the implementation**

```powershell
git add web/src/features/command-center/CommandCenterResponsive.test.js web/src/styles/app.css
git commit -m "fix: compact command center desktop search"
```

### Task 2: Verify and Publish the Slate-Only Change

**Files:**
- Verify: `web/src/styles/app.css`
- Verify: `web/src/features/command-center/CommandCenterResponsive.test.js`

- [ ] **Step 1: Run the complete frontend test suite**

Run from `web`:

```powershell
npm.cmd test
```

Expected: all frontend test files and tests pass with zero failures.

- [ ] **Step 2: Build the production frontend**

Run from `web`:

```powershell
npm.cmd run build
```

Expected: Vite exits with code 0 and produces the production assets.

- [ ] **Step 3: Confirm the deployment branch is clean and authorized**

Run from the repository root:

```powershell
git status --short
npm.cmd run catalyst:preflight:remote
```

Expected: Git prints no changes; preflight reports Development, `codex/geospatial-studio-core`, `migrationReady: true`, and `remoteMutationAuthorized: true`.

- [ ] **Step 4: Deploy only the Catalyst Slate client**

Run:

```powershell
catalyst.cmd deploy --only slate:ksp-crime-intelligence
```

Expected: Catalyst reports the `ksp-crime-intelligence` Slate deployment complete. Do not deploy Functions, data, Jobs, API Gateway, Authentication, or Production.

- [ ] **Step 5: Verify desktop behavior in the in-app browser**

Read the current short commit with `git rev-parse --short HEAD`, append it as the `release` query value, and open the resulting Command Center URL at 1280×756. Verify:

- the page title is `KSP ACE | Karnataka State Police`;
- the search field is 270 pixels wide;
- the search, avatar, notification, and team controls are right-aligned with 10-pixel gaps;
- the desktop header remains 90 pixels high and the rail remains 102 pixels wide;
- the account menu opens and Light/Dark/System remain selectable;
- no framework error overlay is present.

- [ ] **Step 6: Verify the narrow layout remains compact**

At 390×844, verify:

- document `scrollWidth` equals 390 pixels;
- header height is 64 pixels;
- rail width is 58 pixels;
- the search renders as the existing 40-pixel icon control;
- no framework error overlay is present.

# Login Viewport Fit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fit the complete production sign-in experience in standard desktop viewports without an inner scrollbar.

**Architecture:** Make a CSS-only adjustment to the existing login shell. Use one outer document scroll fallback for short/mobile viewports and preserve the current Catalyst iframe and React component behavior.

**Tech Stack:** React, CSS, Vitest, Testing Library, Vite

---

### Task 1: Add the viewport-fit regression

**Files:**
- Modify: `web/src/styles/viewport-layout.test.js`

- [ ] Add an assertion that `.secure-login__access` does not use `overflow-y: auto` on desktop.
- [ ] Add an assertion that a height-based media query makes `.secure-login` the scrolling surface and lets `.secure-login__shell` grow naturally.
- [ ] Run `npm.cmd test -- --run src/styles/viewport-layout.test.js` from `web/` and confirm the new assertion fails against the current CSS.

### Task 2: Apply the minimal CSS fix

**Files:**
- Modify: `web/src/styles/app.css`

- [ ] Remove the desktop access-column scroll container and stable scrollbar gutter.
- [ ] Compact only the vertical shell, iframe, judge-card, and footer spacing required to fit a standard desktop viewport.
- [ ] Add a short-height desktop media query that switches the outer page to document scrolling and removes the shell height cap.
- [ ] Run `npm.cmd test -- --run src/styles/viewport-layout.test.js src/auth/SignInRequired.test.jsx` from `web/` and confirm both test files pass.

### Task 3: Verify the production surface

**Files:**
- No production-file changes.

- [ ] Run `npm.cmd run test` from `web/` and require zero failures.
- [ ] Run `npm.cmd run build` from `web/` and require a successful production build.
- [ ] Render the sign-in route at standard desktop, short desktop, and mobile viewports; verify no inner scrollbar at standard desktop, one outer scrollbar when needed, no clipping, and working copy interaction.
- [ ] Inspect browser warnings/errors and record any unrelated existing messages.


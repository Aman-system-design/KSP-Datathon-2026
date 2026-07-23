# Professional Login Surface Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove invitation messaging and present a compact, professional Catalyst-authenticated KSP login screen.

**Architecture:** Keep Catalyst's embedded authentication iframe and existing responsive split shell. Change only the static login copy and spacing; no authentication logic, dependencies, or credential handling changes.

**Tech Stack:** Static HTML/CSS, Catalyst Web SDK v4, Vitest, Vite, Catalyst Slate.

---

### Task 1: Refine and deploy the login shell

**Files:**
- Modify: `web/src/auth/catalyst-auth.test.js`
- Modify: `web/public/login.html`

- [ ] **Step 1: Write the failing copy test**

Add assertions that `login.html` contains `Sign in` and `Access your Karnataka State Police workspace.` and does not contain `Access is invitation-only` or `Complete the Catalyst invitation`.

- [ ] **Step 2: Run the focused test and verify failure**

Run: `npm.cmd run test --workspace web -- src/auth/catalyst-auth.test.js`

Expected: failure because the approved heading and subtitle are absent and invitation text remains.

- [ ] **Step 3: Implement the approved shell**

In `web/public/login.html`, remove the `access-note` element and its CSS, change the heading to `Sign in`, change the subtitle to `Access your Karnataka State Police workspace.`, reduce the authentication grid to heading, iframe, error and footer, and preserve all Catalyst SDK configuration and error handling.

- [ ] **Step 4: Run focused and full verification**

Run:

```powershell
npm.cmd run test --workspace web -- src/auth/catalyst-auth.test.js
npm.cmd run web:test
npm.cmd run web:build
```

Expected: all tests pass and Vite production build exits zero.

- [ ] **Step 5: Deploy and browser-check**

Run: `catalyst.cmd deploy slate ksp-crime-intelligence`

Verify `https://aiksp.onslate.in/login.html` at desktop and narrow viewport widths. Confirm removed invitation text is absent, approved copy is present, native Catalyst form is usable, and no new console error is introduced.

- [ ] **Step 6: Commit only the login change**

```powershell
git add web/public/login.html web/src/auth/catalyst-auth.test.js docs/superpowers/plans/2026-07-23-professional-login-surface.md
git commit -m "fix(auth): simplify Catalyst login surface"
```

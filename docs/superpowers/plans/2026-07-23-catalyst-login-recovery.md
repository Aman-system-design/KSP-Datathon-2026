# Catalyst Login Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a branded, responsive, invitation-only Catalyst login that uses the approved crest and Roboto typography without clipping the native authentication form.

**Architecture:** Keep authentication on the dedicated same-origin `login.html`. The page loads locally hosted brand/font assets, invokes the official Catalyst Web SDK, and normalizes the injected iframe only for size and accessibility metadata; Catalyst continues to own credentials, validation, and sessions.

**Tech Stack:** Static HTML/CSS, Catalyst Web SDK v4.6.2, Vitest contract tests, Catalyst Slate.

---

### Task 1: Lock the login contract

**Files:**
- Modify: `web/src/auth/catalyst-auth.test.js`

- [ ] Add assertions that `public/login.html` references `/brand/karnataka-state-police.webp`, local Roboto WOFF2 assets, invitation-only guidance, a titled Catalyst iframe normalization hook, and a height greater than 480px.
- [ ] Run `npm.cmd run test --workspace web -- --run src/auth/catalyst-auth.test.js` and confirm the new assertions fail against the old page.

### Task 2: Add approved assets and rebuild the page

**Files:**
- Create: `web/public/brand/karnataka-state-police.webp`
- Create: `web/public/fonts/roboto-latin-400-normal.woff2`
- Create: `web/public/fonts/roboto-latin-500-normal.woff2`
- Create: `web/public/fonts/roboto-latin-700-normal.woff2`
- Modify: `web/public/login.html`
- Modify: `web/src/styles/tokens.css`

- [ ] Copy the supplied crest without transformation and copy the three bundled Roboto font files.
- [ ] Add same-origin `@font-face` declarations for weights 400, 500 and 700.
- [ ] Build the white/navy responsive enterprise layout with the crest proportionally contained.
- [ ] Add visible invitation-only access guidance without adding public registration.
- [ ] Observe the injected iframe, set `title="Catalyst secure sign in"`, and enforce a responsive height of at least 520px.
- [ ] Change the shared root font token from Inter to Roboto to match `Design.md`.
- [ ] Re-run the focused authentication test and confirm it passes.

### Task 3: Verify and release

**Files:**
- Modify only if verification exposes a defect: `web/public/login.html`

- [ ] Run `npm.cmd run web:test` and require zero failures.
- [ ] Run `npm.cmd run web:build` and require bundle-budget success.
- [ ] Deploy with `catalyst.cmd deploy slate -m "Repair Catalyst login experience"`.
- [ ] In the live browser, verify the native Catalyst form, iframe title, no nested scrolling, Roboto computed font, crest loading, empty-submit validation, and 1440px/390px layouts.
- [ ] Commit only source assets, tests, styles, and documentation; exclude generated function bundle dirt.
- [ ] Fast-forward the verified commits to `origin/main`.

# Production Login Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a compact, production-shaped Catalyst login surface with balanced KSP branding.

**Architecture:** Keep the immutable static sign-in document and Catalyst iframe integration. Change only the shell layout and iframe sizing; Catalyst remains responsible for credential capture and recovery.

**Tech Stack:** HTML, CSS, Catalyst Web SDK v4, Vitest, Vite, Catalyst Slate.

---

### Task 1: Lock the approved layout in regression tests

**Files:**
- Modify: `web/src/auth/catalyst-auth.test.js`

- [ ] Assert the immutable sign-in document contains a 960 px shell, 320 px identity rail, 380 px authentication width, 300 px iframe height, and integrated security note.
- [ ] Run `npm.cmd run test --workspace web -- --run src/auth/catalyst-auth.test.js` and confirm the new assertions fail against the oversized shell.

### Task 2: Implement the compact enterprise shell

**Files:**
- Modify: `web/public/ksp-sign-in-v2.html`
- Modify: `web/public/auth/catalyst-sign-in-v3.css`

- [ ] Reduce the desktop container and identity proportions.
- [ ] Wrap the form and security note in one 380 px authentication stack.
- [ ] Reduce iframe height to 300 px in CSS and frame normalization.
- [ ] Preserve responsive behavior and Catalyst-native credential handling.
- [ ] Re-run the targeted test and confirm it passes.

### Task 3: Verify and release

**Files:**
- No additional source files.

- [ ] Run `npm.cmd run web:test`.
- [ ] Run `npm.cmd run web:build`.
- [ ] Deploy Slate with `catalyst.cmd deploy slate ksp-crime-intelligence`.
- [ ] Browser-test the immutable production URL at desktop size and verify one heading, no invitation message, and the approved dimensions.

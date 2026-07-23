# Platform Viewport Fit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the platform fit the dynamic viewport by default while assigning overflow only to content regions that genuinely need scrolling.

**Architecture:** Establish one shared height contract at the document and application-shell boundaries. Keep navigation fixed, make the workspace the authenticated scroll owner, and let Catalyst authentication content scroll inside its constrained host at short viewport heights.

**Tech Stack:** React 19, Vite, Vitest, CSS Grid, Catalyst embedded authentication, Catalyst Slate

---

### Task 1: Guard the viewport contract

**Files:**
- Create: `web/src/styles/viewport-layout.test.js`
- Test: `web/src/styles/viewport-layout.test.js`

- [x] **Step 1: Write the failing CSS contract tests**

Read `tokens.css`, `app.css`, and `catalyst-sign-in-v4.css` and assert that the document root fills the viewport, the application shell is constrained to `100dvh`, the workspace is shrinkable and scrollable, and the Catalyst form document can scroll vertically.

- [x] **Step 2: Run the focused test and verify RED**

Run: `npm test -- --run src/styles/viewport-layout.test.js`

Expected: FAIL because the shared viewport contract is incomplete and Catalyst authentication currently hides overflow.

### Task 2: Implement centralized scroll ownership

**Files:**
- Modify: `web/src/styles/tokens.css`
- Modify: `web/src/styles/app.css`
- Modify: `web/public/auth/catalyst-sign-in-v4.css`
- Test: `web/src/styles/viewport-layout.test.js`

- [x] **Step 1: Constrain the document and application shell**

Add full-height, shrinkable root rules; change the desktop application shell to `height: 100dvh`, `min-height: 0`, and `overflow: hidden`; add `min-height: 0` to its scrollable workspace.

- [x] **Step 2: Constrain authentication without clipping actions**

Make the secure-login host exactly one dynamic viewport high, cap its shell to available height, and allow the access region and Catalyst form document to scroll vertically when password recovery content exceeds the available height.

- [x] **Step 3: Preserve mobile natural scrolling**

At the existing mobile breakpoint, restore auto height and document-level vertical scrolling so touch devices are not trapped inside nested scroll areas.

- [x] **Step 4: Run the focused test and verify GREEN**

Run: `npm test -- --run src/styles/viewport-layout.test.js`

Expected: PASS.

### Task 3: Verify the platform and release

**Files:**
- Modify only if verification reveals a viewport-contract defect.

- [x] **Step 1: Run complete automated verification**

Run: `npm test -- --run`

Run: `npm run build`

Expected: all tests pass and the production bundle builds.

- [x] **Step 2: Browser-test responsive viewport behavior**

Verify normal desktop, short desktop, and mobile viewports. Confirm primary authentication actions remain visible or reachable through the inner form scroll, the authenticated shell has no body-level scroll, and map panels use their available workspace.

- [ ] **Step 3: Commit, push, and deploy**

Stage only the viewport contract, test, specification, and plan files. Commit to the explicitly authorized `main` branch, push to GitHub, and deploy the Slate client to `aiksp.onslate.in`.

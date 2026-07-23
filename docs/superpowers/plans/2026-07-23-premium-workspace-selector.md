# Premium Workspace Selector Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a compact premium workspace-selection grid with a functional Command Centre destination while preserving Catalyst authentication.

**Architecture:** Keep backend-authorized personas as the source of truth and add Command Centre as a separately authorized presenter workspace, not as a fabricated RBAC role. Model each chooser item with a destination type so the router can navigate either to a governed persona query or the existing command-centre route.

**Tech Stack:** React 19, React Router, Vitest, Testing Library, CSS, Lucide React.

---

### Task 1: Specify the chooser behavior

**Files:**
- Modify: `web/src/auth/WorkspaceSelector.test.jsx`
- Modify: `web/src/app/router.test.jsx`

- [ ] **Step 1: Write failing tests**

Add assertions that the chooser renders a six-card grid for the five authorized demonstration personas plus Command Centre, maintains backend filtering, and passes a typed destination object when Continue is activated.

- [ ] **Step 2: Run the focused tests**

Run: `npm test -- --run src/auth/WorkspaceSelector.test.jsx src/app/router.test.jsx`

Expected: FAIL because Command Centre and destination objects are not implemented.

### Task 2: Implement destinations and compact cards

**Files:**
- Modify: `web/src/auth/WorkspaceSelector.jsx`
- Modify: `web/src/app/router.jsx`
- Modify: `web/src/app/workspace-navigation.js`

- [ ] **Step 1: Add presentation metadata**

Extend persona presentation metadata with icon names and define a separate Command Centre presentation whose destination is `/command-centre`.

- [ ] **Step 2: Render the accessible card grid**

Replace the row anatomy with selectable cards using the existing radio-group contract, icon component, and one Continue action.

- [ ] **Step 3: Route by destination type**

Keep persona selections on `/?persona=...` and route Command Centre directly to `/command-centre`.

- [ ] **Step 4: Run focused tests**

Run: `npm test -- --run src/auth/WorkspaceSelector.test.jsx src/app/router.test.jsx`

Expected: PASS.

### Task 3: Apply the responsive visual system

**Files:**
- Modify: `web/src/styles/app.css`

- [ ] **Step 1: Implement desktop, tablet, and mobile layouts**

Use a three-column desktop grid, two-column tablet grid, and one-column mobile layout. Keep the desktop shell within one 1080px-high viewport and expose visible hover, focus, and selected states.

- [ ] **Step 2: Build and run the full frontend tests**

Run: `npm test`

Expected: all tests pass.

Run: `npm run build`

Expected: Vite production build succeeds.

### Task 4: Browser verification and release

**Files:**
- Update generated client artifacts through the existing build/deploy workflow only.

- [ ] **Step 1: Verify locally**

Inspect the selector at desktop and mobile widths and verify keyboard selection, Continue, Command Centre routing, and sign out.

- [ ] **Step 2: Deploy only the Slate client**

Deploy the verified client without changing Catalyst Functions or authentication configuration.

- [ ] **Step 3: Verify production**

Open `https://aiksp.onslate.in/`, confirm login/session behavior independently, then verify the selector grid and both destination types.


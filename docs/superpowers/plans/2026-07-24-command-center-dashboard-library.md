# Command Center Dashboard Library Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a full Command Center Dashboard Library where users can browse authorized dashboards and name/create a new dashboard, reached from compact drawer actions.

**Architecture:** Keep the Command Center shell mounted for both canvas and library routes. The router derives browse/create mode from `/dashboards` and `create=1`, while the shell delegates the full-page experience to a focused library component and preserves persona/release query parameters. Creation uses the existing governed `POST /v1/dashboards` service and returns the user to the newly created dashboard.

**Tech Stack:** React 19, React Router 7, Vitest, Testing Library, existing Catalyst API client and Command Center CSS.

---

### Task 1: Dashboard drawer navigation

**Files:**
- Modify: `web/src/features/command-center/CommandCenterDashboardPicker.test.jsx`
- Modify: `web/src/features/command-center/CommandCenterDashboardPicker.jsx`

- [ ] **Step 1: Write failing tests** asserting `+ New dashboard` calls `onCreate` and closes, while `Open all dashboards` calls `onOpenAll` and closes without expanding sections inline.
- [ ] **Step 2: Run test to verify it fails** with `npm test -- CommandCenterDashboardPicker.test.jsx` and confirm the new action/close expectations fail.
- [ ] **Step 3: Implement minimal drawer actions** by adding `onCreate`, removing `showAll`, and making both footer/header actions navigate through callbacks.
- [ ] **Step 4: Run test to verify it passes** with `npm test -- CommandCenterDashboardPicker.test.jsx`.

### Task 2: Full Dashboard Library and create flow

**Files:**
- Create: `web/src/features/command-center/CommandCenterDashboardLibrary.test.jsx`
- Create: `web/src/features/command-center/CommandCenterDashboardLibrary.jsx`

- [ ] **Step 1: Write failing tests** for an empty browse page, searchable authorized sections, create-mode naming, blank-name validation, and `api.post('/v1/dashboards', { name, description: '' })` followed by `onCreated(id)`.
- [ ] **Step 2: Run test to verify it fails** with `npm test -- CommandCenterDashboardLibrary.test.jsx` because the component does not exist.
- [ ] **Step 3: Implement the focused library** with a compact header, search, relationship sections, honest zero-dashboard state, and an inline create panel shown only in create mode.
- [ ] **Step 4: Run test to verify it passes** with `npm test -- CommandCenterDashboardLibrary.test.jsx`.

### Task 3: Route, shell, and empty-state integration

**Files:**
- Modify: `web/src/app/router.test.jsx`
- Modify: `web/src/app/router.jsx`
- Modify: `web/src/features/command-center/CommandCenterShell.test.jsx`
- Modify: `web/src/features/command-center/CommandCenterShell.jsx`
- Modify: `web/src/features/command-center/CommandCenterDashboardWorkspace.jsx`
- Modify: `web/src/features/command-center/CommandCenterWorkspaceToolbar.test.jsx`
- Modify: `web/src/features/command-center/CommandCenterWorkspaceToolbar.jsx`
- Modify: `web/src/features/command-center/CommandCenterDashboardCanvas.test.jsx`
- Modify: `web/src/features/command-center/CommandCenterDashboardCanvas.jsx`

- [ ] **Step 1: Write failing tests** for preserved persona/release navigation, `/dashboards` browse/create modes, returning to `dashboard=<id>`, hidden toolbar actions without a dashboard, and the Intelligence Workspace copy.
- [ ] **Step 2: Run focused tests to verify failure** with `npm test -- router.test.jsx CommandCenterShell.test.jsx CommandCenterWorkspaceToolbar.test.jsx CommandCenterDashboardCanvas.test.jsx`.
- [ ] **Step 3: Implement integration** using `URLSearchParams` helpers, shell `view/createMode` props, library rendering, drawer callbacks, requested dashboard selection, and conditional toolbar rendering.
- [ ] **Step 4: Run focused tests to verify they pass** with the same command.

### Task 4: Premium compact styling and verification

**Files:**
- Modify: `web/src/styles.css`

- [ ] **Step 1: Add compact library, create panel, drawer action, empty-state, and dashboard-only toolbar styles** using existing Command Center tokens and responsive rules.
- [ ] **Step 2: Run the full frontend suite** with `npm test`; expected result is all tests passing.
- [ ] **Step 3: Build production assets** with `npm run build`; expected result is a successful Vite build.
- [ ] **Step 4: Browser verify** drawer-to-library navigation, zero-dashboard browse page, create-mode naming, successful creation/open, and 100% zoom layout.

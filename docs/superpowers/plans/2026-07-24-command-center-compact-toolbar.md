# Command Centre Compact Toolbar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the redundant empty-workspace title and reduce the dashboard utility strip to a compact 34-pixel control row.

**Architecture:** Keep the existing toolbar component and its dashboard-scoped controls. Render the title only for a real dashboard, then adjust the existing CSS sizing without moving controls into the global application header.

**Tech Stack:** React 19, CSS, Vitest, Testing Library.

---

### Task 1: Compact the dashboard toolbar

**Files:**
- Modify: `web/src/features/command-center/CommandCenterWorkspaceToolbar.jsx`
- Modify: `web/src/features/command-center/CommandCenterWorkspaceToolbar.test.jsx`
- Modify: `web/src/styles/app.css`

- [ ] **Step 1: Write a failing rendering contract**

Add a test that renders `dashboard={null}` and asserts `Command Centre` is absent while the disabled Overview, Edit dashboard, and Present controls remain.

- [ ] **Step 2: Verify RED**

Run `npm.cmd test -- --run src/features/command-center/CommandCenterWorkspaceToolbar.test.jsx` and confirm it fails because the generic title is still rendered.

- [ ] **Step 3: Implement the compact toolbar**

Render `.command-center-workspace-title` only when `dashboard` exists. Set the workspace grid row to `34px`, control height to `26px`, horizontal padding to `8px`, and gaps to `4px`.

- [ ] **Step 4: Verify GREEN and regressions**

Run the focused test, full frontend test suite, production build, and `git diff --check`.

- [ ] **Step 5: Deploy and integrate**

Commit the refinement, deploy only `slate:ksp-crime-intelligence`, verify the live asset and toolbar, merge the feature branch into `main`, and push `main` to `origin`.

# Shared Catalyst Shell and State Leadership Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Standardize the Catalyst-style application header and reduce State Leadership navigation to Home, Intelligence, Alerts, Reports, and Dashboards.

**Architecture:** Reuse the existing `PlatformHeader`, `AppSidebar`, role navigation map, and installed icon primitive. The Command Centre adopts the shared header through props from the authorized router; State Leadership gets a role-specific module list while other roles keep their existing destinations.

**Tech Stack:** React 19, React Router, Vitest, Testing Library, CSS.

---

### Task 1: State Leadership navigation

**Files:**
- Modify: `web/src/app/workspace-navigation.test.js`
- Modify: `web/src/app/workspace-navigation.js`

- [ ] Add a failing assertion that State Leadership exposes exactly `/`, `/intelligence`, `/alerts`, `/reports`, and `/dashboards`.
- [ ] Run `npm test -- workspace-navigation.test.js` from `web` and confirm the old utilities/geospatial/network list fails.
- [ ] Define the minimal State Leadership module array and reuse existing route/icon names.
- [ ] Re-run the focused test.

### Task 2: Shared header utilities

**Files:**
- Modify: `web/src/app/AppShell.test.jsx`
- Modify: `web/src/app/PlatformHeader.jsx`
- Modify: `web/src/components/icons.jsx`
- Modify: `web/src/styles/app.css`

- [ ] Add failing assertions for Support, Alerts, Settings, and Account controls in the shared header.
- [ ] Run `npm test -- AppShell.test.jsx` and confirm Support and Settings are missing.
- [ ] Add the two icon paths and two accessible utility buttons, preserving Alerts and Account behavior.
- [ ] Re-run the focused test.

### Task 3: Command Centre header reuse

**Files:**
- Modify: `web/src/features/command-center/CommandCenterShell.test.jsx`
- Modify: `web/src/features/command-center/CommandCenterShell.jsx`
- Modify: `web/src/app/router.jsx`
- Modify: `web/src/styles/app.css`

- [ ] Add a failing test proving Command Centre renders the shared Catalyst header utilities.
- [ ] Run the focused Command Centre test and confirm failure.
- [ ] Pass workspace/auth/persona navigation into Command Centre and render `PlatformHeader`.
- [ ] Keep the existing command rail and canvas; remove only redundant header ownership.
- [ ] Re-run focused tests.

### Task 4: Verification

- [ ] Run all web tests with `npm test`.
- [ ] Run `npm run build`.
- [ ] Inspect State Leadership and Command Centre in the browser at desktop width.


# KSP Intelligence Label and Workspace Selector Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Display `KSP Intelligence` instead of `Demo Presenter`, normalize the Command Centre card, and fit the selector to ordinary desktop viewports without changing the internal `DEMO_PRESENTER` authorization role.

**Architecture:** Add one presentation-only role-label function beside the existing title-case helper. Use it wherever the authenticated internal role is rendered, remove the Command Centre-only class, and compact the existing selector CSS rather than creating another layout. Policies, Catalyst rows, API contracts, and routing continue to use `DEMO_PRESENTER`.

**Tech Stack:** React 19, Vitest, Testing Library, Vite, Catalyst Slate

---

### Task 1: Add the stable role-label boundary

**Files:**
- Create: `web/src/app/workspace-labels.test.js`
- Modify: `web/src/app/workspace-labels.js`

- [ ] **Step 1: Write the failing label test**

```js
import { describe, expect, test } from 'vitest';
import { roleLabel } from './workspace-labels.js';

describe('roleLabel', () => {
  test('uses the product label for the internal presenter role', () => {
    expect(roleLabel('DEMO_PRESENTER')).toBe('KSP Intelligence');
  });

  test('keeps ordinary role labels human-readable', () => {
    expect(roleLabel('CRIME_ANALYST')).toBe('Crime Analyst');
  });
});
```

- [ ] **Step 2: Run the test and verify that the missing export fails**

Run: `npm.cmd --prefix web test -- workspace-labels.test.js`

Expected: FAIL because `roleLabel` is not exported.

- [ ] **Step 3: Implement the smallest presentation mapping**

Append to `web/src/app/workspace-labels.js`:

```js
const roleLabels = Object.freeze({ DEMO_PRESENTER: 'KSP Intelligence' });

export const roleLabel = value => roleLabels[value] ?? titleCase(value);
```

- [ ] **Step 4: Run the label test**

Run: `npm.cmd --prefix web test -- workspace-labels.test.js`

Expected: 2 tests pass.

### Task 2: Apply the product label to authenticated UI surfaces

**Files:**
- Modify: `web/src/auth/WorkspaceSelector.jsx`
- Modify: `web/src/auth/WorkspaceSelector.test.jsx`
- Modify: `web/src/app/AccountMenu.jsx`
- Modify: `web/src/app/AppShell.test.jsx`
- Modify: `web/src/features/admin/PersonaDirectory.jsx`
- Modify: `web/src/features/admin/PersonaDirectory.test.jsx`

- [ ] **Step 1: Add failing UI assertions**

In `WorkspaceSelector.test.jsx`, assert:

```js
expect(screen.getByText('KSP Intelligence')).toBeVisible();
expect(screen.queryByText('Demo Presenter')).not.toBeInTheDocument();
```

In `AppShell.test.jsx`, replace the presenter identity assertion with:

```js
expect(screen.getByText('KSP Intelligence')).toBeInTheDocument();
```

In `PersonaDirectory.test.jsx`, replace the platform-administrator copy assertion with:

```js
expect(screen.getByText(/KSP Intelligence account is required/i)).toBeInTheDocument();
```

- [ ] **Step 2: Run focused UI tests and verify failure**

Run: `npm.cmd --prefix web test -- WorkspaceSelector.test.jsx AppShell.test.jsx PersonaDirectory.test.jsx`

Expected: FAIL on the new `KSP Intelligence` assertions.

- [ ] **Step 3: Render the mapped label and update presenter copy**

In `WorkspaceSelector.jsx`, import `roleLabel` and render the footer with `roleLabel(workspace.role)`.

In `AccountMenu.jsx`, use `roleLabel` for `workspace.role` and `identity.actualRole`, retain `titleCase` for operational personas, and change the return action to `Return to KSP Intelligence`.

In `PersonaDirectory.jsx`, replace visible presenter wording with `KSP Intelligence` while keeping role checks unchanged.

- [ ] **Step 4: Run focused frontend tests**

Run: `npm.cmd --prefix web test -- workspace-labels.test.js WorkspaceSelector.test.jsx AppShell.test.jsx PersonaDirectory.test.jsx AccountMenu.test.jsx`

Expected: all focused tests pass.

### Task 3: Verify authorization compatibility and release build

**Files:**
- No source changes expected.

- [ ] **Step 1: Run backend authorization regression tests**

Run: `node --test tests/backend/security.test.mjs`

Expected: 7 tests pass; internal `DEMO_PRESENTER` behavior remains unchanged.

- [ ] **Step 2: Run the complete frontend test suite**

Run: `npm.cmd --prefix web test`

Expected: all frontend tests pass.

- [ ] **Step 3: Build the Slate client**

Run: `npm.cmd --prefix web run build`

Expected: Vite exits successfully and writes `web/dist`.

- [ ] **Step 4: Commit only the label implementation**

Run: `git add` only for the plan and eight label-related frontend files, then `git commit -m "fix: label presenter as KSP Intelligence"`.

Expected: unrelated working-tree changes remain unstaged.

- [ ] **Step 5: Deploy and verify the canonical URL**

Deploy the verified `web/dist` through the existing Catalyst Slate release workflow, then open `https://aiksp.onslate.in/` and confirm the workspace selector and account menu display `KSP Intelligence` while persona switching remains functional.

### Task 4: Normalize and fit the workspace selector

**Files:**
- Modify: `web/src/auth/WorkspaceSelector.jsx`
- Modify: `web/src/auth/WorkspaceSelector.test.jsx`
- Modify: `web/src/styles/app.css`

- [ ] **Step 1: Add the failing card-uniformity assertion**

Select the Command Centre radio in `WorkspaceSelector.test.jsx` and assert its class does not contain `workspace-entry__card--command`.

- [ ] **Step 2: Run the selector test and verify failure**

Run: `npm.cmd --prefix web test -- WorkspaceSelector.test.jsx`

Expected: FAIL because Command Centre still receives the special class.

- [ ] **Step 3: Remove the special class and compact the existing CSS**

Render every workspace card with only the `selected` class. Delete the two `.workspace-entry__card--command` selectors. Change the panel to fill the available grid row with border-box sizing and no internal overflow; reduce desktop card height and vertical spacing, and add a short-viewport media query. Preserve document scrolling in the existing mobile media query.

- [ ] **Step 4: Run selector tests and browser layout verification**

Run: `npm.cmd --prefix web test -- WorkspaceSelector.test.jsx`

Expected: all selector tests pass.

At a desktop viewport, verify `scrollHeight <= clientHeight` for `.workspace-entry__panel`, the footer is visible, and all six icons share the same computed foreground/background treatment.

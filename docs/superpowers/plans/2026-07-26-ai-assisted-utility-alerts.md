# AI-Assisted Utility Alerts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Utilities a working Command Centre module and make utility alerting visibly, truthfully AI-assisted with Command Centre delivery enabled by default.

**Architecture:** Keep model metadata in the existing server-owned utility registry and render utility-specific explanations from that governed contract. Extend the existing recipient-role allowlist without changing storage. Repair the Command Centre rail so module selections navigate through the router's existing governed destination helper.

**Tech Stack:** React 19, React Router, Vitest/Testing Library, Node.js ESM backend, Zoho Catalyst functions, CSS.

---

### Task 1: Make Utilities a real Command Centre destination

**Files:**
- Modify: `web/src/features/command-center/command-center-navigation.js`
- Modify: `web/src/features/command-center/CommandCenterShell.jsx`
- Modify: `web/src/features/command-center/CommandCenterShell.test.jsx`
- Modify: `web/src/app/router.test.jsx`

- [ ] **Step 1: Write failing navigation tests**

Add assertions that the rail contains a `Utilities` button, clicking it calls `onModuleNavigate('utilities')`, and `commandCenterModuleLocation('?release=qa', 'utilities')` returns `/utilities?release=qa&persona=COMMAND_CENTER`.

- [ ] **Step 2: Run the focused tests and verify failure**

Run: `npm run test --workspace web -- --run src/features/command-center/CommandCenterShell.test.jsx src/app/router.test.jsx`

Expected: FAIL because Utilities is absent and `CommandCenterShell` ignores `onModuleNavigate`.

- [ ] **Step 3: Implement minimal governed navigation**

Add `{ id: 'utilities', label: 'Utilities', icon: Boxes }` to `commandCenterDestinations`. Accept `onModuleNavigate` in `CommandCenterShell`; keep `home` and `dashboards` local, and call `onModuleNavigate(id)` for Utilities and the other governed modules.

- [ ] **Step 4: Re-run focused tests**

Run: `npm run test --workspace web -- --run src/features/command-center/CommandCenterShell.test.jsx src/app/router.test.jsx`

Expected: PASS.

### Task 2: Support Command Centre as a persisted alert recipient

**Files:**
- Modify: `src/backend/utilities/rule-contract.mjs`
- Modify: `tests/backend/utility-rules.test.mjs`

- [ ] **Step 1: Write failing recipient-contract tests**

Add a creation test with `recipientRoles: ['COMMAND_CENTER', 'CRIME_ANALYST']` and assert the public rule and stored `RecipientRolesJSON` preserve the canonical role order. Retain existing rejection tests for unknown and duplicate recipients.

- [ ] **Step 2: Run focused backend tests and verify failure**

Run: `node --test tests/backend/utility-rules.test.mjs`

Expected: FAIL with `unsupported recipient role`.

- [ ] **Step 3: Extend the canonical recipient allowlist**

Place `COMMAND_CENTER` first in `recipientRoleOrder`. Do not change the persisted JSON shape or existing rules.

- [ ] **Step 4: Re-run focused backend tests**

Run: `node --test tests/backend/utility-rules.test.mjs tests/backend/utility-evaluator.test.mjs`

Expected: PASS, including generated alert evidence containing both recipients.

### Task 3: Explain the model and governance in the alert workflow

**Files:**
- Modify: `src/backend/utilities/utility-registry.mjs`
- Modify: `tests/backend/utility-registry.test.mjs`
- Modify: `web/src/features/utilities/UtilityPage.jsx`
- Modify: `web/src/features/utilities/UtilityPage.test.jsx`
- Modify: `web/src/features/utilities/utility-policy.css`

- [ ] **Step 1: Write failing registry and UI tests**

Require each available utility to return an `aiAssistance` object with `label`, `methodVersion`, and a substantive `explanation`. In the UI test, assert that the alert-policy panel contains `AI-assisted detection`, the utility method/version, human-governed threshold language, and the human-review warning. Assert new drafts select both Command Centre and Crime Analyst and submit both roles.

- [ ] **Step 2: Verify the focused tests fail**

Run: `node --test tests/backend/utility-registry.test.mjs`

Run: `npm run test --workspace web -- --run src/features/utilities/UtilityPage.test.jsx`

Expected: FAIL because the registry lacks `aiAssistance`, the UI lacks the explanation panel, and Command Centre is not a recipient option.

- [ ] **Step 3: Add truthful governed model metadata**

Add immutable metadata to the three available utility definitions:

- Pattern fusion `PF-1.0`: explains feature-linking and confidence as an investigative lead.
- DBSCAN `DBSCAN-1.0`: explains spatial/time-window density clustering.
- Median/MAD `MAD-1.0`: explains robust baseline departure detection.

Every explanation must distinguish machine-generated signal from the human-governed delivery threshold and end with human review.

- [ ] **Step 4: Render one compact explanatory panel**

Validate `aiAssistance` in the existing utility client contract. Add Command Centre to `recipientOptions`, default new drafts to `['COMMAND_CENTER', 'CRIME_ANALYST']`, and render one pale-blue/orange-accent panel above the editable fields. Keep existing policies unchanged.

- [ ] **Step 5: Improve the evaluation narrative without inventing data**

Keep the authoritative counts and add two sentences: published model findings were assessed within governed scope/window; matching findings qualified under the human policy while the rest were suppressed. Do not fabricate confidence values.

- [ ] **Step 6: Re-run registry and UI tests**

Run: `node --test tests/backend/utility-registry.test.mjs`

Run: `npm run test --workspace web -- --run src/features/utilities/UtilityPage.test.jsx`

Expected: PASS.

### Task 4: Integrate, verify, and release to Development

**Files:**
- Generated by build: `functions/crime_intelligence_api/app/src/backend/**`
- Generated by build: `functions/intelligence_refresh/app/src/backend/**`

- [ ] **Step 1: Run all relevant tests**

Run: `node --test tests/backend/utility-rules.test.mjs tests/backend/utility-registry.test.mjs tests/backend/utility-evaluator.test.mjs tests/backend/utility-services.test.mjs`

Run: `npm run test --workspace web -- --run src/features/utilities/UtilityPage.test.jsx src/features/command-center/CommandCenterShell.test.jsx src/app/router.test.jsx`

Expected: PASS with zero failures.

- [ ] **Step 2: Build the web app and Catalyst functions**

Run: `npm run web:build`

Run: `npm run catalyst:build`

Run: `npm run catalyst:inspect`

Expected: all commands exit 0 and generated function copies match source.

- [ ] **Step 3: Inspect the complete diff and protect unrelated work**

Run: `git diff --check`

Run: `git status --short`

Expected: no whitespace errors; only this feature plus the already-present concurrent refresh/reporting work is visible. Stage only reviewed feature files and intentional generated copies.

- [ ] **Step 4: Commit and push main**

Commit the tested feature with `feat: add AI-assisted Command Centre utility alerts`, then push `main` after confirming no upstream divergence.

- [ ] **Step 5: Deploy Development and Slate**

Deploy the two Catalyst functions and Slate client to the existing Development project. Do not deploy Production.

- [ ] **Step 6: Verify the live workflow visually and functionally**

Use the in-app browser at the accepted desktop viewport and a mobile viewport. Verify Command Centre → Utilities navigation, explanation copy, default recipients, save, evaluation, and alert link. Capture the implementation screenshot and compare it with the accepted Catalyst-inspired utility surface using `view_image`, checking copy, hierarchy, typography, palette, spacing, and responsive behavior.

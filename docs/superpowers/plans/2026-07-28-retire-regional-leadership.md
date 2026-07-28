# Retire Regional Leadership Platform-Wide Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove `REGIONAL_LEADERSHIP` from all active presentation, runtime, authorization, dashboard, disclosure, and utility contracts while preventing stale persona data from crashing Command Center.

**Architecture:** Retire the role at both trust boundaries. Frontend catalogues reject it and filter any unsupported presentation before rendering; backend policy and role contracts no longer authorize it. Keep Catalyst Function mirrors synchronized with canonical backend source, deploy the verified web fix to Development, and do not touch Production.

**Tech Stack:** React 19, React Router, Vitest, Node.js test runner, JSON access policy, Zoho Catalyst Functions and Slate

---

### Task 1: Make Command Center stale-persona-safe

**Files:**
- Create: `web/src/features/command-center/CommandCenterPersonaMenu.test.jsx`
- Modify: `web/src/features/command-center/CommandCenterPersonaMenu.jsx`

- [ ] **Step 1: Add the failing menu regression test**

```jsx
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { CommandCenterPersonaMenu } from './CommandCenterPersonaMenu.jsx';

afterEach(cleanup);

test('filters retired and unsupported personas without crashing the account menu', () => {
  const onSelect = vi.fn();
  render(<CommandCenterPersonaMenu
    personas={['STATE_LEADERSHIP', 'REGIONAL_LEADERSHIP', 'CRIME_ANALYST']}
    onSelect={onSelect}
    onAllWorkspaces={vi.fn()}
  />);
  expect(screen.queryByText('Regional Leadership')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('menuitem', { name: 'Crime Analyst' }));
  expect(onSelect).toHaveBeenCalledWith('CRIME_ANALYST');
});
```

- [ ] **Step 2: Run the test and confirm the current null dereference**

Run from `web/`:

```powershell
npm.cmd test -- src/features/command-center/CommandCenterPersonaMenu.test.jsx --reporter=verbose
```

Expected: FAIL because `presentation.label` is read when `getPersonaPresentation()` returns `null`.

- [ ] **Step 3: Filter non-presentable roles before rendering**

Replace the direct `personas.map` block with:

```jsx
{personas.map(role => ({ role, presentation: getPersonaPresentation(role) }))
  .filter(item => item.presentation)
  .map(({ role, presentation }) => (
    <button key={role} type="button" role="menuitem" onClick={() => onSelect(role)}>
      {presentation.label}
    </button>
  ))}
```

- [ ] **Step 4: Run the menu test**

Expected: PASS with one supported persona selection and no Regional item.

- [ ] **Step 5: Commit the crash fix**

```powershell
git add -- web/src/features/command-center/CommandCenterPersonaMenu.jsx web/src/features/command-center/CommandCenterPersonaMenu.test.jsx
git commit -m "fix: filter retired Command Center personas"
```

### Task 2: Remove Regional Leadership from active frontend contracts

**Files:**
- Modify: `web/src/app/runtime.js`
- Modify: `web/src/app/runtime.test.js`
- Modify: `web/src/app/workspace-navigation.js`
- Modify: `web/src/app/workspace-navigation.test.js`
- Modify: `web/src/features/workspaces/PersonaWorkspace.jsx`
- Modify: `web/src/features/workspaces/PersonaWorkspace.test.jsx`
- Modify: `web/src/features/utilities/UtilityPage.jsx`
- Modify: `web/src/features/utilities/UtilityPage.test.jsx`
- Modify: `web/src/app/AppShell.test.jsx`

- [ ] **Step 1: Strengthen failing retirement assertions**

Add or update assertions so:

```js
expect(readDemoPersona('?persona=REGIONAL_LEADERSHIP')).toBeNull();
expect(getPersonaPresentation('REGIONAL_LEADERSHIP')).toBeNull();
```

Update workspace and utility fixtures so the supported catalogue contains only `COMMAND_CENTER`, `STATE_LEADERSHIP`, `DISTRICT_LEADERSHIP`, `CRIME_ANALYST`, and `STATION_OPERATIONS`. Keep one stale Regional value in a filtering test to prove it is ignored.

- [ ] **Step 2: Run the focused frontend contract tests**

```powershell
npm.cmd test -- src/app/runtime.test.js src/app/workspace-navigation.test.js src/app/AppShell.test.jsx src/features/workspaces/PersonaWorkspace.test.jsx src/features/utilities/UtilityPage.test.jsx --reporter=verbose
```

Expected: at least the runtime direct-persona assertion fails before implementation.

- [ ] **Step 3: Remove the role from active frontend code**

- Remove it from `demoPersonas` in `runtime.js`.
- Remove its `roleDefinitions` entry from `workspace-navigation.js` while retaining `getPersonaPresentation('REGIONAL_LEADERSHIP') === null` as the explicit fail-closed compatibility guard.
- Remove the Regional title and render branch from `PersonaWorkspace.jsx`.
- Remove the Regional label and supported-role membership from `UtilityPage.jsx`.

- [ ] **Step 4: Run focused frontend tests**

Expected: all listed test files pass.

- [ ] **Step 5: Commit frontend retirement**

```powershell
git add -- web/src/app/runtime.js web/src/app/runtime.test.js web/src/app/workspace-navigation.js web/src/app/workspace-navigation.test.js web/src/app/AppShell.test.jsx web/src/features/workspaces/PersonaWorkspace.jsx web/src/features/workspaces/PersonaWorkspace.test.jsx web/src/features/utilities/UtilityPage.jsx web/src/features/utilities/UtilityPage.test.jsx
git commit -m "refactor: retire Regional Leadership frontend role"
```

### Task 3: Remove backend authorization and service contracts

**Files:**
- Modify: `config/access-policy.json`
- Modify: `src/backend/security/disclosure.mjs`
- Modify: `src/backend/reporting/dashboard-service.mjs`
- Modify: `src/backend/utilities/rule-contract.mjs`
- Modify: `tests/backend/security.test.mjs`
- Modify: `tests/backend/utility-rules.test.mjs`
- Modify: `tests/reporting/dashboard-service.test.mjs`

- [ ] **Step 1: Add failing backend retirement assertions**

Update tests to assert:

```js
assert.equal(policy.personaAllowlist.includes('REGIONAL_LEADERSHIP'), false);
assert.equal(Object.hasOwn(policy.roles, 'REGIONAL_LEADERSHIP'), false);
assert.equal(errorCode(() => resolveAccess({
  currentUser: user,
  profile: { ...profile, DefaultRole: 'REGIONAL_LEADERSHIP' },
  environment: 'Development',
  policy,
})), 'INACTIVE_ACCESS_PROFILE');
```

Add Regional to the invalid dashboard-default role cases and assert utility rule normalization rejects `roles: ['REGIONAL_LEADERSHIP']`. Remove Regional from disclosure success-role loops, then assert `projectPattern()` with `role: 'REGIONAL_LEADERSHIP'` and an otherwise authorized unit throws `NOT_FOUND`.

- [ ] **Step 2: Run focused backend tests**

```powershell
node --test tests/backend/security.test.mjs tests/backend/utility-rules.test.mjs tests/reporting/dashboard-service.test.mjs
```

Expected: FAIL while active backend contracts still include Regional Leadership.

- [ ] **Step 3: Remove backend role membership**

- Delete `REGIONAL_LEADERSHIP` from `roles` and its permission property in `config/access-policy.json`.
- Delete it from the disclosure role set in `src/backend/security/disclosure.mjs`.
- Delete it from the dashboard assignable-role set in `src/backend/reporting/dashboard-service.mjs`.
- Delete it from allowed utility-rule roles in `src/backend/utilities/rule-contract.mjs`.

- [ ] **Step 4: Run focused backend tests**

Expected: all three test files pass.

- [ ] **Step 5: Commit backend retirement**

```powershell
git add -- config/access-policy.json src/backend/security/disclosure.mjs src/backend/reporting/dashboard-service.mjs src/backend/utilities/rule-contract.mjs tests/backend/security.test.mjs tests/backend/utility-rules.test.mjs tests/reporting/dashboard-service.test.mjs
git commit -m "refactor: retire Regional Leadership authorization"
```

### Task 4: Synchronize Catalyst Function mirrors safely

**Files:**
- Modify: `functions/crime_intelligence_api/app/config/access-policy.json`
- Modify: `functions/crime_intelligence_api/app/src/backend/security/disclosure.mjs`
- Modify: `functions/crime_intelligence_api/app/src/backend/reporting/dashboard-service.mjs`
- Modify: `functions/crime_intelligence_api/app/src/backend/utilities/rule-contract.mjs`
- Modify: `functions/crime_intelligence_api/app/bundle-manifest.json`
- Modify: `functions/intelligence_refresh/app/config/access-policy.json`
- Modify: `functions/intelligence_refresh/app/src/backend/utilities/rule-contract.mjs`
- Modify: `functions/intelligence_refresh/app/bundle-manifest.json`

- [ ] **Step 1: Rebuild Function mirrors from canonical source**

```powershell
npm.cmd run catalyst:build
```

Expected: Function application bundles regenerate successfully.

- [ ] **Step 2: Verify no active runtime copy contains the retired role**

```powershell
rg -n "REGIONAL_LEADERSHIP" config src functions web/src --glob '!**/*.test.*'
```

Expected: no matches in active runtime code or policy.

- [ ] **Step 3: Inspect bundles**

```powershell
npm.cmd run catalyst:inspect
```

Expected: both Function bundles pass inspection.

- [ ] **Step 4: Commit generated mirror changes only**

Stage the eight Function files listed above, inspect `git diff --cached --stat`, and commit:

```powershell
git commit -m "build: synchronize retired Regional role"
```

### Task 5: Update current product documentation

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Replace active Regional wording**

Change the current persona row from `District / Regional Leadership` to `District Leadership`. Do not edit historical files under `docs/superpowers/specs/` or `docs/superpowers/plans/`.

- [ ] **Step 2: Verify active-code and current-doc scan**

```powershell
rg -n "REGIONAL_LEADERSHIP|Regional Leadership|regional leadership" README.md config src functions web/src --glob '!**/*.test.*'
```

Expected: no matches.

- [ ] **Step 3: Commit README update**

```powershell
git add -- README.md
git commit -m "docs: remove retired Regional Leadership persona"
```

### Task 6: Verify and deploy Development safely

**Files:**
- Verify all changed files.

- [ ] **Step 1: Run retirement-focused tests**

```powershell
node --test tests/backend/security.test.mjs tests/backend/utility-rules.test.mjs tests/reporting/dashboard-service.test.mjs
npm.cmd test -- src/features/command-center/CommandCenterPersonaMenu.test.jsx src/app/runtime.test.js src/app/workspace-navigation.test.js src/app/AppShell.test.jsx src/features/workspaces/PersonaWorkspace.test.jsx src/features/utilities/UtilityPage.test.jsx --reporter=verbose
npm.cmd run build
```

Expected: zero failures and a successful Vite build.

- [ ] **Step 2: Record Production asset baseline**

Read the current module asset from `https://acep.onslate.in/` and retain its exact hashed URL.

- [ ] **Step 3: Deploy Slate to Development only**

```powershell
catalyst.cmd -p 43492000000013049 --dc in -ni deploy slate ksp-crime-intelligence -m "Retire Regional Leadership and fix persona switching"
```

Expected: Development Slate becomes live at `https://ace.onslate.in`; no `--production` flag is used.

- [ ] **Step 4: Defer Function deployment unless bundle parity is proven**

Compare each generated Function file to the latest corresponding file in the user’s main working tree. If unrelated main-tree changes would be regressed, do not deploy Functions; report the backend commits as ready for integration. If parity is exact except for the Regional retirement, deploy only the affected Development Functions with Catalyst CLI and verify the deployment output.

- [ ] **Step 5: Verify the live click path**

Open `https://ace.onslate.in/?persona=COMMAND_CENTER&release=regional-retirement`, click the unique `Open account menu` button, and verify:

- the application root remains non-empty;
- Regional Leadership is absent;
- select Crime Analyst, then Station Operations;
- each supported persona renders without refresh and retains its persona query.

- [ ] **Step 6: Verify Production isolation**

Re-read `https://acep.onslate.in/` and confirm its module asset URL matches the baseline exactly.

# Remove Regional Leadership Persona Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove Regional Leadership from all user-visible persona choices without changing backend role authorization.

**Architecture:** Keep backend policy and role definitions intact. Apply an MVP presentation allowlist in `workspace-navigation.js`, and make `WorkspaceSelector` consume only catalogue-approved personas so stale backend allowlists cannot expose Regional Leadership.

**Tech Stack:** React, JavaScript, Vitest, Testing Library, Vite, Catalyst Slate

---

### Task 1: Hide Regional Leadership at the presentation boundary

**Files:**
- Modify: `web/src/app/workspace-navigation.js`
- Modify: `web/src/auth/WorkspaceSelector.jsx`
- Test: `web/src/auth/WorkspaceSelector.test.jsx`
- Test: `web/src/app/workspace-navigation.test.js`

- [x] **Step 1: Write the failing selector test**

Add `REGIONAL_LEADERSHIP` to the backend persona fixture and assert that no Regional Leadership radio is rendered:

```jsx
personaSwitch: { allowed: true, personas: ['STATE_LEADERSHIP', 'REGIONAL_LEADERSHIP', 'CRIME_ANALYST'] }

expect(screen.queryByRole('radio', { name: /Regional Leadership/i })).not.toBeInTheDocument();
```

Add a catalogue test:

```js
expect(getPersonaPresentation('REGIONAL_LEADERSHIP')).toBeNull();
```

- [x] **Step 2: Run tests and verify the expected failure**

Run:

```powershell
npm.cmd test -- --run src/auth/WorkspaceSelector.test.jsx src/app/workspace-navigation.test.js
```

Expected: FAIL because Regional Leadership is still present and `getPersonaPresentation` still returns its presentation.

- [x] **Step 3: Implement the presentation allowlist**

Remove the Regional Leadership entry from `personaWorkspaceDefinitions`. Return `null` for `REGIONAL_LEADERSHIP` from `getPersonaPresentation`, while retaining the neutral fallback for unknown roles. Filter null presentations in `authorizedWorkspaces`:

```js
const personas = authorizedPersonas(workspace)
  .map(role => getPersonaPresentation(role))
  .filter(Boolean)
  .map(presentation => ({
    ...presentation,
    destination: Object.freeze({ type: 'persona', role: presentation.role }),
  }));
```

- [x] **Step 4: Verify focused tests pass**

Run:

```powershell
npm.cmd test -- --run src/auth/WorkspaceSelector.test.jsx src/app/workspace-navigation.test.js src/app/router.test.jsx
```

Expected: all selected tests PASS.

- [x] **Step 5: Verify the production build**

Run:

```powershell
npm.cmd run build
```

Expected: Vite exits 0 and emits production assets.

- [ ] **Step 6: Commit, push, and deploy**

Commit only the plan, tests, and implementation:

```powershell
git add docs/superpowers/plans/2026-07-26-remove-regional-persona.md web/src/app/workspace-navigation.js web/src/app/workspace-navigation.test.js web/src/auth/WorkspaceSelector.jsx web/src/auth/WorkspaceSelector.test.jsx
git commit -m "refactor: hide regional leadership persona"
git push origin main
catalyst.cmd deploy slate ksp-crime-intelligence -m "Remove Regional Leadership persona from MVP selector"
```

Expected: Git push succeeds and Catalyst reports the Slate app live.

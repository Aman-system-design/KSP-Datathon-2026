# Profile Persona and Role Home Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a server-authorized Development persona switcher to the profile menu and simplify the State Leadership home without weakening real-user authorization.

**Architecture:** The access resolver exposes actual versus effective role and a server-derived persona-switch capability. `/v1/workspace` publishes only the safe identity context required by the shell. React changes the `persona` query parameter, causing every API call to be re-authorized by the existing server-side demo-persona contract.

**Tech Stack:** React 19, React Router, Vitest, Testing Library, Node.js test runner, Catalyst Authentication and Serverless API.

---

### Task 1: Publish safe persona-switch capability

**Files:**
- Modify: `src/backend/security/identity.mjs`
- Modify: `src/backend/reporting/workspace-services.mjs`
- Modify: `tests/backend/security.test.mjs`
- Modify: `tests/reporting/workspace-services.test.mjs`

- [ ] **Step 1: Write the failing access tests**

Add assertions proving that a normal role receives `actualRole: 'CRIME_ANALYST'`, `demoPersona: false`, and no switch capability, while a synthetic Development `DEMO_PRESENTER` receives the policy allowlist and retains `actualRole: 'DEMO_PRESENTER'` after assuming `STATE_LEADERSHIP`.

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `node --test tests/backend/security.test.mjs tests/reporting/workspace-services.test.mjs`

Expected: FAIL because `actualRole`, `personaSwitchAllowed`, `availablePersonas` and safe identity fields do not exist.

- [ ] **Step 3: Implement the minimal access fields**

Return these immutable fields from `resolveAccess`:

```js
actualRole: profile.DefaultRole,
personaSwitchAllowed: environment === 'Development'
  && profile.DefaultRole === 'DEMO_PRESENTER'
  && profile.DemoPersonaAllowed === true
  && profile.SyntheticData === true,
availablePersonas: Object.freeze(personaSwitchAllowed ? [...policy.personaAllowlist] : []),
```

Expose a bounded workspace identity projection:

```js
identity: {
  employeeId: access.employeeId,
  actualRole: access.actualRole,
  effectiveRole: access.role,
  demoPersona: access.demoPersona,
},
personaSwitch: {
  allowed: access.personaSwitchAllowed,
  personas: [...access.availablePersonas],
},
```

- [ ] **Step 4: Run focused tests and verify GREEN**

Run: `node --test tests/backend/security.test.mjs tests/reporting/workspace-services.test.mjs`

Expected: PASS.

### Task 2: Add the profile persona menu

**Files:**
- Modify: `web/src/app/AppShell.jsx`
- Modify: `web/src/app/runtime.js`
- Modify: `web/src/app/AppShell.test.jsx`
- Modify: `web/src/styles/app.css`

- [ ] **Step 1: Write failing UI tests**

Add a `DEMO_PRESENTER` workspace fixture whose `personaSwitch.allowed` is true. Assert that opening the extreme-right account button shows employee ID, actual role, effective persona, the five server-returned persona choices and Sign out. Click `STATE_LEADERSHIP` and assert navigation becomes `/?persona=STATE_LEADERSHIP`. Preserve the existing test proving a normal analyst has no persona selector.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm.cmd run test --workspace web -- AppShell.test.jsx`

Expected: FAIL because the account popover has no persona menu or navigation behavior.

- [ ] **Step 3: Implement query construction and menu behavior**

Add a pure helper in `runtime.js`:

```js
export function personaSearch(search, persona) {
  const params = new URLSearchParams(search);
  if (persona) params.set('persona', persona); else params.delete('persona');
  const value = params.toString();
  return value ? `?${value}` : '';
}
```

Use `useLocation` and `useNavigate` in `AppShell`. Render persona buttons only when `workspace.personaSwitch.allowed === true`; navigate to `{ pathname: '/', search: personaSearch(location.search, persona) }`. Include “Return to presenter” to remove the parameter. Do not accept a caller-supplied persona list outside the workspace response.

- [ ] **Step 4: Style one restrained enterprise account menu**

Use the existing Montserrat application tokens, a 320px popover, plain role rows, one selected-state background, a divider and one Sign out action. Do not add gradients, decorative strips, floating numbers or a second modal.

- [ ] **Step 5: Run focused and complete frontend tests**

Run: `npm.cmd run test --workspace web -- AppShell.test.jsx`

Run: `npm.cmd run web:test`

Expected: PASS.

### Task 3: Simplify the State Leadership composition

**Files:**
- Modify: `web/src/features/intelligence/LeadershipView.jsx`
- Modify: `web/src/features/intelligence/IntelligenceViews.test.jsx`
- Modify: `web/src/styles/app.css`

- [ ] **Step 1: Write the failing leadership composition test**

Assert that leadership renders one “State intelligence posture” header, a prioritized-developments region, selected geographic context, evidence summary and ownership/action region. Assert that six equal service cards, a visible `Ctrl K` keycap, Development header label and duplicate run chips are absent.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm.cmd run test --workspace web -- IntelligenceViews.test.jsx`

Expected: FAIL because the current leadership view uses three signal cards and two dense panels.

- [ ] **Step 3: Implement the minimal role-specific layout**

Derive the selected development from actual anomaly/hotspot/risk API data. Render no placeholder success values: absent data produces a labelled empty state. Keep evidence drilldown links to Alerts, Maps and Intelligence.

- [ ] **Step 4: Run frontend verification**

Run: `npm.cmd run web:test`

Run: `npm.cmd run web:build`

Expected: all tests pass and Vite produces a production build without source maps.

### Task 4: Verify and record the slice

**Files:**
- Modify: `docs/PROJECT_MEMORY.md`
- Create: `docs/reviews/2026-07-22-profile-persona-and-role-home.md`

- [ ] **Step 1: Run complete verification**

Run: `npm.cmd test`

Run: `npm.cmd run web:test`

Run: `npm.cmd run web:build`

Expected: zero failures.

- [ ] **Step 2: Run challenge alignment**

Run the `reviewing-challenge-alignment` required-files check and record a PASS/WARN/FAIL review. Persona switching must remain Development-only and server-authorized; leadership must retain all evidence drilldowns.

- [ ] **Step 3: Update memory with observed counts only**

Record the exact test/build results and explicitly state that no Catalyst deployment occurred unless a separate deployment command succeeds.

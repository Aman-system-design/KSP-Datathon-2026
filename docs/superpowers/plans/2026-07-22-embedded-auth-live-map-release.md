# Embedded Authentication and Live Map Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `aiksp.onslate.in` authenticate through Catalyst's embedded form, reject unresolved workspaces, and open a real Karnataka intelligence map with governed default layers.

**Architecture:** The Slate client loads Catalyst Web SDK 4.6.2 and renders embedded authentication only for a 401 session. Authorized calls use the same-origin `/server/crime_intelligence_api` route, while the existing Function remains the role, unit-scope and persona authority. The reusable geospatial workspace receives a Karnataka viewport and a one-time list of default dataset IDs; it still obtains features only through the existing catalogue and layer-execution APIs.

**Tech Stack:** React 19, React Router, Vite, Vitest/Testing Library, Catalyst Authentication v4, Catalyst Slate, Catalyst Serverless Functions, MapLibre, deck.gl, H3, PMTiles, OpenFreeMap and Supercluster.

---

## File Responsibilities

- `web/index.html`: load the exact Catalyst Web SDK version; no inline authentication behavior.
- `web/src/auth/catalyst-auth.js`: small adapter for session, embedded sign-in and sign-out.
- `web/src/auth/SignInRequired.jsx`: KSP-branded host for Catalyst's native embedded login.
- `web/src/app/runtime.js`: approve same-origin Function routing and reject unapproved external hosts.
- `web/src/app/router.jsx`: enforce the authentication/workspace state machine and configure the Karnataka Studio route.
- `web/src/features/geospatial/useGeospatialWorkspace.js`: add authorized default datasets once after catalogue resolution.
- Existing focused tests: define each behavior before production code changes.
- `docs/PROJECT_MEMORY.md` and deployment ledger: record observed results only.

### Task 1: Catalyst embedded authentication adapter

**Files:**
- Modify: `web/index.html`
- Modify: `web/src/auth/catalyst-auth.js`
- Modify: `web/src/auth/catalyst-auth.test.js`
- Modify: `web/src/auth/SignInRequired.jsx`
- Create: `web/src/auth/SignInRequired.test.jsx`

- [ ] **Step 1: Write failing adapter tests**

Add tests proving `embeddedSignIn('loginDivElementId')` calls:

```js
expect(signIn).toHaveBeenCalledWith('loginDivElementId', { service_url: '/' });
```

and throws a bounded `Catalyst authentication is unavailable.` error when `catalyst.auth.signIn` is absent. Add a component test that renders `<SignInRequired auth={auth} />`, contains exactly one `#loginDivElementId`, and invokes `embeddedSignIn` once.

- [ ] **Step 2: Verify RED**

Run: `npm.cmd run test --workspace web -- catalyst-auth.test.js SignInRequired.test.jsx`

Expected: FAIL because `embeddedSignIn` and the embedded-login container do not exist.

- [ ] **Step 3: Implement the minimal adapter and login host**

Extend the frozen adapter with:

```js
embeddedSignIn(elementId = 'loginDivElementId') {
  const signIn = sdk()?.auth?.signIn;
  if (typeof signIn !== 'function') throw new Error('Catalyst authentication is unavailable.');
  return signIn(elementId, { service_url: '/' });
},
```

Replace the hosted-login link with a `useEffect` that invokes the adapter after rendering:

```jsx
<div id="loginDivElementId" aria-label="Catalyst sign in" />
```

Keep the supplied KSP organization brand and Catalyst's default form CSS. Update `web/index.html` from SDK `4.6.1` to `4.6.2`; retain `/__catalyst/sdk/init.js` as a same-origin script loaded by application bootstrap.

- [ ] **Step 4: Verify GREEN**

Run: `npm.cmd run test --workspace web -- catalyst-auth.test.js SignInRequired.test.jsx`

Expected: PASS with one embedded sign-in invocation.

- [ ] **Step 5: Commit the authentication adapter**

```powershell
git add web/index.html web/src/auth/catalyst-auth.js web/src/auth/catalyst-auth.test.js web/src/auth/SignInRequired.jsx web/src/auth/SignInRequired.test.jsx
git commit -m "feat: embed Catalyst authentication"
```

### Task 2: Same-origin runtime and fail-closed workspace gate

**Files:**
- Modify: `web/src/app/runtime.js`
- Modify: `web/src/app/runtime.test.js`
- Modify: `web/src/app/router.jsx`
- Modify: `web/src/app/router.test.jsx`

- [ ] **Step 1: Write failing routing tests**

Add assertions that default runtime is exactly:

```js
expect(readRuntime({})).toEqual({ apiBase: '/server/crime_intelligence_api', authOrigin: '' });
```

and that a successful `/v1/workspace` response with `data: null` renders `Intelligence is unavailable`, never `Authorized workspace unavailable` or `Role Loading`. Assert an API 401 renders `SignInRequired` with the authentication adapter. Assert the default client does not call `generateAuthToken`.

- [ ] **Step 2: Verify RED**

Run: `npm.cmd run test --workspace web -- runtime.test.js router.test.jsx`

Expected: FAIL because `fallbackWorkspace` still converts null workspace data into `role: LOADING`, and the direct Development host derives an auth token provider.

- [ ] **Step 3: Implement the strict gate**

Delete `fallbackWorkspace`. Add a bounded workspace predicate:

```js
function validWorkspace(value) {
  return value && typeof value.role === 'string' && value.role !== 'LOADING';
}
```

After loading, render `<Failure />` when `validWorkspace(state.data)` is false. Create the API client without a token provider when `apiBase` is relative. Pass the `auth` adapter to `<SignInRequired auth={auth} />` for 401 only. Preserve existing 403 and generic error behavior.

- [ ] **Step 4: Verify GREEN and regression coverage**

Run: `npm.cmd run test --workspace web -- runtime.test.js router.test.jsx`

Run: `npm.cmd run web:test`

Expected: focused and complete frontend suites PASS; no test expects `LOADING` as a real role.

- [ ] **Step 5: Commit the workspace gate**

```powershell
git add web/src/app/runtime.js web/src/app/runtime.test.js web/src/app/router.jsx web/src/app/router.test.jsx
git commit -m "fix: fail closed on unresolved workspace"
```

### Task 3: Karnataka operational map defaults

**Files:**
- Modify: `web/src/features/geospatial/useGeospatialWorkspace.js`
- Modify: `web/src/features/geospatial/useGeospatialWorkspace.test.jsx`
- Modify: `web/src/features/geospatial/GeospatialStudio.test.jsx`
- Modify: `web/src/app/router.jsx`
- Modify: `web/src/app/router.test.jsx`

- [ ] **Step 1: Write failing default-map tests**

Render the hook with:

```js
initialViewport: { bounds: [74.0, 11.5, 78.6, 18.5] },
defaultDatasetIds: ['hotspots', 'anomalies', 'areaRisk'],
```

Return an authorized catalogue containing those datasets plus `alerts`. Assert the three requested datasets become visible layers exactly once, in order; `alerts` is not added. Assert each available layer executes through `/v1/geospatial/layers/execute`. Add a negative fixture where `areaRisk` is absent and prove the two available layers still load without invented geography.

- [ ] **Step 2: Verify RED**

Run: `npm.cmd run test --workspace web -- useGeospatialWorkspace.test.jsx GeospatialStudio.test.jsx router.test.jsx`

Expected: FAIL because the hook has no `defaultDatasetIds` behavior and the route supplies no Karnataka viewport.

- [ ] **Step 3: Implement one-time authorized defaults**

Add `defaultDatasetIds = []` to the hook arguments and a `defaultsApplied` ref. After catalogue success, build layers only from matching catalogue entries using the existing `rendererFor`, `displayFieldsFor` and layer state rules. Do not add a dataset twice and do not reopen defaults after a user removes a layer.

Configure the route:

```jsx
<Studio api={api} organizationConfig={{
  defaultViewport: { bounds: [74.0, 11.5, 78.6, 18.5] },
  jurisdictionLabel: 'Karnataka',
  defaultDatasetIds: ['hotspots', 'anomalies', 'areaRisk'],
}} />
```

Pass `organizationConfig.defaultDatasetIds` into `useGeospatialWorkspace`. The browser continues to receive only API-returned features.

- [ ] **Step 4: Verify GREEN**

Run: `npm.cmd run test --workspace web -- useGeospatialWorkspace.test.jsx GeospatialStudio.test.jsx router.test.jsx`

Run: `npm.cmd run geospatial:verify`

Expected: focused tests and the complete geospatial verification gate PASS.

- [ ] **Step 5: Commit the operational defaults**

```powershell
git add web/src/features/geospatial/useGeospatialWorkspace.js web/src/features/geospatial/useGeospatialWorkspace.test.jsx web/src/features/geospatial/GeospatialStudio.test.jsx web/src/app/router.jsx web/src/app/router.test.jsx
git commit -m "feat: open Karnataka intelligence map"
```

### Task 4: Local release verification

**Files:**
- Modify only when a failing test identifies a defect.

- [ ] **Step 1: Run all deterministic gates**

Run: `npm.cmd run verify`

Expected: backend, frontend, build, Function bundle inspection and schema validators all PASS. Vite outputs no production source maps.

- [ ] **Step 2: Run the local browser target flow**

Flow: `/` unauthenticated -> embedded Catalyst login host renders -> authorized workspace fixture renders -> profile persona switch changes the governed query -> `/geospatial` renders Karnataka with hotspot, anomaly and risk layers -> selecting a feature opens evidence.

Use the Browser/IAB runtime. Verify page identity, nonblank DOM, no framework overlay, no relevant console warning/error, desktop screenshot, one mobile viewport and at least one layer/evidence interaction.

- [ ] **Step 3: Fix defects test-first and rerun the same gates**

For each defect, add the smallest failing focused test, observe RED, implement the shared root-cause fix, observe GREEN, then rerun `npm.cmd run verify`.

### Task 5: Catalyst Development deployment and live proof

**Files:**
- Modify: `docs/deployment/catalyst-development-ledger.md`
- Modify: `docs/PROJECT_MEMORY.md`

- [ ] **Step 1: Run Catalyst remote preflight**

Run: `npm.cmd run catalyst:preflight:remote`

Expected: project `43492000000013049`, India Development and the approved targets are reported; any mismatch stops deployment.

- [ ] **Step 2: Build deployable artifacts from the verified commit**

Run: `npm.cmd run catalyst:build`

Run: `npm.cmd run catalyst:inspect`

Run: `npm.cmd run web:build`

Expected: Function manifests and the Slate build pass inspection with the verified source revision.

- [ ] **Step 3: Deploy the API Function and Slate only**

Run: `catalyst deploy --only functions:crime_intelligence_api,slate:ksp-crime-intelligence`

Expected: Catalyst reports both Development targets deployed successfully. Do not deploy `intelligence_refresh`, tables or Production.

- [ ] **Step 4: Perform fresh-session live browser verification**

At `https://aiksp.onslate.in` verify:

1. embedded Catalyst login appears in a fresh unauthenticated session;
2. successful sign-in returns to `/`;
3. `/v1/workspace` resolves an authorized non-`LOADING` role;
4. the profile menu exposes only server-returned personas;
5. `/geospatial` starts at Karnataka and displays API-backed hotspot, anomaly and risk layers;
6. a feature opens evidence and a layer can be hidden/reordered;
7. the console has no relevant authentication, application or map errors.

Any failure blocks the release claim and is fixed test-first before redeployment.

- [ ] **Step 5: Record observed release evidence**

Append the deployed revision, exact test counts, Catalyst deployment IDs, live URL, browser checks, remaining limitations and rollback target to the ledger and `docs/PROJECT_MEMORY.md`. Do not write `PASS` for an unobserved check.

### Task 6: Publish the verified revision

**Files:**
- Stage only files belonging to this plan; preserve unrelated generated Function-bundle changes.

- [ ] **Step 1: Review the exact diff and repository state**

Run: `git status --short`

Run: `git diff --check`

Run: `git log --oneline -5`

Expected: no conflict markers or whitespace errors; unrelated generated artifacts remain unstaged.

- [ ] **Step 2: Commit release evidence**

```powershell
git add docs/deployment/catalyst-development-ledger.md docs/PROJECT_MEMORY.md
git commit -m "docs: record embedded auth release"
```

- [ ] **Step 3: Push the verified branch and fast-forward GitHub main**

Run: `git push origin codex/geospatial-studio-core`

Run the repository's established reviewed fast-forward procedure so `origin/main` points to the exact deployed revision. Never force-push.

- [ ] **Step 4: Verify revision equality**

Run: `git rev-parse HEAD`

Run: `git ls-remote origin refs/heads/main`

Expected: local `HEAD`, deployed revision recorded in the ledger and GitHub `main` are identical.

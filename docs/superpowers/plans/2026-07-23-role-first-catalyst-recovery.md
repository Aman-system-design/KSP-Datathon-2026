# Role-First Catalyst Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore the live Catalyst application with real embedded authentication, readable role-specific workspaces, and a governed operational-intelligence map.

**Architecture:** Keep the existing React, Catalyst Function, analytics, and geospatial boundaries. Correct the Slate-to-Function authentication contract at the shared runtime/client seam, simplify the existing shell instead of replacing it, and make the existing dataset-driven map start with Karnataka and available analytical layers. QuickML remains a separately gated external deployment because no endpoint or Connection currently exists.

**Tech Stack:** React 19, Vite, Vitest, Catalyst Web SDK 4.6.2, Catalyst Advanced I/O Function, MapLibre, deck.gl, H3, PMTiles, Supercluster, OpenFreeMap.

---

### Task 1: Restore Catalyst cross-domain authentication

**Files:**
- Create: `web/public/client-package.json`
- Modify: `web/src/app/runtime.test.js`
- Modify: `web/src/app/runtime.js`
- Modify: `web/src/app/router.test.jsx`
- Modify: `web/src/app/router.jsx`
- Verify: `web/src/auth/catalyst-auth.test.js`
- Verify: `web/src/api/client.test.js`

- [ ] **Step 1: Write failing runtime and router tests**

Assert that the default runtime returns the approved complete Development Function URL and enables Catalyst token generation. Assert that `Application` calls `generateAuthToken()` and the API request sends the raw token in `Authorization`.

- [ ] **Step 2: Verify the tests fail for the same-origin regression**

Run: `npm run test --workspace web -- --run src/app/runtime.test.js src/app/router.test.jsx`

Expected: FAIL because `readRuntime()` returns `/server/crime_intelligence_api` and `Application` disables the token provider.

- [ ] **Step 3: Implement the minimum shared fix**

Set the default runtime to the allowlisted full Function URL and a non-empty auth mode/origin flag. Keep `createApiClient` as the only HTTP-token writer. Add:

```json
{
  "homepage": "/",
  "login_redirect": "/"
}
```

to `web/public/client-package.json`.

- [ ] **Step 4: Verify focused auth tests**

Run: `npm run test --workspace web -- --run src/app/runtime.test.js src/app/router.test.jsx src/auth/catalyst-auth.test.js src/api/client.test.js`

Expected: PASS.

- [ ] **Step 5: Commit only source and tests**

```powershell
git add web/public/client-package.json web/src/app/runtime.js web/src/app/runtime.test.js web/src/app/router.jsx web/src/app/router.test.jsx
git commit -m "fix(auth): restore Catalyst cross-domain session"
```

### Task 2: Simplify and enlarge the enterprise shell

**Files:**
- Modify: `web/src/app/AppShell.test.jsx`
- Modify: `web/src/app/AppShell.jsx`
- Modify: `web/src/styles/tokens.css`
- Modify: `web/src/styles/app.css`

- [ ] **Step 1: Write failing shell tests**

Assert that the header no longer renders Environment, Intelligence freshness, or Data mode; the KSP brand, search, notifications/help, and profile menu remain; the navigation collapse button retains an accessible expanded state.

- [ ] **Step 2: Verify the shell test fails**

Run: `npm run test --workspace web -- --run src/app/AppShell.test.jsx`

Expected: FAIL because the three operational-context blocks still render.

- [ ] **Step 3: Remove header clutter without a new component system**

Delete the header-context block from `AppShell`. Preserve backend-authorized persona switching in the profile menu and preserve the existing collapsible module/context navigation.

- [ ] **Step 4: Apply the typography floor**

Use the existing CSS files. Replace the root font stack with `Inter, "Noto Sans Kannada", "Segoe UI", Arial, sans-serif`, set a 14px body floor, raise 9–11px operational copy to 12px, controls to 14px, and keep page headings at 24–30px. Do not add a font dependency or CDN.

- [ ] **Step 5: Verify shell and accessibility behavior**

Run: `npm run test --workspace web -- --run src/app/AppShell.test.jsx src/app/workspace-navigation.test.js`

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add web/src/app/AppShell.jsx web/src/app/AppShell.test.jsx web/src/styles/tokens.css web/src/styles/app.css
git commit -m "fix(ui): simplify and enlarge platform shell"
```

### Task 3: Make role homes evidence-led and free of invented values

**Files:**
- Modify: `web/src/app/router.test.jsx`
- Modify: `web/src/app/router.jsx`
- Modify: `web/src/features/workspaces/PersonaWorkspace.test.jsx`
- Modify: `web/src/features/workspaces/PersonaWorkspace.jsx`
- Modify: `web/src/features/intelligence/LeadershipView.jsx`

- [ ] **Step 1: Write failing role-contract tests**

Cover state leadership, district leadership, station operations, analyst, investigator, and administrator. Assert that missing values render an honest unavailable state rather than `0`, and that each role receives its approved decision hierarchy.

- [ ] **Step 2: Verify failures expose the current zero fallbacks**

Run: `npm run test --workspace web -- --run src/app/router.test.jsx src/features/workspaces/PersonaWorkspace.test.jsx src/features/intelligence/IntelligenceViews.test.jsx`

Expected: FAIL on values currently normalized with `?? 0`.

- [ ] **Step 3: Preserve absent evidence through the route adapter**

Remove zero-valued fallback conversions in `CommandPage` and `CommandCentrePage`. Map only values present in API responses.

- [ ] **Step 4: Render role-specific decision surfaces**

Reuse `PersonaWorkspace` and `LeadershipView`. Keep state leadership focused on movement, district comparison, ageing, and priority alerts; district leadership on jurisdiction signals; station operations on cases, ageing, assignments, and local alerts; analyst on model evidence; investigator on assignments; administrator on platform governance.

- [ ] **Step 5: Verify focused role tests**

Run: `npm run test --workspace web -- --run src/app/router.test.jsx src/features/workspaces/PersonaWorkspace.test.jsx src/features/intelligence/IntelligenceViews.test.jsx`

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add web/src/app/router.jsx web/src/app/router.test.jsx web/src/features/workspaces/PersonaWorkspace.jsx web/src/features/workspaces/PersonaWorkspace.test.jsx web/src/features/intelligence/LeadershipView.jsx
git commit -m "feat(ui): make role homes evidence-led"
```

### Task 4: Start the map with real Karnataka intelligence layers

**Files:**
- Modify: `web/src/features/geospatial/useGeospatialWorkspace.test.jsx`
- Modify: `web/src/features/geospatial/useGeospatialWorkspace.js`
- Modify: `web/src/features/geospatial/GeospatialStudio.test.jsx`
- Modify: `web/src/features/geospatial/GeospatialStudio.jsx`
- Modify: `web/src/styles/app.css`

- [ ] **Step 1: Write failing default-composition tests**

Assert that the default viewport fits Karnataka and that available `hotspots`, `anomalies`, and `areaRisk` catalog items are added once, in that order, and execute through `/v1/geospatial/layers/execute`. Assert unavailable items are not invented or executed.

- [ ] **Step 2: Verify failure against neutral empty startup**

Run: `npm run test --workspace web -- --run src/features/geospatial/useGeospatialWorkspace.test.jsx src/features/geospatial/GeospatialStudio.test.jsx`

Expected: FAIL because the viewport is `[0, 0]` and no default layer is added.

- [ ] **Step 3: Implement the minimal default composition**

Add a Karnataka viewport constant and a one-time catalog effect that calls the existing `addDataset` path for available datasets. Saved views and organization-provided viewport configuration override the default.

- [ ] **Step 4: Improve operational canvas hierarchy**

Keep the existing map engine and controls. Make the map canvas dominant, keep layer status/legend/evidence visible, and preserve the accessible feature table. Do not copy WorldMonitor code or add external feeds.

- [ ] **Step 5: Verify geospatial suite**

Run: `npm run test --workspace web -- --run src/features/geospatial`

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add web/src/features/geospatial/useGeospatialWorkspace.js web/src/features/geospatial/useGeospatialWorkspace.test.jsx web/src/features/geospatial/GeospatialStudio.jsx web/src/features/geospatial/GeospatialStudio.test.jsx web/src/styles/app.css
git commit -m "feat(map): open with governed Karnataka intelligence"
```

### Task 5: Verify and release the working recovery

**Files:**
- Modify after evidence exists: `docs/evidence/2026-07-23-catalyst-role-first-release.md`

- [ ] **Step 1: Run the full local gate**

Run: `npm run verify`

Expected: all backend tests, frontend tests, build, bundle inspection, and schema validations pass.

- [ ] **Step 2: Run Catalyst preflight**

Run: `npm run catalyst:preflight`

Expected: the linked project and source layout validate.

- [ ] **Step 3: Confirm console-only authentication prerequisites**

In Catalyst Authentication, confirm Embedded Authentication is enabled and `https://aiksp.onslate.in` is an Authorized Domain with CORS enabled. Do not enter or copy OAuth secrets into the repo or chat.

- [ ] **Step 4: Deploy only the changed Slate resource**

Run: `catalyst deploy --only client`

Expected: Slate deploy succeeds for the linked Development project. Do not redeploy Functions because this recovery does not change Function source and console environment variables must be preserved.

- [ ] **Step 5: Verify the live application**

Use a fresh browser session at `https://aiksp.onslate.in`. Verify embedded login, real workspace resolution, role home, geospatial startup, API-backed analytical layer, and a clean relevant console.

- [ ] **Step 6: Record evidence and push**

Write only observed evidence and failures. Commit the evidence, then push the verified branch to `main` only if it is a fast-forward and the user-authorized public release remains valid.

### Task 6: Gate genuine QuickML integration

**Files:**
- Create only after Catalyst resources exist: `docs/evidence/2026-07-23-quickml-resource-contract.md`
- Backend implementation paths are selected after the published endpoint's actual request/response schema is exported.

- [ ] **Step 1: Inspect current QuickML resources**

Confirm a Catalyst Connection, published pipeline/model endpoint, required scope, endpoint identifier, project identifier, organization identifier, and Function environment variables. Record identifiers, never credentials.

- [ ] **Step 2: Stop honestly if resources do not exist**

Do not add a fake adapter, fake model health, or “QuickML integrated” label. Keep DBSCAN, Median/MAD, Pattern Fusion, TF-IDF, graph analytics, identity resolution, and area-risk outputs as the real baseline.

- [ ] **Step 3: Create the endpoint-specific TDD plan after the schema exists**

The next plan must include the exact Catalyst request and response, Function timeout/retry policy, schema validation, run persistence, failure UI, and live invocation proof.


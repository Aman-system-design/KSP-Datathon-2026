# ACE Tenant Branding and Compact Selector Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Centralize tenant branding under the reusable ACE product model and make the workspace selector compact without changing authorization behavior.

**Architecture:** A small React branding provider resolves validated runtime overrides over immutable KSP defaults and sets the document title. Every brand-bearing component reads that shared source. The selector keeps its current component structure but stops stretching grid rows to consume the viewport.

**Tech Stack:** React 19, Vitest, Testing Library, CSS Grid, Vite, Catalyst Slate

---

### Task 1: Define and validate the branding contract

**Files:**
- Create: `web/src/branding/platform-brand.js`
- Create: `web/src/branding/platform-brand.test.js`

- [ ] **Step 1: Write failing resolver tests**

Test that defaults resolve to `ACE`, `KSP ACE`, `Karnataka State Police`, `KSP`, `Analytics · Crime · Enforcement`, the existing KSP assets, and `KSP ACE | Karnataka State Police`. Test a partial runtime override, boolean subtitle suppression, ignored unknown fields, empty-string fallback, and rejection of non-root-relative/non-HTTPS asset URLs.

- [ ] **Step 2: Run the resolver tests and verify failure**

Run: `npm.cmd --prefix web test -- platform-brand.test.js`

Expected: FAIL because the branding module does not exist.

- [ ] **Step 3: Implement the minimum resolver**

Export a frozen `DEFAULT_PLATFORM_BRAND` and `resolvePlatformBrand(override)`. Copy only known fields. Accept trimmed non-empty strings for text fields, booleans for `showProductTagline`, and root-relative or HTTPS asset URLs. Return a frozen resolved object.

- [ ] **Step 4: Run resolver tests**

Run: `npm.cmd --prefix web test -- platform-brand.test.js`

Expected: all branding resolver tests pass.

### Task 2: Provide branding to the application

**Files:**
- Create: `web/src/branding/BrandProvider.jsx`
- Create: `web/src/branding/BrandProvider.test.jsx`
- Modify: `web/src/main.jsx`
- Modify: `web/index.html`

- [ ] **Step 1: Write failing provider tests**

Render a consumer through `BrandProvider`. Assert that it receives bundled defaults, accepts an explicit override, and sets `document.title` from the resolved branding.

- [ ] **Step 2: Run provider tests and verify failure**

Run: `npm.cmd --prefix web test -- BrandProvider.test.jsx`

Expected: FAIL because the provider does not exist.

- [ ] **Step 3: Implement and mount the provider**

Create a context with `usePlatformBrand()`. Resolve the explicit `override` prop or `globalThis.__ACE_BRAND__`, set the document title in an effect, and wrap `AppRouter` in `main.jsx`. Change the static HTML title to the same KSP ACE fallback.

- [ ] **Step 4: Run provider tests**

Run: `npm.cmd --prefix web test -- BrandProvider.test.jsx`

Expected: all provider tests pass.

### Task 3: Migrate visible brand surfaces

**Files:**
- Modify: `web/src/components/OrganizationBrand.jsx`
- Modify: `web/src/components/OrganizationBrand.test.jsx`
- Modify: `web/src/app/PlatformHeader.jsx`
- Modify: `web/src/app/AppShell.test.jsx`
- Modify: `web/src/app/AsyncStates.jsx`
- Modify: `web/src/app/AsyncStates.test.jsx`
- Modify: `web/src/auth/SignInRequired.jsx`
- Modify: `web/src/auth/SignInRequired.test.jsx`
- Modify: `web/src/auth/WorkspaceSelector.jsx`
- Modify: `web/src/auth/WorkspaceSelector.test.jsx`
- Modify: `web/src/features/command-centre/CommandCentre.jsx`
- Modify the corresponding Command Centre test located by `rg --files web/src/features/command-centre`

- [ ] **Step 1: Change component assertions first**

Assert the approved header hierarchy: configured organization logo, `Karnataka State Police`, then `Analytics · Crime · Enforcement`. Assert login/product surfaces use `KSP ACE`, loaders use configured assets, compact brands use the configured seal/abbreviation, and no rendered header contains `KSP Crime Decision Intelligence` or `Crime Decision Intelligence`.

- [ ] **Step 2: Run focused component tests and verify failure**

Run the OrganizationBrand, AppShell, AsyncStates, SignInRequired, WorkspaceSelector and CommandCentre test files through `npm.cmd --prefix web test -- ...`.

Expected: FAIL on legacy hard-coded branding.

- [ ] **Step 3: Replace hard-coded branding with the shared hook**

Use `usePlatformBrand()` in each component. Preserve organization-first header hierarchy and render the expansion only when `showProductTagline` is true. Use `instanceName` for login/product references and Command Centre naming. Derive image alternative text from the configured organization name.

- [ ] **Step 4: Run focused component tests**

Expected: all migrated component tests pass.

### Task 4: Make the selector compact

**Files:**
- Modify: `web/src/styles/app.css`
- Modify: `web/src/styles/viewport-layout.test.js`

- [ ] **Step 1: Add the compact-layout contract**

Update the CSS contract test to require natural panel height and fixed compact desktop card rows rather than `1fr` rows that stretch to fill the viewport.

- [ ] **Step 2: Run the viewport contract and verify failure**

Run: `npm.cmd --prefix web test -- viewport-layout.test.js`

Expected: FAIL while the selector still uses viewport-filling grid rows.

- [ ] **Step 3: Implement compact CSS**

Keep the 3×2 desktop grid, use approximately 124px natural card rows, remove the panel's forced height, reduce vertical margins where needed, and retain page scrolling at existing tablet/mobile breakpoints. Do not reintroduce an internal panel scrollbar.

- [ ] **Step 4: Run viewport and selector tests**

Run: `npm.cmd --prefix web test -- viewport-layout.test.js WorkspaceSelector.test.jsx`

Expected: all layout and selector tests pass.

### Task 5: Verify, release and inspect the live tenant

**Files:**
- No additional source files expected.

- [ ] **Step 1: Run the complete frontend suite**

Run: `npm.cmd --prefix web test`

Expected: all frontend tests pass.

- [ ] **Step 2: Run authorization regression tests**

Run: `node --test tests/backend/security.test.mjs`

Expected: 7 tests pass and internal `DEMO_PRESENTER` behavior remains unchanged.

- [ ] **Step 3: Build the Slate application**

Run: `npm.cmd --prefix web run build`

Expected: Vite completes successfully.

- [ ] **Step 4: Commit only branding and selector files**

Stage the plan and files listed above. Do not stage unrelated authentication or deployment-ledger changes. Commit as `feat: centralize ACE tenant branding`.

- [ ] **Step 5: Deploy and verify Catalyst**

Deploy `ksp-crime-intelligence` to Catalyst Slate. At `https://aiksp.onslate.in/`, verify the organization-first hierarchy, KSP ACE document title, uniform configured logo, compact card height, visible footer, `scrollHeight <= clientHeight`, optional-tagline behavior through a provider test, and working workspace selection.

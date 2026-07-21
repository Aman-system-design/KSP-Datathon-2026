# Catalyst-Authenticated Persona UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver one Catalyst-native, authenticated KSP Crime Decision Intelligence application with a durable enterprise shell, role-scoped workspaces, an admin workspace directory, and a presentation-safe Command Centre.

**Architecture:** Catalyst Hosted Authentication owns sign-in and browser session state. The Serverless function continues to resolve the current Catalyst user into the application access profile and authorized unit tree; the React client obtains only the already-authorized `/v1/workspace` contract. A shared shell composes role-aware navigation and existing governed analytics without client-side security claims or fabricated data.

**Tech Stack:** React 19, React Router 7, Vitest, Testing Library, Leaflet, CSS, Catalyst Web Client Hosting/Slate, Catalyst Authentication, Catalyst Serverless Functions, Catalyst Data Store.

---

## Task 1: Lock authentication and workspace contracts

**Files:**
- Modify: `web/src/app/runtime.js`
- Create: `web/src/auth/catalyst-auth.js`
- Create: `web/src/auth/catalyst-auth.test.js`
- Modify: `web/src/api/client.js`
- Modify: `web/src/api/client.test.js`

- [ ] Write failing tests proving the client uses same-origin Catalyst session cookies, maps HTTP 401 to an unauthenticated state, exposes the native hosted-login URL, and calls Catalyst Web SDK sign-out when available.
- [ ] Run `npm --prefix web test -- catalyst-auth.test.js client.test.js` and confirm the new assertions fail for missing authentication behavior.
- [ ] Implement the smallest authentication adapter: `isUserAuthenticated`, `signOut`, and the same-origin `/__catalyst/auth/login` fallback. Do not store tokens or user roles in browser storage.
- [ ] Re-run the focused tests and confirm they pass.

## Task 2: Install jurisdiction branding as local assets

**Files:**
- Create: `web/public/brand/ksp-logo.webp`
- Create: `web/public/brand/karnataka-seal.webp`
- Create: `web/src/components/OrganizationBrand.jsx`
- Create: `web/src/components/OrganizationBrand.test.jsx`

- [ ] Write a failing component test for meaningful KSP branding, compact/full variants, and non-empty alternative text.
- [ ] Run `npm --prefix web test -- OrganizationBrand.test.jsx` and confirm failure.
- [ ] Copy the founder-approved public brand assets into the web client and implement the reusable brand component without a new dependency.
- [ ] Re-run the focused test and confirm it passes.

## Task 3: Build permission-aware platform navigation

**Files:**
- Create: `web/src/app/workspace-navigation.js`
- Create: `web/src/app/workspace-navigation.test.js`
- Create: `web/src/components/icons.jsx`

- [ ] Write failing pure-function tests for State Leadership, District Leadership, Crime Analyst, Station Command, Investigator, Platform Admin, Auditor, and Demo Presenter navigation.
- [ ] Prove unauthorized modules are omitted, Platform Admin receives Governance and Persona Workspaces, and State Leadership defaults to the intelligence brief.
- [ ] Implement one frozen navigation configuration driven by resolved role and server-returned actions. Treat UI filtering as usability only; APIs remain the security boundary.
- [ ] Run the focused tests and confirm they pass.

## Task 4: Replace the page shell with a Catalyst-inspired platform shell

**Files:**
- Modify: `web/src/app/AppShell.jsx`
- Modify: `web/src/app/AppShell.test.jsx`
- Create: `web/src/components/PlatformPrimitives.jsx`
- Modify: `web/src/styles/tokens.css`
- Modify: `web/src/styles/app.css`

- [ ] Replace the current shell test with failing tests for the white global header, navy module rail, contextual sidebar, configured brand, global search placeholder, alert centre, scope, freshness, account control, synthetic-data status, and keyboard-visible navigation labels.
- [ ] Add a failing test that production roles cannot select a demo persona.
- [ ] Implement the shared shell and operational primitives using local SVG icons, semantic landmarks, restrained platform styling, and responsive navigation.
- [ ] Keep the global search visibly unavailable until a governed API exists; do not search cached sensitive data.
- [ ] Run `npm --prefix web test -- AppShell.test.jsx` and confirm it passes.

## Task 5: Add honest native-authentication states

**Files:**
- Modify: `web/src/app/router.jsx`
- Modify: `web/src/app/router.test.jsx`
- Create: `web/src/auth/SignInRequired.jsx`
- Create: `web/src/auth/AccessNotProvisioned.jsx`

- [ ] Write failing route tests proving HTTP 401 renders a KSP-branded Catalyst sign-in action, HTTP 403 renders access-not-provisioned guidance, and neither state exposes the application shell or internal errors.
- [ ] Implement workspace-first application bootstrap. Only render navigation after `/v1/workspace` succeeds.
- [ ] Wire sign-in to Catalyst Hosted Authentication and sign-out to the Catalyst Web SDK adapter.
- [ ] Re-run the focused tests and confirm they pass.

## Task 6: Compose persona workspaces from governed intelligence

**Files:**
- Create: `web/src/features/workspaces/PersonaWorkspace.jsx`
- Create: `web/src/features/workspaces/PersonaWorkspace.test.jsx`
- Modify: `web/src/features/intelligence/LeadershipView.jsx`
- Modify: `web/src/app/router.jsx`

- [ ] Write failing tests for the approved default experiences: State Intelligence Brief, Jurisdiction Intelligence Pulse, Analyst Workbench, Operational Intelligence, Investigation Tasks, and Governance Console.
- [ ] Prove each workspace uses API-provided results, preserves confidence/limitations/human-review language, and shows an honest partial state when an endpoint is unavailable.
- [ ] Implement role composition around existing brief, anomaly, hotspot, risk, alert, map, network, report, and dashboard components. Do not add analytics or display invented counts.
- [ ] Run the focused persona tests and confirm they pass.

## Task 7: Add admin workspace directory and presentation-safe Command Centre

**Files:**
- Create: `web/src/features/admin/PersonaDirectory.jsx`
- Create: `web/src/features/admin/PersonaDirectory.test.jsx`
- Create: `web/src/features/command-centre/CommandCentre.jsx`
- Create: `web/src/features/command-centre/CommandCentre.test.jsx`
- Modify: `web/src/app/router.jsx`

- [ ] Write failing tests proving the admin directory lists all configured workspace routes only for authorized admin/demo use.
- [ ] Write failing tests proving Command Centre is read-only, uses aggregate governed data, displays freshness/synthetic status, and omits notes, assignment, report-building, and evidence-edit controls.
- [ ] Implement both routes without creating impersonation or bypassing server authorization. Development demo-persona query/header behavior must remain subject to the existing server allowlist.
- [ ] Run both focused test files and confirm they pass.

## Task 8: Verify responsive, accessible, security, and challenge behavior

**Files:**
- Modify: `web/src/styles/app.css`
- Modify: `Design.md`
- Modify: `Memory.md`
- Create: `docs/reviews/2026-07-21-authenticated-persona-ui-review.md`

- [ ] Run `npm --prefix web test` and resolve every regression.
- [ ] Run `npm --prefix web run build` and confirm a production bundle with no build error.
- [ ] Run the repository test suite defined by the root package scripts.
- [ ] Run the challenge required-files checker and complete the Challenge 02 review template with evidence paths.
- [ ] Run a security scan of changed first-party code; resolve high-confidence Critical/High findings and document any unavailable integration.
- [ ] Start the local web client and verify 1440, 1024, 768, and 375 pixel widths, route navigation, overflow, focus order, sign-in state, admin directory, and Command Centre. Use the in-app browser when attachment is available.
- [ ] Update `Memory.md` with implemented behavior, exact Catalyst console follow-up for Hosted Authentication, verification results, and deployment status.
- [x] Stage only task-owned files; do not stage `package.json`, `package-lock.json`, `.agents/`, or `skills-lock.json` unless separately reviewed and intentionally required.

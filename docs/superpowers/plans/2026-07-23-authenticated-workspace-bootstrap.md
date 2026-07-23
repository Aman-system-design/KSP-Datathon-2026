# Authenticated Workspace Bootstrap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy a real Catalyst sign-in, backend-governed MVP persona selector and stable Catalyst-like role shell to `https://aiksp.onslate.in`.

**Architecture:** Keep Catalyst Authentication and `GET /v1/workspace` as the identity and authorization authorities. Add a small shadcn component foundation to the existing Vite SPA, place the Development-only selector before the protected shell, and split the shell into focused sidebar and account-menu components. The provisional role home consumes existing APIs only; the later 31-district design remains replaceable.

**Tech Stack:** React 19, Vite 8, Catalyst Web SDK 4.6.2, Catalyst Slate, shadcn/ui radix-nova, Tailwind CSS v4, Vitest, Testing Library.

---

## File Structure

**Create**

- `web/components.json` — shadcn registry and alias configuration.
- `web/jsconfig.json` — Vite JavaScript alias resolution for `@/*`.
- `web/src/lib/utils.js` — shadcn `cn()` helper.
- `web/src/components/ui/*` — CLI-generated, reviewed shadcn primitives only.
- `web/public/auth/catalyst-sign-in.css` — Catalyst Embedded Authentication customization.
- `web/src/auth/WorkspaceSelector.jsx` — Development-only backend-governed persona selection.
- `web/src/auth/WorkspaceSelector.test.jsx` — selector authorization and interaction tests.
- `web/src/app/AppSidebar.jsx` — collapsible role-derived module navigation.
- `web/src/app/AppSidebar.test.jsx` — navigation and collapse tests.
- `web/src/app/AccountMenu.jsx` — authenticated identity, authorized persona switch and sign out.
- `web/src/app/AccountMenu.test.jsx` — account and persona-switch tests.
- `docs/evidence/2026-07-23-authenticated-workspace-bootstrap-release.md` — commands and live acceptance evidence.

**Modify**

- `web/package.json` and root `package-lock.json` — shadcn/Tailwind dependencies.
- `web/vite.config.js` — Tailwind plugin and `@` alias; preserve bundle splitting and disabled source maps.
- `web/src/main.jsx` — load the generated Tailwind/shadcn stylesheet before focused application overrides.
- `web/src/styles/tokens.css` — map KSP/Catalyst values to semantic shadcn variables.
- `web/src/styles/app.css` — remove superseded shell/auth styling; keep feature-specific styles.
- `web/public/login.html` — approved split KSP identity layout and real Catalyst `css_url`.
- `web/src/auth/catalyst-auth.test.js` — embedded CSS and sign-in contract.
- `web/src/app/router.jsx` and `web/src/app/router.test.jsx` — render selector before shell and preserve fail-closed routing.
- `web/src/app/AppShell.jsx` and `web/src/app/AppShell.test.jsx` — compose sidebar/account components.
- `web/src/app/workspace-navigation.js` — export metadata without granting access.
- `docs/PROJECT_MEMORY.md` and `docs/deployment/catalyst-development-ledger.md` — release state and remaining production transition.

## Task 1: Add the Minimal shadcn Foundation

**Files:**
- Create: `web/components.json`
- Create: `web/jsconfig.json`
- Create: `web/src/lib/utils.js`
- Create: `web/src/components/ui/{avatar,badge,button,card,dropdown-menu,separator,sidebar,skeleton,toggle-group,tooltip}.jsx`
- Modify: `web/package.json`
- Modify: `web/vite.config.js`
- Modify: `web/src/main.jsx`
- Modify: `web/src/styles/tokens.css`
- Test: `web/src/components/ui/ui-foundation.test.jsx`

- [ ] **Step 1: Write the failing primitive-composition test**

```jsx
import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';

import { Avatar, AvatarFallback } from './avatar.jsx';
import { Button } from './button.jsx';

test('KSP UI foundation exposes accessible shadcn primitives', () => {
  render(<><Avatar><AvatarFallback>AD</AvatarFallback></Avatar><Button>Open workspace</Button></>);
  expect(screen.getByText('AD')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Open workspace' })).toBeEnabled();
});
```

- [ ] **Step 2: Run the focused test and confirm the imports fail**

Run: `npm run test --workspace web -- --run src/components/ui/ui-foundation.test.jsx`

Expected: FAIL because `avatar.jsx` and `button.jsx` do not exist.

- [ ] **Step 3: Initialize shadcn and preview the generated changes**

Run from `web`:

```powershell
npx.cmd shadcn@latest init --template vite --base radix --preset radix-nova --css-variables --no-rtl --pointer --no-monorepo
npx.cmd shadcn@latest info --json
git diff -- components.json package.json vite.config.js src
```

Expected: Vite, JavaScript, Radix, Tailwind v4 and the `@/*` alias are reported. Do not accept a generated second application entry point or enable source maps.

- [ ] **Step 4: Add only the primitives used by this release**

Run from `web`:

```powershell
npx.cmd shadcn@latest add avatar badge button card dropdown-menu separator sidebar skeleton toggle-group tooltip
```

Review every added file. Preserve `iconLibrary` from `components.json`; do not mix icon packages.

- [ ] **Step 5: Map the design tokens instead of restyling individual components**

Ensure the generated global CSS defines semantic variables with these light-mode values:

```css
:root {
  --background: oklch(0.985 0.003 247);
  --foreground: oklch(0.25 0.035 252);
  --card: oklch(1 0 0);
  --primary: oklch(0.49 0.13 247);
  --primary-foreground: oklch(0.99 0 0);
  --muted: oklch(0.965 0.006 247);
  --muted-foreground: oklch(0.53 0.025 252);
  --border: oklch(0.91 0.012 247);
  --ring: oklch(0.62 0.13 247);
  --radius: 0.5rem;
}
```

Retain `Roboto, "Noto Sans Kannada", "Segoe UI", Arial, sans-serif` as the application font family.

- [ ] **Step 6: Run the focused test and production build**

Run:

```powershell
npm run test --workspace web -- --run src/components/ui/ui-foundation.test.jsx
npm run web:build
```

Expected: PASS and Vite build succeeds without source maps.

- [ ] **Step 7: Commit the UI foundation**

```powershell
git add web/components.json web/jsconfig.json web/package.json package-lock.json web/vite.config.js web/src/main.jsx web/src/styles/tokens.css web/src/lib web/src/components/ui
git commit -m "feat(web): add governed shadcn UI foundation"
```

## Task 2: Style the Real Catalyst Embedded Sign-In

**Files:**
- Create: `web/public/auth/catalyst-sign-in.css`
- Modify: `web/public/login.html`
- Modify: `web/src/auth/catalyst-auth.test.js`

- [ ] **Step 1: Extend the failing HTML contract test**

Add these assertions to the dedicated sign-in test:

```js
expect(html).toContain('css_url: "/auth/catalyst-sign-in.css"');
expect(html).toContain('service_url: "/"');
expect(html).toContain('Karnataka State Police');
expect(html).not.toContain('type="password"');
expect(html).not.toContain('name="password"');
```

- [ ] **Step 2: Run the authentication test and verify the CSS assertion fails**

Run: `npm run test --workspace web -- --run src/auth/catalyst-auth.test.js`

Expected: FAIL because `css_url` is not yet passed.

- [ ] **Step 3: Update only the Catalyst configuration and approved split shell**

Use the real embedded form:

```html
<div id="loginDivElementId"></div>
<script>
  catalyst.auth.signIn("loginDivElementId", {
    css_url: "/auth/catalyst-sign-in.css",
    service_url: "/"
  });
</script>
```

The surrounding page keeps the supplied KSP emblem, invitation-only message and locally hosted Roboto. It must not contain email/password inputs.

- [ ] **Step 4: Add Catalyst form customization using neutral semantic styles**

`web/public/auth/catalyst-sign-in.css` must style Catalyst's documented form selectors with white surfaces, 44px controls, visible focus, 6px radii and the KSP blue primary action. Do not hide validation, forgot-password or accessibility content.

- [ ] **Step 5: Run the auth tests and build**

Run:

```powershell
npm run test --workspace web -- --run src/auth/catalyst-auth.test.js src/auth/SignInRequired.test.jsx
npm run web:build
```

Expected: all focused tests PASS; `dist/login.html` and `dist/auth/catalyst-sign-in.css` exist.

- [ ] **Step 6: Commit authentication styling**

```powershell
git add web/public/login.html web/public/auth/catalyst-sign-in.css web/src/auth/catalyst-auth.test.js
git commit -m "feat(auth): style native Catalyst sign in"
```

## Task 3: Add the Backend-Governed Workspace Selector

**Files:**
- Create: `web/src/auth/WorkspaceSelector.jsx`
- Create: `web/src/auth/WorkspaceSelector.test.jsx`
- Modify: `web/src/app/workspace-navigation.js`
- Modify: `web/src/app/router.jsx`
- Modify: `web/src/app/router.test.jsx`

- [ ] **Step 1: Write failing authorization-first selector tests**

```jsx
test('renders only personas returned by the backend', () => {
  render(<WorkspaceSelector workspace={{ personaSwitch: {
    allowed: true,
    personas: ['STATE_LEADERSHIP', 'CRIME_ANALYST'],
  } }} onSelect={() => {}} onSignOut={() => {}} />);
  expect(screen.getByRole('button', { name: /State Leadership/i })).toBeVisible();
  expect(screen.getByRole('button', { name: /Crime Analyst/i })).toBeVisible();
  expect(screen.queryByRole('button', { name: /Station Operations/i })).not.toBeInTheDocument();
});

test('fails closed when persona switching is not authorized', () => {
  render(<WorkspaceSelector workspace={{ personaSwitch: { allowed: false, personas: [] } }} onSelect={() => {}} onSignOut={() => {}} />);
  expect(screen.getByRole('alert')).toHaveTextContent('No demonstration workspace is authorized');
  expect(screen.queryByRole('button', { name: 'Open workspace' })).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run the focused tests and confirm the component is missing**

Run: `npm run test --workspace web -- --run src/auth/WorkspaceSelector.test.jsx`

Expected: FAIL on missing module.

- [ ] **Step 3: Export presentation metadata without granting authority**

In `workspace-navigation.js`, export `getPersonaPresentation(role)` that returns labels for known roles and an `Authorized workspace` fallback. It must not add a role to `personaSwitch.personas`.

```js
export function getPersonaPresentation(role) {
  return personaPresentation[role] ?? Object.freeze({
    role, label: 'Authorized workspace', workspace: 'Role workspace', scope: 'Configured scope',
  });
}
```

- [ ] **Step 4: Implement the selector with shadcn composition**

`WorkspaceSelector` uses `Card`, `ToggleGroup`, `Badge`, `Avatar`, `Separator` and `Button`. Its only source list is:

```js
const personas = workspace?.personaSwitch?.allowed === true
  ? workspace.personaSwitch.personas.filter(role => typeof role === 'string')
  : [];
```

The component keeps a single selected role, disables `Open workspace` until selected, calls `onSelect(selectedRole)`, and calls `onSignOut` for sign out.

- [ ] **Step 5: Route the demo presenter to the selector before `AppShell`**

In `AuthorizedApplication`, call `useNavigate()` beside `useLocation()`, then after validating the workspace and before command-centre routing:

```jsx
if (workspace.role === 'DEMO_PRESENTER' && !readDemoPersona(location.search)) {
  return <WorkspaceSelector
    workspace={workspace}
    onSelect={persona => navigate({ pathname: '/', search: personaSearch('', persona) })}
    onSignOut={() => auth.signOut()}
  />;
}
```

Use `useNavigate`; do not directly trust or mutate the returned workspace.

- [ ] **Step 6: Add router tests for pre-shell placement and rejected personas**

Assert that the demo presenter sees no `Platform modules` navigation until a backend-returned persona is selected, and that an unsupported query value is removed by `readDemoPersona` rather than sent as a header.

- [ ] **Step 7: Run focused and complete frontend tests**

Run:

```powershell
npm run test --workspace web -- --run src/auth/WorkspaceSelector.test.jsx src/app/router.test.jsx src/app/runtime.test.js
npm run web:test
```

Expected: PASS.

- [ ] **Step 8: Commit workspace selection**

```powershell
git add web/src/auth/WorkspaceSelector.jsx web/src/auth/WorkspaceSelector.test.jsx web/src/app/workspace-navigation.js web/src/app/router.jsx web/src/app/router.test.jsx
git commit -m "feat(auth): add governed persona selection"
```

## Task 4: Replace the Monolithic Shell with shadcn Sidebar and Account Menu

**Files:**
- Create: `web/src/app/AppSidebar.jsx`
- Create: `web/src/app/AppSidebar.test.jsx`
- Create: `web/src/app/AccountMenu.jsx`
- Create: `web/src/app/AccountMenu.test.jsx`
- Modify: `web/src/app/AppShell.jsx`
- Modify: `web/src/app/AppShell.test.jsx`
- Modify: `web/src/styles/app.css`

- [ ] **Step 1: Write failing shell boundary tests**

```jsx
test('sidebar is collapsible and navigation comes from the resolved workspace', () => {
  renderShell(demoWorkspace);
  screen.getByRole('button', { name: 'Collapse navigation' }).click();
  expect(screen.getByRole('navigation', { name: 'Platform modules' })).toHaveAttribute('data-state', 'collapsed');
  expect(screen.getByRole('link', { name: 'Crime Intelligence' })).toBeVisible();
});

test('account menu exposes only backend-authorized persona choices', async () => {
  renderAccount({ allowed: true, personas: ['CRIME_ANALYST'] });
  await user.click(screen.getByRole('button', { name: /Account/i }));
  expect(screen.getByRole('menuitem', { name: /Crime Analyst/i })).toBeVisible();
  expect(screen.queryByRole('menuitem', { name: /State Leadership/i })).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run the focused tests and confirm missing component failures**

Run: `npm run test --workspace web -- --run src/app/AppSidebar.test.jsx src/app/AccountMenu.test.jsx`

Expected: FAIL on missing modules.

- [ ] **Step 3: Implement `AppSidebar` as a focused adapter**

The component receives `{ navigation, location }`, composes shadcn `Sidebar`, `SidebarHeader`, `SidebarContent`, `SidebarGroup`, `SidebarMenu` and `SidebarRail`, and maps only `navigation.modules`. It owns collapse UI but no identity or authorization logic.

- [ ] **Step 4: Implement `AccountMenu` as a focused adapter**

Compose `Avatar` with mandatory `AvatarFallback` and a grouped `DropdownMenu`. Receive `{ workspace, onPersonaSelect, onSignOut }`. Render persona items only when `workspace.personaSwitch.allowed === true`; preserve the neutral provenance line in the identity group.

- [ ] **Step 5: Reduce `AppShell` to orchestration**

`AppShell` obtains navigation, computes labels, and renders:

```jsx
<SidebarProvider>
  <AppSidebar navigation={navigation} location={location} />
  <SidebarInset>
    <header className="platform-header">
      <SidebarTrigger aria-label="Collapse navigation" />
      <Separator orientation="vertical" />
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem><BreadcrumbPage>{navigation.workspaceLabel}</BreadcrumbPage></BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <AccountMenu workspace={workspace} onPersonaSelect={switchPersona} onSignOut={auth.signOut} />
    </header>
    <main className="workspace-main">{children}</main>
  </SidebarInset>
</SidebarProvider>
```

Remove disabled global search and the second context sidebar. Dashboard selection belongs inside the Dashboards module.

- [ ] **Step 6: Remove only superseded CSS**

Delete rules for `.module-rail`, `.context-sidebar`, `.global-search`, `.account-popover` and `.persona-switch` after their replacements pass tests. Keep feature-level geospatial, alert, report and intelligence styles unchanged.

- [ ] **Step 7: Run shell tests, accessibility checks and build**

Run:

```powershell
npm run test --workspace web -- --run src/app/AppSidebar.test.jsx src/app/AccountMenu.test.jsx src/app/AppShell.test.jsx
npm run web:test
npm run web:build
```

Expected: PASS; no duplicate navigation landmarks or missing accessible names.

- [ ] **Step 8: Commit the shell**

```powershell
git add web/src/app/AppSidebar.jsx web/src/app/AppSidebar.test.jsx web/src/app/AccountMenu.jsx web/src/app/AccountMenu.test.jsx web/src/app/AppShell.jsx web/src/app/AppShell.test.jsx web/src/styles/app.css
git commit -m "refactor(web): compose Catalyst-like role shell"
```

## Task 5: Make Authentication and Workspace Failures Specific

**Files:**
- Modify: `web/src/app/router.jsx`
- Modify: `web/src/app/router.test.jsx`
- Modify: `web/src/auth/AccessNotProvisioned.jsx`
- Test: `web/src/auth/AccessNotProvisioned.test.jsx`

- [ ] **Step 1: Add failing tests for each gate**

Cover these exact states: SDK unavailable, unauthenticated, token unavailable, Function unreachable, workspace contract invalid, access not provisioned and persona forbidden. Each test asserts a specific title, safe request ID when present, retry/sign-in action, and absence of role navigation.

- [ ] **Step 2: Run the gate tests and confirm the generic failure text fails expectations**

Run: `npm run test --workspace web -- --run src/app/router.test.jsx src/auth/AccessNotProvisioned.test.jsx`

- [ ] **Step 3: Implement a safe failure mapping**

Define a static map in `router.jsx`:

```js
const workspaceFailureCopy = Object.freeze({
  CATALYST_AUTH_TOKEN_UNAVAILABLE: ['Session could not be verified', 'Return to secure sign in and try again.'],
  CATALYST_FUNCTION_UNREACHABLE: ['Workspace service is unavailable', 'Retry the authorized workspace connection.'],
  CATALYST_AUTHORIZATION_REQUEST_BLOCKED: ['Authorized request was blocked', 'The Catalyst domain or CORS configuration needs attention.'],
  WORKSPACE_CONTRACT_INVALID: ['Workspace response is invalid', 'The service returned an unsupported workspace contract.'],
});
```

Unknown errors retain neutral copy. Never render `error.message`, response bodies, tokens or stack traces.

- [ ] **Step 4: Run focused and complete frontend tests**

Run:

```powershell
npm run test --workspace web -- --run src/app/router.test.jsx src/auth/AccessNotProvisioned.test.jsx
npm run web:test
```

Expected: PASS.

- [ ] **Step 5: Commit failure boundaries**

```powershell
git add web/src/app/router.jsx web/src/app/router.test.jsx web/src/auth/AccessNotProvisioned.jsx web/src/auth/AccessNotProvisioned.test.jsx
git commit -m "fix(web): make workspace failures actionable"
```

## Task 6: Verify the Complete Release Before Deployment

**Files:**
- Modify only if tests expose a defect.

- [ ] **Step 1: Run all repository verification**

Run:

```powershell
npm run verify
```

Expected: backend, frontend, build, schema and bundle inspections PASS.

- [ ] **Step 2: Inspect production artifacts**

Run:

```powershell
Get-ChildItem web/dist -Recurse | Where-Object Extension -eq '.map'
rg -n "password:|client_secret|KSP_AUDIT_KEY|at\.connectme" web/dist
```

Expected: no source maps and no credentials/secrets.

- [ ] **Step 3: Run the challenge-alignment review**

Run:

```powershell
powershell -ExecutionPolicy Bypass -File skills/reviewing-challenge-alignment/scripts/review-challenge-alignment.ps1
```

Confirm the release still exposes AI/ML intelligence routes, district drilldowns, maps, alerts, networks and risk—not merely authentication and dashboard styling.

- [ ] **Step 4: Review the complete diff**

Run:

```powershell
git diff --check HEAD~5..HEAD
git status --short
```

Expected: no whitespace errors; unrelated dirty files remain unstaged and preserved.

## Task 7: Deploy to Catalyst Development and Perform Live Acceptance

**Files:**
- Create: `docs/evidence/2026-07-23-authenticated-workspace-bootstrap-release.md`
- Modify: `docs/PROJECT_MEMORY.md`
- Modify: `docs/deployment/catalyst-development-ledger.md`

- [ ] **Step 1: Verify Catalyst console prerequisites without recording secrets**

In Catalyst Authentication confirm:

- Embedded Authentication is enabled.
- CSS customization is enabled.
- `https://aiksp.onslate.in` is an Authorized Domain with CORS enabled.
- At least one invited user is confirmed.

- [ ] **Step 2: Deploy only the verified Slate client**

Run:

```powershell
catalyst.cmd deploy --only client
```

Expected: deployment succeeds for `ksp-crime-intelligence`; no Function, table, Production or cron resource changes.

- [ ] **Step 3: Browser-test a fresh unauthenticated session**

At `https://aiksp.onslate.in` verify:

1. KSP-branded split login loads.
2. The real Catalyst form is visible and keyboard usable.
3. No protected sidebar or hard-coded metrics are present.
4. Failed empty submission uses Catalyst validation.

- [ ] **Step 4: Browser-test the authenticated demo presenter**

After signing in with a confirmed invited account, verify:

1. `/v1/workspace` resolves the Catalyst identity.
2. Workspace selector contains exactly the backend-returned personas.
3. Unsupported persona URLs fail closed.
4. Every permitted persona opens the shared role shell.
5. Profile switching and sign out work.
6. No relevant console error, authentication loop or blank page occurs.

- [ ] **Step 5: Record release evidence**

The evidence document records commit SHA, build/test commands, Catalyst deployment identifier, URL, tested personas, observed API request IDs for failures, and any manual Catalyst console prerequisite. It contains no credentials.

- [ ] **Step 6: Update memory and deployment ledger**

State clearly that the authenticated bootstrap is live while the 31-district/lakhs-of-FIR State Leadership home remains the next design slice.

- [ ] **Step 7: Commit release evidence**

```powershell
git add docs/evidence/2026-07-23-authenticated-workspace-bootstrap-release.md docs/PROJECT_MEMORY.md docs/deployment/catalyst-development-ledger.md
git commit -m "docs: record authenticated workspace release"
```

## Plan Self-Review

- Spec coverage: Catalyst sign-in, CSS customization, backend-governed selector, role shell, failure behavior, tests, Development-only deployment and live acceptance all have explicit tasks.
- Scope: Microsoft Entra, final statewide analytics, QuickML and external feeds remain outside this release.
- Authorization consistency: every selector and profile choice originates from `workspace.personaSwitch.personas`; presentation metadata never grants access.
- Data consistency: role pages retain API-only values; no task adds fallback metrics.
- Deployment consistency: only the Slate client is deployed after repository verification; Functions and Production remain unchanged.
- Placeholder scan: no unresolved markers, unspecified error handling or deferred code step remains.

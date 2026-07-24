# Command Center Empty Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an authenticated, isolated `COMMAND_CENTER` persona shell matching the approved reference, with an empty canvas and persistent light/dark/system appearance.

**Architecture:** Treat `COMMAND_CENTER` as a client-only presentation persona after Catalyst session verification. Resolve the ordinary `/v1/workspace` profile without forwarding `COMMAND_CENTER` as `X-Demo-Persona`, then render a dedicated shell before the existing workspace selector and `AppShell`; this preserves authorization without requiring a Function deployment. Keep shell state, rail state, and appearance state inside focused Command Center components.

**Tech Stack:** React 19, React Router 7, Lucide React, CSS, Vitest, Testing Library, Vite, Catalyst Slate Development.

---

### Task 1: Accept the isolated persona without forwarding it to the API

**Files:**
- Modify: `web/src/app/runtime.js`
- Modify: `web/src/app/runtime.test.js`
- Modify: `web/src/app/router.jsx`
- Modify: `web/src/app/router.test.jsx`

- [ ] **Step 1: Write failing runtime tests**

Add `readDemoPersona` to the runtime test import and assert that `COMMAND_CENTER` is accepted while an unknown value is rejected:

```js
import { governedAppLocation, personaSearch, readDemoPersona, readRuntime } from './runtime.js';

test('command center is an allowlisted client presentation persona', () => {
  expect(readDemoPersona('?persona=COMMAND_CENTER')).toBe('COMMAND_CENTER');
  expect(readDemoPersona('?persona=COMMAND%20CENTER')).toBeNull();
  expect(readDemoPersona('?persona=NOT_ALLOWED')).toBeNull();
});
```

- [ ] **Step 2: Run the runtime test and verify failure**

Run: `npm.cmd run test --workspace web -- src/app/runtime.test.js`

Expected: FAIL because `readDemoPersona('?persona=COMMAND_CENTER')` returns `null`.

- [ ] **Step 3: Add the persona to the client allowlist**

Extend the set in `web/src/app/runtime.js`:

```js
const demoPersonas = new Set([
  'COMMAND_CENTER',
  'STATE_LEADERSHIP',
  'REGIONAL_LEADERSHIP',
  'DISTRICT_LEADERSHIP',
  'CRIME_ANALYST',
  'STATION_OPERATIONS',
]);
```

- [ ] **Step 4: Add a failing router test for the isolated shell boundary**

Add a temporary mock component import target and test to `web/src/app/router.test.jsx`:

```jsx
test('command center persona verifies the ordinary workspace without forwarding a demo header', async () => {
  const api = { get: vi.fn(async path => {
    if (path === '/v1/workspace') return { data: {
      role: 'DEMO_PRESENTER', scopeUnitId: 1, syntheticData: true,
      availableDashboards: [], alertSummary: { total: 0 },
      personaSwitch: { allowed: true, personas: [] },
    } };
    throw new Error(`Unexpected request: ${path}`);
  }) };

  render(<MemoryRouter initialEntries={['/?persona=COMMAND_CENTER']}><Application api={api} /></MemoryRouter>);

  expect(await screen.findByRole('application', { name: 'KSP Command Center' })).toBeInTheDocument();
  expect(api.get).toHaveBeenCalledTimes(1);
  expect(api.get).toHaveBeenCalledWith('/v1/workspace');
});
```

- [ ] **Step 5: Run the router test and verify failure**

Run: `npm.cmd run test --workspace web -- src/app/router.test.jsx`

Expected: FAIL because the dedicated shell does not exist.

- [ ] **Step 6: Add the routing boundary**

In `web/src/app/router.jsx`, import `CommandCenterShell`, pass the requested persona into `AuthorizedApplication`, and render the shell only after the ordinary workspace response verifies `DEMO_PRESENTER`:

```jsx
import { CommandCenterShell } from '../features/command-center/CommandCenterShell.jsx';

function AuthorizedApplication({ api, auth, requestedPersona }) {
  // existing workspace load and failure handling remain unchanged
  const workspace = state.data;
  if (requestedPersona === 'COMMAND_CENTER') {
    if (workspace.role !== 'DEMO_PRESENTER') {
      return <AccessNotProvisioned requestId="ROUTE-SCOPE" onSignOut={() => auth.signOut()} />;
    }
    return <CommandCenterShell />;
  }
  // existing selector and app-shell branches
}
```

When constructing the API client, do not forward the client-only persona:

```js
const forwardedPersona = demoPersona === 'COMMAND_CENTER' ? null : demoPersona;
const api = useMemo(() => providedApi ?? createApiClient({
  baseUrl: runtime.apiBase,
  headers: forwardedPersona ? { 'X-Demo-Persona': forwardedPersona } : {},
  tokenProvider: () => auth.accessToken(),
}), [providedApi, forwardedPersona, runtime.apiBase, auth]);
```

Pass `requestedPersona={demoPersona}` to `AuthorizedApplication`.

- [ ] **Step 7: Run focused tests**

Run: `npm.cmd run test --workspace web -- src/app/runtime.test.js src/app/router.test.jsx`

Expected: runtime tests pass; router test may remain blocked only until the shell component is created in Task 2.

- [ ] **Step 8: Commit the routing boundary**

```powershell
git add web/src/app/runtime.js web/src/app/runtime.test.js web/src/app/router.jsx web/src/app/router.test.jsx
git commit -m "feat: route isolated command center persona"
```

### Task 2: Build the empty Command Center shell

**Files:**
- Create: `web/src/features/command-center/command-center-navigation.js`
- Create: `web/src/features/command-center/CommandCenterHeader.jsx`
- Create: `web/src/features/command-center/CommandCenterRail.jsx`
- Create: `web/src/features/command-center/CommandCenterShell.jsx`
- Create: `web/src/features/command-center/CommandCenterShell.test.jsx`

- [ ] **Step 1: Write failing shell tests**

Create `CommandCenterShell.test.jsx` with reference-structure and empty-canvas assertions:

```jsx
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { BrandProvider } from '../../branding/BrandProvider.jsx';
import { CommandCenterShell } from './CommandCenterShell.jsx';

afterEach(cleanup);

const renderShell = () => render(<BrandProvider><CommandCenterShell /></BrandProvider>);

test('renders the approved reference shell with an empty canvas', () => {
  renderShell();
  expect(screen.getByRole('application', { name: 'KSP Command Center' })).toBeInTheDocument();
  expect(screen.getByText('Karnataka State Police')).toBeInTheDocument();
  expect(screen.getByText('Analytics · Crime · Enforcement')).toBeInTheDocument();
  expect(screen.getByRole('searchbox', { name: 'Search' })).toBeDisabled();
  expect(screen.getByRole('navigation', { name: 'Command Center modules' })).toBeInTheDocument();
  expect(screen.getByTestId('command-center-canvas')).toBeEmptyDOMElement();
});

test('keeps all seven destinations while changing only selected rail state', () => {
  renderShell();
  const map = screen.getByRole('button', { name: 'Map' });
  fireEvent.click(map);
  expect(map).toHaveAttribute('aria-current', 'page');
  expect(screen.getByTestId('command-center-canvas')).toBeEmptyDOMElement();
});
```

- [ ] **Step 2: Run the shell test and verify failure**

Run: `npm.cmd run test --workspace web -- src/features/command-center/CommandCenterShell.test.jsx`

Expected: FAIL because the files do not exist.

- [ ] **Step 3: Define navigation data**

Create `command-center-navigation.js`:

```js
import { Bell, ChartNoAxesColumnIncreasing, FileText, Grid2X2, House, Map, Share2 } from 'lucide-react';

export const commandCenterDestinations = Object.freeze([
  { id: 'home', label: 'Home', icon: House },
  { id: 'analytics', label: 'Analytics', icon: ChartNoAxesColumnIncreasing },
  { id: 'alerts', label: 'Alerts', icon: Bell },
  { id: 'map', label: 'Map', icon: Map },
  { id: 'network', label: 'Network', icon: Share2 },
  { id: 'reports', label: 'Reports', icon: FileText },
  { id: 'apps', label: 'Apps', icon: Grid2X2 },
]);
```

- [ ] **Step 4: Implement the rail**

Create `CommandCenterRail.jsx` as a labelled navigation element that maps `commandCenterDestinations` to icon buttons, sets `aria-current="page"` only on the selected item, and calls `onSelect(id)`.

- [ ] **Step 5: Implement the header structure**

Create `CommandCenterHeader.jsx` using `usePlatformBrand()`, the existing KSP logo asset, and Lucide `Search`, `Bell`, and `Users` icons. Render the search control on the right immediately before avatar, notification, and team controls. The search input has `aria-label="Search"`, `placeholder=""`, and `disabled`. Notification and team buttons are disabled and have no counters.

- [ ] **Step 6: Compose the shell**

Create `CommandCenterShell.jsx`:

```jsx
import { useState } from 'react';
import { CommandCenterHeader } from './CommandCenterHeader.jsx';
import { CommandCenterRail } from './CommandCenterRail.jsx';

export function CommandCenterShell() {
  const [selected, setSelected] = useState('home');
  return <div className="command-center-shell" role="application" aria-label="KSP Command Center">
    <CommandCenterHeader />
    <CommandCenterRail selected={selected} onSelect={setSelected} />
    <main className="command-center-canvas" data-testid="command-center-canvas" />
  </div>;
}
```

- [ ] **Step 7: Run component and router tests**

Run: `npm.cmd run test --workspace web -- src/features/command-center/CommandCenterShell.test.jsx src/app/runtime.test.js src/app/router.test.jsx`

Expected: PASS.

- [ ] **Step 8: Commit the component structure**

```powershell
git add web/src/features/command-center web/src/app/runtime.js web/src/app/runtime.test.js web/src/app/router.jsx web/src/app/router.test.jsx
git commit -m "feat: add empty command center shell"
```

### Task 3: Add persistent appearance and reference-faithful styling

**Files:**
- Create: `web/src/features/command-center/command-center-appearance.js`
- Create: `web/src/features/command-center/CommandCenterAppearanceMenu.jsx`
- Modify: `web/src/features/command-center/CommandCenterHeader.jsx`
- Modify: `web/src/features/command-center/CommandCenterShell.jsx`
- Modify: `web/src/features/command-center/CommandCenterShell.test.jsx`
- Modify: `web/src/styles/app.css`

- [ ] **Step 1: Add failing appearance tests**

Extend `CommandCenterShell.test.jsx`:

```jsx
test('opens appearance choices from the avatar and persists dark mode', () => {
  renderShell();
  fireEvent.click(screen.getByRole('button', { name: 'Open account menu' }));
  fireEvent.click(screen.getByRole('radio', { name: 'Dark' }));
  expect(screen.getByRole('application', { name: 'KSP Command Center' })).toHaveAttribute('data-appearance', 'dark');
  expect(localStorage.getItem('ksp-command-center-appearance')).toBe('dark');
});
```

Clear `localStorage` in `afterEach`.

- [ ] **Step 2: Run the appearance test and verify failure**

Run: `npm.cmd run test --workspace web -- src/features/command-center/CommandCenterShell.test.jsx`

Expected: FAIL because the avatar menu and persistence do not exist.

- [ ] **Step 3: Implement appearance persistence**

Create `command-center-appearance.js` with the exact storage key `ksp-command-center-appearance`, accepted values `light`, `dark`, and `system`, default `light`, and a resolver using `matchMedia('(prefers-color-scheme: dark)')` only for `system`.

- [ ] **Step 4: Implement the appearance menu**

Create `CommandCenterAppearanceMenu.jsx` as a popover anchored to the avatar button. It exposes a radiogroup named `Appearance` with Light, Dark, and System radio controls. Escape and outside click close the menu; focus returns to the avatar trigger.

- [ ] **Step 5: Wire appearance into the shell**

Initialize appearance from storage, persist changes, and render both `data-appearance={resolvedAppearance}` and a scoped `command-center-shell--dark` class. Do not add or remove the global `.dark` class because other personas must remain unchanged.

- [ ] **Step 6: Add scoped reference-faithful CSS**

Append a dedicated `/* Command Center persona */` section to `web/src/styles/app.css`. Use these layout anchors from the supplied 1462×756 reference:

```css
.command-center-shell {
  --cc-header-height: 90px;
  --cc-rail-width: 102px;
  display: grid;
  grid-template: var(--cc-header-height) 1fr / var(--cc-rail-width) 1fr;
  width: 100%;
  height: 100%;
  min-height: 100dvh;
  overflow: hidden;
  background: #fff;
  color: #172234;
}
.command-center-header { grid-column: 1 / -1; }
.command-center-rail { background: #071a35; }
.command-center-canvas { min-width: 0; min-height: 0; background: #fff; }
.command-center-shell--dark { background: #0b1320; color: #edf3fb; }
.command-center-shell--dark .command-center-canvas { background: #0b1320; }
```

Complete the header, rail, controls, focus states, popover, and responsive rules without styling outside `.command-center-*`. At widths below 720px, reduce the identity copy and search width while preserving the rail and preventing horizontal overflow.

- [ ] **Step 7: Run focused tests and production build**

Run: `npm.cmd run test --workspace web -- src/features/command-center/CommandCenterShell.test.jsx src/app/runtime.test.js src/app/router.test.jsx`

Expected: PASS.

Run: `npm.cmd run web:build`

Expected: Vite build and bundle budget check PASS.

- [ ] **Step 8: Commit appearance and styling**

```powershell
git add web/src/features/command-center web/src/styles/app.css
git commit -m "feat: style command center persona shell"
```

### Task 4: Verify, deploy only Slate, and preserve rollback evidence

**Files:**
- Modify: `docs/PROJECT_MEMORY.md`
- Modify: `docs/deployment/catalyst-development-ledger.md`

- [ ] **Step 1: Run the full local verification gate**

Run: `npm.cmd run web:test`

Expected: all frontend tests PASS with zero failures.

Run: `npm.cmd run web:build`

Expected: production build and bundle budgets PASS.

Run: `git diff --check`

Expected: no whitespace errors.

- [ ] **Step 2: Perform Browser desktop QA**

Open `http://127.0.0.1:5173/?persona=COMMAND_CENTER` in the in-app browser with a test API or verified Development session. Confirm page identity, nonblank shell, empty canvas, no framework overlay, clean console, seven unique rail controls, selected-state interaction, blank search input, and working Light/Dark/System choices. Capture light and dark screenshots.

- [ ] **Step 3: Perform responsive QA**

Use the browser viewport capability at a mobile-sized width. Confirm no clipping or horizontal overflow, header controls remain reachable, rail remains usable, and the canvas stays empty. Reset the viewport override afterward.

- [ ] **Step 4: Compare against the accepted reference**

Use `view_image` on the supplied reference and the latest desktop screenshot. Record the fidelity check for header height, rail width, brand position, right-aligned search order, icon sizing, selected Home state, palette, and empty canvas. Fix any material mismatch before deployment.

- [ ] **Step 5: Record the rollback checkpoint**

Read the current Catalyst Slate deployment identifier, live URL, current commit, and clean remote preflight. Add a pending ledger entry that authorizes only the web-client mutation and names redeployment of that prior commit as rollback.

- [ ] **Step 6: Deploy only Catalyst Slate Development**

Run the repository’s reviewed Catalyst Slate deployment command for `ksp-crime-intelligence`. Do not deploy Functions, Data Store, API Gateway, Authentication, Jobs, cron, or Production resources.

Expected: Catalyst reports the Slate client deployment successful.

- [ ] **Step 7: Smoke-test the live persona URL**

Open `https://ace.onslate.in/?persona=COMMAND_CENTER`. Confirm the authenticated shell renders, the canvas is empty, rail selection works, appearance persists after reload, the search contains no sentence, and the browser console has no relevant errors.

- [ ] **Step 8: Finalize evidence and commit**

Update `docs/PROJECT_MEMORY.md` and `docs/deployment/catalyst-development-ledger.md` with the exact verification totals, deployment identifiers, live smoke result, and rollback commit.

```powershell
git add docs/PROJECT_MEMORY.md docs/deployment/catalyst-development-ledger.md
git commit -m "docs: record command center development deployment"
```

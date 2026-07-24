# Command Center Compact Controls and Menus Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Further compact the Command Center chrome, remove the Team control, move appearance choices to Settings, and make the avatar a backend-authorized persona switcher.

**Architecture:** Keep authorization and navigation in `AuthorizedApplication`, passing only the backend persona allowlist and governed callbacks into the Command Center components. Keep menu presentation in focused persona and appearance components, with `CommandCenterShell` owning mutually exclusive menu state and appearance persistence.

**Tech Stack:** React 19, React Router 7, Lucide React, CSS, Vitest, Testing Library, Vite, Catalyst Slate

---

## File Structure

- Create `web/src/features/command-center/CommandCenterPersonaMenu.jsx` for authorized persona actions and the workspace-selector return action.
- Modify `web/src/features/command-center/CommandCenterShell.jsx` to own mutually exclusive account/settings menu state.
- Modify `web/src/features/command-center/CommandCenterHeader.jsx` to remove Team, add Settings, and render the correct menu beneath each control.
- Modify `web/src/features/command-center/CommandCenterAppearanceMenu.jsx` only if its callback contract must close the menu after selection.
- Modify `web/src/features/command-center/CommandCenterShell.test.jsx` for menu behavior and Team removal.
- Modify `web/src/features/command-center/CommandCenterResponsive.test.js` for exact compact dimensions.
- Modify `web/src/app/router.jsx` to pass the backend-authorized personas and governed navigation callbacks.
- Modify `web/src/app/router.test.jsx` to verify persona and workspace-selector navigation.
- Modify `web/src/styles/app.css` for compact dimensions and both popovers.

### Task 1: Specify Menu Behavior and Compact Dimensions

**Files:**
- Modify: `web/src/features/command-center/CommandCenterShell.test.jsx`
- Modify: `web/src/features/command-center/CommandCenterResponsive.test.js`

- [ ] **Step 1: Add failing component tests**

Render the shell with authorized persona callbacks:

```jsx
const onPersonaSelect = vi.fn();
const onAllWorkspaces = vi.fn();
render(<BrandProvider><CommandCenterShell
  personas={['STATE_LEADERSHIP', 'CRIME_ANALYST']}
  onPersonaSelect={onPersonaSelect}
  onAllWorkspaces={onAllWorkspaces}
/></BrandProvider>);
```

Assert these behaviors in separate tests:

```jsx
expect(screen.queryByRole('button', { name: 'Team' })).not.toBeInTheDocument();

fireEvent.click(screen.getByRole('button', { name: 'Open persona menu' }));
fireEvent.click(screen.getByRole('button', { name: 'Crime Analyst' }));
expect(onPersonaSelect).toHaveBeenCalledWith('CRIME_ANALYST');
expect(screen.queryByRole('menu', { name: 'Change persona' })).not.toBeInTheDocument();

fireEvent.click(screen.getByRole('button', { name: 'Open persona menu' }));
fireEvent.click(screen.getByRole('button', { name: 'All workspaces' }));
expect(onAllWorkspaces).toHaveBeenCalledOnce();

fireEvent.click(screen.getByRole('button', { name: 'Open settings' }));
fireEvent.click(screen.getByRole('radio', { name: 'Dark' }));
expect(screen.getByRole('application')).toHaveAttribute('data-appearance', 'dark');
expect(screen.queryByRole('radiogroup', { name: 'Appearance' })).not.toBeInTheDocument();
```

Also assert opening Settings closes the persona menu.

- [ ] **Step 2: Update the CSS contract test with exact desktop values**

Require these declarations:

```js
expect(css).toContain('.command-center-shell { --cc-header:56px; --cc-rail:56px;');
expect(css).toContain('.command-center-header__brand img { width:32px; height:38px;');
expect(css).toContain('.command-center-header__brand span { color:#68758a; font-size:12px;');
expect(css).toContain('.command-center-search { display:flex; align-items:center; gap:8px; width:200px; height:38px;');
expect(css).toContain('.command-center-header__utilities>button,.command-center-avatar { display:grid; place-items:center; width:38px; height:38px;');
expect(css).toContain('.command-center-rail button { display:grid; place-items:center; width:44px; height:44px;');
expect(css).toContain('.command-center-rail svg { width:20px; height:20px;');
```

- [ ] **Step 3: Run focused tests and verify RED**

Run from `web`:

```powershell
npm.cmd test -- CommandCenterShell.test.jsx CommandCenterResponsive.test.js
```

Expected: failures because the persona/settings separation, Team removal, and smaller desktop dimensions do not exist.

### Task 2: Implement Focused Persona and Settings Menus

**Files:**
- Create: `web/src/features/command-center/CommandCenterPersonaMenu.jsx`
- Modify: `web/src/features/command-center/CommandCenterShell.jsx`
- Modify: `web/src/features/command-center/CommandCenterHeader.jsx`
- Modify: `web/src/features/command-center/CommandCenterAppearanceMenu.jsx`

- [ ] **Step 1: Create the persona menu**

Use `getPersonaPresentation` for labels and render only supplied personas:

```jsx
import { getPersonaPresentation } from '../../app/workspace-navigation.js';

export function CommandCenterPersonaMenu({ personas, onSelect, onAllWorkspaces }) {
  return <div className="command-center-menu" role="menu" aria-label="Change persona">
    <strong>Change persona</strong>
    {personas.map(role => {
      const presentation = getPersonaPresentation(role);
      return <button key={role} type="button" role="menuitem" onClick={() => onSelect(role)}>{presentation.label}</button>;
    })}
    <button type="button" role="menuitem" onClick={onAllWorkspaces}>All workspaces</button>
  </div>;
}
```

- [ ] **Step 2: Refactor shell menu state**

Use one state value:

```jsx
const [openMenu, setOpenMenu] = useState(null);
```

Pass `accountOpen`, `settingsOpen`, and toggle callbacks to the header. Wrap persona, workspace, and appearance callbacks so each action sets `openMenu` to `null` after completion.

- [ ] **Step 3: Render the new utility order**

In `CommandCenterHeader.jsx`, import `Settings` instead of `Users`. Render Search, avatar/persona menu, Notifications, then Settings/appearance menu. Remove the Team button completely.

- [ ] **Step 4: Run focused tests and verify menu behavior GREEN**

Run:

```powershell
npm.cmd test -- CommandCenterShell.test.jsx
```

Expected: shell tests pass, including persona actions, menu exclusivity, settings persistence, and Team removal.

### Task 3: Wire Governed Navigation

**Files:**
- Modify: `web/src/app/router.jsx`
- Modify: `web/src/app/router.test.jsx`

- [ ] **Step 1: Add failing router tests**

For a `DEMO_PRESENTER` workspace whose `personaSwitch.personas` contains `STATE_LEADERSHIP` and `CRIME_ANALYST`, render at `/?release=1&persona=COMMAND_CENTER` with `LocationProbe`. Verify:

```jsx
fireEvent.click(await screen.findByRole('button', { name: 'Open persona menu' }));
fireEvent.click(screen.getByRole('menuitem', { name: 'Crime Analyst' }));
expect(screen.getByTestId('location')).toHaveTextContent('/?release=1&persona=CRIME_ANALYST');
```

In a separate render, click `All workspaces` and expect `/?release=1` plus the `Select workspace` heading.

- [ ] **Step 2: Run router tests and verify RED**

Run:

```powershell
npm.cmd test -- router.test.jsx
```

Expected: failures because `AuthorizedApplication` does not pass persona data or callbacks to the shell.

- [ ] **Step 3: Pass governed props from `AuthorizedApplication`**

Render the shell as:

```jsx
<CommandCenterShell
  personas={workspace.personaSwitch?.personas ?? []}
  onPersonaSelect={role => navigate(workspaceDestinationLocation({ type: 'persona', role }, location.search))}
  onAllWorkspaces={() => navigate({ pathname: '/', search: personaSearch(location.search, null) })}
/>
```

This preserves unrelated safe query values such as `release`, uses the existing persona allowlist, and never exposes a persona missing from the backend contract.

- [ ] **Step 4: Run router tests and verify GREEN**

Run:

```powershell
npm.cmd test -- router.test.jsx
```

Expected: router tests pass and both governed navigation paths are proven.

### Task 4: Apply the Compact Visual Rules

**Files:**
- Modify: `web/src/styles/app.css`
- Test: `web/src/features/command-center/CommandCenterResponsive.test.js`

- [ ] **Step 1: Apply the approved desktop dimensions**

Set the base shell/header/rail values to the exact dimensions asserted in Task 1. Use 8-pixel desktop utility gaps, reduce header padding to 16 pixels, and position both menus beneath their owning controls.

- [ ] **Step 2: Style shared menus without changing authorization behavior**

Use `.command-center-menu` as the shared popover surface and keep `.command-center-appearance` as its appearance-specific layout. Ensure menu buttons have visible hover and focus states in light and dark appearance.

- [ ] **Step 3: Preserve narrow overflow safety**

Retain the 390-pixel no-overflow contract. At `max-width:520px`, keep search as an icon and hide branding copy; do not reintroduce Team.

- [ ] **Step 4: Run the responsive contract test**

Run:

```powershell
npm.cmd test -- CommandCenterResponsive.test.js
```

Expected: both desktop and narrow layout tests pass.

### Task 5: Verify, Commit, Deploy, and Exercise the Live UI

**Files:**
- Verify all files changed in Tasks 1-4.

- [ ] **Step 1: Run complete frontend verification**

Run from `web`:

```powershell
npm.cmd test
npm.cmd run build
```

Expected: all tests pass and Vite exits with code 0.

- [ ] **Step 2: Validate and commit the implementation**

```powershell
git diff --check
git add web/src/app/router.jsx web/src/app/router.test.jsx web/src/features/command-center web/src/styles/app.css
git commit -m "feat: add compact command center account controls"
```

- [ ] **Step 3: Run the clean Development preflight**

```powershell
npm.cmd run catalyst:preflight:remote
```

Expected: clean `codex/geospatial-studio-core`, Development, `migrationReady: true`, and `remoteMutationAuthorized: true`.

- [ ] **Step 4: Deploy only Slate**

```powershell
catalyst.cmd deploy --only slate:ksp-crime-intelligence
```

Do not deploy Functions, data, Jobs, API Gateway, Authentication, or Production.

- [ ] **Step 5: Verify desktop and narrow dimensions in the in-app browser**

At 1280 by 756, measure the exact approved header, rail, search, controls, rail buttons, and icons. At 390 by 844, confirm document `scrollWidth` equals 390 and no framework overlay appears.

- [ ] **Step 6: Exercise both menus live**

Verify:

- Team is absent;
- avatar opens only backend-authorized personas plus All workspaces;
- selecting a persona changes the governed persona query and closes the menu;
- All workspaces returns to the selector while preserving the release query;
- Settings opens Light/Dark/System;
- changing appearance persists and closes the menu;
- opening either menu closes the other.

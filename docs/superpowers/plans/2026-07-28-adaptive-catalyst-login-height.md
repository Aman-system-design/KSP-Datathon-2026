# Adaptive Catalyst Login Height Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the email-step whitespace and desktop scrollbar by sizing the embedded Catalyst form to its rendered content while preserving safe password, error, and fallback states.

**Architecture:** Add a small login-owned utility that reads the same-origin iframe document height, clamps it to safe bounds, and applies it through one CSS custom property. `SignInRequired` owns observer setup and cleanup; existing Catalyst mounting, credentials, routing, and all non-login code remain unchanged.

**Tech Stack:** React 19, browser DOM APIs (`MutationObserver`, `ResizeObserver`), CSS custom properties, Vitest, Testing Library, Vite.

---

## File map

- Create `web/src/auth/catalyst-frame-height.js`: height constants, safe measurement, clamping, and style application.
- Create `web/src/auth/catalyst-frame-height.test.js`: deterministic unit coverage for compact, expanded, bounded, and inaccessible iframe states.
- Modify `web/src/auth/SignInRequired.jsx`: bind frame load/content observers and clean them up without changing authentication behavior.
- Modify `web/src/auth/SignInRequired.test.jsx`: integration coverage for adaptive height, fallback, cleanup, credentials, and unchanged mount arguments.
- Modify `web/src/styles/app.css`: consume the height custom property, reduce the desktop shell height, and remove the forced short-desktop overflow rule.

### Task 1: Create an isolated implementation worktree

**Files:**
- Reference: `docs/superpowers/specs/2026-07-28-adaptive-catalyst-login-height-design.md`
- Reference: `docs/superpowers/plans/2026-07-28-adaptive-catalyst-login-height.md`

- [ ] **Step 1: Verify the source branch and preserve the dirty root worktree**

Run:

```powershell
git status --short
git rev-parse origin/main
git worktree list
```

Expected: existing unrelated changes remain in the root worktree; `origin/main` resolves to the currently deployed lineage.

- [ ] **Step 2: Create the isolated branch from `origin/main`**

Run through `superpowers:using-git-worktrees`:

```powershell
git worktree add "C:\tmp\ksp-adaptive-login" -b codex/adaptive-login-height origin/main
```

Expected: a clean worktree on `codex/adaptive-login-height`; no root-worktree files change.

- [ ] **Step 3: Confirm the deployed login baseline exists**

Run:

```powershell
git status --short
rg -n "Demo access for judges|height: 360px|height: min\(700px" web/src/auth/SignInRequired.jsx web/src/styles/app.css
```

Expected: clean status and all three deployed-baseline strings are present.

### Task 2: Add bounded iframe-height measurement with TDD

**Files:**
- Create: `web/src/auth/catalyst-frame-height.js`
- Create: `web/src/auth/catalyst-frame-height.test.js`

- [ ] **Step 1: Write failing unit tests**

Create tests covering these exact contracts:

```js
import { describe, expect, test } from 'vitest';
import {
  CATALYST_FRAME_FALLBACK_HEIGHT,
  applyCatalystFrameHeight,
  measureCatalystFrameHeight,
} from './catalyst-frame-height.js';

const frameWithHeight = height => ({
  contentDocument: {
    body: { scrollHeight: height - 4 },
    documentElement: { scrollHeight: height },
  },
});

describe('Catalyst frame height', () => {
  test('uses a compact bounded height for the email step', () => {
    expect(measureCatalystFrameHeight(frameWithHeight(270))).toBe(282);
  });

  test('expands and clamps tall password or error states', () => {
    expect(measureCatalystFrameHeight(frameWithHeight(390))).toBe(402);
    expect(measureCatalystFrameHeight(frameWithHeight(900))).toBe(420);
  });

  test('returns the safe fallback when iframe access is unavailable', () => {
    const frame = {};
    Object.defineProperty(frame, 'contentDocument', { get: () => { throw new DOMException('Blocked'); } });
    expect(measureCatalystFrameHeight(frame)).toBe(CATALYST_FRAME_FALLBACK_HEIGHT);
  });

  test('applies one shared custom property to the host', () => {
    const host = document.createElement('div');
    expect(applyCatalystFrameHeight(host, frameWithHeight(270))).toBe(282);
    expect(host.style.getPropertyValue('--catalyst-frame-height')).toBe('282px');
  });
});
```

- [ ] **Step 2: Run the new test and verify it fails**

Run:

```powershell
npm.cmd test -- --run src/auth/catalyst-frame-height.test.js
```

Working directory: `C:\tmp\ksp-adaptive-login\web`

Expected: FAIL because `catalyst-frame-height.js` does not exist.

- [ ] **Step 3: Implement the minimal utility**

Create:

```js
export const CATALYST_FRAME_MIN_HEIGHT = 250;
export const CATALYST_FRAME_MAX_HEIGHT = 420;
export const CATALYST_FRAME_FALLBACK_HEIGHT = 360;
const CATALYST_FRAME_PADDING = 12;

const clamp = value => Math.min(
  CATALYST_FRAME_MAX_HEIGHT,
  Math.max(CATALYST_FRAME_MIN_HEIGHT, value),
);

export function measureCatalystFrameHeight(frame) {
  try {
    const document = frame?.contentDocument;
    if (!document) return CATALYST_FRAME_FALLBACK_HEIGHT;
    const height = Math.max(
      Number(document.documentElement?.scrollHeight) || 0,
      Number(document.body?.scrollHeight) || 0,
    );
    if (!height) return CATALYST_FRAME_FALLBACK_HEIGHT;
    return clamp(Math.ceil(height) + CATALYST_FRAME_PADDING);
  } catch {
    return CATALYST_FRAME_FALLBACK_HEIGHT;
  }
}

export function applyCatalystFrameHeight(host, frame) {
  const height = measureCatalystFrameHeight(frame);
  host.style.setProperty('--catalyst-frame-height', `${height}px`);
  return height;
}
```

- [ ] **Step 4: Run the unit test and verify it passes**

Run:

```powershell
npm.cmd test -- --run src/auth/catalyst-frame-height.test.js
```

Expected: 4 tests pass.

- [ ] **Step 5: Commit the utility**

```powershell
git add web/src/auth/catalyst-frame-height.js web/src/auth/catalyst-frame-height.test.js
git commit -m "test: define adaptive Catalyst frame height"
```

### Task 3: Integrate adaptive sizing into the login component with TDD

**Files:**
- Modify: `web/src/auth/SignInRequired.jsx`
- Modify: `web/src/auth/SignInRequired.test.jsx`

- [ ] **Step 1: Add failing component tests**

Extend the focused suite with tests that mount a synthetic iframe from `auth.mountSignIn`, define a readable `contentDocument`, fire `load`, and assert:

```js
expect(document.getElementById('catalystLogin').style
  .getPropertyValue('--catalyst-frame-height')).toBe('282px');
```

Then change both synthetic `scrollHeight` values to `390`, notify the mocked observer, and assert:

```js
expect(document.getElementById('catalystLogin').style
  .getPropertyValue('--catalyst-frame-height')).toBe('402px');
```

Add a cross-origin getter test that throws and confirms the property remains `360px`. Spy on observer `disconnect()` methods and assert cleanup calls them after `unmount()`.

- [ ] **Step 2: Run the focused component tests and verify failure**

Run:

```powershell
npm.cmd test -- --run src/auth/SignInRequired.test.jsx
```

Expected: new adaptive-height and cleanup assertions fail; existing authentication and credential assertions continue to pass.

- [ ] **Step 3: Bind measurement and observers without changing authentication**

Import `applyCatalystFrameHeight`. Inside the existing effect, retain `frame.title`, `frame.scrolling = 'no'`, and the exact `auth.mountSignIn(...)` arguments. Add one per-frame `load` listener and observe the readable iframe document:

```js
const frameCleanups = new Map();

const bindFrame = (frame) => {
  frameCleanups.get(frame)?.();
  const syncHeight = () => applyCatalystFrameHeight(host, frame);
  let contentObserver;
  let resizeObserver;

  const observeContent = () => {
    contentObserver?.disconnect();
    resizeObserver?.disconnect();
    syncHeight();
    try {
      const root = frame.contentDocument?.documentElement;
      if (!root) return;
      contentObserver = new MutationObserver(syncHeight);
      contentObserver.observe(root, { childList: true, subtree: true, attributes: true });
      if (typeof ResizeObserver === 'function') {
        resizeObserver = new ResizeObserver(syncHeight);
        resizeObserver.observe(root);
      }
    } catch {
      syncHeight();
    }
  };

  frame.addEventListener('load', observeContent);
  observeContent();
  frameCleanups.set(frame, () => {
    frame.removeEventListener('load', observeContent);
    contentObserver?.disconnect();
    resizeObserver?.disconnect();
  });
};
```

Call `bindFrame(frame)` only once per discovered frame, and run every stored cleanup plus the existing host observer cleanup on component unmount.

- [ ] **Step 4: Run the component tests and verify they pass**

Run:

```powershell
npm.cmd test -- --run src/auth/SignInRequired.test.jsx src/auth/catalyst-frame-height.test.js
```

Expected: all focused login tests pass with no React act warnings or leaked observers.

- [ ] **Step 5: Commit the component integration**

```powershell
git add web/src/auth/SignInRequired.jsx web/src/auth/SignInRequired.test.jsx
git commit -m "fix: adapt Catalyst login frame height"
```

### Task 4: Make the desktop shell compact and scrollbar-safe

**Files:**
- Modify: `web/src/styles/app.css`
- Modify: `web/src/auth/SignInRequired.test.jsx`

- [ ] **Step 1: Replace the fixed-height CSS assertion with adaptive layout assertions**

Assert the login rules contain:

```js
expect(hostRule).toMatch(/height:\s*var\(--catalyst-frame-height,\s*360px\)/);
expect(frameRule).toMatch(/height:\s*var\(--catalyst-frame-height,\s*360px\)/);
expect(shellRule).toMatch(/height:\s*min\(680px,\s*calc\(100dvh\s*-\s*32px\)\)/);
expect(css).not.toMatch(/@media \(min-width:\s*761px\) and \(max-height:\s*680px\)/);
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```powershell
npm.cmd test -- --run src/auth/SignInRequired.test.jsx
```

Expected: FAIL on the old fixed `360px`, `700px`, and short-desktop rules.

- [ ] **Step 3: Apply the minimal CSS changes**

Use these contracts:

```css
.secure-login { padding: 16px; }
.secure-login__shell {
  height: min(680px, calc(100dvh - 32px));
  max-height: calc(100dvh - 32px);
}
.secure-login__catalyst,
.secure-login__catalyst iframe {
  height: var(--catalyst-frame-height, 360px) !important;
  transition: height 180ms ease;
}
```

Keep the iframe width and border declarations. Delete only the desktop `min-width: 761px`/`max-height: 680px` rule that forces a 700px card and outer scrolling. Preserve the existing mobile rules, where normal page scrolling is intentional.

- [ ] **Step 4: Run focused tests and the production build**

Run:

```powershell
npm.cmd test -- --run src/auth/SignInRequired.test.jsx src/auth/catalyst-frame-height.test.js src/app/router.test.jsx
npm.cmd run build
```

Expected: focused tests pass and Vite production build succeeds.

- [ ] **Step 5: Commit the CSS change**

```powershell
git add web/src/styles/app.css web/src/auth/SignInRequired.test.jsx
git commit -m "fix: compact the desktop login shell"
```

### Task 5: Verify visual states and regression safety

**Files:**
- Verify only; no planned file changes.

- [ ] **Step 1: Run the complete login/authentication regression set**

Run:

```powershell
npm.cmd test -- --run src/auth src/app/router.test.jsx
```

Expected: all authentication and router tests pass.

- [ ] **Step 2: Run the repository web build from the worktree root**

Run:

```powershell
npm.cmd run web:build
```

Expected: production build and bundle-budget validation pass.

- [ ] **Step 3: Start the local client and inspect the email step**

Run:

```powershell
npm.cmd run dev -- --host 127.0.0.1
```

Use the in-app browser at 1920x1080 and 1440x900. Expected: the demo credentials sit directly below the email form, all content fits, and both document and access-column `scrollHeight` equal `clientHeight`.

- [ ] **Step 4: Inspect the password step**

Enter the supplied demo email and activate `Next`. Expected: the iframe grows, the password form remains fully visible, credentials move down, and there is no clipping or nested scrollbar.

- [ ] **Step 5: Inspect constrained viewports**

Test 760x900 and 390x844. Expected: the single-column layout remains usable and uses normal page scrolling when required.

- [ ] **Step 6: Confirm the branch contains only login-scoped changes**

Run:

```powershell
git diff --stat origin/main...HEAD
git diff --name-only origin/main...HEAD
git status --short
```

Expected: only the five planned login files (plus approved design/plan documents if cherry-picked) appear and status is clean.

### Task 6: Integrate and deploy safely

**Files:**
- No new source changes expected.

- [ ] **Step 1: Rebase or merge the latest `origin/main` into the isolated branch**

Run:

```powershell
git fetch origin
git rebase origin/main
```

Expected: no unrelated changes are lost; resolve only login-file conflicts if upstream changed them.

- [ ] **Step 2: Re-run focused verification after integration**

Run:

```powershell
npm.cmd test -- --run src/auth src/app/router.test.jsx
npm.cmd run build
```

Expected: tests and build pass from the final commit.

- [ ] **Step 3: Push the isolated branch and fast-forward `main` only after review**

Run the repository's approved integration workflow. Expected: `main` contains only reviewed login changes and remains pushable without force.

- [ ] **Step 4: Deploy the existing Slate application**

Run:

```powershell
catalyst.cmd deploy --only slate:ksp-crime-intelligence -p 43492000000013049
```

Expected: Catalyst reports deployment complete for the existing Slate app; `https://ace.onslate.in` remains unchanged.

- [ ] **Step 5: Verify production without transmitting new data**

Open a cache-busted production URL. Verify email and password layouts, then confirm login and one persona switch. Expected: no blank page, no scrollbar at desktop viewport, demo credentials visible, and no new console render errors.


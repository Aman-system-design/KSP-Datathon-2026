# Environment-aware Catalyst Origin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Route the Development and Production public hosts to their matching Catalyst function and authentication origins without changing any other application behavior.

**Architecture:** Keep origin selection inside the existing `readRuntime` boundary. Select Production only for the exact `acep.onslate.in` hostname; retain Development as the default for `ace.onslate.in`, localhost, tests, and previews.

**Tech Stack:** JavaScript, Vite, Vitest, React, Zoho Catalyst CLI

---

### Task 1: Add hostname routing regression tests

**Files:**
- Modify: `web/src/app/runtime.test.js`
- Test: `web/src/app/runtime.test.js`

- [ ] **Step 1: Write the failing Production-host test**

```js
const productionOrigin = 'https://kspdatathon2026-60077844198.catalystserverless.in';

test('Production Slate uses the Production Catalyst origin', () => {
  expect(readRuntime({}, { hostname: 'acep.onslate.in' })).toEqual({
    apiBase: `${productionOrigin}/server/crime_intelligence_api`,
    authOrigin: productionOrigin,
  });
});
```

- [ ] **Step 2: Preserve Development and local behavior in tests**

```js
test.each(['ace.onslate.in', 'localhost', '127.0.0.1'])('%s keeps the Development Catalyst origin', hostname => {
  expect(readRuntime({}, { hostname }).authOrigin).toBe(
    'https://kspdatathon2026-60077844198.development.catalystserverless.in',
  );
});
```

- [ ] **Step 3: Run the focused test and verify RED**

Run: `npm test -- src/app/runtime.test.js` from `web/`

Expected: FAIL because `readRuntime` ignores the hostname and returns the Development origin for `acep.onslate.in`.

- [ ] **Step 4: Commit the failing regression test**

```bash
git add web/src/app/runtime.test.js
git commit -m "test: cover Production Catalyst runtime origin"
```

### Task 2: Implement exact-host environment selection

**Files:**
- Modify: `web/src/app/runtime.js`
- Test: `web/src/app/runtime.test.js`

- [ ] **Step 1: Add minimal origin selection**

```js
const DEVELOPMENT_ORIGIN = 'https://kspdatathon2026-60077844198.development.catalystserverless.in';
const PRODUCTION_ORIGIN = 'https://kspdatathon2026-60077844198.catalystserverless.in';

export function readRuntime(environment = import.meta.env, location = globalThis.location ?? {}) {
  const hostname = typeof location.hostname === 'string' ? location.hostname.toLowerCase() : '';
  const authOrigin = hostname === 'acep.onslate.in' ? PRODUCTION_ORIGIN : DEVELOPMENT_ORIGIN;
  const approvedApi = `${authOrigin}/server/crime_intelligence_api`;
  const apiBase = environment.VITE_API_BASE ?? approvedApi;
  if (apiBase !== approvedApi) throw new TypeError('VITE_API_BASE must be the approved Catalyst endpoint');
  return Object.freeze({ apiBase, authOrigin });
}
```

- [ ] **Step 2: Run the focused test and verify GREEN**

Run: `npm test -- src/app/runtime.test.js` from `web/`

Expected: all runtime tests PASS.

- [ ] **Step 3: Run the full web regression suite**

Run: `npm test` from `web/`

Expected: all tests PASS with no new failures.

- [ ] **Step 4: Build the deployable web client**

Run: `npm run build` from `web/`

Expected: Vite exits successfully and produces `web/dist/`.

- [ ] **Step 5: Commit the implementation**

```bash
git add web/src/app/runtime.js
git commit -m "fix: select Catalyst origin by public host"
```

### Task 3: Deploy and verify without changing Development

**Files:**
- No source changes

- [ ] **Step 1: Review the deployment diff**

Confirm the deployment contains only the rebuilt Slate/web-client artifact. Abort if it includes functions, datastore schema, File Store permissions, personas, dashboards, reports, or environment settings.

- [ ] **Step 2: Deploy the web client to Production**

Use the project’s existing Catalyst deployment workflow and target Production only.

Expected: Catalyst reports deployment successful.

- [ ] **Step 3: Verify Production**

Open `https://acep.onslate.in/?release=production-origin-final`.

Expected: the Catalyst login/workspace flow renders without `CATALYST_AUTHORIZATION_REQUEST_BLOCKED` or `CATALYST_FUNCTION_UNREACHABLE`.

- [ ] **Step 4: Verify Development is unchanged**

Open `https://ace.onslate.in/?persona=COMMAND_CENTER&release=development-regression-check`.

Expected: Development loads normally, persona switching works, and no blank screen appears.

- [ ] **Step 5: Record final verification**

Run `git status --short` and confirm only the user’s pre-existing unrelated changes remain outside the isolated implementation commits.

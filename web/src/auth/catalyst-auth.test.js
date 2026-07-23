import { readFileSync } from 'node:fs';

import { afterEach, expect, test, vi } from 'vitest';

import { authFailureDiagnostic, createCatalystAuth } from './catalyst-auth.js';

afterEach(() => vi.unstubAllGlobals());

test('authentication diagnostics exclude messages and response payloads', () => {
  const error = Object.assign(new Error('secret provider detail'), { code: 'TOKEN_FAILED', status: 401, response: { secret: true } });
  expect(authFailureDiagnostic(error)).toEqual({ name: 'Error', code: 'TOKEN_FAILED', status: 401 });
});

test('uses the native Catalyst hosted-login route without storing credentials', () => {
  const auth = createCatalystAuth({ location: { origin: 'https://ksp.example' } });
  expect(auth.loginUrl).toBe('/__catalyst/auth/login');
  expect(auth).not.toHaveProperty('token');
});

test('reads session identity and signs out through the Catalyst Web SDK', async () => {
  const isUserAuthenticated = vi.fn(async () => ({ content: { user_id: 'CAT-1', status: 'ACTIVE' } }));
  const signOut = vi.fn();
  const auth = createCatalystAuth({ catalyst: { auth: { isUserAuthenticated, signOut } }, location: { origin: 'https://ksp.example' } });

  await expect(auth.currentUser()).resolves.toEqual({ user_id: 'CAT-1', status: 'ACTIVE' });
  auth.signOut();

  expect(isUserAuthenticated).toHaveBeenCalledOnce();
  expect(signOut).toHaveBeenCalledWith('https://ksp.example/__catalyst/auth/login');
});

test('falls back to the hosted-login URL when the Web SDK is unavailable', () => {
  const assign = vi.fn();
  const auth = createCatalystAuth({ location: { origin: 'https://ksp.example', assign } });
  auth.signOut();
  expect(assign).toHaveBeenCalledWith('/__catalyst/auth/login');
});

test('session failures are logged as serialized safe diagnostics', async () => {
  const sessionError = Object.assign(new Error('private provider detail'), { code: 'SESSION_FAILED', status: 503 });
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});
  const auth = createCatalystAuth({ catalyst: { auth: { isUserAuthenticated: async () => { throw sessionError; } } } });

  await expect(auth.currentUser()).rejects.toBe(sessionError);

  expect(log).toHaveBeenCalledWith('catalyst_auth_session_failed', JSON.stringify({
    name: 'Error', code: 'SESSION_FAILED', status: 503,
  }));
  expect(log.mock.calls[0][1]).not.toContain('private provider detail');
  log.mockRestore();
});

test('generates the Catalyst cross-domain backend token without storing it', async () => {
  const generateAuthToken = vi.fn(async () => ({ access_token: 'TOKEN-1' }));
  const auth = createCatalystAuth({ catalyst: { auth: { generateAuthToken } } });

  await expect(auth.accessToken()).resolves.toBe('TOKEN-1');
  expect(generateAuthToken).toHaveBeenCalledOnce();
  expect(auth).not.toHaveProperty('token');
});

test('returns no backend token until the Catalyst Web SDK session is available', async () => {
  const auth = createCatalystAuth({ catalyst: {} });
  await expect(auth.accessToken()).resolves.toBeNull();
});

test('opens the dedicated same-origin Catalyst sign-in page', () => {
  const replace = vi.fn();
  const auth = createCatalystAuth({ location: { origin: 'https://aiksp.onslate.in', replace } });

  auth.openSignIn();

  expect(replace).toHaveBeenCalledWith('/ksp-sign-in-v3.html');
});

test('Slate authentication uses the approved Catalyst Function origin for hosted login and sign-out', () => {
  const assign = vi.fn();
  const authOrigin = 'https://kspdatathon2026-60077844198.development.catalystserverless.in';
  const auth = createCatalystAuth({ authOrigin, location: { origin: 'https://aiksp.onslate.in', assign } });
  expect(auth.loginUrl).toBe(`${authOrigin}/__catalyst/auth/login`);
  auth.signOut();
  expect(assign).toHaveBeenCalledWith(`${authOrigin}/__catalyst/auth/login`);
});

test('web entry loads Catalyst v4 and same-origin initialization before the application module', () => {
  const html = readFileSync('index.html', 'utf8');
  const sdk = html.indexOf('https://static.zohocdn.com/catalyst/sdk/js/4.6.2/catalystWebSDK.js');
  const init = html.indexOf('/__catalyst/sdk/init.js');
  const application = html.indexOf('/src/main.jsx');

  expect(sdk).toBeGreaterThan(-1);
  expect(init).toBeGreaterThan(sdk);
  expect(application).toBeGreaterThan(init);
});

test('dedicated sign-in page invokes embedded Catalyst auth after its target exists', () => {
  const html = readFileSync('public/ksp-sign-in-v3.html', 'utf8');
  const sdk = html.indexOf('https://static.zohocdn.com/catalyst/sdk/js/4.6.2/catalystWebSDK.js');
  const init = html.indexOf('/__catalyst/sdk/init.js');
  const target = html.indexOf('id="loginDivElementId"');
  const signIn = html.indexOf('catalyst.auth.signIn("loginDivElementId"');

  expect(sdk).toBeGreaterThan(-1);
  expect(init).toBeGreaterThan(sdk);
  expect(target).toBeGreaterThan(init);
  expect(signIn).toBeGreaterThan(target);
  expect(html).toContain('css_url: "/auth/catalyst-sign-in-v4.css"');
  expect(html).toContain('service_url: "/"');
  expect(html).toContain('Karnataka State Police');
  expect(html).not.toContain('type="password"');
  expect(html).not.toContain('name="password"');
});

test('dedicated sign-in page uses the approved KSP identity in a compact single-viewport composition', () => {
  const html = readFileSync('public/ksp-sign-in-v3.html', 'utf8');
  const signInCss = readFileSync('public/auth/catalyst-sign-in-v4.css', 'utf8');
  const tokens = readFileSync('src/styles/tokens.css', 'utf8');

  expect(html).toContain('/brand/karnataka-state-police.webp');
  expect(html).toContain('/fonts/roboto-latin-400-normal.woff2');
  expect(html).toContain('/fonts/roboto-latin-500-normal.woff2');
  expect(html).toContain('/fonts/roboto-latin-700-normal.woff2');
  expect(html).not.toContain('authentication__heading');
  expect(html).not.toContain('Access is invitation-only');
  expect(html).not.toContain('Complete the Catalyst invitation');
  expect(signInCss).toContain('max-width: 380px');
  expect(html).toContain('Catalyst secure sign in');
  expect(html).toContain('width: min(960px, 100%)');
  expect(html).toContain('grid-template-columns: 320px minmax(0, 1fr)');
  expect(html).toContain('width: min(380px, 100%)');
  expect(html).toContain('class="authentication__stack"');
  expect(html).toContain('class="security-note"');
  expect(html).toContain('height: 300px');
  expect(html).toContain('frame.scrolling = "no"');
  expect(html).toContain('align-items: center');
  expect(html).toContain('min-height: 100dvh');
  expect(html).not.toContain('min-height: 700px');
  expect(tokens).toMatch(/font-family:\s*Roboto,/u);
});

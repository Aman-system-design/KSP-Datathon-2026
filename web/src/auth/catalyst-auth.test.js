import { readFileSync } from 'node:fs';

import { afterEach, expect, test, vi } from 'vitest';

import { createCatalystAuth } from './catalyst-auth.js';

afterEach(() => vi.unstubAllGlobals());

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

  expect(replace).toHaveBeenCalledWith('/login.html');
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
  const html = readFileSync('public/login.html', 'utf8');
  const sdk = html.indexOf('https://static.zohocdn.com/catalyst/sdk/js/4.6.2/catalystWebSDK.js');
  const init = html.indexOf('/__catalyst/sdk/init.js');
  const target = html.indexOf('id="loginDivElementId"');
  const signIn = html.indexOf('catalyst.auth.signIn("loginDivElementId"');

  expect(sdk).toBeGreaterThan(-1);
  expect(init).toBeGreaterThan(sdk);
  expect(target).toBeGreaterThan(init);
  expect(signIn).toBeGreaterThan(target);
  expect(html).toContain('service_url: "/"');
});

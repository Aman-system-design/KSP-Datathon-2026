import { afterEach, expect, test, vi } from 'vitest';

import { createCatalystAuth, loadCatalystInit } from './catalyst-auth.js';

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

test('renders Catalyst embedded authentication into the native login host', () => {
  const signIn = vi.fn();
  const auth = createCatalystAuth({ catalyst: { auth: { signIn } } });

  auth.embeddedSignIn('loginDivElementId');

  expect(signIn).toHaveBeenCalledWith('loginDivElementId', { service_url: '/' });
});

test('fails safely when Catalyst embedded authentication is unavailable', () => {
  const auth = createCatalystAuth({ catalyst: {} });
  expect(() => auth.embeddedSignIn()).toThrow('Catalyst authentication is unavailable.');
});

test('Slate authentication uses the approved Catalyst Function origin for hosted login and sign-out', () => {
  const assign = vi.fn();
  const authOrigin = 'https://kspdatathon2026-60077844198.development.catalystserverless.in';
  const auth = createCatalystAuth({ authOrigin, location: { origin: 'https://aiksp.onslate.in', assign } });
  expect(auth.loginUrl).toBe(`${authOrigin}/__catalyst/auth/login`);
  auth.signOut();
  expect(assign).toHaveBeenCalledWith(`${authOrigin}/__catalyst/auth/login`);
});

test('loads the same-origin Catalyst initializer once', () => {
  loadCatalystInit(document);
  loadCatalystInit(document);
  const scripts = document.querySelectorAll('script[data-catalyst-init]');
  expect(scripts).toHaveLength(1);
  expect(scripts[0]).toHaveAttribute('src', '/__catalyst/sdk/init.js');
});

test('Slate loads Catalyst initialization from the approved Function origin', () => {
  document.querySelectorAll('script[data-catalyst-init]').forEach(script => script.remove());
  const source = 'https://kspdatathon2026-60077844198.development.catalystserverless.in/__catalyst/sdk/init.js';
  loadCatalystInit(document, source);
  expect(document.querySelector('script[data-catalyst-init]')).toHaveAttribute('src', source);
});

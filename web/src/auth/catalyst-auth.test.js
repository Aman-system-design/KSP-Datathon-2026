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
  expect(signOut).toHaveBeenCalledWith('https://ksp.example/');
});

test('returns to the application root when the Web SDK is unavailable', () => {
  const assign = vi.fn();
  const auth = createCatalystAuth({ location: { origin: 'https://ksp.example', assign } });
  auth.signOut();
  expect(assign).toHaveBeenCalledWith('/');
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

test('mounts embedded Catalyst sign in with a root return URL', async () => {
  const signIn = vi.fn();
  const auth = createCatalystAuth({ catalyst: { auth: { signIn } } });

  await auth.mountSignIn('catalystLogin', {
    cssUrl: '/auth/catalyst-sign-in-v4.css', serviceUrl: '/',
  });

  expect(signIn).toHaveBeenCalledWith('catalystLogin', {
    css_url: '/auth/catalyst-sign-in-v4.css', service_url: '/',
  });
});

test('Slate authentication uses the approved Catalyst Function origin for hosted login and sign-out', () => {
  const assign = vi.fn();
  const authOrigin = 'https://kspdatathon2026-60077844198.development.catalystserverless.in';
  const auth = createCatalystAuth({ authOrigin, location: { origin: 'https://aiksp.onslate.in', assign } });
  auth.signOut();
  expect(assign).toHaveBeenCalledWith('/');
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

test('the application root owns sign in and no legacy login page is referenced', () => {
  const html = readFileSync('index.html', 'utf8');
  const auth = readFileSync('src/auth/SignInRequired.jsx', 'utf8');

  expect(html).toContain('id="root"');
  expect(auth).toContain("serviceUrl: '/'");
  expect(auth).toContain('/brand/karnataka-state-police.webp');
  expect(auth).not.toContain('/login.html');
  expect(auth).not.toContain('/ksp-sign-in');
});

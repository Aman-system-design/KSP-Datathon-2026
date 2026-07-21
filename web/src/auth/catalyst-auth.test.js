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

test('loads the same-origin Catalyst initializer once', () => {
  loadCatalystInit(document);
  loadCatalystInit(document);
  const scripts = document.querySelectorAll('script[data-catalyst-init]');
  expect(scripts).toHaveLength(1);
  expect(scripts[0]).toHaveAttribute('src', '/__catalyst/sdk/init.js');
});

import { expect, test } from 'vitest';

import { normalizeCatalystSignInUrl } from './catalyst-sign-in-frame.js';

const AUTH_ORIGIN = 'https://accounts.zohoportal.in';

test('moves ACE account routes to the configured Catalyst auth origin', () => {
  const source = 'https://ace.onslate.in/accounts/p/50043872568/signin?css_url=%2Fauth.css&serviceurl=%2F';
  expect(normalizeCatalystSignInUrl(source, {
    applicationOrigin: 'https://ace.onslate.in', authOrigin: AUTH_ORIGIN,
  })).toBe('https://accounts.zohoportal.in/accounts/p/50043872568/signin?css_url=%2Fauth.css&serviceurl=%2F');
});

test('preserves non-account and already-normalized URLs', () => {
  expect(normalizeCatalystSignInUrl('https://ace.onslate.in/reports', {
    applicationOrigin: 'https://ace.onslate.in', authOrigin: AUTH_ORIGIN,
  })).toBe('https://ace.onslate.in/reports');
  expect(normalizeCatalystSignInUrl('https://accounts.zohoportal.in/accounts/p/1/signin', {
    applicationOrigin: 'https://ace.onslate.in', authOrigin: AUTH_ORIGIN,
  })).toBe('https://accounts.zohoportal.in/accounts/p/1/signin');
});

test('leaves malformed URLs unchanged', () => {
  expect(normalizeCatalystSignInUrl('not a url', {
    applicationOrigin: 'https://ace.onslate.in', authOrigin: AUTH_ORIGIN,
  })).toBe('not a url');
});

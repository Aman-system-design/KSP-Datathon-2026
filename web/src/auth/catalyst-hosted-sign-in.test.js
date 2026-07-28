import { expect, test } from 'vitest';

import { toCatalystHostedSignInUrl } from './catalyst-hosted-sign-in.js';

test('moves only an SDK-generated account URL to the Catalyst auth origin', () => {
  const source = 'https://ace.onslate.in/accounts/p/70-50043872568/signin?service_url=%2F__catalyst%2Fauth%2Fsignin-redirect&css_url=%2Fauth%2Fcatalyst.css';

  expect(toCatalystHostedSignInUrl(source, { applicationOrigin: 'https://ace.onslate.in' })).toBe(
    'https://accounts.zohoportal.in/accounts/p/70-50043872568/signin?service_url=%2F__catalyst%2Fauth%2Fsignin-redirect&css_url=%2Fauth%2Fcatalyst.css',
  );
});

test.each([
  'https://evil.example/accounts/p/70/signin',
  'https://ace.onslate.in/reports',
  'javascript:alert(1)',
])('rejects a non-Catalyst discovery URL: %s', source => {
  expect(toCatalystHostedSignInUrl(source, { applicationOrigin: 'https://ace.onslate.in' })).toBeNull();
});

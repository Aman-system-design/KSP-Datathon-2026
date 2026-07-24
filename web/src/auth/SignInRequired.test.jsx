import { readFileSync } from 'node:fs';

import { render, screen } from '@testing-library/react';
import { expect, test, vi } from 'vitest';

import { SignInRequired } from './SignInRequired.jsx';

test('renders embedded Catalyst sign in on the application root', async () => {
  const auth = { mountSignIn: vi.fn(async () => {}) };

  render(<SignInRequired auth={auth} />);

  expect(await screen.findByRole('heading', { name: 'Karnataka State Police' })).toBeInTheDocument();
  expect(screen.getByText('Secure access protected by Catalyst')).toBeInTheDocument();
  expect(screen.queryByText('Catalyst secure access')).not.toBeInTheDocument();
  expect(screen.queryByText('Identity protected')).not.toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'Sign in' })).not.toBeInTheDocument();
  expect(screen.queryByText('Official police system')).not.toBeInTheDocument();
  expect(screen.queryByText('Secure workspace')).not.toBeInTheDocument();
  expect(auth.mountSignIn).toHaveBeenCalledWith('catalystLogin', {
    cssUrl: '/auth/catalyst-sign-in-v4.css', serviceUrl: '/',
  });
  expect(document.getElementById('catalystLogin')).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'Continue to sign in' })).not.toBeInTheDocument();
});

test('uses the approved premium glass shell without changing the Catalyst surface', () => {
  const css = readFileSync('src/styles/app.css', 'utf8');
  const catalystCss = readFileSync('public/auth/catalyst-sign-in-v4.css', 'utf8');

  expect(css).toMatch(/\.secure-login__shell\s*{[^}]*background:\s*rgb\(255 255 255 \/ 82%\)/s);
  expect(css).toMatch(/\.secure-login__shell\s*{[^}]*border-radius:\s*22px/s);
  expect(css).toMatch(/\.secure-login__shell\s*{[^}]*backdrop-filter:\s*blur\(/s);
  expect(css).toMatch(/@media \(prefers-reduced-motion:\s*reduce\)/);
  expect(catalystCss).toMatch(/#login_id:focus[^}]*box-shadow:/s);
  expect(catalystCss).toMatch(/#nextbtn[^}]*height:\s*48px/s);
});

test('reserves enough height for Catalyst password and OTP steps', () => {
  const css = readFileSync('src/styles/app.css', 'utf8');
  const hostRule = css.match(/\.secure-login__catalyst\s*\{([^}]*)\}/)?.[1] ?? '';
  const frameRule = css.match(/\.secure-login__catalyst iframe\s*\{([^}]*)\}/)?.[1] ?? '';

  expect(hostRule).toMatch(/height:\s*360px/);
  expect(frameRule).toMatch(/height:\s*360px/);
});

test('uses a clean card edge instead of a decorative top strip', () => {
  const css = readFileSync('src/styles/app.css', 'utf8');
  const shellAccent = css.match(/\.secure-login__shell::before\s*\{([^}]*)\}/)?.[1] ?? '';

  expect(shellAccent).toBe('');
});

test('fits the secure shell inside the dynamic viewport', () => {
  const css = readFileSync('src/styles/app.css', 'utf8');
  const shellRule = css.match(/\.secure-login__shell\s*\{([^}]*)\}/)?.[1] ?? '';

  expect(shellRule).toMatch(/width:\s*min\(980px,\s*100%\)/);
  expect(shellRule).toMatch(/height:\s*min\(600px,\s*calc\(100dvh\s*-\s*48px\)\)/);
  expect(shellRule).toMatch(/grid-template-columns:\s*360px\s+minmax\(0,\s*1fr\)/);
});

test('keeps the embedded identity form at a deliberate enterprise width', () => {
  const css = readFileSync('public/auth/catalyst-sign-in-v4.css', 'utf8');

  expect(css).toMatch(/max-width:\s*340px/);
  expect(css).toMatch(/height:\s*48px/);
  expect(css).toMatch(/border-radius:\s*12px/);
});

test('keeps the police emblem on a calm identity panel without decorative target rings', () => {
  const css = readFileSync('src/styles/app.css', 'utf8');

  expect(css).not.toMatch(/\.secure-login__identity::after/);
  expect(css).toMatch(/\.secure-login__identity img\s*\{[^}]*width:\s*202px/);
});

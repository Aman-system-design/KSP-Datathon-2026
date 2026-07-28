import { readFileSync } from 'node:fs';
import { StrictMode } from 'react';

import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';

import { SignInRequired } from './SignInRequired.jsx';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const hostedAuth = source => ({
  mountSignIn: vi.fn(async elementId => {
    const frame = document.createElement('iframe');
    frame.src = source;
    document.getElementById(elementId).append(frame);
  }),
});

test('prepares Catalyst sign in on the application root', async () => {
  const auth = { mountSignIn: vi.fn(async () => {}) };

  render(<SignInRequired auth={auth} />);

  expect(await screen.findByRole('heading', { name: 'Karnataka State Police' })).toBeInTheDocument();
  expect(screen.queryByText('Secure access protected by Catalyst')).not.toBeInTheDocument();
  expect(screen.queryByText('Catalyst secure access')).not.toBeInTheDocument();
  expect(screen.queryByText('Identity protected')).not.toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'Sign in' })).not.toBeInTheDocument();
  expect(screen.queryByText('Official police system')).not.toBeInTheDocument();
  expect(screen.queryByText('Secure workspace')).not.toBeInTheDocument();
  expect(auth.mountSignIn).toHaveBeenCalledWith('catalystLogin', {
    cssUrl: '/auth/catalyst-sign-in-v4.css', serviceUrl: '/',
  });
  expect(document.getElementById('catalystLogin')).toBeInTheDocument();
  expect(screen.getByText('Preparing secure sign in…')).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'Continue to sign in' })).not.toBeInTheDocument();
});

test('shows judge demo credentials without changing Catalyst sign in', async () => {
  const auth = { mountSignIn: vi.fn(async () => {}) };

  render(<SignInRequired auth={auth} />);

  expect(screen.getByRole('complementary', { name: 'Demo access credentials' })).toBeInTheDocument();
  const demo = screen.getByRole('complementary', { name: 'Demo access credentials' });
  expect(within(demo).queryByText('Authentication managed by Catalyst')).not.toBeInTheDocument();
  expect(screen.getByText('Authentication managed by Catalyst')).toBeInTheDocument();
  expect(within(demo).getByRole('status')).toBeEmptyDOMElement();
  expect(screen.getByText('ksp.tech@zohomail.in')).toBeInTheDocument();
  expect(screen.getByText('Mail@2026')).toBeInTheDocument();
  expect(auth.mountSignIn).toHaveBeenCalledWith('catalystLogin', {
    cssUrl: '/auth/catalyst-sign-in-v4.css', serviceUrl: '/',
  });
});

test('copies each demo credential and clears success feedback', async () => {
  vi.useFakeTimers();
  const writeText = vi.fn(async () => {});
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText },
  });

  render(<SignInRequired auth={{ mountSignIn: vi.fn(async () => {}) }} />);
  const demo = screen.getByRole('complementary', { name: 'Demo access credentials' });
  const copyStatus = within(demo).getByRole('status');

  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Copy demo email' })));
  expect(writeText).toHaveBeenCalledWith('ksp.tech@zohomail.in');
  expect(copyStatus).toHaveTextContent('Email copied');

  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Copy demo password' })));
  expect(writeText).toHaveBeenCalledWith('Mail@2026');
  expect(copyStatus).toHaveTextContent('Password copied');

  await act(async () => vi.advanceTimersByTimeAsync(1200));
  expect(copyStatus).toBeEmptyDOMElement();
  vi.useRealTimers();
});

test('offers the official Catalyst hosted sign in without displaying its iframe', async () => {
  const source = `${window.location.origin}/accounts/p/70-50043872568/signin?service_url=%2F__catalyst%2Fauth%2Fsignin-redirect&css_url=%2Fauth%2Fcatalyst-sign-in-v4.css`;
  const auth = hostedAuth(source);

  render(<SignInRequired auth={auth} />);

  const link = await screen.findByRole('link', { name: 'Continue to secure sign in' });
  expect(link).toHaveAttribute('href', source.replace(window.location.origin, 'https://accounts.zohoportal.in'));
  expect(link).not.toHaveAttribute('target');
  expect(document.querySelector('#catalystLogin iframe')).toBeNull();
  expect(auth.mountSignIn).toHaveBeenCalledWith('catalystLogin', {
    cssUrl: '/auth/catalyst-sign-in-v4.css', serviceUrl: '/',
  });
});

test('keeps the sign-in action unavailable when the SDK emits an unsafe URL', async () => {
  render(<SignInRequired auth={hostedAuth('https://evil.example/accounts/p/70/signin')} />);

  expect(await screen.findByRole('alert')).toHaveTextContent('Secure sign in could not be loaded');
  expect(screen.queryByRole('link', { name: 'Continue to secure sign in' })).not.toBeInTheDocument();
});

test('reports a bounded error when Catalyst does not create a sign-in URL', async () => {
  vi.useFakeTimers();
  render(<SignInRequired auth={{ mountSignIn: vi.fn(async () => {}) }} />);

  expect(screen.getByText('Preparing secure sign in…')).toBeInTheDocument();
  await act(async () => vi.advanceTimersByTimeAsync(5000));
  expect(screen.getByRole('alert')).toHaveTextContent('Secure sign in could not be loaded');
});

test('keeps URL discovery active through the React Strict Mode effect replay', async () => {
  vi.useFakeTimers();

  render(<StrictMode><SignInRequired auth={{ mountSignIn: vi.fn(async () => {}) }} /></StrictMode>);

  await act(async () => vi.advanceTimersByTimeAsync(5000));
  expect(screen.getByRole('alert')).toHaveTextContent('Secure sign in could not be loaded');
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

test('keeps judge demo access compact inside the existing access column', () => {
  const css = readFileSync('src/styles/app.css', 'utf8');

  expect(css).toMatch(/\.secure-login__demo\s*{[^}]*border-radius:\s*12px/s);
  expect(css).toMatch(/\.secure-login__demo\s*{[^}]*margin-top:\s*16px/s);
  expect(css).toMatch(/@media \(max-width:\s*760px\)[^{]*{[\s\S]*\.secure-login__demo\s*{[^}]*margin-top:\s*14px/s);
  expect(css).toMatch(/\.secure-login__demo-row\s*{[^}]*grid-template-columns:\s*60px\s+minmax\(0,\s*1fr\)\s+28px/s);
  expect(css).toMatch(/\.secure-login__demo-row button\s*{[^}]*width:\s*26px/s);
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
  expect(shellRule).toMatch(/height:\s*min\(680px,\s*calc\(100dvh\s*-\s*32px\)\)/);
  expect(shellRule).toMatch(/grid-template-columns:\s*360px\s+minmax\(0,\s*1fr\)/);
  expect(css).not.toMatch(/@media \(min-width:\s*761px\) and \(max-height:\s*680px\)/);
});

test('keeps URL discovery hidden and the hosted action inside the premium access column', () => {
  const css = readFileSync('src/styles/app.css', 'utf8');

  expect(css).toMatch(/\.secure-login__catalyst-discovery\s*{[^}]*position:\s*absolute[^}]*width:\s*1px[^}]*height:\s*1px[^}]*overflow:\s*hidden/s);
  expect(css).toMatch(/\.secure-login__auth-link\s*{[^}]*min-height:\s*48px[^}]*display:\s*grid[^}]*border-radius:\s*12px/s);
  expect(css).toMatch(/\.secure-login__managed\s*{[^}]*border-top:/s);
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

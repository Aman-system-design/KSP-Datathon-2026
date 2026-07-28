import { readFileSync } from 'node:fs';
import { StrictMode } from 'react';

import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';

import { SignInRequired } from './SignInRequired.jsx';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const embeddedAuth = source => ({
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

test('keeps the Catalyst sign-in iframe embedded and sizes it after load', async () => {
  const source = `${window.location.origin}/accounts/p/70/signin`;
  const auth = embeddedAuth(source);

  render(<SignInRequired auth={auth} />);

  const frame = await waitFor(() => document.querySelector('#catalystLogin iframe'));
  fireEvent.load(frame);
  expect(frame).toHaveAttribute('src', source);
  expect(frame).toHaveAttribute('title', 'Karnataka State Police secure sign in');
  expect(frame).toHaveAttribute('scrolling', 'no');
  expect(document.getElementById('catalystLogin')).toHaveStyle('--catalyst-frame-height: 360px');
  expect(screen.queryByRole('link', { name: 'Continue to secure sign in' })).not.toBeInTheDocument();
});

test('shows a bounded same-page retry when Catalyst creates no iframe', async () => {
  vi.useFakeTimers();
  render(<SignInRequired auth={{ mountSignIn: vi.fn(async () => {}) }} />);

  expect(screen.getByText('Preparing secure sign in…')).toBeInTheDocument();
  await act(async () => vi.advanceTimersByTimeAsync(5000));
  expect(screen.getByRole('alert')).toHaveTextContent('Secure sign in could not be loaded');
  expect(screen.getByRole('button', { name: 'Refresh sign in' })).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: /secure sign in/i })).not.toBeInTheDocument();
});

test('performs one fresh SDK mount and clears the error after a successful retry', async () => {
  vi.useFakeTimers();
  const auth = {
    mountSignIn: vi.fn(async elementId => {
      if (auth.mountSignIn.mock.calls.length !== 2) return;
      const frame = document.createElement('iframe');
      frame.src = `${window.location.origin}/accounts/p/70/signin`;
      document.getElementById(elementId).append(frame);
    }),
  };
  render(<SignInRequired auth={auth} />);
  await act(async () => vi.advanceTimersByTimeAsync(5000));

  fireEvent.click(screen.getByRole('button', { name: 'Refresh sign in' }));
  const frame = await waitFor(() => document.querySelector('#catalystLogin iframe'));
  fireEvent.load(frame);

  expect(auth.mountSignIn).toHaveBeenCalledTimes(2);
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Refresh sign in' })).not.toBeInTheDocument();
  expect(frame).toBeInTheDocument();
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

test('keeps the embedded form and retry inside the premium access column', () => {
  const css = readFileSync('src/styles/app.css', 'utf8');

  expect(css).toMatch(/\.secure-login__catalyst\s*{[^}]*height:\s*var\(--catalyst-frame-height,\s*360px\)[^}]*overflow:\s*hidden/s);
  expect(css).toMatch(/\.secure-login__catalyst iframe\s*{[^}]*width:\s*100%!important[^}]*border:\s*0!important/s);
  expect(css).toMatch(/\.secure-login__retry\s*{[^}]*min-height:\s*44px[^}]*border-radius:\s*12px/s);
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

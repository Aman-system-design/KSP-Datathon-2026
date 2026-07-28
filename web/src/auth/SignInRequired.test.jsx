import { readFileSync } from 'node:fs';

import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';

import { SignInRequired } from './SignInRequired.jsx';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const frameAuth = (contentDocument) => ({
  mountSignIn: vi.fn(async (elementId) => {
    const frame = document.createElement('iframe');
    Object.defineProperty(frame, 'contentDocument', {
      configurable: true,
      get: typeof contentDocument === 'function' ? contentDocument : () => contentDocument,
    });
    document.getElementById(elementId).append(frame);
    frame.dispatchEvent(new Event('load'));
  }),
});

test('renders embedded Catalyst sign in on the application root', async () => {
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
  expect(screen.queryByRole('link', { name: 'Continue to sign in' })).not.toBeInTheDocument();
});

test('shows judge demo credentials without changing Catalyst sign in', async () => {
  const auth = { mountSignIn: vi.fn(async () => {}) };

  render(<SignInRequired auth={auth} />);

  expect(screen.getByRole('complementary', { name: 'Demo access credentials' })).toBeInTheDocument();
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

  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Copy demo email' })));
  expect(writeText).toHaveBeenCalledWith('ksp.tech@zohomail.in');
  expect(screen.getByRole('status')).toHaveTextContent('Email copied');

  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Copy demo password' })));
  expect(writeText).toHaveBeenCalledWith('Mail@2026');
  expect(screen.getByRole('status')).toHaveTextContent('Password copied');

  await act(async () => vi.advanceTimersByTimeAsync(1200));
  expect(screen.getByRole('status')).toBeEmptyDOMElement();
  vi.useRealTimers();
});

test('adapts the Catalyst frame from the compact email step to a taller password step', async () => {
  const heights = { value: 270 };
  const contentDocument = {
    body: { get scrollHeight() { return heights.value - 4; } },
    documentElement: { get scrollHeight() { return heights.value; } },
  };
  const auth = frameAuth(contentDocument);

  render(<SignInRequired auth={auth} />);

  const host = document.getElementById('catalystLogin');
  await waitFor(() => expect(host.style.getPropertyValue('--catalyst-frame-height')).toBe('282px'));

  heights.value = 330;
  host.querySelector('iframe').dispatchEvent(new Event('load'));
  await waitFor(() => expect(host.style.getPropertyValue('--catalyst-frame-height')).toBe('342px'));
});

test('keeps the safe Catalyst height when iframe measurement is inaccessible', async () => {
  const auth = frameAuth(() => { throw new DOMException('Blocked'); });

  render(<SignInRequired auth={auth} />);

  const host = document.getElementById('catalystLogin');
  await waitFor(() => expect(host.style.getPropertyValue('--catalyst-frame-height')).toBe('360px'));
});

test('removes adaptive frame listeners when login unmounts', async () => {
  const auth = frameAuth({
    body: { scrollHeight: 266 },
    documentElement: { scrollHeight: 270 },
  });

  const view = render(<SignInRequired auth={auth} />);
  const host = document.getElementById('catalystLogin');
  await waitFor(() => expect(host.style.getPropertyValue('--catalyst-frame-height')).toBe('282px'));
  const frame = host.querySelector('iframe');
  const removeEventListener = vi.spyOn(frame, 'removeEventListener');
  view.unmount();

  expect(removeEventListener).toHaveBeenCalledWith('load', expect.any(Function));
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
  expect(css).toMatch(/\.secure-login__demo-row\s*{[^}]*grid-template-columns:\s*60px\s+minmax\(0,\s*1fr\)\s+28px/s);
  expect(css).toMatch(/\.secure-login__demo-row button\s*{[^}]*width:\s*26px/s);
});

test('adapts height while retaining a safe fallback for Catalyst password and OTP steps', () => {
  const css = readFileSync('src/styles/app.css', 'utf8');
  const hostRule = css.match(/\.secure-login__catalyst\s*\{([^}]*)\}/)?.[1] ?? '';
  const frameRule = css.match(/\.secure-login__catalyst iframe\s*\{([^}]*)\}/)?.[1] ?? '';

  expect(hostRule).toMatch(/height:\s*var\(--catalyst-frame-height,\s*360px\)/);
  expect(frameRule).toMatch(/height:\s*var\(--catalyst-frame-height,\s*360px\)/);
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

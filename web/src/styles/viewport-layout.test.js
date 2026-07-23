import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

const appCss = readFileSync('src/styles/app.css', 'utf8');
const tokenCss = readFileSync('src/styles/tokens.css', 'utf8');
const catalystAuthCss = readFileSync('public/auth/catalyst-sign-in-v4.css', 'utf8');

describe('platform viewport layout contract', () => {
  test('makes the document root fill the available viewport', () => {
    expect(tokenCss).toMatch(/html,\s*body,\s*#root\s*{[^}]*height:\s*100%/s);
    expect(tokenCss).toMatch(/html,\s*body,\s*#root\s*{[^}]*min-height:\s*0/s);
  });

  test('keeps the application shell fixed while the workspace owns scrolling', () => {
    expect(appCss).toMatch(/\.app-shell\s*{[^}]*height:\s*100dvh/s);
    expect(appCss).toMatch(/\.app-shell\s*{[^}]*min-height:\s*0/s);
    expect(appCss).toMatch(/\.app-shell\s*{[^}]*overflow:\s*hidden/s);
    expect(appCss).toMatch(/\.workspace-main\s*{[^}]*min-height:\s*0/s);
    expect(appCss).toMatch(/\.workspace-main\s*{[^}]*overflow:\s*auto/s);
  });

  test('keeps standalone workspaces inside the viewport', () => {
    expect(appCss).toMatch(/\.workspace-entry\s*{[^}]*height:\s*100dvh/s);
    expect(appCss).toMatch(/\.workspace-entry\s*{[^}]*overflow:\s*hidden/s);
    expect(appCss).toMatch(/\.workspace-entry__panel\s*{[^}]*overflow:\s*hidden/s);
    expect(appCss).toMatch(/@media \(max-width:\s*900px\)[^{]*{[^}]*\.workspace-entry\s*{[^}]*overflow:\s*auto/s);
    expect(appCss).toMatch(/\.command-centre\s*{[^}]*height:\s*100dvh/s);
    expect(appCss).toMatch(/\.command-centre__grid\s*{[^}]*overflow:\s*auto/s);
  });

  test('uses compact natural-height workspace cards without a nested panel scrollbar', () => {
    expect(appCss).toMatch(/\.workspace-entry__panel\s*{[^}]*height:\s*auto/s);
    expect(appCss).toMatch(/\.workspace-entry__list\s*{[^}]*grid-auto-rows:\s*124px/s);
    expect(appCss).not.toMatch(/\.workspace-entry__list\s*{[^}]*grid-template-rows:\s*repeat\(2,minmax\(0,1fr\)\)/s);
  });

  test('constrains authentication and keeps Catalyst recovery actions reachable', () => {
    expect(appCss).toMatch(/\.secure-login\s*{[^}]*height:\s*100dvh/s);
    expect(appCss).toMatch(/\.secure-login__shell\s*{[^}]*max-height:\s*calc\(100dvh - 32px\)/s);
    expect(appCss).toMatch(/\.secure-login__access\s*{[^}]*overflow-y:\s*auto/s);
    expect(catalystAuthCss).toMatch(/html,\s*body\s*{[^}]*height:\s*100%/s);
    expect(catalystAuthCss).toMatch(/body\s*{[^}]*overflow-y:\s*auto/s);
  });
});

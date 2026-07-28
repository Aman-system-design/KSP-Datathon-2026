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
  });

  test('uses compact natural-height workspace cards without a nested panel scrollbar', () => {
    expect(appCss).toMatch(/\.workspace-entry__panel\s*{[^}]*height:\s*auto/s);
    expect(appCss).toMatch(/\.workspace-entry__list\s*{[^}]*grid-auto-rows:\s*124px/s);
    expect(appCss).not.toMatch(/\.workspace-entry__list\s*{[^}]*grid-template-rows:\s*repeat\(2,minmax\(0,1fr\)\)/s);
  });

  test('fits authentication without a nested scrollbar and keeps recovery actions reachable', () => {
    expect(appCss).toMatch(/\.secure-login\s*{[^}]*height:\s*100dvh/s);
    expect(appCss).toMatch(/\.secure-login__shell\s*{[^}]*max-height:\s*calc\(100dvh - 32px\)/s);
    expect(appCss).toMatch(/\.secure-login__access\s*{[^}]*overflow:\s*visible/s);
    expect(appCss).not.toMatch(/\.secure-login__access\s*{[^}]*overflow-y:\s*auto/s);
    expect(appCss).not.toMatch(/@media\s*\(min-width:\s*761px\)\s*and\s*\(max-height:\s*680px\)[^{]*{[\s\S]*\.secure-login\s*{[^}]*overflow-y:\s*auto/s);
    expect(catalystAuthCss).toMatch(/html,\s*body\s*{[^}]*height:\s*100%/s);
    expect(catalystAuthCss).toMatch(/body\s*{[^}]*overflow-y:\s*auto/s);
    expect(catalystAuthCss).not.toMatch(/(?:#forgotpassword|\.bluetext_action|\.fed_div)[^{]*{[^}]*display:\s*none/s);
  });

  test('keeps the premium Catalyst attribution compact and separate', () => {
    expect(appCss).toMatch(/\.secure-login__managed\s*{[^}]*justify-content:\s*center[^}]*padding-top:\s*8px/s);
    expect(appCss).toMatch(/\.secure-login__managed svg\s*{[^}]*color:\s*#b88719/s);
    expect(appCss).toMatch(/\.secure-login__access\s*{[^}]*padding:\s*12px 0 8px/s);
  });

  test('keeps the State Leadership dashboard contained and responsive', () => {
    expect(appCss).toMatch(/\.state-leadership-dashboard\s*{[^}]*min-height:\s*0/s);
    expect(appCss).toMatch(/\.state-leadership-dashboard\s*>\s*\.command-center-dashboard-canvas\s*{[^}]*min-height:/s);
    expect(appCss).toMatch(/@media\s*\(max-width:\s*700px\)[^{]*{[\s\S]*\.state-leadership-dashboard__header\s*{[^}]*flex-direction:\s*column/s);
    expect(appCss).toMatch(/@media\s*\(max-width:\s*700px\)[^{]*{[\s\S]*\.state-leadership-dashboard\s*\.command-center-dashboard-placement\s*{[^}]*position:\s*relative/s);
  });

  test('provides responsive dashboard deletion surfaces', () => {
    expect(appCss).toMatch(/\.command-center-dashboard-card__actions/);
    expect(appCss).toMatch(/\.command-center-dashboard-card__menu/);
    expect(appCss).toMatch(/\.command-center-dashboard-delete-backdrop/);
    expect(appCss).toMatch(/\.command-center-dashboard-delete-dialog/);
    expect(appCss).toMatch(/\.command-center-dashboard-delete-dialog__danger/);
    expect(appCss).toMatch(/@media\(max-width:720px\)[^{]*{[\s\S]*\.command-center-dashboard-delete-dialog/);
  });

  test('fits report authoring and chart cards without nested horizontal scrolling', () => {
    expect(appCss).toMatch(/\.report-builder-workspace\s*{[^}]*overflow:\s*hidden/s);
    expect(appCss).toMatch(/\.report-builder-authoring\s*{[^}]*overflow-x:\s*hidden/s);
    expect(appCss).toMatch(/\.report-type-picker\s*{[^}]*repeat\(auto-fit,\s*minmax\(120px,\s*1fr\)\)/s);
    expect(appCss).toMatch(/\.report-builder-preview__empty\s*{[^}]*box-sizing:\s*border-box/s);
    expect(appCss).toMatch(/@media \(max-width:\s*720px\)[\s\S]*\.report-builder-workspace\s*{[^}]*grid-template-columns:\s*1fr/s);
    expect(appCss).toMatch(/@media \(max-width:\s*620px\)[\s\S]*\.report-builder-progress\s*{[^}]*grid-template-columns:\s*repeat\(5,\s*minmax\(0,\s*1fr\)\)/s);
  });

  test('keeps persona dashboards readable and stacked on narrow screens', () => {
    expect(appCss).toMatch(/\.persona-dashboard-workspace\s*{[^}]*min-width:\s*0/s);
    expect(appCss).toMatch(/\.persona-dashboard-workspace__header\s*{[^}]*display:\s*flex/s);
    expect(appCss).toMatch(/@media\s*\(max-width:\s*760px\)[^{]*{[\s\S]*\.persona-dashboard-workspace__header\s*{[^}]*flex-direction:\s*column/s);
  });
});

import { describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const css = readFileSync(resolve(process.cwd(), 'src/styles/app.css'), 'utf8');

describe('Command Center compact layout', () => {
  test('scales down the entire desktop shell at 100% browser zoom', () => {
    expect(css).toContain('.command-center-shell { --cc-header:64px; --cc-rail:68px;');
    expect(css).toContain('.command-center-header__brand img { width:38px; height:44px;');
    expect(css).toContain('.command-center-header__utilities { display:flex; align-items:center; justify-content:flex-end; gap:10px;');
    expect(css).toContain('.command-center-search { display:flex; align-items:center; gap:10px; width:240px; height:44px;');
    expect(css).toContain('.command-center-header__utilities>button,.command-center-avatar { display:grid; place-items:center; width:44px; height:44px;');
    expect(css).toContain('.command-center-rail button { display:grid; place-items:center; width:56px; height:56px;');
    expect(css).toContain('.command-center-rail svg { width:24px; height:24px;');
  });

  test('scales down the entire shell at narrow widths', () => {
    expect(css).toContain('@media(max-width:720px){.command-center-shell{--cc-header:64px;--cc-rail:58px}');
    expect(css).toContain('.command-center-header__brand img{width:32px;height:40px}');
    expect(css).toContain('.command-center-search{width:min(132px,26vw);height:40px;padding:0 11px}');
    expect(css).toContain('.command-center-header__utilities>button,.command-center-avatar{width:40px;height:40px}');
    expect(css).toContain('.command-center-rail button{width:48px;height:48px}');
    expect(css).toContain('.command-center-rail svg{width:22px;height:22px}');
  });
});

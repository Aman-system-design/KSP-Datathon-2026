import { describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const css = readFileSync(resolve(process.cwd(), 'src/styles/app.css'), 'utf8');

describe('Command Center compact layout', () => {
  test('scales down the entire desktop shell at 100% browser zoom', () => {
    expect(css).toContain('.command-center-shell { --cc-header:56px; --cc-rail:56px;');
    expect(css).toContain('.command-center-header__brand img { width:32px; height:38px;');
    expect(css).toContain('.command-center-header__brand span { color:#68758a; font-size:12px;');
    expect(css).toContain('.command-center-header__utilities { display:flex; align-items:center; justify-content:flex-end; gap:8px;');
    expect(css).toContain('.command-center-search { display:flex; align-items:center; gap:8px; width:200px; height:38px;');
    expect(css).toContain('.command-center-header__utilities>button,.command-center-avatar { display:grid; place-items:center; width:38px; height:38px;');
    expect(css).toContain('.command-center-rail button { display:grid; place-items:center; width:44px; height:44px;');
    expect(css).toContain('.command-center-rail svg { width:20px; height:20px;');
  });

  test('scales down the entire shell at narrow widths', () => {
    expect(css).toContain('@media(max-width:720px){.command-center-shell{--cc-header:56px;--cc-rail:52px}');
    expect(css).toContain('.command-center-header__brand img{width:30px;height:36px}');
    expect(css).toContain('.command-center-search{width:min(120px,24vw);height:38px;padding:0 10px}');
    expect(css).toContain('.command-center-header__utilities>button,.command-center-avatar,.command-center-settings>button{width:38px;height:38px}');
    expect(css).toContain('.command-center-rail button{width:42px;height:42px}');
    expect(css).toContain('.command-center-rail svg{width:19px;height:19px}');
  });
});

import fs from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from 'vitest';

const css = fs.readFileSync(resolve(process.cwd(), 'src/features/station-operations/station-operations.css'), 'utf8');

test('station workspace defines compact responsive and reduced-motion contracts', () => {
  expect(css).toMatch(/@media\s*\(max-width:\s*1024px\)/);
  expect(css).toMatch(/@media\s*\(max-width:\s*768px\)/);
  expect(css).toMatch(/@media\s*\(max-width:\s*420px\)/);
  expect(css).toMatch(/prefers-reduced-motion:\s*reduce/);
  expect(css).toMatch(/overflow-x:\s*hidden/);
  expect(css).toMatch(/station-case-detail[^}]*overflow-x:\s*hidden/s);
  expect(css).toMatch(/station-case-detail__back[^}]*min-height:\s*44px/s);
  expect(css).toMatch(/station-case-detail__back:focus-visible/);
  expect(css).toMatch(/grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)/);
  expect(css).toMatch(/grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
  expect(css).toMatch(/command-center-dashboard-canvas:not\(\.is-editing\)[^{]*\{[^}]*grid-template-columns:\s*repeat\(12,\s*minmax\(0,\s*1fr\)\)/s);
  expect(css).toMatch(/command-center-dashboard-canvas:not\(\.is-editing\)[\s\S]*station-placement--register[^}]*grid-column:\s*span\s*12/);
  expect(css).toMatch(/station-placement--metric[^}]*height:\s*1(?:0|1|2)\dpx/s);
  expect(css).toMatch(/station-placement--ageing[^}]*grid-column:\s*span\s*6[^}]*order:\s*2/s);
  expect(css).toMatch(/station-placement--lifecycle[^}]*order:\s*2/s);
  expect(css).toMatch(/station-placement--detail[^}]*order:\s*3/s);
  expect(css).toMatch(/station-placement--register[^}]*order:\s*4/s);
  expect(css).not.toMatch(/command-center-dashboard-placement[^}]*height:\s*min\(430px/s);
});

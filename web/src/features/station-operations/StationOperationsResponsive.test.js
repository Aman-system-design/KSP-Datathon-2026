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
  expect(css).toMatch(/grid-template-columns:\s*1fr/);
});

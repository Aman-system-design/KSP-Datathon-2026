import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

describe('design token compatibility', () => {
  test('keeps legacy muted text distinct from the shadcn muted surface', () => {
    const css = readFileSync('src/styles/tokens.css', 'utf8');

    expect(css).toContain('--muted-surface:');
    expect(css).toContain('--color-muted: var(--muted-surface);');
    expect(css).toMatch(/--muted:\s*oklch\(0\.53\s/);
  });
});

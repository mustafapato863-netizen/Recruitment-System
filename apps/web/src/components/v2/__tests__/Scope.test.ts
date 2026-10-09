import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(resolve(__dirname, '../v2-primitives.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

describe('v2 primitives CSS scoping (flag-off parity)', () => {
  it('every rule is scoped to [data-ui=v2]', () => {
    const blocks = css.match(/(^|[};])\s*([^{}@;]+)\{/g) ?? [];
    const selectors = blocks
      .map((b) => b.replace(/^[};]/, '').replace(/\{$/, '').trim())
      .filter((s) => !/^(from|to|\d+%)/.test(s));
    expect(selectors.length).toBeGreaterThan(20);
    for (const sel of selectors) for (const part of sel.split(',')) expect(part.trim()).toMatch(/^\[data-ui='v2'\]/);
  });

  it('uses no literal hex colours (tokens only)', () => {
    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b/i);
  });

  it('respects reduced motion', () => {
    expect(css).toMatch(/prefers-reduced-motion: reduce/);
  });

  it('is not imported by the product app entry', () => {
    const app = readFileSync(resolve(__dirname, '../../../App.tsx'), 'utf8');
    const main = readFileSync(resolve(__dirname, '../../../main.tsx'), 'utf8');
    expect(app + main).not.toMatch(/components\/v2/);
  });
});

/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (fromHere: string) => readFileSync(resolve(__dirname, fromHere), 'utf8');

const main = read('../../main.tsx');
const app = read('../../App.tsx');
const shell = read('../V2Shell.tsx');
const tokensV2 = read('../../styles/tokens-v2.css');
const tokens = read('../../styles/tokens.css');

/** Matches a stylesheet import without treating classic-in-shell.css as shell.css. */
function cssImport(fileName: string) {
  const escaped = fileName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^|[/'"\`])${escaped}['"\`]`);
}

const SIGNED_IN_SHELL_CSS = [
  'CommandCenterPolish.css',
  'ApplicantProfilePolish.css',
  'ui-primitives.css',
  'design-system.css',
  'v2-parity.css',
  'glass-neo.css',
  'classic-in-shell.css',
  'shell.css',
  'polish.css',
  'source-integration.css',
  'RecruitFlowUi.css',
];

function stripComments(css: string) {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

/** CSS custom properties declared directly inside one rule body (no nested rules). */
function declarations(block: string) {
  const found = new Map<string, string>();
  for (const match of block.matchAll(/(--(?:rf2-)?motion-[\w-]*)\s*:\s*([^;]+);/g)) {
    found.set(match[1], match[2].trim());
  }
  return found;
}

function sliceBlock(css: string, openBrace: number) {
  let depth = 0;
  for (let index = openBrace; index < css.length; index += 1) {
    if (css[index] === '{') depth += 1;
    else if (css[index] === '}') {
      depth -= 1;
      if (depth === 0) return css.slice(openBrace + 1, index);
    }
  }
  return '';
}

/** Rule bodies that only apply for reduced motion, and the CSS with those regions removed. */
function splitReducedMotion(css: string) {
  const source = stripComments(css);
  const reduced: string[] = [];
  let base = '';
  let cursor = 0;
  const starts = /@media\s*\([^)]*prefers-reduced-motion:\s*reduce[^)]*\)\s*\{|html\[data-reduced-motion=(['"])true\1\][^{]*\{/g;
  for (const match of source.matchAll(starts)) {
    const open = match.index + match[0].length - 1;
    const body = sliceBlock(source, open);
    reduced.push(body);
    base += source.slice(cursor, match.index);
    cursor = open + body.length + 2;
  }
  base += source.slice(cursor);
  return { base, reduced: reduced.join('\n') };
}

function literalMs(value: string | undefined) {
  const match = value?.match(/^(\d+(?:\.\d+)?)ms$/);
  return match ? Number(match[1]) : null;
}

function expectInMotionRange(name: string, value: string, aliases: Map<string, string>) {
  const direct = literalMs(value);
  if (direct !== null) {
    expect(direct, name).toBeGreaterThanOrEqual(80);
    expect(direct, name).toBeLessThanOrEqual(220);
    return;
  }
  const alias = value.match(/^var\(\s*(--[\w-]+)\s*\)$/)?.[1];
  expect(alias, `${name} should be an 80–220ms duration or an alias of one`).toBeTruthy();
  const resolved = literalMs(aliases.get(alias!));
  expect(resolved, alias).toBeGreaterThanOrEqual(80);
  expect(resolved, alias).toBeLessThanOrEqual(220);
}

describe('signed-in shell CSS stays off the login entry', () => {
  it('keeps shell stylesheets in the lazy V2Shell chunk', () => {
    for (const file of SIGNED_IN_SHELL_CSS) {
      const pattern = cssImport(file);
      expect(main, file).not.toMatch(pattern);
      expect(app, file).not.toMatch(pattern);
      expect(shell, file).toMatch(pattern);
    }
  });

  it('keeps tokens and base primitives on the entry chunk', () => {
    expect(main).toMatch(cssImport('index.css'));
    for (const file of ['App.css', 'tokens.css', 'density.css', 'tokens-v2.css']) {
      expect(app, file).toMatch(cssImport(file));
    }
  });
});

describe('motion duration contract', () => {
  it('defines the v2 durations and ease, and zeros both durations for reduced motion', () => {
    expect(tokensV2).toMatch(/--rf2-motion-fast:\s*120ms/);
    expect(tokensV2).toMatch(/--rf2-motion-standard:\s*200ms/);
    expect(tokensV2).toMatch(/--rf2-ease:\s*cubic-bezier\(0\.2,\s*0,\s*0,\s*1\)/);

    const media = tokensV2.match(/@media \(prefers-reduced-motion:\s*reduce\)\s*\{[\s\S]*?\n\}/)?.[0] ?? '';
    expect(media).toMatch(/--rf2-motion-fast:\s*0ms/);
    expect(media).toMatch(/--rf2-motion-standard:\s*0ms/);

    const attribute = tokensV2.match(/html\[data-reduced-motion='true'\][^{]*\{[^}]*\}/)?.[0] ?? '';
    expect(attribute).toMatch(/--rf2-motion-fast:\s*0ms/);
    expect(attribute).toMatch(/--rf2-motion-standard:\s*0ms/);
  });

  it('keeps tokens.css and tokens-v2.css inside 80–220ms, and reduced motion at 0ms or 0.01ms', () => {
    const v2 = splitReducedMotion(tokensV2);
    const legacy = splitReducedMotion(tokens);
    const v2Base = declarations(v2.base);
    const legacyBase = declarations(legacy.base);

    expect(literalMs(v2Base.get('--rf2-motion-fast'))).toBe(120);
    expect(literalMs(v2Base.get('--rf2-motion-standard'))).toBe(200);

    for (const [name, value] of v2Base) {
      expectInMotionRange(name, value, v2Base);
    }

    for (const [name, value] of legacyBase) {
      // --motion-slow remains 300ms in the legacy token file. v2 retargets it at the standard duration.
      if (name === '--motion-slow') {
        expect(literalMs(value)).toBe(300);
        expectInMotionRange(name, v2Base.get(name) ?? '', v2Base);
        continue;
      }
      expectInMotionRange(name, value, legacyBase);
    }

    const reduced = declarations(v2.reduced + legacy.reduced);
    expect(reduced.size).toBeGreaterThan(0);
    for (const [name, value] of reduced) {
      const ms = literalMs(value);
      expect(ms, name).not.toBeNull();
      expect([0, 0.01], name).toContain(ms);
    }
  });
});

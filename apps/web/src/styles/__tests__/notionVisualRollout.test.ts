/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (fromHere: string) => readFileSync(resolve(__dirname, fromHere), 'utf8');

const tokens = read('../tokens-v2.css');
const glass = read('../glass-neo.css');
const pages = read('../../pages/PageEnhancementsV2.css');
const jobs = read('../../v2/pages/jobs.css');
const polish = read('../polish.css');
const main = read('../../main.tsx');
const shell = read('../../layout/V2Shell.tsx');

function ruleBody(css: string, selector: string): string {
  const escaped = selector
    .trim()
    .split(/\s+/)
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('\\s+');
  return css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`))?.[1] ?? '';
}

describe('notion visual rollout tokens', () => {
  it('defines flat solid surfaces and the 8px / 10px radii', () => {
    expect(tokens).toMatch(/--rf2-neo-raise:\s*none/);
    expect(tokens).toMatch(/--rf2-glass-card:\s*var\(--color-surface\)/);
    expect(tokens).toMatch(/--rf2-radius-control:\s*8px/);
    expect(tokens).toMatch(/--rf2-radius-card:\s*10px/);
  });

  it('zeros fast motion when the user prefers reduced motion', () => {
    const block = tokens.match(/@media \(prefers-reduced-motion:\s*reduce\)\s*\{[\s\S]*?\n\}/)?.[0] ?? '';
    expect(block).toMatch(/--rf2-motion-fast:\s*0ms/);
  });
});

describe('operational surfaces stay solid', () => {
  it('does not blur shell cards or vacancy cards', () => {
    expect(glass).not.toMatch(/backdrop-filter:\s*blur\(12px\)/);
    expect(glass).not.toMatch(/-webkit-backdrop-filter:\s*blur\(12px\)/);
    expect(glass).toMatch(/background-color:\s*var\(--rf2-card\)/);
    expect(ruleBody(glass, "[data-ui='v2'] .rf2-shell__content .rf2-col")).toMatch(/background:\s*var\(--color-surface-subtle\)/);
    expect(glass).toMatch(/article\.rf-vacancy-card[\s\S]*backdrop-filter:\s*none/);
  });

  it('drops backdrop blur from job panels, job cards, and pipeline cards', () => {
    expect(jobs).not.toMatch(/backdrop-filter:\s*blur\(12px\)/);
    expect(ruleBody(jobs, "[data-ui='v2'] .rf2-panel")).not.toMatch(/backdrop-filter/);
    expect(ruleBody(jobs, "[data-ui='v2'] .rf2-jcard")).not.toMatch(/backdrop-filter/);
    expect(ruleBody(jobs, "[data-ui='v2'] .rf2-pipeline .rf2-kcard")).not.toMatch(/backdrop-filter/);
  });
});

describe('page cards do not shift on hover', () => {
  it('keeps metric and elevated card hover on the border and background', () => {
    const hover = ruleBody(pages, '.rf-metric-card:hover, .rf-elevated-card:hover');
    expect(hover).not.toMatch(/translateY\(-2px\)/);
    expect(hover).toMatch(/border-color:/);
    expect(hover).toMatch(/background-color:/);
    expect(pages).not.toMatch(/translateY\(-2px\)/);
    expect(pages).not.toMatch(/translateX\(2px\)/);
  });

  it('turns the page hero blur orb off', () => {
    const hero = ruleBody(pages, '.rf-page-hero');
    const orb = ruleBody(pages, '.rf-page-hero::after');
    expect(hero).toMatch(/background:\s*var\(--color-surface\)/);
    expect(hero).toMatch(/box-shadow:\s*none/);
    expect(orb).toMatch(/display:\s*none/);
    expect(orb).not.toMatch(/blur\(/);
  });

  it('keeps the header action flat and skips the page entrance', () => {
    expect(ruleBody(polish, '.header-new-action')).toMatch(/background:\s*var\(--color-action\)/);
    expect(ruleBody(polish, '.header-new-action')).toMatch(/box-shadow:\s*none/);
    expect(ruleBody(polish, '.header-new-action:hover')).not.toMatch(/translateY\(-1px\)/);
    expect(ruleBody(polish, '.rf-page')).toMatch(/animation:\s*none/);
  });
});

describe('signed-in polish stays off the login entry', () => {
  it('does not import or mount profile polish from the login entry', () => {
    expect(main).not.toMatch(/ApplicantProfilePolish|CollapseInitialMatchSkills/);
    expect(main).not.toMatch(/CommandCenterPolish\.css|ApplicantProfilePolish\.css/);
  });

  it('mounts that polish from the signed-in shell', () => {
    expect(shell).toContain('<ApplicantProfilePolish />');
    expect(shell).toContain('<CollapseInitialMatchSkills />');
    expect(shell).toContain('CommandCenterPolish.css');
    expect(shell).toContain('ApplicantProfilePolish.css');
  });
});

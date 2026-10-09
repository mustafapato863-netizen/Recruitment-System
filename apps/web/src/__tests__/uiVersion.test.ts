import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { applyUiVersion, resolveUiVersion, UI_VERSION_STORAGE_KEY } from '../theme/uiVersion';

function memoryStorage(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return { data, getItem: (k: string) => data[k] ?? null, setItem: (k: string, v: string) => { data[k] = v; } };
}

describe('resolveUiVersion', () => {
  it('defaults to v1 (flag off)', () => {
    expect(resolveUiVersion()).toBe('v1');
    expect(resolveUiVersion({ envFlag: 'false', storage: memoryStorage() })).toBe('v1');
  });
  it('turns on from the env flag', () => {
    expect(resolveUiVersion({ envFlag: 'true' })).toBe('v2');
  });
  it('query param wins and persists', () => {
    const storage = memoryStorage();
    expect(resolveUiVersion({ search: '?ui=v2', storage })).toBe('v2');
    expect(storage.data[UI_VERSION_STORAGE_KEY]).toBe('v2');
    expect(resolveUiVersion({ search: '', storage })).toBe('v2');
    expect(resolveUiVersion({ search: '?ui=v1', storage, envFlag: 'true' })).toBe('v1');
    expect(resolveUiVersion({ storage })).toBe('v1');
  });
  it('ignores junk values', () => {
    expect(resolveUiVersion({ search: '?ui=v9', storage: memoryStorage({ [UI_VERSION_STORAGE_KEY]: 'x' }) })).toBe('v1');
  });
  it('survives storage that throws', () => {
    const storage = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); } };
    expect(resolveUiVersion({ search: '?ui=v2', storage })).toBe('v2');
    expect(resolveUiVersion({ storage, envFlag: 'true' })).toBe('v2');
  });
});

describe('applyUiVersion + scoped tokens', () => {
  const css = readFileSync(resolve(__dirname, '../styles/tokens-v2.css'), 'utf8');
  afterEach(() => {
    document.documentElement.removeAttribute('data-ui');
    document.head.innerHTML = '';
    document.body.innerHTML = '';
  });

  it('toggles the data-ui attribute on <html>', () => {
    applyUiVersion('v2');
    expect(document.documentElement.getAttribute('data-ui')).toBe('v2');
    applyUiVersion('v1');
    expect(document.documentElement.hasAttribute('data-ui')).toBe(false);
  });

  it('v2 variables apply only under [data-ui="v2"]', () => {
    const style = document.createElement('style');
    style.textContent = `:root { --color-action: #0069b4; --radius-card: 12px; }\n${css}`;
    document.head.appendChild(style);
    const probe = document.createElement('div');
    document.body.appendChild(probe);
    const read = (name: string) => getComputedStyle(probe).getPropertyValue(name).trim();

    expect(read('--color-action')).toBe('#0069b4');
    expect(read('--rf2-action')).toBe('');
    expect(read('--radius-card')).toBe('12px');

    applyUiVersion('v2');
    expect(read('--rf2-action')).toBe('#1d4ed8');
    expect(read('--color-action')).toBe('var(--rf2-action)');
    expect(read('--radius-card')).toBe('var(--rf2-radius-card)');

    applyUiVersion('v1');
    expect(read('--color-action')).toBe('#0069b4');
  });

  it('v2 css is fully scoped (no unscoped rules)', () => {
    const selectors = css.replace(/\/\*[\s\S]*?\*\//g, '').match(/(^|})\s*([^{}@]+)\{/g) ?? [];
    for (const raw of selectors) {
      const sel = raw.replace(/^}/, '').replace(/\{$/, '').trim();
      for (const part of sel.split(',')) expect(part).toContain("[data-ui='v2']");
    }
  });

  it('removes purple, gradients and glows under v2', () => {
    expect(css).toMatch(/--color-purple: var\(--rf2-info\)/);
    expect(css).toMatch(/--sgh-glow-brand: none/);
    expect(css).toMatch(/--gradient-brand: linear-gradient\(var\(--rf2-action\), var\(--rf2-action\)\)/);
  });
});

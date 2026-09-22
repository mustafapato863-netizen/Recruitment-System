import { beforeEach, describe, expect, it } from 'vitest';
import i18n, { applyDocumentLanguage, changeAppLanguage } from './index';

describe('i18n scaffolding', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
    applyDocumentLanguage();
  });

  it('resolves common brand and nav keys in English', () => {
    expect(i18n.t('brand.productName')).toBe('RecruitFlow');
    expect(i18n.t('nav.locked')).toBe('Locked');
    expect(i18n.t('nav.needs', { requirement: 'Offers approve' })).toBe('Needs Offers approve');
  });

  it('keeps document lang/dir on English', async () => {
    await changeAppLanguage('en');
    expect(document.documentElement.lang).toBe('en');
    expect(document.documentElement.dir).toBe('ltr');
  });
});

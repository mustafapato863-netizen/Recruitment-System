import { beforeEach, describe, expect, it } from 'vitest';
import i18n, { applyDocumentLanguage, changeAppLanguage } from './index';

describe('i18n scaffolding', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
    applyDocumentLanguage('en');
  });

  it('resolves common brand and nav keys in English', () => {
    expect(i18n.t('brand.productName')).toBe('RecruitFlow');
    expect(i18n.t('nav.locked')).toBe('Locked');
    expect(i18n.t('nav.needs', { requirement: 'Offers approve' })).toBe('Needs Offers approve');
  });

  it('loads Arabic common namespace and updates document lang/dir', async () => {
    await changeAppLanguage('ar');
    expect(i18n.t('nav.locked')).toBe('مقفل');
    expect(document.documentElement.lang).toBe('ar');
    expect(document.documentElement.dir).toBe('rtl');
  });
});

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const enModules = import.meta.glob('../locales/en/common.json', {
  eager: true,
  import: 'default',
}) as Record<string, Record<string, unknown>>;

const enCommon = Object.values(enModules)[0] ?? {};

void i18n.use(initReactI18next).init({
  resources: {
    en: { common: enCommon },
  },
  lng: 'en',
  fallbackLng: 'en',
  supportedLngs: ['en'],
  ns: ['common'],
  defaultNS: 'common',
  interpolation: { escapeValue: false },
  react: { useSuspense: false },
});

/** Keep document language fixed to English (company default). */
export function applyDocumentLanguage() {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = 'en';
  document.documentElement.dir = 'ltr';
}

applyDocumentLanguage();
i18n.on('languageChanged', applyDocumentLanguage);

/**
 * Optional helper for a future language switcher — English-only for now.
 * Example: await changeAppLanguage('en')
 */
export async function changeAppLanguage(lng: 'en' = 'en') {
  await i18n.changeLanguage(lng);
  applyDocumentLanguage();
}

export default i18n;

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const localeModules = import.meta.glob('../locales/*/common.json', {
  eager: true,
  import: 'default',
}) as Record<string, Record<string, unknown>>;

const resources: Record<string, { common: Record<string, unknown> }> = {};
for (const [path, messages] of Object.entries(localeModules)) {
  const match = path.match(/locales\/([^/]+)\/common\.json$/);
  if (!match) continue;
  resources[match[1]] = { common: messages };
}

void i18n.use(initReactI18next).init({
  resources,
  lng: 'en',
  fallbackLng: 'en',
  ns: ['common'],
  defaultNS: 'common',
  interpolation: { escapeValue: false },
  react: { useSuspense: false },
});

/** Keep document lang/dir in sync when language changes (minimal RTL hook). */
export function applyDocumentLanguage(lng: string = i18n.resolvedLanguage ?? i18n.language) {
  if (typeof document === 'undefined') return;
  const short = (lng || 'en').split('-')[0];
  document.documentElement.lang = short;
  document.documentElement.dir = short === 'ar' ? 'rtl' : 'ltr';
}

applyDocumentLanguage();
i18n.on('languageChanged', applyDocumentLanguage);

/**
 * Optional helper for a future language switcher — not wired to settings UI.
 * Example: await changeAppLanguage('ar')
 */
export async function changeAppLanguage(lng: 'en' | 'ar') {
  await i18n.changeLanguage(lng);
  applyDocumentLanguage(lng);
}

export default i18n;

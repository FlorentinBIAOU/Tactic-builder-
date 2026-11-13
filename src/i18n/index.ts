import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';

/**
 * Interface strings, French by default, English available from the top bar.
 * One JSON file per area in locales/<lang>/<namespace>.json — every file is
 * picked up automatically.
 */
const files = import.meta.glob('./locales/*/*.json', { eager: true }) as Record<
  string,
  { default: Record<string, unknown> }
>;

const resources: Record<string, Record<string, Record<string, unknown>>> = {};
for (const [path, mod] of Object.entries(files)) {
  const m = path.match(/\.\/locales\/(\w+)\/(\w+)\.json$/);
  if (!m) continue;
  const [, lang, ns] = m;
  resources[lang] ??= {};
  resources[lang][ns] = mod.default;
}

export const LANGUAGES = [
  { code: 'fr', label: 'Français' },
  { code: 'en', label: 'English' },
] as const;

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'fr',
    supportedLngs: ['fr', 'en'],
    ns: Object.keys(resources.fr ?? { common: {} }),
    defaultNS: 'common',
    interpolation: { escapeValue: false },
    detection: { order: ['localStorage'], lookupLocalStorage: 'tactic.lang', caches: ['localStorage'] },
    returnNull: false,
  });

const syncLang = (lng: string) => {
  document.documentElement.lang = lng.startsWith('en') ? 'en' : 'fr';
};
syncLang(i18n.language || 'fr');
i18n.on('languageChanged', syncLang);

/** Locale for dates and numbers (fr-FR / en-GB). */
export function locale(): string {
  return i18n.language?.startsWith('en') ? 'en-GB' : 'fr-FR';
}

export default i18n;

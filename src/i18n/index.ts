import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import { detectLocale, SUPPORTED_LOCALES, type SupportedLocale } from './detectLocale';
import enTranslations from './locales/en.yml';

export { detectLocale, SUPPORTED_LOCALES, type SupportedLocale };
export { i18n };

export type LocaleDictionary = Record<string, any>;

const LOCALE_IMPORTERS: Partial<Record<SupportedLocale, () => Promise<{ default: LocaleDictionary }>>> = {
  ja: () => import('./locales/ja.yml'),
  zh: () => import('./locales/zh.yml'),
};

const loadedBundles: Partial<Record<SupportedLocale, LocaleDictionary>> = {
  en: enTranslations,
};

export async function loadLocale(locale: SupportedLocale): Promise<void> {
  if (locale === 'en') {
    if (i18n.isInitialized && !i18n.hasResourceBundle('en', 'translation')) {
      i18n.addResourceBundle('en', 'translation', enTranslations, true, true);
    }
    return;
  }

  if (loadedBundles[locale]) {
    if (i18n.isInitialized && !i18n.hasResourceBundle(locale, 'translation')) {
      i18n.addResourceBundle(locale, 'translation', loadedBundles[locale], true, true);
    }
    return;
  }

  const importer = LOCALE_IMPORTERS[locale];
  const bundle: LocaleDictionary = importer
    ? (await importer()).default
    : enTranslations;

  loadedBundles[locale] = bundle;
  if (i18n.isInitialized) {
    i18n.addResourceBundle(locale, 'translation', bundle, true, true);
  }
}

export async function setLanguage(locale: SupportedLocale): Promise<void> {
  await loadLocale(locale);
  await i18n.changeLanguage(locale);

  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('badminton-locale', locale);
    }
  } catch {
  }

  if (typeof document !== 'undefined') {
    document.documentElement.lang = locale;
  }
}

const isTest =
  (typeof import.meta !== 'undefined' && import.meta.env?.MODE === 'test') ||
  (typeof globalThis !== 'undefined' &&
    (globalThis as { process?: { env?: Record<string, string> } }).process?.env?.NODE_ENV === 'test');

export async function initI18n(initialLocale: SupportedLocale = 'en'): Promise<typeof i18n> {
  if (i18n.isInitialized) {
    if (initialLocale !== i18n.language) {
      await setLanguage(initialLocale);
    }
    return i18n;
  }

  if (initialLocale !== 'en' && !loadedBundles[initialLocale]) {
    await loadLocale(initialLocale);
  }

  const initialResources: Record<string, { translation: Record<string, any> }> = {
    en: { translation: enTranslations },
  };

  if (initialLocale !== 'en' && loadedBundles[initialLocale]) {
    initialResources[initialLocale] = { translation: loadedBundles[initialLocale]! };
  }

  await i18n.use(initReactI18next).init({
    lng: initialLocale,
    fallbackLng: 'en',
    resources: initialResources,
    interpolation: {
      escapeValue: false,
    },
    saveMissing: isTest,
    missingKeyHandler: (_lngs, _ns, key) => {
      if (isTest && !i18n.exists(key, { lng: 'en' })) {
        throw new Error(`Missing translation key: "${key}"`);
      }
    },
  });

  if (typeof document !== 'undefined') {
    document.documentElement.lang = initialLocale;
  }

  return i18n;
}

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import { detectLocale, SUPPORTED_LOCALES, type SupportedLocale } from './detectLocale';
import enTranslations from './locales/en.yml';

function updateDocumentMeta(_locale: SupportedLocale): void {
  if (typeof document === 'undefined') return;

  document.documentElement.lang = i18n.t('meta.lang');

  const title = i18n.t('meta.title');
  const description = i18n.t('meta.description');

  document.title = title;

  const setMeta = (selector: string, attr: string, value: string): void => {
    document.querySelector(selector)?.setAttribute(attr, value);
  };

  setMeta('meta[name="description"]', 'content', description);
  setMeta('meta[property="og:title"]', 'content', title);
  setMeta('meta[property="og:description"]', 'content', description);
  setMeta('meta[property="og:locale"]', 'content', i18n.t('meta.ogLocale'));
  setMeta('meta[name="twitter:title"]', 'content', title);
  setMeta('meta[name="twitter:description"]', 'content', description);

  updateStructuredData(title, description);
}

function updateStructuredData(title: string, description: string): void {
  const existing = document.getElementById('ld-json');
  if (existing) existing.remove();

  const script = document.createElement('script');
  script.id = 'ld-json';
  script.type = 'application/ld+json';
  script.text = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: title,
    description,
    url: 'https://sylhare.github.io/Badminton/',
    applicationCategory: 'SportsApplication',
    inLanguage: i18n.t('meta.lang'),
    operatingSystem: 'Web',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  });
  document.head.appendChild(script);
}

export { detectLocale, SUPPORTED_LOCALES, type SupportedLocale };
export { i18n };

export type LocaleDictionary = Record<string, any>;

const LOCALE_IMPORTERS = import.meta.glob<{ default: LocaleDictionary }>([
  './locales/*.yml',
  '!./locales/en.yml',
]);

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

  const importer = LOCALE_IMPORTERS[`./locales/${locale}.yml`];
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

  updateDocumentMeta(locale);
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

  updateDocumentMeta(initialLocale);

  return i18n;
}

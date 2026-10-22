import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { en } from './messages/en';
import type { TranslationKey } from './messages/en';
import { translate } from './translations';
import type { TranslationParams } from './translations';
import {
  browserLanguages,
  detectLocale,
  htmlLangFor,
  readStoredLocale,
  storeLocale,
} from './locales';
import type { Locale } from './locales';
import { CATALOGS } from './translations';

export type Translate = (key: TranslationKey, params?: TranslationParams) => string;

export interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: Translate;
  /**
   * Plural helper: picks `oneKey` when `count` is exactly 1, else `otherKey`,
   * and passes `count` through as a param. Japanese catalogs give both keys the
   * same text, since Japanese does not inflect for number.
   */
  tp: (
    oneKey: TranslationKey,
    otherKey: TranslationKey,
    count: number,
    params?: TranslationParams,
  ) => string;
}

/**
 * English by default so components render on their own (tests, storybooks,
 * isolated usage) and the app costs nothing extra until a provider is mounted.
 */
export const defaultTranslate: Translate = (key, params) => translate(en, key, params);

const defaultContext: I18nContextValue = {
  locale: 'en',
  setLocale: () => {},
  t: defaultTranslate,
  tp: (oneKey, otherKey, count, params) =>
    defaultTranslate(count === 1 ? oneKey : otherKey, { count, ...params }),
};

const I18nContext = createContext<I18nContextValue>(defaultContext);

export function useTranslation(): I18nContextValue {
  return useContext(I18nContext);
}

interface I18nProviderProps {
  children: React.ReactNode;
  /** Override the detected locale (useful for tests). */
  initialLocale?: Locale;
}

export function I18nProvider({ children, initialLocale }: I18nProviderProps): React.ReactElement {
  const [locale, setLocaleState] = useState<Locale>(
    () => initialLocale ?? detectLocale(readStoredLocale(), browserLanguages()),
  );

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    storeLocale(next);
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.lang = htmlLangFor(locale);
    document.documentElement.classList.toggle('locale-ja', locale === 'ja');
  }, [locale]);

  const value = useMemo<I18nContextValue>(() => {
    const catalog = CATALOGS[locale] ?? en;
    const t: Translate = (key, params) => translate(catalog, key, params);
    return {
      locale,
      setLocale,
      t,
      tp: (oneKey, otherKey, count, params) => t(count === 1 ? oneKey : otherKey, { count, ...params }),
    };
  }, [locale, setLocale]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.title = value.t('app.title');
  }, [value]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export { I18nProvider, useTranslation, defaultTranslate } from './I18nProvider';
export type { I18nContextValue, Translate } from './I18nProvider';
export {
  SUPPORTED_LOCALES,
  DEFAULT_LOCALE,
  detectLocale,
  htmlLangFor,
  isLocale,
  LOCALE_STORAGE_KEY,
} from './locales';
export type { Locale } from './locales';
export { interpolate } from './translations';
export type { TranslationKey, TranslationParams } from './translations';

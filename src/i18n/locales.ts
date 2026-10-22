/** Locales the app ships translations for. Order is the order of the language picker. */
export const SUPPORTED_LOCALES = [
  { code: 'en', label: 'English', htmlLang: 'en' },
  { code: 'ja', label: '日本語', htmlLang: 'ja' },
] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number]['code'];

export const DEFAULT_LOCALE: Locale = 'en';
export const LOCALE_STORAGE_KEY = 'badminton-locale';

export function isLocale(value: unknown): value is Locale {
  return SUPPORTED_LOCALES.some(locale => locale.code === value);
}

export function htmlLangFor(locale: Locale): string {
  return SUPPORTED_LOCALES.find(l => l.code === locale)?.htmlLang ?? locale;
}

/**
 * Pick the starting locale: an explicit choice the user made earlier wins,
 * then the browser's language preferences, then English.
 */
export function detectLocale(
  storedLocale?: string | null,
  browserLanguages?: readonly string[],
): Locale {
  if (isLocale(storedLocale)) return storedLocale;

  for (const language of browserLanguages ?? []) {
    const base = language.toLowerCase().split('-')[0];
    if (isLocale(base)) return base;
  }

  return DEFAULT_LOCALE;
}

/** Read the persisted locale, if the environment allows it. */
export function readStoredLocale(): string | null {
  try {
    return localStorage.getItem(LOCALE_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function storeLocale(locale: Locale): void {
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // Storage can be unavailable (private mode, quota); the in-memory choice still applies.
  }
}

/** The browser's language preferences, guarded for non-browser environments. */
export function browserLanguages(): readonly string[] {
  if (typeof navigator === 'undefined') return [];
  return navigator.languages?.length ? navigator.languages : [navigator.language];
}

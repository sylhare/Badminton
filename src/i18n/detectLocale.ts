export const SUPPORTED_LOCALES = ['en', 'ja', 'zh'] as const;
export type SupportedLocale = typeof SUPPORTED_LOCALES[number];

export function isSupportedLocale(locale: unknown): locale is SupportedLocale {
  return typeof locale === 'string' && (SUPPORTED_LOCALES as readonly string[]).includes(locale);
}

export function matchLocaleTag(tag: string): SupportedLocale | null {
  const normalized = tag.toLowerCase().trim();
  if (normalized === 'ja' || normalized.startsWith('ja-') || normalized.startsWith('ja_')) {
    return 'ja';
  }
  if (normalized === 'zh' || normalized.startsWith('zh-') || normalized.startsWith('zh_')) {
    return 'zh';
  }
  if (normalized === 'en' || normalized.startsWith('en-') || normalized.startsWith('en_')) {
    return 'en';
  }
  return null;
}

/**
 * Detects the active locale by checking stored user preferences and browser languages.
 */
export function detectLocale(): SupportedLocale {
  try {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem('badminton-locale');
      if (isSupportedLocale(stored)) {
        return stored;
      }
    }
  } catch {
  }

  try {
    if (typeof navigator !== 'undefined') {
      let candidateLanguages: readonly string[] = [];
      if (Array.isArray(navigator.languages) && navigator.languages.length > 0) {
        candidateLanguages = navigator.languages;
      } else if (navigator.language) {
        candidateLanguages = [navigator.language];
      }

      for (const lang of candidateLanguages) {
        if (!lang) continue;
        const matched = matchLocaleTag(lang);
        if (matched) {
          return matched;
        }
      }
    }
  } catch {
  }

  return 'en';
}

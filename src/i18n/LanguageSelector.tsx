import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { SUPPORTED_LOCALES, type SupportedLocale, setLanguage } from './index';

const LANGUAGE_LABELS: Record<SupportedLocale, string> = {
  en: 'English',
  ja: '日本語',
  zh: '简体中文',
};

export const LanguageSelector: React.FC = () => {
  const { t, i18n } = useTranslation();
  const [error, setError] = useState<string | null>(null);
  const currentLocale: SupportedLocale = (SUPPORTED_LOCALES as readonly string[]).includes(i18n.language)
    ? (i18n.language as SupportedLocale)
    : 'en';

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const next = e.target.value as SupportedLocale;
    setError(null);
    void setLanguage(next).catch((err: unknown) => {
      console.error(`[i18n] Failed to switch language to "${next}":`, err);
      setError(`Failed to switch language to ${LANGUAGE_LABELS[next] ?? next}`);
    });
  };

  return (
    <div className="language-selector-wrapper">
      <select
        data-testid="language-selector"
        aria-label={t('footer.language')}
        value={currentLocale}
        onChange={handleChange}
        className="language-selector"
      >
        {SUPPORTED_LOCALES.map(loc => (
          <option key={loc} value={loc}>
            {LANGUAGE_LABELS[loc]}
          </option>
        ))}
      </select>
      {error ? (
        <span className="language-selector-error" role="alert" title={error}>
          {error}
        </span>
      ) : null}
    </div>
  );
};

export default LanguageSelector;

import React from 'react';

import { SUPPORTED_LOCALES, useTranslation } from '../i18n';
import type { Locale } from '../i18n';

/** Language picker. The choice is persisted and applied on the next visit. */
const LanguageSwitcher: React.FC = () => {
  const { locale, setLocale, t } = useTranslation();

  return (
    <label className="language-switcher">
      <span className="language-switcher-label">{t('language.label')}</span>
      <select
        className="language-switcher-select"
        value={locale}
        onChange={event => setLocale(event.target.value as Locale)}
        data-testid="language-select"
        aria-label={t('language.label')}
      >
        {SUPPORTED_LOCALES.map(option => (
          <option key={option.code} value={option.code}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
};

export default LanguageSwitcher;

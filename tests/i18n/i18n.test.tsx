import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';

import { I18nProvider, useTranslation } from '../../src/i18n';
import type { TranslationKey, TranslationParams } from '../../src/i18n';
import { detectLocale, isLocale } from '../../src/i18n/locales';
import { interpolate } from '../../src/i18n/translations';
import { en } from '../../src/i18n/messages/en';
import { ja } from '../../src/i18n/messages/ja';
import LanguageSwitcher from '../../src/components/LanguageSwitcher';
import { formatTimeAgo } from '../../src/components/court/CourtAssignments';

afterEach(() => {
  localStorage.clear();
  document.documentElement.className = '';
  document.documentElement.lang = 'en';
});

const placeholders = (template: string): string[] =>
  [...template.matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort();

describe('message catalogs', () => {
  it('ship the same keys in every language', () => {
    expect(Object.keys(ja).sort()).toEqual(Object.keys(en).sort());
  });

  it('only use placeholders the English template provides', () => {
    // A translation may drop a placeholder (Japanese has no plural noun), but it
    // must never introduce one the caller does not pass.
    const unknown = Object.keys(en).filter(key => {
      const enKey = key as keyof typeof en;
      return placeholders(ja[enKey]).some(name => !placeholders(en[enKey]).includes(name));
    });

    expect(unknown).toEqual([]);
  });

  it('have no empty translations', () => {
    const empties = Object.entries(ja).filter(([, value]) => value.trim() === '');
    expect(empties).toEqual([]);
  });
});

describe('interpolate', () => {
  it('replaces known placeholders', () => {
    expect(interpolate('Court {number}', { number: 3 })).toBe('Court 3');
  });

  it('leaves unknown placeholders untouched', () => {
    expect(interpolate('{a} and {b}', { a: 'x' })).toBe('x and {b}');
  });

  it('returns the template unchanged without params', () => {
    expect(interpolate('plain text')).toBe('plain text');
  });
});

describe('detectLocale', () => {
  it('prefers a stored, supported locale', () => {
    expect(detectLocale('ja', ['en-US'])).toBe('ja');
  });

  it('ignores an unsupported stored locale', () => {
    expect(detectLocale('fr', ['fr-FR'])).toBe('en');
  });

  it('matches the browser language by its base tag', () => {
    expect(detectLocale(null, ['ja-JP'])).toBe('ja');
  });

  it('falls back to English', () => {
    expect(detectLocale(null, ['de-DE'])).toBe('en');
    expect(detectLocale(null, [])).toBe('en');
  });
});

describe('isLocale', () => {
  it('accepts supported codes only', () => {
    expect(isLocale('ja')).toBe(true);
    expect(isLocale('en')).toBe(true);
    expect(isLocale('jp')).toBe(false);
  });
});

const Sample: React.FC = () => {
  const { t, tp } = useTranslation();
  return (
    <div>
      <h1>{t('app.title')}</h1>
      <span>{t('court.court', { number: 2 })}</span>
      <span>{tp('image.foundOne', 'image.foundOther', 1)}</span>
      <span>{tp('image.foundOne', 'image.foundOther', 3)}</span>
    </div>
  );
};

describe('I18nProvider', () => {
  it('defaults to English when there is no provider', () => {
    render(<Sample />);
    expect(screen.getByRole('heading')).toHaveTextContent('Badminton Court Manager');
  });

  it('renders Japanese when the provider starts in Japanese', () => {
    render(<I18nProvider initialLocale="ja"><Sample /></I18nProvider>);
    expect(screen.getByRole('heading')).toHaveTextContent('バドミントン コート管理');
    expect(screen.getByText('コート 2')).toBeInTheDocument();
  });

  it('switches language and updates <html lang>', async () => {
    const user = userEvent.setup();
    render(<I18nProvider initialLocale="en"><Sample /><LanguageSwitcher /></I18nProvider>);

    await user.selectOptions(screen.getByTestId('language-select'), 'ja');

    expect(screen.getByRole('heading')).toHaveTextContent('バドミントン コート管理');
    expect(document.documentElement.lang).toBe('ja');
    expect(document.documentElement).toHaveClass('locale-ja');
  });

  it('persists the chosen language', async () => {
    const user = userEvent.setup();
    render(<I18nProvider initialLocale="en"><LanguageSwitcher /></I18nProvider>);

    await user.selectOptions(screen.getByTestId('language-select'), 'ja');

    expect(localStorage.getItem('badminton-locale')).toBe('ja');
  });
});

describe('formatTimeAgo', () => {
  it('uses translated relative time units', () => {
    const jaT = (key: TranslationKey, params?: TranslationParams): string =>
      interpolate(ja[key], params);

    expect(formatTimeAgo(Date.now() - 5_000, jaT)).toBe('5秒前');
  });
});

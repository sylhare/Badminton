import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';

import en from '../../src/i18n/locales/en.yml';
import ja from '../../src/i18n/locales/ja.yml';
import zh from '../../src/i18n/locales/zh.yml';
import { i18n, initI18n, loadLocale, setLanguage } from '../../src/i18n';
import LanguageSelector from '../../src/i18n/LanguageSelector';

describe('i18n', () => {
  beforeEach(async () => {
    localStorage.clear();
    await initI18n('en');
    await setLanguage('en');
  });

  afterEach(async () => {
    await setLanguage('en');
    localStorage.clear();
  });

  it('provides English translations immediately without async loading', () => {
    expect(i18n.language).toBe('en');
    expect(i18n.t('app.title')).toBe(en.app.title);
    expect(i18n.t('footer.feedback')).toBe(en.footer.feedback);
  });

  it('lazily loads Japanese locale on demand', async () => {
    await loadLocale('ja');
    await setLanguage('ja');

    expect(i18n.language).toBe('ja');
    expect(i18n.t('app.title')).toBe(ja.app.title);
    expect(document.documentElement.lang).toBe('ja');
    expect(localStorage.getItem('badminton-locale')).toBe('ja');
  });

  it('lazily loads Chinese locale on demand', async () => {
    await loadLocale('zh');
    await setLanguage('zh');

    expect(i18n.language).toBe('zh');
    expect(i18n.t('app.title')).toBe(zh.app.title);
    expect(document.documentElement.lang).toBe('zh');
    expect(localStorage.getItem('badminton-locale')).toBe('zh');
  });

  it('falls back to English when a key is missing from a locale resource', async () => {
    i18n.addResourceBundle('es', 'translation', { app: { custom: 'Hola' } }, true, true);
    await i18n.changeLanguage('es');

    expect(i18n.t('app.title')).toBe(en.app.title);
    expect(i18n.t('app.custom')).toBe('Hola');
  });

  it('throws an error in test environment when a key is completely missing', () => {
    expect(() => {
      i18n.t('app.nonexistent_typo');
    }).toThrow('Missing translation key: "app.nonexistent_typo"');
  });

  describe('LanguageSelector component', () => {
    it('renders with testid and accessible label', async () => {
      await act(async () => {
        render(<LanguageSelector />);
      });
      const select = screen.getByTestId('language-selector');
      expect(select).toBeInTheDocument();
      expect(select).toHaveAttribute('aria-label', 'Language');
      expect(select).toHaveValue('en');
    });

    it('changes language and persists preference when selected', async () => {
      await act(async () => {
        render(<LanguageSelector />);
      });
      const select = screen.getByTestId('language-selector');

      await act(async () => {
        fireEvent.change(select, { target: { value: 'ja' } });
        await new Promise(resolve => setTimeout(resolve, 10));
      });

      expect(await screen.findByDisplayValue('日本語')).toBeInTheDocument();
      expect(i18n.language).toBe('ja');
      expect(localStorage.getItem('badminton-locale')).toBe('ja');
      expect(document.documentElement.lang).toBe('ja');
    });
  });
});

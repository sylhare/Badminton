import { beforeEach, describe, expect, it } from 'vitest';

import { detectLocale, matchLocaleTag } from '../../src/i18n/detectLocale';

describe('detectLocale', () => {
  beforeEach(() => {
    localStorage.clear();
    Object.defineProperty(navigator, 'languages', {
      value: ['en-US', 'en'],
      configurable: true,
      writable: true,
    });
    Object.defineProperty(navigator, 'language', {
      value: 'en-US',
      configurable: true,
      writable: true,
    });
  });

  describe('matchLocaleTag', () => {
    it('matches Japanese locale tags', () => {
      expect(matchLocaleTag('ja')).toBe('ja');
      expect(matchLocaleTag('ja-JP')).toBe('ja');
      expect(matchLocaleTag('JA-jp')).toBe('ja');
      expect(matchLocaleTag('ja_JP')).toBe('ja');
    });

    it('matches Chinese locale tags', () => {
      expect(matchLocaleTag('zh')).toBe('zh');
      expect(matchLocaleTag('zh-CN')).toBe('zh');
      expect(matchLocaleTag('zh-TW')).toBe('zh');
      expect(matchLocaleTag('zh-Hans')).toBe('zh');
      expect(matchLocaleTag('zh-Hant-HK')).toBe('zh');
    });

    it('matches English locale tags', () => {
      expect(matchLocaleTag('en')).toBe('en');
      expect(matchLocaleTag('en-US')).toBe('en');
      expect(matchLocaleTag('en-GB')).toBe('en');
    });

    it('returns null for unsupported locales', () => {
      expect(matchLocaleTag('fr')).toBeNull();
      expect(matchLocaleTag('de-DE')).toBeNull();
      expect(matchLocaleTag('es')).toBeNull();
      expect(matchLocaleTag('')).toBeNull();
    });
  });

  describe('precedence and detection', () => {
    it('prefers localStorage over navigator.languages', () => {
      localStorage.setItem('badminton-locale', 'ja');
      Object.defineProperty(navigator, 'languages', {
        value: ['zh-CN', 'en-US'],
        configurable: true,
      });

      expect(detectLocale()).toBe('ja');
    });

    it('ignores invalid localStorage values and falls back to navigator', () => {
      localStorage.setItem('badminton-locale', 'invalid-locale');
      Object.defineProperty(navigator, 'languages', {
        value: ['zh-CN'],
        configurable: true,
      });

      expect(detectLocale()).toBe('zh');
    });

    it('detects ja-JP from navigator.languages when no stored preference', () => {
      Object.defineProperty(navigator, 'languages', {
        value: ['ja-JP', 'en-US'],
        configurable: true,
      });

      expect(detectLocale()).toBe('ja');
    });

    it('detects zh-TW from navigator.languages', () => {
      Object.defineProperty(navigator, 'languages', {
        value: ['zh-TW', 'en-US'],
        configurable: true,
      });

      expect(detectLocale()).toBe('zh');
    });

    it('skips unknown locale (e.g. fr) and picks subsequent supported locale', () => {
      Object.defineProperty(navigator, 'languages', {
        value: ['fr-FR', 'ja-JP'],
        configurable: true,
      });

      expect(detectLocale()).toBe('ja');
    });

    it('falls back to en when navigator has only unknown languages', () => {
      Object.defineProperty(navigator, 'languages', {
        value: ['fr-FR', 'de-DE'],
        configurable: true,
      });
      Object.defineProperty(navigator, 'language', {
        value: 'fr-FR',
        configurable: true,
      });

      expect(detectLocale()).toBe('en');
    });

    it('falls back to en when navigator languages list is empty', () => {
      Object.defineProperty(navigator, 'languages', {
        value: [],
        configurable: true,
      });
      Object.defineProperty(navigator, 'language', {
        value: '',
        configurable: true,
      });

      expect(detectLocale()).toBe('en');
    });
  });
});

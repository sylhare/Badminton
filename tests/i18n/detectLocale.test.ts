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

    it('matches French locale tags', () => {
      expect(matchLocaleTag('fr')).toBe('fr');
      expect(matchLocaleTag('fr-FR')).toBe('fr');
      expect(matchLocaleTag('FR-fr')).toBe('fr');
      expect(matchLocaleTag('fr_FR')).toBe('fr');
    });

    it('matches German locale tags', () => {
      expect(matchLocaleTag('de')).toBe('de');
      expect(matchLocaleTag('de-DE')).toBe('de');
      expect(matchLocaleTag('DE-de')).toBe('de');
      expect(matchLocaleTag('de_AT')).toBe('de');
    });

    it('matches Hindi locale tags', () => {
      expect(matchLocaleTag('hi')).toBe('hi');
      expect(matchLocaleTag('hi-IN')).toBe('hi');
      expect(matchLocaleTag('HI-in')).toBe('hi');
      expect(matchLocaleTag('hi_IN')).toBe('hi');
    });

    it('matches Malay locale tags', () => {
      expect(matchLocaleTag('ms')).toBe('ms');
      expect(matchLocaleTag('ms-MY')).toBe('ms');
      expect(matchLocaleTag('MS-my')).toBe('ms');
      expect(matchLocaleTag('ms_MY')).toBe('ms');
    });

    it('matches English locale tags', () => {
      expect(matchLocaleTag('en')).toBe('en');
      expect(matchLocaleTag('en-US')).toBe('en');
      expect(matchLocaleTag('en-GB')).toBe('en');
    });

    it('returns null for unsupported locales', () => {
      expect(matchLocaleTag('es')).toBeNull();
      expect(matchLocaleTag('it-IT')).toBeNull();
      expect(matchLocaleTag('ko')).toBeNull();
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

    it('skips unknown locale (e.g. es) and picks subsequent supported locale', () => {
      Object.defineProperty(navigator, 'languages', {
        value: ['es-ES', 'ja-JP'],
        configurable: true,
      });

      expect(detectLocale()).toBe('ja');
    });

    it('falls back to en when navigator has only unknown languages', () => {
      Object.defineProperty(navigator, 'languages', {
        value: ['es-ES', 'it-IT'],
        configurable: true,
      });
      Object.defineProperty(navigator, 'language', {
        value: 'es-ES',
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

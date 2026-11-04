import { describe, expect, it } from 'vitest';

import en from '../../src/i18n/locales/en.yml';
import ja from '../../src/i18n/locales/ja.yml';
import zh from '../../src/i18n/locales/zh.yml';
import {
  flattenKeys,
  validateNonEmptyStrings,
  validateParity,
} from '../../vite/yamlPlugin';

describe('locale parity', () => {
  const enFlat = flattenKeys(en);
  const jaFlat = flattenKeys(ja);
  const zhFlat = flattenKeys(zh);

  it('has identical keys between en and ja', () => {
    expect(() => validateParity(jaFlat, enFlat, 'ja.yml')).not.toThrow();
  });

  it('has identical keys between en and zh', () => {
    expect(() => validateParity(zhFlat, enFlat, 'zh.yml')).not.toThrow();
  });

  it('has no empty or whitespace-only values in en.yml', () => {
    expect(() => validateNonEmptyStrings(enFlat, 'en.yml')).not.toThrow();
  });

  it('has no empty or whitespace-only values in ja.yml', () => {
    expect(() => validateNonEmptyStrings(jaFlat, 'ja.yml')).not.toThrow();
  });

  it('has no empty or whitespace-only values in zh.yml', () => {
    expect(() => validateNonEmptyStrings(zhFlat, 'zh.yml')).not.toThrow();
  });

  describe('parity and validation helpers', () => {
    it('throws when missing keys are detected', () => {
      const incomplete = { ...enFlat };
      delete incomplete['app.title'];

      expect(() => validateParity(incomplete, enFlat, 'incomplete.yml')).toThrow(
        /Missing keys:\s+- app\.title/,
      );
    });

    it('throws when extra keys are detected', () => {
      const extra = { ...enFlat, 'extra.key': 'Extra' };

      expect(() => validateParity(extra, enFlat, 'extra.yml')).toThrow(
        /Extra keys:\s+- extra\.key/,
      );
    });

    it('throws when a value is empty or whitespace only', () => {
      expect(() =>
        validateNonEmptyStrings({ 'empty.key': '' }, 'test.yml'),
      ).toThrow(/Locale value for key "empty.key" in "test.yml" must be a non-empty string\./);

      expect(() =>
        validateNonEmptyStrings({ 'blank.key': '   ' }, 'test.yml'),
      ).toThrow(/Locale value for key "blank.key" in "test.yml" must be a non-empty string\./);
    });
  });
});

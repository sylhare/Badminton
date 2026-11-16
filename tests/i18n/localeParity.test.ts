import { describe, expect, it } from 'vitest';

import {
  flattenKeys,
  validateNonEmptyStrings,
  validateParity,
} from '../../vite/yamlPlugin';

const localeModules = import.meta.glob<{ default: Record<string, any> }>(
  '../../src/i18n/locales/*.yml',
  { eager: true },
);

const locales = Object.entries(localeModules).map(([filePath, mod]) => {
  const filename = filePath.split('/').pop()!;
  const name = filename.replace(/\.yml$/, '');
  return {
    name,
    filename,
    flat: flattenKeys(mod.default),
  };
});

const enLocale = locales.find(l => l.name === 'en')!;
const enFlat = enLocale.flat;
const nonEnLocales = locales.filter(l => l.name !== 'en');

describe('locale parity', () => {
  it.each(nonEnLocales)('has identical keys between en and $name', ({ flat, filename }) => {
    expect(() => validateParity(flat, enFlat, filename)).not.toThrow();
  });

  it.each(locales)('has no empty or whitespace-only values in $filename', ({ flat, filename }) => {
    expect(() => validateNonEmptyStrings(flat, filename)).not.toThrow();
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

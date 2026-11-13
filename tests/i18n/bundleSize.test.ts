import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import de from '../../src/i18n/locales/de.yml';
import en from '../../src/i18n/locales/en.yml';
import fr from '../../src/i18n/locales/fr.yml';
import hi from '../../src/i18n/locales/hi.yml';
import ja from '../../src/i18n/locales/ja.yml';
import ms from '../../src/i18n/locales/ms.yml';
import zh from '../../src/i18n/locales/zh.yml';
import { flattenKeys } from '../../vite/yamlPlugin';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const localesDir = path.resolve(__dirname, '../../src/i18n/locales');
const distAssetsDir = path.resolve(__dirname, '../../dist/assets');

const MAX_LOCALE_FILE_SIZE_BYTES = 30 * 1024;
const MAX_FLATTENED_JSON_SIZE_BYTES = 30 * 1024;
const MAX_BUILT_CHUNK_SIZE_BYTES = 26 * 1024;

describe('bundleSize', () => {
  it('keeps raw locale YAML files within reasonable size limits', () => {
    const localeFiles = ['en.yml', 'ja.yml', 'zh.yml', 'fr.yml', 'de.yml', 'hi.yml', 'ms.yml'];

    for (const file of localeFiles) {
      const filePath = path.join(localesDir, file);
      const stat = fs.statSync(filePath);
      expect(stat.size).toBeLessThan(MAX_LOCALE_FILE_SIZE_BYTES);
    }
  });

  it('keeps in-memory locale dictionaries compact', () => {
    const dictionaries = [
      { name: 'en', dict: en },
      { name: 'ja', dict: ja },
      { name: 'zh', dict: zh },
      { name: 'fr', dict: fr },
      { name: 'de', dict: de },
      { name: 'hi', dict: hi },
      { name: 'ms', dict: ms },
    ];

    for (const { dict } of dictionaries) {
      const flat = flattenKeys(dict);
      const jsonBytes = Buffer.byteLength(JSON.stringify(flat), 'utf8');
      expect(jsonBytes).toBeLessThan(MAX_FLATTENED_JSON_SIZE_BYTES);
    }
  });

  it('ensures built locale chunks stay within reasonable size limits if dist exists', () => {
    if (!fs.existsSync(distAssetsDir)) {
      return;
    }

    const files = fs.readdirSync(distAssetsDir);
    const chunkLocales = ['ja', 'zh', 'fr', 'de', 'hi', 'ms'];

    for (const loc of chunkLocales) {
      const chunkRegex = new RegExp(`^${loc}-[A-Za-z0-9_-]+\\.js$`);
      const chunk = files.find(file => chunkRegex.test(file));
      if (chunk) {
        const size = fs.statSync(path.join(distAssetsDir, chunk)).size;
        expect(size).toBeLessThan(MAX_BUILT_CHUNK_SIZE_BYTES);
      }
    }
  });
});

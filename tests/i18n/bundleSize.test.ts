import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import en from '../../src/i18n/locales/en.yml';
import ja from '../../src/i18n/locales/ja.yml';
import zh from '../../src/i18n/locales/zh.yml';
import { flattenKeys } from '../../vite/yamlPlugin';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const localesDir = path.resolve(__dirname, '../../src/i18n/locales');
const distAssetsDir = path.resolve(__dirname, '../../dist/assets');

const MAX_LOCALE_FILE_SIZE_BYTES = 25 * 1024;
const MAX_FLATTENED_JSON_SIZE_BYTES = 25 * 1024;
const MAX_BUILT_CHUNK_SIZE_BYTES = 20 * 1024;

describe('bundleSize', () => {
  it('keeps raw locale YAML files within reasonable size limits', () => {
    const localeFiles = ['en.yml', 'ja.yml', 'zh.yml'];

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
    ];

    for (const { dict } of dictionaries) {
      const flat = flattenKeys(dict);
      const jsonBytes = Buffer.byteLength(JSON.stringify(flat), 'utf8');
      expect(jsonBytes).toBeLessThan(MAX_FLATTENED_JSON_SIZE_BYTES);
    }
  });

  it('ensures built ja and zh chunks stay within reasonable size limits if dist exists', () => {
    if (!fs.existsSync(distAssetsDir)) {
      return;
    }

    const files = fs.readdirSync(distAssetsDir);
    const jaChunk = files.find(file => /^ja-[A-Za-z0-9_-]+\.js$/.test(file));
    const zhChunk = files.find(file => /^zh-[A-Za-z0-9_-]+\.js$/.test(file));

    if (jaChunk) {
      const jaSize = fs.statSync(path.join(distAssetsDir, jaChunk)).size;
      expect(jaSize).toBeLessThan(MAX_BUILT_CHUNK_SIZE_BYTES);
    }

    if (zhChunk) {
      const zhSize = fs.statSync(path.join(distAssetsDir, zhChunk)).size;
      expect(zhSize).toBeLessThan(MAX_BUILT_CHUNK_SIZE_BYTES);
    }
  });
});

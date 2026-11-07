import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { Plugin } from 'vite';
import YAML from 'yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const localesDir = path.resolve(__dirname, '../src/i18n/locales');
const enYmlPath = path.resolve(localesDir, 'en.yml');

export function flattenKeys(obj: unknown, prefix = ''): Record<string, string> {
  const result: Record<string, string> = {};
  if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
    for (const [key, value] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        Object.assign(result, flattenKeys(value, fullKey));
      } else {
        result[fullKey] = typeof value === 'string' ? value : String(value ?? '');
      }
    }
  }
  return result;
}

export function validateNonEmptyStrings(flat: Record<string, string>, filePath: string): void {
  for (const [key, value] of Object.entries(flat)) {
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new Error(`Locale value for key "${key}" in "${filePath}" must be a non-empty string.`);
    }
  }
}

export function validateParity(
  localeFlat: Record<string, string>,
  enFlat: Record<string, string>,
  localeIdentifier: string,
): void {
  const localeKeys = new Set(Object.keys(localeFlat));
  const enKeys = new Set(Object.keys(enFlat));

  const missingKeys = [...enKeys].filter(k => !localeKeys.has(k)).sort();
  const extraKeys = [...localeKeys].filter(k => !enKeys.has(k)).sort();

  if (missingKeys.length > 0 || extraKeys.length > 0) {
    const details: string[] = [];
    if (missingKeys.length > 0) {
      details.push(`Missing keys:\n  - ${missingKeys.join('\n  - ')}`);
    }
    if (extraKeys.length > 0) {
      details.push(`Extra keys:\n  - ${extraKeys.join('\n  - ')}`);
    }
    throw new Error(
      `Locale "${localeIdentifier}" does not match key parity with en.yml:\n${details.join('\n')}`,
    );
  }
}

export function yamlPlugin(): Plugin {
  return {
    name: 'vite-plugin-yaml',
    transform(code, id) {
      const cleanId = id.split('?')[0];
      if (!cleanId.endsWith('.yml')) {
        return null;
      }

      const parsed = YAML.parse(code) as Record<string, any>;
      const flat = flattenKeys(parsed);
      const normalizedPath = path.resolve(cleanId);
      const rel = path.relative(localesDir, normalizedPath);
      const isLocalesDir = !rel.startsWith('..') && !path.isAbsolute(rel);
      const isEnFile = normalizedPath === enYmlPath;

      if (isLocalesDir) {
        validateNonEmptyStrings(flat, path.basename(cleanId));

        if (!isEnFile) {
          if (this.addWatchFile) {
            this.addWatchFile(enYmlPath);
          }

          let enContent: string;
          try {
            enContent = fs.readFileSync(enYmlPath, 'utf8');
          } catch {
            throw new Error(`Could not read base English locale file at "${enYmlPath}".`);
          }

          const enParsed = YAML.parse(enContent) as Record<string, any>;
          const enFlat = flattenKeys(enParsed);
          validateParity(flat, enFlat, path.basename(cleanId));
        }
      }

      return {
        code: `export default ${JSON.stringify(parsed)};`,
        map: { mappings: '' },
      };
    },
  };
}

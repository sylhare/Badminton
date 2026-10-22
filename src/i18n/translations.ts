import { en } from './messages/en';
import type { TranslationKey } from './messages/en';
import { ja } from './messages/ja';

export type { TranslationKey };
export type TranslationParams = Record<string, string | number>;

export type Catalog = Record<TranslationKey, string>;

export const CATALOGS: Record<string, Catalog> = { en, ja };

/** Replace `{name}` placeholders with their params, leaving unknown ones untouched. */
export function interpolate(template: string, params?: TranslationParams): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : match,
  );
}

/** Translate `key` against a catalog. Used by the provider and by the English default context. */
export function translate(
  catalog: Catalog,
  key: TranslationKey,
  params?: TranslationParams,
): string {
  return interpolate(catalog[key], params);
}

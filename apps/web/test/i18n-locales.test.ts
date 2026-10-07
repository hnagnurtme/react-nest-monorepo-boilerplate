import { describe, expect, it } from 'vitest';

import { resources } from '@/lib/i18n';
import { SUPPORTED_LANGUAGES, type AppLanguage } from '@/lib/i18n/languages';

type Bundle = Record<string, unknown>;

/** Flattens a locale bundle to dotted leaf paths, so the two sides compare as sets. */
function leafKeys(value: unknown, prefix = ''): string[] {
  if (typeof value !== 'object' || value === null) return [prefix];
  return Object.entries(value as Bundle).flatMap(([key, child]) =>
    leafKeys(child, prefix === '' ? key : `${prefix}.${key}`),
  );
}

/**
 * `{{name}}` placeholders a translator must keep; a dropped one renders raw.
 * The optional `, number` suffix is an i18next formatter, not part of the name.
 */
function placeholders(value: string): string[] {
  return [...value.matchAll(/\{\{\s*(\w+)[^}]*\}\}/g)].map((match) => match[1] ?? '').sort();
}

function leafEntries(value: unknown, prefix = ''): [string, string][] {
  if (typeof value !== 'object' || value === null) {
    return [[prefix, String(value)]];
  }
  return Object.entries(value as Bundle).flatMap(([key, child]) =>
    leafEntries(child, prefix === '' ? key : `${prefix}.${key}`),
  );
}

const REFERENCE: AppLanguage = 'en';
const NAMESPACES = Object.keys(resources[REFERENCE]) as (keyof (typeof resources)['en'])[];
const TRANSLATIONS = SUPPORTED_LANGUAGES.filter((language) => language !== REFERENCE);

describe('locale bundles stay in step', () => {
  it('declares the same namespaces for every language', () => {
    for (const language of SUPPORTED_LANGUAGES) {
      expect(Object.keys(resources[language]).sort()).toEqual([...NAMESPACES].sort());
    }
  });

  it.each(TRANSLATIONS.flatMap((language) => NAMESPACES.map((ns) => [language, ns] as const)))(
    '%s/%s has exactly the keys of en',
    (language, namespace) => {
      const expected = leafKeys(resources[REFERENCE][namespace]).sort();
      const actual = leafKeys(resources[language][namespace]).sort();

      expect(actual.filter((key) => !expected.includes(key))).toEqual([]);
      expect(expected.filter((key) => !actual.includes(key))).toEqual([]);
    },
  );

  it.each(TRANSLATIONS.flatMap((language) => NAMESPACES.map((ns) => [language, ns] as const)))(
    '%s/%s keeps every interpolation placeholder',
    (language, namespace) => {
      const reference = new Map(leafEntries(resources[REFERENCE][namespace]));
      const mismatched: string[] = [];

      for (const [key, value] of leafEntries(resources[language][namespace])) {
        const source = reference.get(key);
        if (source === undefined) continue;
        if (placeholders(source).join(',') !== placeholders(value).join(',')) {
          mismatched.push(key);
        }
      }

      expect(mismatched).toEqual([]);
    },
  );

  it('never leaves a translation empty', () => {
    for (const language of SUPPORTED_LANGUAGES) {
      for (const namespace of NAMESPACES) {
        for (const [key, value] of leafEntries(resources[language][namespace])) {
          expect(value.trim(), `${language}/${namespace}:${key}`).not.toBe('');
        }
      }
    }
  });
});

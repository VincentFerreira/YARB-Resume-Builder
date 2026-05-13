import { describe, it, expect } from 'vitest';
import {
  getLangText,
  getLangArray,
  createMultiLangString,
  createMultiLangArray,
  LANGUAGE_CODES,
  LANGUAGES,
  DEFAULT_LANGUAGE,
  UI_TRANSLATIONS,
  LATEX_TRANSLATIONS,
} from '../../lib/i18n';

// ── getLangText ───────────────────────────────────────────────────────────────

describe('getLangText', () => {
  it('returns the value for the requested language', () => {
    expect(getLangText({ fr: 'Bonjour', en: 'Hello' }, 'en')).toBe('Hello');
    expect(getLangText({ fr: 'Bonjour', en: 'Hello' }, 'fr')).toBe('Bonjour');
  });

  it('falls back to DEFAULT_LANGUAGE when the requested lang is missing', () => {
    expect(getLangText({ fr: 'Bonjour' }, 'en')).toBe('Bonjour');
  });

  it('falls back to first available value when default lang is also missing', () => {
    expect(getLangText({ en: 'Hello' }, 'fr')).toBe('Hello');
  });

  it('returns empty string for null input', () => {
    expect(getLangText(null, 'fr')).toBe('');
  });

  it('returns empty string for undefined input', () => {
    expect(getLangText(undefined, 'fr')).toBe('');
  });

  it('returns empty string for an empty object', () => {
    expect(getLangText({}, 'fr')).toBe('');
  });

  it('returns empty string when all values are falsy', () => {
    expect(getLangText({ fr: '', en: '' }, 'fr')).toBe('');
  });
});

// ── getLangArray ──────────────────────────────────────────────────────────────

describe('getLangArray', () => {
  it('returns the array for the requested language', () => {
    expect(getLangArray({ fr: ['a', 'b'], en: ['c', 'd'] }, 'en')).toEqual(['c', 'd']);
    expect(getLangArray({ fr: ['a', 'b'], en: ['c', 'd'] }, 'fr')).toEqual(['a', 'b']);
  });

  it('falls back to DEFAULT_LANGUAGE when the requested lang is missing', () => {
    expect(getLangArray({ fr: ['a', 'b'] }, 'en')).toEqual(['a', 'b']);
  });

  it('returns empty array for null input', () => {
    expect(getLangArray(null, 'fr')).toEqual([]);
  });

  it('returns empty array for undefined input', () => {
    expect(getLangArray(undefined, 'fr')).toEqual([]);
  });

  it('returns empty array for an empty object', () => {
    expect(getLangArray({}, 'fr')).toEqual([]);
  });

  it('preserves array order', () => {
    const items = ['z', 'a', 'm', 'b'];
    expect(getLangArray({ fr: items }, 'fr')).toEqual(items);
  });
});

// ── createMultiLangString ─────────────────────────────────────────────────────

describe('createMultiLangString', () => {
  it('initializes every language code to empty string by default', () => {
    const result = createMultiLangString();
    for (const code of LANGUAGE_CODES) {
      expect(result[code]).toBe('');
    }
    expect(Object.keys(result)).toHaveLength(LANGUAGE_CODES.length);
  });

  it('uses provided values', () => {
    const result = createMultiLangString({ fr: 'Bonjour', en: 'Hello' });
    expect(result.fr).toBe('Bonjour');
    expect(result.en).toBe('Hello');
  });

  it('fills missing languages with empty string', () => {
    const result = createMultiLangString({ fr: 'Bonjour' });
    expect(result.fr).toBe('Bonjour');
    expect(result.en).toBe('');
  });

  it('does not carry extra keys beyond LANGUAGE_CODES', () => {
    const result = createMultiLangString({ fr: 'Bonjour', en: 'Hello' });
    expect(Object.keys(result)).toEqual([...LANGUAGE_CODES]);
  });
});

// ── createMultiLangArray ──────────────────────────────────────────────────────

describe('createMultiLangArray', () => {
  it('initializes every language code to empty array by default', () => {
    const result = createMultiLangArray();
    for (const code of LANGUAGE_CODES) {
      expect(result[code]).toEqual([]);
    }
  });

  it('uses provided values', () => {
    const result = createMultiLangArray({ fr: ['a', 'b'], en: ['c'] });
    expect(result.fr).toEqual(['a', 'b']);
    expect(result.en).toEqual(['c']);
  });

  it('fills missing languages with empty array', () => {
    const result = createMultiLangArray({ fr: ['x'] });
    expect(result.fr).toEqual(['x']);
    expect(result.en).toEqual([]);
  });

  it('does not share array references between languages', () => {
    const result = createMultiLangArray();
    result.fr!.push('mutated');
    expect(result.en).toEqual([]);
  });
});

// ── Constants ─────────────────────────────────────────────────────────────────

describe('LANGUAGE_CODES', () => {
  it('contains at least fr and en', () => {
    expect(LANGUAGE_CODES).toContain('fr');
    expect(LANGUAGE_CODES).toContain('en');
  });
});

describe('LANGUAGES metadata', () => {
  it('has one entry per language code', () => {
    expect(LANGUAGES).toHaveLength(LANGUAGE_CODES.length);
  });

  it('each entry has a non-empty code, label, and locale', () => {
    for (const lang of LANGUAGES) {
      expect(lang.code).toBeTruthy();
      expect(lang.label).toBeTruthy();
      expect(lang.locale).toBeTruthy();
    }
  });

  it('codes in LANGUAGES match LANGUAGE_CODES exactly', () => {
    const codes = LANGUAGES.map(l => l.code);
    expect(codes).toEqual([...LANGUAGE_CODES]);
  });
});

describe('DEFAULT_LANGUAGE', () => {
  it('is a valid language code', () => {
    expect(LANGUAGE_CODES).toContain(DEFAULT_LANGUAGE);
  });
});

// ── Translation completeness ──────────────────────────────────────────────────

describe('UI_TRANSLATIONS', () => {
  it('has an entry for every language code', () => {
    for (const code of LANGUAGE_CODES) {
      expect(UI_TRANSLATIONS[code]).toBeDefined();
    }
  });

  it('every language has the same set of keys', () => {
    const [first, ...rest] = LANGUAGE_CODES;
    const referenceKeys = Object.keys(UI_TRANSLATIONS[first]).sort();
    for (const code of rest) {
      expect(Object.keys(UI_TRANSLATIONS[code]).sort()).toEqual(referenceKeys);
    }
  });

  it('no translation value is empty', () => {
    for (const code of LANGUAGE_CODES) {
      for (const [key, value] of Object.entries(UI_TRANSLATIONS[code])) {
        expect(value, `UI_TRANSLATIONS.${code}.${key} should not be empty`).toBeTruthy();
      }
    }
  });

  it('English previewLanguages is in English, not French', () => {
    expect(UI_TRANSLATIONS.en.previewLanguages).not.toBe('LANGUES');
    expect(UI_TRANSLATIONS.en.previewLanguages).toBe('LANGUAGES');
  });
});

describe('LATEX_TRANSLATIONS', () => {
  it('has an entry for every language code', () => {
    for (const code of LANGUAGE_CODES) {
      expect(LATEX_TRANSLATIONS[code]).toBeDefined();
    }
  });

  it('every language has the same set of keys', () => {
    const [first, ...rest] = LANGUAGE_CODES;
    const referenceKeys = Object.keys(LATEX_TRANSLATIONS[first]).sort();
    for (const code of rest) {
      expect(Object.keys(LATEX_TRANSLATIONS[code]).sort()).toEqual(referenceKeys);
    }
  });
});

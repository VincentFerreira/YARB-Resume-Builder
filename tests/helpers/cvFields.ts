import type { CVData, Language } from '../../types';
import { LANGUAGE_CODES } from '../../lib/i18n';

// Never rendered as visible CV text: internal ids, the raw photo data URL, the active-language flag.
const NON_DISPLAYED_KEYS = new Set(['id', 'photo', 'currentLanguage']);

function isMultiLangObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const keys = Object.keys(value);
  return keys.length > 0 && keys.every((k) => (LANGUAGE_CODES as readonly string[]).includes(k));
}

function collect(node: unknown, lang: Language, key: string | undefined, out: string[]): void {
  if (key && NON_DISPLAYED_KEYS.has(key)) return;

  if (typeof node === 'string') {
    if (node.trim()) out.push(node);
    return;
  }

  if (Array.isArray(node)) {
    for (const item of node) collect(item, lang, undefined, out);
    return;
  }

  if (isMultiLangObject(node)) {
    collect(node[lang], lang, undefined, out);
    return;
  }

  if (typeof node === 'object' && node !== null) {
    for (const [k, v] of Object.entries(node)) collect(v, lang, k, out);
  }
}

// Schema-driven: walks the raw CVData tree so a new field, once populated in a fixture,
// is expected automatically — no per-field mapping to keep in sync by hand.
export function walkCvLeafStrings(cv: CVData, lang: Language): string[] {
  const out: string[] = [];
  collect(cv, lang, undefined, out);
  return out;
}

// Presentation strips content invariance: names are uppercased (CSS in Preview, \uppercase{}
// in the LaTeX template), some comma-separated fields render as one chip per item, and pdflatex
// typesets straight quotes as typographic ones. Comparisons normalize all of that away so they
// check content (a real encoding bug still shows up as mojibake, not a quote/case mismatch).
export function normalizeForComparison(value: string): string {
  return value
    .replace(/[‘’]/g, "'")
    .replace(/[,\n\r\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

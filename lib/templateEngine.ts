import Mustache from 'mustache';

// Disable HTML escaping — we pre-escape data for LaTeX ourselves
Mustache.escape = (s: string) => s;

// Use [[ ]] delimiters to avoid conflicts with LaTeX { } brace syntax
const TAGS: [string, string] = ['[[', ']]'];

export function render(template: string, data: object): string {
  return Mustache.render(template, data, {}, TAGS);
}

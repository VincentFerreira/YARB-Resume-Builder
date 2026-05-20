const LS_KEY = 'cv-latex-template';

export function saveLatexTemplate(template: string): void {
  try {
    localStorage.setItem(LS_KEY, template);
  } catch { /* ignore quota errors */ }
}

export function loadLatexTemplate(): string | null {
  try {
    return localStorage.getItem(LS_KEY);
  } catch {
    return null;
  }
}

export function resetLatexTemplate(): void {
  try {
    localStorage.removeItem(LS_KEY);
  } catch { /* ignore */ }
}

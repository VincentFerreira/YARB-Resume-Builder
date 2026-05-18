import { CVData } from '../types';

export function exportAsHtml(data: CVData): void {
  const el = document.getElementById('cv-preview-export');
  if (!el) return;

  let html = el.outerHTML;

  // Remove responsive scale transform classes added for the in-app preview
  html = html
    .replace(/\s*origin-top\s*/g, ' ')
    .replace(/\s*scale-\[[\d.]+\]\s*/g, ' ')
    .replace(/\s*sm:scale-\[[\d.]+\]\s*/g, ' ')
    .replace(/\s*md:scale-\[[\d.]+\]\s*/g, ' ')
    .replace(/\s*lg:scale-\d+\s*/g, ' ')
    .replace(/\s*transition-transform\s*/g, ' ')
    .replace(/\s*duration-300\s*/g, ' ');

  const { firstName, lastName } = data.personalInfo;
  const title = `CV – ${firstName} ${lastName}`.trim().replace(/ –\s*$/, '');
  const lang = data.currentLanguage ?? 'fr';

  const fullHtml = `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <script src="https://cdn.tailwindcss.com"><\/script>
</head>
<body class="bg-slate-100 min-h-screen p-8 flex justify-center">
  ${html}
</body>
</html>`;

  const blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const fileName = `cv_${firstName || 'export'}_${lastName || ''}.html`.replace(/\s+/g, '_');
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

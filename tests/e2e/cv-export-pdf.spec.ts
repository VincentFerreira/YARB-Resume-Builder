import fs from 'node:fs';
import path from 'node:path';
import { test, expect } from '@playwright/test';
import { importJsonFixture, closeCvManager } from '../helpers/cvManager';
import { loadCvFixture } from '../helpers/fixtures';
import { walkCvLeafStrings, normalizeForComparison } from '../helpers/cvFields';
import { readPdf } from '../helpers/pdf';

test.setTimeout(60_000);

async function importAndExportPdf(page: import('@playwright/test').Page, fixtureName: string) {
  await page.goto('/');
  await importJsonFixture(page, fixtureName);
  await expect(page.getByText('CV imported. Save it to keep it.')).toBeVisible();
  await closeCvManager(page);

  const exportButton = page.getByRole('button', { name: 'Export' });
  await exportButton.click();
  const exportMenu = exportButton.locator('..');
  const downloadPromise = page.waitForEvent('download');
  await exportMenu.getByRole('button', { name: 'PDF', exact: true }).click();
  const download = await downloadPromise;

  const destDir = path.join('test-results', 'downloaded-pdfs');
  fs.mkdirSync(destDir, { recursive: true });
  const destPath = path.join(destDir, download.suggestedFilename());
  await download.saveAs(destPath);

  return { download, buffer: fs.readFileSync(destPath) };
}

test('T3 - export PDF déclenche un téléchargement nommé correctement', async ({ page }) => {
  const cv = loadCvFixture('cv-complet.json');
  const { download, buffer } = await importAndExportPdf(page, 'cv-complet.json');

  expect(download.suggestedFilename()).toBe(
    `cv_${cv.personalInfo.firstName}_${cv.personalInfo.lastName}.pdf`
  );
  expect(buffer.length).toBeGreaterThan(0);
});

test('T4 - le PDF produit est structurellement valide et contient le contenu clé', async ({ page }) => {
  const cv = loadCvFixture('cv-complet.json');
  const { buffer } = await importAndExportPdf(page, 'cv-complet.json');

  const pdf = await readPdf(buffer);
  const text = normalizeForComparison(pdf.text);

  expect(pdf.numPages).toBe(1);

  const keyValues = [
    cv.personalInfo.firstName,
    cv.personalInfo.lastName,
    cv.personalInfo.email,
    cv.experience[0].company,
    cv.experience[0].role.fr,
    cv.skills[0].items.fr,
  ];
  for (const value of keyValues) {
    expect(text, `champ manquant dans le PDF : "${value}"`).toContain(normalizeForComparison(value!));
  }
});

test('T5 - les accents et caractères Unicode sont préservés dans le PDF', async ({ page }) => {
  const cv = loadCvFixture('cv-accents.json');
  const { buffer } = await importAndExportPdf(page, 'cv-accents.json');

  const pdf = await readPdf(buffer);
  const text = normalizeForComparison(pdf.text);

  const expectedValues = walkCvLeafStrings(cv, cv.currentLanguage);
  for (const value of expectedValues) {
    expect(text, `chaîne accentuée manquante ou corrompue dans le PDF : "${value}"`).toContain(
      normalizeForComparison(value)
    );
  }
});

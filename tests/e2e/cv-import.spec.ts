import { test, expect } from '@playwright/test';
import { importJsonFixture, closeCvManager } from '../helpers/cvManager';
import { loadCvFixture } from '../helpers/fixtures';
import { walkCvLeafStrings, normalizeForComparison } from '../helpers/cvFields';

test('T1 - import happy path: bannière de succès, aucune erreur console', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => consoleErrors.push(err.message));

  await page.goto('/');
  await importJsonFixture(page, 'cv-complet.json');

  await expect(page.getByText('CV imported. Save it to keep it.')).toBeVisible();
  expect(consoleErrors).toEqual([]);
});

for (const fixtureName of ['cv-complet.json', 'cv-minimal.json']) {
  test(`T2 - tous les champs de ${fixtureName} apparaissent dans l'aperçu`, async ({ page }) => {
    await page.goto('/');
    await importJsonFixture(page, fixtureName);
    await expect(page.getByText('CV imported. Save it to keep it.')).toBeVisible();
    await closeCvManager(page);

    const cv = loadCvFixture(fixtureName);
    const expectedValues = walkCvLeafStrings(cv, cv.currentLanguage);
    const previewText = normalizeForComparison(await page.locator('#cv-preview-export').innerText());

    for (const value of expectedValues) {
      expect(previewText, `champ manquant dans l'aperçu : "${value}"`).toContain(normalizeForComparison(value));
    }
  });
}

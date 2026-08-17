import { test, expect } from '@playwright/test';
import { openCvManager } from '../helpers/cvManager';
import { fixturePath } from '../helpers/fixtures';
import { INITIAL_CV_DATA } from '../../constants';

const cases = [
  { fixture: 'cv-invalide.json', bannerText: 'Error reading the file.', label: 'JSON syntaxiquement invalide' },
  { fixture: 'cv-vide.json', bannerText: 'Error reading the file.', label: 'fichier vide' },
  { fixture: 'cv-champs-manquants.json', bannerText: 'Invalid JSON file.', label: 'champs obligatoires manquants' },
];

for (const { fixture, bannerText, label } of cases) {
  test(`T6 - ${label} (${fixture}) : erreur explicite, pas de crash, CV inchangé`, async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await page.goto('/cvs/new');
    await openCvManager(page);
    await page.locator('input[type="file"][accept=".json"]').setInputFiles(fixturePath(fixture));

    await expect(page.getByText(bannerText)).toBeVisible();
    expect(pageErrors).toEqual([]);

    await page.getByRole('button', { name: 'Close' }).click();
    await expect(page.locator('#cv-preview-export')).toContainText(INITIAL_CV_DATA.personalInfo.lastName, {
      ignoreCase: true,
    });
  });
}

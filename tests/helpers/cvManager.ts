import { expect, type Page } from '@playwright/test';
import { fixturePath } from './fixtures';

export async function openCvManager(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'My CVs' }).click();
  await expect(page.getByRole('heading', { name: 'My CVs' })).toBeVisible();
}

export async function closeCvManager(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Close' }).click();
  await expect(page.getByRole('heading', { name: 'My CVs' })).not.toBeVisible();
}

// Sets the file directly on the (hidden) <input type="file">, bypassing the OS file picker.
export async function importJsonFixture(page: Page, fixtureName: string): Promise<void> {
  await openCvManager(page);
  await page.locator('input[type="file"][accept=".json"]').setInputFiles(fixturePath(fixtureName));
}

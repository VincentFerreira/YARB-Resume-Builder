import { test, expect } from '@playwright/test';
import { unique } from '../helpers/jobs';

test('T-import - import a job posting end-to-end via the fake provider', async ({ page }) => {
  const suffix = unique();
  const company = `Acme Import Co ${suffix}`;
  const rawText = [
    'Title: Senior Backend Engineer',
    `Company: ${company}`,
    'Location: Paris, France',
    'Salary: 55k-65k EUR',
    'We need someone remote with strong experience in javascript, docker and kubernetes.',
  ].join('\n');

  await page.goto('/jobs');
  await page.getByTestId('import-job-button').click();
  await expect(page.getByTestId('import-job-dialog')).toBeVisible();

  await page.getByTestId('import-raw-text-input').fill(rawText);
  await page.getByTestId('import-provider-fake').click();
  await page.getByTestId('extract-job-button').click();

  // Extraction hands off to JobForm, prefilled, for mandatory review before saving.
  await expect(page.getByTestId('job-form')).toBeVisible();
  await expect(page.getByTestId('job-company-input')).toHaveValue(company);
  await expect(page.getByTestId('job-title-input')).toHaveValue('Senior Backend Engineer');
  await expect(page.getByTestId('job-description-input')).toHaveValue(rawText);

  await page.getByTestId('job-form-submit').click();
  await expect(page.getByTestId('job-form')).not.toBeVisible();

  await expect(page.locator('tr', { hasText: company })).toBeVisible();

  await page.locator('tr', { hasText: company }).click();
  await expect(page.getByTestId('job-detail')).toBeVisible();
  await expect(page.getByTestId('job-keywords')).toBeVisible();
});

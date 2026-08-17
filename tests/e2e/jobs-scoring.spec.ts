import { test, expect } from '@playwright/test';
import { createCvFromFixture, createJob, unique } from '../helpers/jobs';

// The fake ATS provider (VITE_ATS_PROVIDER=fake, set by playwright.config.ts for the Vite
// dev server it spawns itself) ranks the job description's distinct words by frequency and
// checks each against the CV text. cv-minimal.json's skills/techStack only contain
// "JavaScript", so a 5-distinct-word, all-frequency-1 description makes the outcome fully
// deterministic: the words keep their original order (stable sort), "javascript" is the
// only one present, giving a score of round(1/5*100) = 20.
const JD_TEXT = 'javascript graphql testing docker kubernetes';

async function assignCvAndComputeScore(page: import('@playwright/test').Page, cvLabel: string) {
  await page.getByTestId('cv-select').selectOption({ label: cvLabel });
  await page.getByTestId('compute-score-button').click();
  await expect(page.getByTestId('ats-report')).toBeVisible();
}

test('T2 - associating a CV and computing a score shows the badge and breakdown', async ({ page }) => {
  const suffix = unique();
  const cvLabel = `Scoring CV ${suffix}`;
  const company = `Scoring Co ${suffix}`;

  await createCvFromFixture(page, 'cv-minimal.json', cvLabel);
  await createJob(page, company, 'Frontend Engineer', JD_TEXT);

  await page.locator('tr', { hasText: company }).click();
  await expect(page.getByTestId('job-detail')).toBeVisible();

  await assignCvAndComputeScore(page, cvLabel);

  await expect(page.getByTestId('score-badge')).toContainText('20');
  await expect(page.getByTestId('keyword-javascript')).toContainText('in CV');
  await expect(page.getByTestId('keyword-graphql')).toContainText('missing');
});

test('T3 - editing the CV marks the score stale; recalculating refreshes it', async ({ page }) => {
  const suffix = unique();
  const cvLabel = `Stale-flow CV ${suffix}`;
  const company = `Stale-flow Co ${suffix}`;

  await createCvFromFixture(page, 'cv-minimal.json', cvLabel);
  await createJob(page, company, 'Frontend Engineer', JD_TEXT);

  await page.locator('tr', { hasText: company }).click();
  await expect(page.getByTestId('job-detail')).toBeVisible();
  await assignCvAndComputeScore(page, cvLabel);
  await expect(page.getByTestId('score-badge')).toContainText('20');

  // Edit the CV in the editor: add "GraphQL" so the score should improve on recalculation.
  await page.goto('/cvs');
  await page
    .locator('[data-testid^="cv-card-"]', { hasText: cvLabel })
    .getByRole('link', { name: 'Edit' })
    .click();
  await page.getByTestId('section-header-skills').click();
  await page.getByTestId('skill-items-0').fill('HTML, CSS, JavaScript, GraphQL');
  await page.getByTestId('cv-manager-button').click();
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('CV updated.')).toBeVisible();
  await page.getByRole('button', { name: 'Close' }).click();

  // Back on the job: the previously-computed score is now stale.
  await page.goto('/jobs');
  await page.locator('tr', { hasText: company }).click();
  await expect(page.getByTestId('job-detail')).toBeVisible();
  await expect(page.getByTestId('stale-badge')).toBeVisible();
  await expect(page.getByTestId('score-section')).toContainText('computed against a different version');

  await page.getByTestId('compute-score-button').click();
  await expect(page.getByTestId('score-badge')).toContainText('40');
  await expect(page.getByTestId('keyword-graphql')).toContainText('in CV');
  await expect(page.getByTestId('stale-badge')).not.toBeVisible();
});

test('T7 - deleting a job that has a computed score removes it without error', async ({ page }) => {
  const suffix = unique();
  const cvLabel = `Delete-flow CV ${suffix}`;
  const company = `Delete-flow Co ${suffix}`;

  await createCvFromFixture(page, 'cv-minimal.json', cvLabel);
  await createJob(page, company, 'Frontend Engineer', JD_TEXT);

  await page.locator('tr', { hasText: company }).click();
  await expect(page.getByTestId('job-detail')).toBeVisible();
  await assignCvAndComputeScore(page, cvLabel);
  await expect(page.getByTestId('score-badge')).toContainText('20');

  await page.getByRole('button', { name: 'Delete' }).click();
  await page.getByRole('button', { name: 'Confirm?' }).click();

  await expect(page).toHaveURL(/\/jobs$/);
  await expect(page.getByText(company)).not.toBeVisible();
});

import { test, expect, type Locator, type Page } from '@playwright/test';
import { createCv, createJob, unique } from '../helpers/jobs';

// Our kanban implements real HTML5 drag & drop (draggable + DataTransfer), which
// Playwright's mouse-based locator.dragTo() does not trigger — Chromium's automation
// mouse events don't synthesize native dragstart/dragover/drop. Dispatching the drag
// event sequence manually with a shared DataTransfer handle is the documented way to
// drive native HTML5 DnD from Playwright.
async function dragCardToColumn(page: Page, card: Locator, column: Locator): Promise<void> {
  const dataTransfer = await page.evaluateHandle(() => new DataTransfer());
  await card.dispatchEvent('dragstart', { dataTransfer });
  await column.dispatchEvent('dragover', { dataTransfer });
  await column.dispatchEvent('drop', { dataTransfer });
  await card.dispatchEvent('dragend', { dataTransfer });
}

test('T6 - kanban drag applied → interview persists on reload', async ({ page }) => {
  const suffix = unique();
  const cvLabel = `Kanban CV ${suffix}`;
  const company = `Kanban Co ${suffix}`;

  await createCv(page, cvLabel);
  await createJob(page, company, 'DevOps Engineer');

  await page.locator('tr', { hasText: company }).click();
  await expect(page.getByTestId('job-detail')).toBeVisible();
  await page.getByTestId('cv-select').selectOption({ label: cvLabel });
  await page.getByTestId('status-select').selectOption('applied');
  await expect(page.getByTestId('status-select')).toHaveValue('applied');

  await page.goto('/jobs');
  await page.getByTestId('view-kanban-button').click();
  await expect(page.getByTestId('jobs-kanban')).toBeVisible();
  await expect(page.getByTestId('kanban-column-applied')).toContainText(company);

  const card = page.locator('[data-testid^="job-card-"]', { hasText: company });
  await dragCardToColumn(page, card, page.getByTestId('kanban-column-interview'));

  await expect(page.getByTestId('kanban-column-interview')).toContainText(company);
  await expect(page.getByTestId('kanban-column-applied')).not.toContainText(company);

  // The view toggle itself is persisted in localStorage, so a reload should stay on kanban.
  await page.reload();
  await expect(page.getByTestId('jobs-kanban')).toBeVisible();
  await expect(page.getByTestId('kanban-column-interview')).toContainText(company);
  await expect(page.getByTestId('kanban-column-applied')).not.toContainText(company);
});

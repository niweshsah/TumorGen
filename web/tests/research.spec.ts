import { test, expect } from '@playwright/test';
import { experiments, dsc, models } from '../src/research';

test('research includes all scores, scientific workflow, figures, and source links', async ({
  page,
}) => {
  await page.goto('/?view=research&case=UPENN-GBM-00002_11#results');
  await expect(page.getByRole('heading', { name: 'Reported experimental results' })).toBeVisible();
  for (const experiment of experiments) {
    await page.getByLabel('Inspect an experiment').selectOption(experiment.id);
    const whole = page.getByRole('table', { name: 'Whole-tumor Dice similarity coefficient' });
    for (let i = 0; i < models.length; i++)
      await expect(whole.getByRole('row').nth(i + 1)).toContainText(dsc(experiment.whole[i]));
    const labels = page.getByRole('table', {
      name: 'Per-label Dice similarity coefficient',
    });
    for (let i = 0; i < 2; i++)
      for (let j = 0; j < 3; j++)
        await expect(
          labels
            .getByRole('row')
            .nth(i + 1)
            .getByRole('cell')
            .nth(j),
        ).toHaveText(dsc(experiment.labels[i][j]));
  }
  await expect(page.getByRole('heading', { name: '10 mm ROI dilation' })).toHaveCount(1);
  await expect(page.locator('#research')).not.toContainText('5 mm');
  await expect(page.locator('#research')).not.toContainText(/\b(?:slides?|presentation)\b/i);
  await expect(page.locator('#research')).toContainText('Brain Tumor Segmentation (BraTS)');
  await expect(page.locator('#research')).toContainText('α = 0.7 and β = 0.3');
  await expect(page.locator('#research')).toContainText('custom RGB-stacked MRI dataset');
  await expect(page.locator('#research')).toContainText('rank-4 trainable low-rank updates');
  await expect(
    page.getByRole('heading', { name: 'Classification and segmentation objectives' }),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'GitHub repository' })).toHaveAttribute(
    'href',
    'https://github.com/niweshsah/TumorGen',
  );
  await page.getByRole('button', { name: 'Enlarge Qualitative segmentation: slice 106' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Enlarge Qualitative segmentation: slice 106' }),
  ).toBeFocused();
});

test('research navigation preserves patient and viewing state and supports history', async ({
  page,
}) => {
  await page.goto('/?case=UPENN-GBM-00002_11');
  const canvas = page.locator('[data-testid="canvas-gt"] canvas');
  await expect(canvas).toBeVisible();
  await expect.poll(() => canvas.getAttribute('data-camera')).not.toBeNull();
  const before = await canvas.getAttribute('data-camera');
  await page.getByRole('button', { name: 'Research approach' }).click();
  await expect(page).toHaveURL(/view=research/);
  await expect(
    page.getByRole('heading', { name: 'Brain tumor segmentation across cohorts' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Open comparison' }).click();
  await expect(canvas).toBeVisible();
  await expect(canvas).toHaveAttribute('data-camera', before!);
  await expect(page).toHaveURL(/case=UPENN-GBM-00002_11/);
  await page.goBack();
  await expect(
    page.getByRole('heading', { name: 'Brain tumor segmentation across cohorts' }),
  ).toBeVisible();
  await page.goForward();
  await expect(canvas).toBeVisible();
});

test('research themes and responsive compositions', async ({ page }) => {
  await page.goto('/?view=research');
  for (const width of [1440, 1024, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const theme of ['light', 'dark']) {
      await page.setViewportSize({ width, height: 1000 });
      if ((await page.locator('html').getAttribute('data-theme')) !== theme)
        await page.getByRole('button', { name: `Switch to ${theme} mode` }).click();
      await page.locator('#research img').evaluateAll(async (images) => {
        for (const image of images) {
          (image as HTMLImageElement).loading = 'eager';
          await (image as HTMLImageElement).decode();
        }
      });
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBeTruthy();
      await page.evaluate(() => window.scrollTo(0, 0));
      const height = await page.evaluate(() => document.documentElement.scrollHeight);
      for (let y = 0, part = 1; y < height; y += 5500, part++) {
        await page.setViewportSize({ width, height: Math.min(5500, height - y) });
        await page.evaluate((offset) => window.scrollTo(0, offset), y);
        await page.screenshot({
          path: `.impeccable/review/research-${width}-${theme}-part${part}.png`,
        });
      }
    }
  }
});

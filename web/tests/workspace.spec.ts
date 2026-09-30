import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

async function ready(page: Page) {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Brain tumor segmentation' })).toBeVisible();
  await expect(page.getByRole('slider', { name: 'axial slice' })).toBeVisible();
  await expect(page.locator('[data-testid="canvas-gt"] canvas')).toBeVisible();
}
async function openRendering(page: Page) {
  if (!(await page.getByRole('slider', { name: 'Brain opacity', exact: true }).isVisible()))
    await page.getByLabel('Rendering settings').click();
  if (!(await page.getByRole('slider', { name: 'Tumor opacity', exact: true }).isVisible()))
    await page.getByText('More opacity settings', { exact: false }).click();
}
async function camera(page: Page, kind = 'gt') {
  const value = await page
    .locator(`[data-testid="canvas-${kind}"] canvas`)
    .getAttribute('data-camera');
  return value
    ? JSON.stringify(JSON.parse(value), (_key, item) =>
        typeof item === 'number' ? Math.round(item * 1e6) / 1e6 : item,
      )
    : null;
}
test('real volumes, metrics, camera linkage, and controls', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await ready(page);
  const expected = await page.request.get('/data/manifest.json').then((r) => r.json());
  await expect(page.getByTestId('dice-score')).toHaveText(
    expected.cases[0].metrics.WT.dice.toFixed(3),
  );
  const gt = page.locator('[data-testid="canvas-gt"] canvas');
  await expect.poll(() => camera(page)).not.toBeNull();
  const before = await camera(page),
    bounds = (await gt.boundingBox())!;
  await page.mouse.move(bounds.x + bounds.width * 0.55, bounds.y + bounds.height * 0.55);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width * 0.75, bounds.y + bounds.height * 0.65, {
    steps: 12,
  });
  await page.mouse.up();
  await expect.poll(() => camera(page)).not.toBe(before);
  await expect.poll(() => camera(page, 'pred')).toBe(await camera(page));
  const rotated = await camera(page);
  await page.mouse.wheel(0, -180);
  await expect.poll(() => camera(page)).not.toBe(rotated);
  await expect.poll(() => camera(page, 'pred')).toBe(await camera(page));
  const zoomed = await camera(page);
  await page.mouse.down({ button: 'right' });
  await page.mouse.move(bounds.x + bounds.width * 0.65, bounds.y + bounds.height * 0.55, {
    steps: 8,
  });
  await page.mouse.up({ button: 'right' });
  await expect.poll(() => camera(page)).not.toBe(zoomed);
  await expect.poll(() => camera(page, 'pred')).toBe(await camera(page));
  await page.getByRole('button', { name: 'Unlink cameras' }).click();
  const other = await camera(page, 'pred');
  await page.mouse.move(bounds.x + bounds.width * 0.5, bounds.y + bounds.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width * 0.35, bounds.y + bounds.height * 0.4, {
    steps: 8,
  });
  await page.mouse.up();
  expect(await camera(page, 'pred')).toBe(other);
  await page.getByRole('button', { name: 'Synchronize cameras' }).click();
  await page.getByRole('button', { name: 'Reset camera', exact: true }).click();
  await expect.poll(() => camera(page, 'pred')).toBe(await camera(page));
  await page.getByRole('button', { name: 'Hide tumor', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Show tumor', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Show tumor', exact: true }).click();
  await openRendering(page);
  await page.getByRole('slider', { name: 'Tumor opacity', exact: true }).fill('0.55');
  await expect(page.getByRole('slider', { name: 'Tumor opacity', exact: true })).toHaveValue(
    '0.55',
  );
  await openRendering(page);
  await page.getByRole('button', { name: 'Toggle MRI slice planes' }).click();
  await page.getByRole('slider', { name: 'axial slice' }).fill('60');
  await expect(page.getByRole('slider', { name: 'axial slice' })).toHaveValue('60');
  await page.getByRole('button', { name: 'Toggle MRI slice planes' }).click();
  await page.getByRole('button', { name: 'Fullscreen comparison' }).click();
  await expect.poll(() => page.evaluate(() => !!document.fullscreenElement)).toBe(true);
  await page.getByRole('button', { name: 'Fullscreen comparison' }).click();
  await expect.poll(() => page.evaluate(() => !!document.fullscreenElement)).toBe(false);
  await page.getByRole('button', { name: 'Reset camera', exact: true }).click();
  await openRendering(page);
  await page.getByRole('slider', { name: 'Tumor opacity', exact: true }).fill('0.95');
  await openRendering(page);
  await page.screenshot({
    path: 'test-results/workspace-desktop.png',
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
test('slice crosshair, modality, patient browser, and provenance', async ({ page }) => {
  await ready(page);
  const sagittal = page.getByRole('slider', { name: 'sagittal slice' }),
    coronal = page.getByRole('slider', { name: 'coronal slice' });
  const before = [await sagittal.inputValue(), await coronal.inputValue()];
  await page
    .getByRole('img', { name: 'Ground Truth axial MRI slice' })
    .click({ position: { x: 35, y: 35 } });
  expect([await sagittal.inputValue(), await coronal.inputValue()]).not.toEqual(before);
  const keyboardBefore = await sagittal.inputValue();
  await page.getByRole('img', { name: 'Ground Truth axial MRI slice' }).focus();
  await page.keyboard.press('ArrowRight');
  expect(await sagittal.inputValue()).not.toBe(keyboardBefore);
  await page.getByLabel('MRI modality', { exact: true }).selectOption('FLAIR');
  await expect(page.getByRole('slider', { name: 'axial slice' })).toBeVisible();
  await page.getByLabel('Evaluation region').selectOption('ET');
  await expect(page.getByTestId('dice-score')).toHaveText(/0\.\d{3}|1\.000/);
  await page.getByRole('button', { name: 'About these predictions' }).click();
  await expect(page.getByRole('dialog')).toContainText('not an independent estimate');
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await page.getByRole('button', { name: 'Open case browser' }).click();
  await page.getByLabel('Search cases').fill('00006');
  await expect(page.getByRole('button', { name: /Select UPENN-GBM-/ })).toHaveCount(1);
  await page.getByRole('button', { name: 'Select UPENN-GBM-00006_11' }).click();
  await expect(page.getByRole('slider', { name: 'axial slice' })).toBeVisible();
  await expect(page).toHaveURL(/case=UPENN-GBM-00006_11/);
  await page.getByRole('button', { name: 'Open case browser' }).click();
  await page.getByRole('button', { name: 'Clear search' }).click();
  await page.getByLabel('Filter tumor volume').selectOption('small');
  await page.getByLabel('Filter tumor volume').selectOption('all');
  await page.getByRole('button', { name: 'Close case browser', exact: true }).click();
  await page.getByText('Acquisition & export', { exact: true }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export case metrics' }).click();
  const exported = await download;
  expect(exported.suggestedFilename()).toBe('UPENN-GBM-00006_11-metrics.json');
  const data = JSON.parse(await readFile((await exported.path())!, 'utf8'));
  expect(data.caseId).toBe('UPENN-GBM-00006_11');
  expect(data.region).toBe('ET');
  expect(data.prediction.name).toBe('Published UPenn-GBM automated segmentation');
  expect(data.prediction.kind).toBe('demo');
  expect(data.metrics.WT.dice).toBeGreaterThan(0);
});
test('responsive layout, case switching, and recoverable errors', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await ready(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Open case browser' }).click();
  await expect(page.getByLabel('Patient browser')).toBeVisible();
  await page.getByRole('button', { name: 'Select UPENN-GBM-00008_11' }).click();
  await expect(page.getByRole('slider', { name: 'axial slice' })).toBeVisible();
  await page.getByRole('button', { name: 'MRI slices', exact: true }).click();
  await page.screenshot({
    path: 'test-results/workspace-mobile.png',
    fullPage: true,
  });
  await page.route('**/cases/UPENN-GBM-00009_11/T1GD.nii.gz', (route) =>
    route.fulfill({ status: 503, body: 'Unavailable' }),
  );
  await page.getByRole('button', { name: 'Next case', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Volume unavailable');
  await page.unroute('**/cases/UPENN-GBM-00009_11/T1GD.nii.gz');
  await page.getByRole('button', { name: 'Retry case' }).click();
  await expect(page.getByRole('slider', { name: 'axial slice' })).toBeVisible();
  await page.getByRole('button', { name: 'Next case', exact: true }).click();
  await page.getByRole('button', { name: 'Next case', exact: true }).click();
  await expect(page).toHaveURL(/case=UPENN-GBM-00013_11/);
  await expect(page.getByRole('slider', { name: 'axial slice' })).toBeVisible();
});
test('all prepared cases have available modalities, distinct masks, and valid artifacts', async ({
  request,
}) => {
  const manifest = await request.get('/data/manifest.json').then((r) => r.json());
  const validation = await request.get('/data/validation.json').then((r) => r.json());
  expect(manifest.cases).toHaveLength(40);
  expect(validation.passed).toBe(40);
  expect(validation.errors).toEqual([]);
  for (const record of manifest.cases) {
    expect(record.differentVoxels).toBeGreaterThan(0);
    expect((await request.head(record.modalities.T1GD)).ok()).toBe(true);
    expect((await request.head(record.brainMeshUrl)).ok()).toBe(true);
    expect(record.metrics.WT.dice).toBeGreaterThanOrEqual(0);
    expect(record.metrics.WT.dice).toBeLessThanOrEqual(1);
  }
});

test('themes persist and preserve the active review', async ({ page }) => {
  await ready(page);
  await page.getByRole('button', { name: 'Switch to dark mode' }).click();
  await page.getByRole('slider', { name: 'axial slice' }).fill('60');
  await page.getByLabel('Evaluation region').selectOption('ET');
  await openRendering(page);
  await page.getByRole('slider', { name: 'Tumor opacity', exact: true }).fill('0.55');
  await openRendering(page);
  const before = await camera(page),
    dice = await page.getByTestId('dice-score').textContent();
  await page.getByRole('button', { name: 'Switch to light mode' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  expect(await camera(page)).toBe(before);
  await expect(page.getByRole('slider', { name: 'axial slice' })).toHaveValue('60');
  await expect(page.getByTestId('dice-score')).toHaveText(dice!);
  await openRendering(page);
  await expect(page.getByRole('slider', { name: 'Tumor opacity', exact: true })).toHaveValue(
    '0.55',
  );
  await openRendering(page);
  await expect(page.getByRole('heading', { name: 'Prediction', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Switch to dark mode' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});
test('theme switching works when storage is unavailable', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(Storage.prototype, 'getItem', {
      value: () => {
        throw new Error('Storage blocked');
      },
    });
    Object.defineProperty(Storage.prototype, 'setItem', {
      value: () => {
        throw new Error('Storage blocked');
      },
    });
  });
  await ready(page);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.getByRole('button', { name: 'Switch to dark mode' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('button', { name: 'Switch to light mode' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});
test('review workspace at desktop, tablet, and mobile sizes', async ({ page }) => {
  await ready(page);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForLoadState('networkidle');
  await page.setViewportSize({ width: 1167, height: 990 });
  await expect.poll(() => camera(page, 'pred')).toBe(await camera(page));
  await page.screenshot({ path: '.impeccable/review/hero-repro.png' });
  for (const width of [1440, 1024, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1100 });
    await expect.poll(() => camera(page, 'pred')).toBe(await camera(page));
    for (const theme of ['dark', 'light']) {
      if ((await page.locator('html').getAttribute('data-theme')) !== theme)
        await page.getByRole('button', { name: `Switch to ${theme} mode` }).click();
      await expect(page.getByRole('slider', { name: 'axial slice' })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      expect(
        await page
          .locator('.slice-image')
          .first()
          .evaluate((element) => getComputedStyle(element).backgroundColor),
      ).toBe('rgb(0, 0, 0)');
      const view = JSON.parse(
        (await page.locator('[data-testid="canvas-gt"] canvas').getAttribute('data-camera'))!,
      );
      const distance = Math.hypot(
        ...view.position.map((n: number, i: number) => n - view.target[i]),
      );
      expect(distance).toBeGreaterThan(150);
      await expect.poll(() => camera(page, 'pred')).toBe(await camera(page));
      await page.screenshot({
        path: `.impeccable/review/workspace-${width}-${theme}.png`,
        fullPage: true,
      });
    }
  }
});

test('case filters, ordering, keyboard focus, and MRI display controls', async ({ page }) => {
  await ready(page);
  const manifest = await page.request.get('/data/manifest.json').then((r) => r.json());
  await page.getByRole('button', { name: 'Open case browser' }).click();
  await page.getByLabel('Filter tumor volume').selectOption('small');
  await expect(page.getByRole('button', { name: /Select UPENN-GBM-/ })).toHaveCount(
    manifest.cases.filter(
      (r: { metrics: { WT: { groundTruthMl: number } } }) => r.metrics.WT.groundTruthMl < 20,
    ).length,
  );
  await page.getByLabel('Filter tumor volume').selectOption('all');
  await page.getByLabel('Sort cases').selectOption('volume');
  const ordered = [...manifest.cases].sort(
    (
      a: { metrics: { WT: { groundTruthMl: number } } },
      b: { metrics: { WT: { groundTruthMl: number } } },
    ) => b.metrics.WT.groundTruthMl - a.metrics.WT.groundTruthMl,
  );
  await expect(page.getByRole('button', { name: /Select UPENN-GBM-/ }).first()).toHaveAttribute(
    'aria-label',
    `Select ${ordered[0].id}`,
  );
  await page.getByText('Agreement filter', { exact: false }).click();
  await page.getByLabel('Minimum Dice').fill('0.95');
  await expect(page.getByRole('button', { name: /Select UPENN-GBM-/ })).toHaveCount(
    manifest.cases.filter((r: { metrics: { WT: { dice: number } } }) => r.metrics.WT.dice >= 0.95)
      .length,
  );
  await page.getByLabel('Search cases').fill('no-such-patient');
  await expect(page.getByText('No matching cases.')).toBeVisible();
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await expect(page.getByRole('button', { name: /Select UPENN-GBM-/ })).toHaveCount(40);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Open case browser' })).toBeFocused();
  const image = page.getByRole('img', { name: 'Ground Truth axial MRI slice' });
  const before = await image.evaluate((element) => (element as HTMLCanvasElement).toDataURL());
  await page.getByText('Window / level', { exact: false }).click();
  await page.getByRole('slider', { name: 'MRI window', exact: true }).fill('150');
  await page.getByRole('slider', { name: 'MRI level', exact: true }).fill('90');
  expect(await image.evaluate((element) => (element as HTMLCanvasElement).toDataURL())).not.toBe(
    before,
  );
  await openRendering(page);
  await page.getByRole('slider', { name: 'Brain opacity', exact: true }).fill('0.4');
  await expect(page.getByRole('slider', { name: 'Brain opacity', exact: true })).toHaveValue('0.4');
});

test('dataset errors recover through reload', async ({ page }) => {
  await page.route('**/data/manifest.json', (route) =>
    route.fulfill({ status: 503, body: 'Unavailable' }),
  );
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Prepare your study cohort' })).toBeVisible();
  await page.unroute('**/data/manifest.json');
  await page.getByRole('button', { name: 'Reload dataset' }).click();
  await expect(page.getByRole('slider', { name: 'axial slice' })).toBeVisible();
});

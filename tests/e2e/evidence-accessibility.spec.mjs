import { test, expect } from '@playwright/test';

async function saveRun(page) {
  const response = page.waitForResponse(r => r.url().includes('/api/experiments') && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Recalculate Model Boundary', exact: true }).click();
  await page.getByRole('button', { name: 'Save Run', exact: true }).click();
  return (await (await response).json()).data;
}

test('F1: Playground history and analysis dock are keyboard operable', async ({ page }) => {
  await page.goto('/app/playground');
  await page.getByRole('button', { name: 'Recalculate Model Boundary', exact: true }).click();
  const toggle = page.getByRole('button', { name: 'Show history data table' });
  await toggle.focus(); await page.keyboard.press('Enter');
  await expect(page.getByRole('region', { name: 'Recorded Playground metric history' })).toBeVisible();
  await expect(page.getByRole('table', { name: 'Exact recorded training history, without inferred values' })).toBeVisible();
  const collapse = page.getByRole('button', { name: 'Collapse Playground analysis' });
  await collapse.focus(); await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Expand Playground analysis' })).toHaveAttribute('aria-expanded', 'false');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Collapse Playground analysis' })).toHaveAttribute('aria-expanded', 'true');
});

test('F1: Arena exposes the exact saved comparison evidence by keyboard', async ({ page }) => {
  await page.goto('/app/playground');
  const baseline = await saveRun(page);
  const variant = await saveRun(page);
  await page.goto('/app/arena');
  await page.getByRole('combobox', { name: 'Baseline', exact: true }).selectOption(baseline._id);
  await page.getByRole('combobox', { name: 'Variant', exact: true }).selectOption(variant._id);
  await expect(page.getByRole('status').filter({ hasText: 'Matched task' })).toBeVisible();
  const toggle = page.getByRole('button', { name: 'Show comparison data table' });
  await toggle.focus(); await page.keyboard.press('Enter');
  const region = page.getByRole('region', { name: 'Recorded comparison data' });
  await expect(region).toBeVisible();
  await expect(region.getByRole('columnheader', { name: 'Baseline train' })).toBeVisible();
  await expect(region.getByRole('columnheader', { name: 'Variant validation' })).toBeVisible();
  const epochs = region.getByRole('button', { name: /Inspect epoch/ });
  if (await epochs.count()) {
    await epochs.first().click();
    await expect(page.getByRole('slider', { name: 'Comparison epoch' })).toHaveValue(await epochs.first().innerText());
  } else {
    await expect(region.getByText('No epoch-level measurements were recorded.')).toBeVisible();
  }
  await page.getByRole('button', { name: 'Show comparison chart' }).click();
  await expect(page.getByRole('img', { name: /Recorded loss curves/ })).toBeVisible();
});

test('F1: Studio analysis dock and existing chart table support keyboard access', async ({ page }) => {
  await page.goto('/app/studio');
  const collapse = page.getByRole('button', { name: 'Collapse Studio training analysis' });
  await collapse.focus(); await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Expand Studio training analysis' })).toHaveAttribute('aria-expanded', 'false');
  await page.keyboard.press('Enter');
  const chart = page.getByRole('region', { name: 'Binary Cross-Entropy Loss chart' });
  const toggle = chart.getByRole('button', { name: 'Toggle accessible table view' });
  await toggle.focus(); await page.keyboard.press('Enter');
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await expect(chart.getByRole('table')).toBeVisible();
});

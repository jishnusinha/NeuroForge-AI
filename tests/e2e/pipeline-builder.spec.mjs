import { test, expect } from '@playwright/test';

test('F3: pipeline builder previews stratified membership and accepts median and split changes', async ({ page }) => {
  await page.goto('/app/datasets');
  await page.getByRole('button', { name: 'Try sample dataset' }).click();
  const prep = page.getByRole('region', { name: 'CSV preparation' });
  await expect(prep.getByRole('list', { name: 'Visual pipeline stages' })).toHaveCount(1);
  const preview = prep.getByRole('region', { name: 'Leakage-safe pipeline preview' });
  await expect(preview).toBeVisible();
  await expect(preview.getByRole('table', { name: /Observed training features only/ })).toBeVisible();
  await expect(preview.getByRole('table', { name: /First 8 original and transformed rows/ })).toBeVisible();
  await prep.getByRole('combobox', { name: 'CSV imputation' }).selectOption('median');
  await expect(prep.getByText('median (train-fitted)')).toBeVisible();
  await prep.getByRole('combobox', { name: 'CSV split preset' }).selectOption('80/10/10');
  await expect(prep.getByText('80/10/10 · seed 42')).toBeVisible();
  await expect(preview.getByText('120', { exact: true })).toHaveCount(0);
  await prep.getByRole('combobox', { name: 'CSV scaling' }).selectOption('minmax');
  await expect(prep.getByText('minmax (train-fitted)')).toBeVisible();
  await prep.getByRole('button', { name: 'Prepare for Playground' }).click();
  await expect(page).toHaveURL(/\/app\/playground$/);
  await expect(page.getByRole('button', { name: 'Recalculate Model Boundary', exact: true })).toBeVisible();
});

test('F3: incomplete CSV with no imputation fails closed, median produces a valid local preview', async ({ page }) => {
  await page.goto('/app/datasets');
  const csv = ['x,y,label',
    '1,2,0','2,4,0','3,6,0','4,8,0','5,10,0',
    '6,12,1','7,14,1','8,16,1','9,18,1','10,20,1',
    ',22,0','12,24,1'].join('\n');
  await page.getByLabel('CSV file').setInputFiles({ name: 'pipeline-missing.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
  const prep = page.getByRole('region', { name: 'CSV preparation' });
  await expect(prep.getByRole('region', { name: 'Leakage-safe pipeline preview' })).toBeVisible();
  await prep.getByRole('combobox', { name: 'CSV imputation' }).selectOption('none');
  await expect(prep.getByRole('status')).toContainText('NONFINITE_FEATURE');
  await prep.getByRole('button', { name: 'Prepare for Playground' }).click();
  await expect(prep.getByRole('alert')).toContainText('NONFINITE_FEATURE');
  await expect(page).toHaveURL(/\/app\/datasets$/);
  await prep.getByRole('combobox', { name: 'CSV imputation' }).selectOption('median');
  await expect(prep.getByRole('region', { name: 'Leakage-safe pipeline preview' })).toBeVisible();
  await prep.getByRole('button', { name: 'Prepare for Studio' }).click();
  await expect(page).toHaveURL(/\/app\/studio$/);
});

test('F3: invalid target is shown as an explicit preview issue rather than training silently', async ({ page }) => {
  await page.goto('/app/datasets');
  const csv = ['x,y,label','1,2,0','2,4,0','3,6,0','4,8,0','5,10,0','6,12,1','7,14,1','8,16,1','9,18,1','10,20,1'].join('\n');
  await page.getByLabel('CSV file').setInputFiles({ name: 'target.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
  const prep = page.getByRole('region', { name: 'CSV preparation' });
  await prep.getByRole('combobox', { name: 'CSV target' }).selectOption('x');
  await expect(prep.getByRole('status')).toContainText('Choose two different numeric inputs');
  await prep.getByRole('button', { name: 'Prepare for Playground' }).click();
  await expect(prep.getByRole('alert')).toContainText('Choose two different numeric inputs');
  await expect(page).toHaveURL(/\/app\/datasets$/);
});
